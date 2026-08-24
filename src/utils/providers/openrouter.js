import { fetchWithBackoff, hash } from './_shared.js';
import fs from 'fs';

export const getOpenRouterStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0, chatId = null) {
    const messages = [];
    if (systemInstruction) {
        messages.push({
            role: 'system',
            content: [
                {
                    type: 'text',
                    text: systemInstruction,
                    // cache_control: { type: 'ephemeral' }
                }
            ]
        });
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
                    } else {
                        msgContent.push({
                            type: 'file',
                            file: {
                                filename: part.filename || 'file',
                                file_data: `data:${mimeType};base64,${data}`
                            }
                        });
                    }
                }
            }
        } else {
            const text = content.text || '';
            if (text) msgContent.push({ type: 'text', text });
        }

        // Use simple string if it's only text, otherwise use array format
        messages.push({
            role,
            content: (msgContent.length === 1 && msgContent[0].type === 'text') ? msgContent[0].text : msgContent
        });
    }

    const reasoningEffortMap = {
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };

    const openRouterVariants = ['free', 'nitro', 'floor', 'exact', 'extended', 'beta', 'online'];
    let formattedModel = model;
    let providerConfig = null;

    if (model.includes(':')) {
        const parts = model.split(':');
        const lastPart = parts[parts.length - 1].toLowerCase().trim();
        if (!openRouterVariants.includes(lastPart)) {
            const provider = parts.pop().trim();
            formattedModel = parts.join(':').trim();
            if (provider) {
                providerConfig = {
                    order: [provider],
                    allow_fallbacks: false
                };
            }
        } else {
            formattedModel = model.trim();
        }
    }

    const rawId = `${apiKey.slice(-5)}${chatId || ''}${thinkingLevel}${formattedModel}${providerConfig ? JSON.stringify(providerConfig) : ''}`;
    const sessionId = await hash(rawId);

    const requestPayload = {
        model: formattedModel,
        messages: messages,
        stream: true,
        temperature: temperature,
        cache_control: { type: 'ephemeral' },
        session_id: sessionId
    };

    if (providerConfig) {
        requestPayload.provider = providerConfig;
    }

    const effort = reasoningEffortMap[thinkingLevel];
    if (effort && thinkingLevel !== 'Fast') {
        requestPayload.reasoning_effort = effort;
    }

    const response = await fetchWithBackoff('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://fluxflow-cli.onrender.com/',
            // 'HTTP-Referer': 'https://github.com/KushalRoyChowdhury/fluxflow-cli',
            'X-Title': 'FluxFlow CLI',
            'X-OpenRouter-Title': 'FluxFlow CLI',
            'X-Cache': 'true',
            'X-OpenRouter-Cache': 'true'
        },
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        // console.log(errData); // check errData.error.message for specifics
        const errorMsg = errData.error?.metadata?.raw
            || errData.error?.message
            || (typeof errData.error === 'string' ? errData.error : '')
            || response.statusText
            || 'Unknown error';
        throw new Error(`OpenRouter Error (${response.status}): ${errorMsg}`);
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
        // fs.appendFileSync('debug.txt', `${lines}\n\n`);
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
                    if (json.error) {
                        const streamErr = json.error.metadata?.raw || json.error.message || JSON.stringify(json.error);
                        throw new Error(`OpenRouter Stream Error: ${streamErr}`);
                    }
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
                            cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || usage.prompt_tokens_details?.cache_read_input_tokens || usage.cache_read_input_tokens || 0,
                            thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || 0
                        };
                        hasNewData = true;
                    }

                    if (delta) {
                        const thought = delta.reasoning || (delta.reasoning_details ? delta.reasoning_details.map(d => d.text).join('') : null);
                        if (thought) {
                            pendingParts.push({ text: thought, thought: true });
                            hasNewData = true;
                        }
                        if (delta.content) {
                            pendingParts.push({ text: delta.content });
                            hasNewData = true;
                        }
                    }
                } catch (e) {
                    if (e.message && e.message.startsWith('OpenRouter Stream Error:')) {
                        throw e;
                    }
                    // Ignore parse errors for partial chunks
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
    }
};
