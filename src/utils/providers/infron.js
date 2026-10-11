import { fetchWithBackoff } from './_shared.js';
import { getMappedThinkingLevel } from '../../data/thinking_config.js';
// import fs from 'fs';

export const getInfronStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0) {
    let cleanModel = model;
    let providerPayload = null;

    if (typeof cleanModel === 'string') {
        const providerConfig = {};

        // 1. Check for provider prefix: provider::model
        if (cleanModel.includes('::')) {
            const dIdx = cleanModel.indexOf('::');
            const onlyProvider = cleanModel.slice(0, dIdx).trim();
            if (onlyProvider) {
                providerConfig.only = [onlyProvider];
            }
            cleanModel = cleanModel.slice(dIdx + 2).trim();
        }

        // 2. Token-based scanning for suffixes: :quant, :sort, :tier
        const VALID_SERVICE_TIERS = ['flex', 'standard', 'priority'];
        const VALID_QUANTIZATIONS = {
            'fp16': 'fp16',
            'f16': 'fp16',
            'fp8': 'fp8',
            'f8': 'fp8',
            'int8': 'int8',
            'in8': 'int8',
            'int4': 'int4',
            'in4': 'int4'
        };
        const VALID_SORTS = ['throughput', 'latency', 'price', 'ttft'];

        if (cleanModel.includes(':')) {
            const parts = cleanModel.split(':');
            // Scan trailing tokens as long as they match recognized provider options
            while (parts.length > 1) {
                const lastToken = parts[parts.length - 1].toLowerCase().trim();

                if (VALID_SERVICE_TIERS.includes(lastToken)) {
                    providerConfig.service_tier = lastToken;
                    providerConfig.allow_fallbacks = false;
                    parts.pop();
                } else if (VALID_QUANTIZATIONS[lastToken]) {
                    providerConfig.quantizations = [VALID_QUANTIZATIONS[lastToken]];
                    providerConfig.allow_fallbacks = false;
                    parts.pop();
                } else if (VALID_SORTS.includes(lastToken)) {
                    providerConfig.sort = lastToken;
                    providerConfig.allow_fallbacks = false;
                    parts.pop();
                } else {
                    // Not a provider option (e.g. :free or model sub-identifier), stop peeling
                    break;
                }
            }
            cleanModel = parts.join(':').trim();
        }

        if (Object.keys(providerConfig).length > 0) {
            providerPayload = providerConfig;
        }
    }

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

    const customEffort = getMappedThinkingLevel('Infron', cleanModel, thinkingLevel);
    const reasoningEffortMap = {
        'Fast': 'none',
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };
    const effort = customEffort !== null ? customEffort : reasoningEffortMap[thinkingLevel];

    const requestPayload = {
        model: cleanModel,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        tools: [], // Forcing models not to fallback to API function calls
        tool_choice: "none"
    };

    if (providerPayload) {
        requestPayload.provider = providerPayload;
    }

    if (effort) {
        requestPayload.reasoning = { effort };
    }

    const baseUrl = process.env.INFRON_URL || 'https://llm.onerouter.pro/v1/chat/completions';

    const headers = {
        'Content-Type': 'application/json',
        'X-Title': 'Flux-Flow',
        'User-Agent': 'Flux-Flow',
        'HTTP-Referer': 'https://fluxflow-cli.onrender.com/'
    };

    const effectiveKey = apiKey || process.env.INFRON_API_KEY || '';
    headers['Authorization'] = `Bearer ${effectiveKey}`;

    const response = await fetchWithBackoff(baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Infron Error (${response.status}): ${errData.error?.message || errData.message || response.statusText}`);
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
