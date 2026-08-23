import { fetchWithBackoff, hash, convertChannelThinkTags } from './_shared.js';
import { hasModelReasoning } from '../../data/model_config.js';

export const getMistralStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0, chatId = null) {
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    for (const content of contents) {
        const role = content.role === 'user' ? 'user' : 'assistant';
        const msgContent = [];

        if (Array.isArray(content.parts)) {
            for (const part of content.parts) {
                if (part.text) {
                    msgContent.push({ type: 'text', text: part.text });
                } else if (part.inlineData && isMultiModal) {
                    const mimeType = part.inlineData.mimeType;
                    const data = part.inlineData.data;
                    if (mimeType.startsWith('image/')) {
                        // FIX #1: Mistral expects image_url as a direct string, not {url:...}
                        msgContent.push({
                            type: 'image_url',
                            image_url: `data:${mimeType};base64,${data}`
                        });
                    }
                }
            }
        } else {
            const text = content.text || '';
            if (text) msgContent.push({ type: 'text', text });
        }

        // FIX #2: Don't push messages with empty content
        if (msgContent.length > 0) {
            messages.push({
                role,
                content: (msgContent.length === 1 && msgContent[0].type === 'text') ? msgContent[0].text : msgContent
            });
        }
    }

    const reasoningEffortMap = {
        'Fast': 'none',
        'Low': 'none',
        'Medium': 'high',
        'Standard': 'high',
        'High': 'high',
        'xHigh': 'high'
    };

    const rawPromptCacheKey = `${apiKey.slice(-5)}${chatId || ''}${thinkingLevel}${model}`;
    const promptCacheKey = await hash(rawPromptCacheKey);

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        temperature: temperature,
        prompt_cache_key: promptCacheKey
    };

    if (thinkingLevel && thinkingLevel !== 'Fast' && hasModelReasoning(model)) {
        requestPayload.reasoning_effort = reasoningEffortMap[thinkingLevel] || 'high';
    }
    // console.log(hasModelReasoning(model));

    const response = await fetchWithBackoff('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = response.statusText;
        try {
            const errData = JSON.parse(errText);
            errMsg = errData.error?.message || errData.message || JSON.stringify(errData.detail || errData);
        } catch {
            if (errText) errMsg = errText;
        }
        throw new Error(`Mistral Error (${response.status}): ${JSON.stringify(errMsg)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;

    const parseChunkText = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return convertChannelThinkTags(val);
        if (Array.isArray(val)) {
            return val.map(parseChunkText).filter(Boolean).join('');
        }
        if (typeof val === 'object' && val !== null) {
            if (typeof val.text === 'string') return convertChannelThinkTags(val.text);
            if (typeof val.content === 'string') return convertChannelThinkTags(val.content);
            if (typeof val.thinking === 'string') return convertChannelThinkTags(val.thinking);
            if (typeof val.reasoning_content === 'string') return convertChannelThinkTags(val.reasoning_content);
            if (typeof val.reasoning === 'string') return convertChannelThinkTags(val.reasoning);
            if (typeof val.value === 'string') return convertChannelThinkTags(val.value);

            if (val.text) return parseChunkText(val.text);
            if (val.content) return parseChunkText(val.content);
            if (val.thinking) return parseChunkText(val.thinking);
            if (val.reasoning_content) return parseChunkText(val.reasoning_content);
            if (val.reasoning) return parseChunkText(val.reasoning);
            if (val.value) return parseChunkText(val.value);

            return '';
        }
        return convertChannelThinkTags(String(val));
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            if (hasNewData && (pendingParts.length > 0 || latestUsageMetadata)) {
                yield {
                    candidates: pendingParts.length > 0 ? [{ content: { parts: pendingParts } }] : [],
                    usageMetadata: latestUsageMetadata
                };
            }
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
            let isDone = false;
            if (cleanLine === 'data: [DONE]') {
                isDone = true;
            } else {
                try {
                    const json = JSON.parse(cleanLine.substring(6));
                    const delta = json.choices?.[0]?.delta;
                    const usage = json.usage;
                    if (json.choices?.[0]?.finish_reason) {
                        isDone = true;
                    }

                    if (usage) {
                        latestUsageMetadata = {
                            totalTokenCount: usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)),
                            promptTokenCount: usage.prompt_tokens || 0,
                            candidatesTokenCount: usage.completion_tokens || 0,
                            cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
                            thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || 0
                        };
                        hasNewData = true;
                    }

                    if (delta) {
                        const rawThought = delta.thinking || delta.reasoning_content || delta.reasoning;
                        const thoughtText = parseChunkText(rawThought);
                        if (thoughtText) {
                            pendingParts.push({ text: thoughtText, thought: true });
                            hasNewData = true;
                        }

                        const rawContent = delta.content || (!delta.thinking && !delta.reasoning_content && !delta.reasoning ? delta.text : null);
                        if (rawContent) {
                            if (Array.isArray(rawContent)) {
                                for (const item of rawContent) {
                                    if (typeof item === 'object' && item !== null) {
                                        const isThought = item.type === 'thinking' || item.type === 'reasoning' || Boolean(item.thought);
                                        const txt = parseChunkText(item);
                                        if (txt) {
                                            pendingParts.push({ text: txt, ...(isThought ? { thought: true } : {}) });
                                            hasNewData = true;
                                        }
                                    } else {
                                        const txt = parseChunkText(item);
                                        if (txt) {
                                            pendingParts.push({ text: txt });
                                            hasNewData = true;
                                        }
                                    }
                                }
                            } else if (typeof rawContent === 'object' && rawContent !== null) {
                                const isThought = rawContent.type === 'thinking' || rawContent.type === 'reasoning' || Boolean(rawContent.thought);
                                const txt = parseChunkText(rawContent);
                                if (txt) {
                                    pendingParts.push({ text: txt, ...(isThought ? { thought: true } : {}) });
                                    hasNewData = true;
                                }
                            } else {
                                const contentText = parseChunkText(rawContent);
                                if (contentText) {
                                    pendingParts.push({ text: contentText });
                                    hasNewData = true;
                                }
                            }
                        }
                    }
                } catch (e) { }
            }

            if ((isDone || Date.now() - lastFlushTime >= 150) && hasNewData) {
                yield {
                    candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
                    usageMetadata: latestUsageMetadata
                };
                pendingParts = [];
                lastFlushTime = Date.now();
                hasNewData = false;
            }

            if (isDone) break;
        }

        if (Date.now() - lastFlushTime >= 150 && hasNewData) {
            yield {
                candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
                usageMetadata: latestUsageMetadata
            };
            pendingParts = [];
            lastFlushTime = Date.now();
            hasNewData = false;
        }
    }
};
