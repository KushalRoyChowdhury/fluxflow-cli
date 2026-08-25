import { fetchWithBackoff } from './_shared.js';

export const getInferXStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0) {
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    for (const content of contents) {
        const role = content.role === 'user' ? 'user' : 'assistant';
        let textContent = '';

        if (Array.isArray(content.parts)) {
            for (const part of content.parts) {
                if (part.text) {
                    textContent += (textContent ? '\n' : '') + part.text;
                }
            }
        } else {
            textContent = content.text || '';
        }

        messages.push({
            role,
            content: textContent
        });
    }

    const reasoningEffortMap = {
        'Fast': 'low',
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };

    const isSkipReasoningModel = model && model.toLowerCase().includes('qwen3.8-27b');
    const addThink = model && (model.toLowerCase().includes('qwen3.8-27b') || model.toLowerCase().includes('qwen3.6-35b-a3b-fp8'));

    const requestPayload = {
        model: model,
        messages: messages.filter(m => m.content && String(m.content).trim().length > 0),
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature
    };

    if (!isSkipReasoningModel) {
        requestPayload.stream_options = { include_usage: true };
        if (reasoningEffortMap[thinkingLevel]) {
            requestPayload.reasoning_effort = reasoningEffortMap[thinkingLevel];
        }
    }

    const response = await fetchWithBackoff('https://model.inferx.net/endpoints/v1/chat/completions', {
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
        let errorMsg = '';
        try {
            const errData = JSON.parse(errText);
            errorMsg = errData.error?.message
                || errData.error?.detail
                || errData.message
                || errData.detail
                || (typeof errData.error === 'string' ? errData.error : '')
                || (errText && errText !== '{}' ? errText : '');
        } catch {
            errorMsg = errText;
        }

        if (!errorMsg || errorMsg === '{}') {
            errorMsg = response.statusText || 'Unknown error';
        }

        throw new Error(`InferX Error (${response.status}): ${errorMsg}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;
    let isFirstChunk = true;

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
        // fs.appendFileSync("DEBUG.txt", `${lines}\n\n`);
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
                        const thought = delta.reasoning || delta.reasoning_content || null;
                        if (thought) {
                            pendingParts.push({ text: thought, thought: true });
                            hasNewData = true;
                        }
                        if (delta.content) {
                            let contentText = delta.content;
                            if (addThink && isFirstChunk && contentText.length > 0) {
                                contentText = '<think>' + contentText;
                                isFirstChunk = false;
                            }
                            pendingParts.push({ text: contentText });
                            hasNewData = true;
                        }
                    }
                } catch (e) { }
            }

            if ((isDone || Date.now() - lastFlushTime >= 150 || latestUsageMetadata) && hasNewData) {
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
