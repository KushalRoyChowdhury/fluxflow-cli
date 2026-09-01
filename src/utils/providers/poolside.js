import { fetchWithBackoff } from './_shared.js';

export const getPoolsideStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0) {
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
                    const isImage = mimeType.startsWith('image/');

                    if (isImage) {
                        msgContent.push({
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${data}`
                            }
                        });
                    }
                }
            }
        } else {
            const text = content.text || '';
            if (text) msgContent.push({ type: 'text', text });
        }

        messages.push({
            role,
            content: (msgContent.length === 1 && msgContent[0].type === 'text') ? msgContent[0].text : msgContent
        });
    }

    const isThinkingDisabled = thinkingLevel === 'Fast';

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature
    };

    if (isThinkingDisabled) {
        requestPayload.chat_template_kwargs = { enable_thinking: false };
    }

    const response = await fetchWithBackoff('https://inference.poolside.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Poolside Error (${response.status}): ${errData.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;

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
                            thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || usage.reasoning_tokens || 0
                        };
                        hasNewData = true;
                    }

                    if (delta) {
                        const thought = delta.reasoning_content || delta.reasoning || null;
                        if (thought) {
                            pendingParts.push({ text: thought, thought: true });
                            hasNewData = true;
                        }
                        if (delta.content) {
                            pendingParts.push({ text: delta.content });
                            hasNewData = true;
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
