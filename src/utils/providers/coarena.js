import { fetchWithBackoff , extractSseLines} from './_shared.js';
import { getMappedThinkingLevel } from '../../data/thinking_config.js';

export const getCoArenaStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0) {
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

    const customEffort = getMappedThinkingLevel('CoArena', model, thinkingLevel);
    const reasoningEffortMap = {
        'Fast': 'low',
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'xhigh'
    };
    const effort = customEffort !== null ? customEffort : reasoningEffortMap[thinkingLevel];

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        tools: [],
        tool_choice: "none"
    };

    if (effort) {
        requestPayload.reasoning_effort = effort;
    }

    const baseUrl = process.env.COARENA_URL || 'https://coarena.ai/api/v1/chat/completions';

    const headers = {
        'Content-Type': 'application/json',
        'X-Title': 'FluxFlow',
        'User-Agent': 'FluxFlow',
        'HTTP-Referer': 'https://fluxflow-cli.onrender.com/'
    };

    const effectiveKey = apiKey || process.env.COARENA_API_KEY || '';
    headers['Authorization'] = `Bearer ${effectiveKey}`;

    const response = await fetchWithBackoff(baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`CoArena Error (${response.status}): ${errData.error?.message || errData.message || response.statusText}`);
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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { lines, uncompleted } = extractSseLines(buffer);
        buffer = uncompleted;

        // Keep uncompleted line in buffer

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // Ignore empty lines and SSE comments

            if (trimmed === 'data: [DONE]') {
                if (pendingParts.length > 0) {
                    yield {
                        candidates: [{ content: { parts: [...pendingParts] } }],
                        usageMetadata: latestUsageMetadata
                    };
                    pendingParts = [];
                }
                return;
            }

            let isDone = false;
            if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.slice(6);
                if (jsonStr === '[DONE]') {
                    isDone = true;
                } else {
                    try {
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.usage) {
                            latestUsageMetadata = {
                                promptTokenCount: parsed.usage.prompt_tokens,
                                candidatesTokenCount: parsed.usage.completion_tokens,
                                totalTokenCount: parsed.usage.total_tokens,
                                cachedContentTokenCount: parsed.usage.prompt_tokens_details?.cached_tokens
                                    || parsed.usage.prompt_tokens_details?.cache_read_input_tokens
                                    || parsed.usage.cachedContentTokenCount
                                    || parsed.usage.cache_read_input_tokens
                                    || 0,
                                thoughtsTokenCount: parsed.usage.completion_tokens_details?.reasoning_tokens
                                    || parsed.usage.thoughtsTokenCount
                                    || parsed.usage.reasoning_tokens
                                    || 0
                            };
                        }

                        const choice = parsed.choices?.[0];
                        const delta = choice?.delta;

                        if (delta) {
                            let thought = delta.reasoning_content || delta.reasoning || null;
                            if (!thought && Array.isArray(delta.reasoning_details) && delta.reasoning_details.length > 0) {
                                thought = delta.reasoning_details.map(d => d.text || '').filter(Boolean).join('');
                            }

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
