import { fetchWithBackoff } from './_shared.js';
import { getMappedThinkingLevel } from '../../data/thinking_config.js';

/**
 * Universally Compatible Custom OpenAI-compatible Provider Stream
 * Supports various OpenAI dialects, base URL variations, reasoning fields, and streaming payloads.
 */
export const getCustomOpenAIStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0, baseUrl = '') {
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

    const customEffort = getMappedThinkingLevel('c_openai', model, thinkingLevel);
    const reasoningEffortMap = {
        'Fast': 'none',
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

    if (effort && effort !== 'none') {
        requestPayload.reasoning_effort = effort;
        requestPayload.reasoning = { effort: effort };
    }

    // Comprehensive URL normalization:
    // User may supply:
    //  - http://localhost:8000
    //  - http://localhost:8000/
    //  - http://localhost:8000/v1
    //  - http://localhost:8000/v1/
    //  - http://localhost:8000/api/v1
    //  - http://localhost:8000/v1/chat/completions
    //  - http://localhost:8000/chat/completions
    let rawEndpoint = (baseUrl || process.env.CUSTOM_OPENAI_URL || process.env.C_OPENAI_URL || '').trim();
    if (!rawEndpoint) {
        throw new Error('Custom OpenAI Base URL is not configured. Please set Base URL in /settings -> Providers.');
    }

    let targetUrl = rawEndpoint.replace(/\/+$/, '');
    if (!targetUrl.endsWith('/chat/completions')) {
        if (targetUrl.endsWith('/v1')) {
            targetUrl = `${targetUrl}/chat/completions`;
        } else {
            // Check if user already provided /v1/chat/completions or just domain
            targetUrl = `${targetUrl}/chat/completions`;
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, application/json',
        'X-Title': 'Flux-Flow',
        'User-Agent': 'Flux-Flow'
    };

    const effectiveKey = (apiKey && apiKey !== 'LOCAL') ? apiKey : (process.env.CUSTOM_OPENAI_API_KEY || process.env.C_OPENAI_API_KEY || '');
    if (effectiveKey && effectiveKey.trim() !== '') {
        const trimmedKey = effectiveKey.trim();
        headers['Authorization'] = trimmedKey.startsWith('Bearer ') ? trimmedKey : `Bearer ${trimmedKey}`;
        headers['api-key'] = trimmedKey; // Azure & custom gateway compatibility
    }

    let response = await fetchWithBackoff(targetUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    // Fallback Cascade: If strict server rejects combined parameters (HTTP 400 or 422),
    // 1. Try with `reasoning: { effort }` only (for Infron / OneRouter / custom Anthropic proxies)
    // 2. Try with `reasoning_effort` only (for standard OpenAI / OpenRouter)
    // 3. Fallback to clean payload without reasoning parameters
    if (!response.ok && (response.status === 400 || response.status === 422) && (requestPayload.reasoning || requestPayload.reasoning_effort)) {
        console.info("\n");
        // Step 1: Try reasoning: { effort } ONLY (remove reasoning_effort)
        if (requestPayload.reasoning && requestPayload.reasoning_effort) {
            const reasoningOnlyPayload = { ...requestPayload };
            delete reasoningOnlyPayload.reasoning_effort;
            const retryReasoning = await fetchWithBackoff(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(reasoningOnlyPayload),
                signal: signal
            }).catch(() => null);

            if (retryReasoning && retryReasoning.ok) {
                response = retryReasoning;
            }
        }

        // Step 2: If still failing, try reasoning_effort ONLY (remove reasoning object)
        if (!response.ok && requestPayload.reasoning_effort) {
            const effortOnlyPayload = { ...requestPayload };
            delete effortOnlyPayload.reasoning;
            const retryEffort = await fetchWithBackoff(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(effortOnlyPayload),
                signal: signal
            }).catch(() => null);

            if (retryEffort && retryEffort.ok) {
                response = retryEffort;
            }
        }

        // Step 3: If both styles were rejected, try completely plain payload without reasoning parameters
        if (!response.ok) {
            const plainPayload = { ...requestPayload };
            delete plainPayload.reasoning;
            delete plainPayload.reasoning_effort;
            const retryPlain = await fetchWithBackoff(targetUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(plainPayload),
                signal: signal
            }).catch(() => null);

            if (retryPlain && retryPlain.ok) {
                response = retryPlain;
            }
        }
    }

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errDetail = errData.error?.metadata?.raw
            || errData.error?.message
            || (typeof errData.error === 'string' ? errData.error : '')
            || errData.message
            || response.statusText
            || 'Unknown error';
        throw new Error(`Custom OpenAI Error (${response.status}): ${errDetail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;

    // Helper to safely extract reasoning/thinking across different model APIs
    const extractThought = (delta, choiceObj) => {
        if (!delta && !choiceObj) return null;

        // 1. Direct fields on delta
        if (delta) {
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) return delta.reasoning_content;
            if (typeof delta.reasoning === 'string' && delta.reasoning) return delta.reasoning;
            if (typeof delta.thinking === 'string' && delta.thinking) return delta.thinking;
            if (typeof delta.thought === 'string' && delta.thought) return delta.thought;
            if (typeof delta.reasoning_text === 'string' && delta.reasoning_text) return delta.reasoning_text;

            // 2. Structured reasoning_details array (OpenRouter, DeepSeek proxies)
            if (Array.isArray(delta.reasoning_details) && delta.reasoning_details.length > 0) {
                const combined = delta.reasoning_details
                    .map(d => (typeof d === 'string' ? d : (d?.text || d?.content || '')))
                    .filter(Boolean)
                    .join('');
                if (combined) return combined;
            }
        }

        // 3. Choice-level reasoning (some local gateways like LM Studio / vLLM variants)
        if (choiceObj) {
            if (typeof choiceObj.reasoning_content === 'string' && choiceObj.reasoning_content) return choiceObj.reasoning_content;
            if (typeof choiceObj.reasoning === 'string' && choiceObj.reasoning) return choiceObj.reasoning;
        }

        return null;
    };

    // Helper to extract content text across dialects
    const extractContent = (delta, choiceObj) => {
        if (delta) {
            if (typeof delta.content === 'string' && delta.content) return delta.content;
            if (typeof delta.text === 'string' && delta.text) return delta.text;
            if (Array.isArray(delta.content)) {
                return delta.content.map(p => (typeof p === 'string' ? p : (p?.text || ''))).join('');
            }
        }
        if (choiceObj) {
            if (typeof choiceObj.text === 'string' && choiceObj.text) return choiceObj.text;
        }
        return '';
    };

    // Helper to extract token usage across formats
    const extractUsage = (json) => {
        const u = json.usage || json.usageMetadata || json.choices?.[0]?.usage || null;
        if (!u) return null;

        const promptTokens = u.prompt_tokens || u.promptTokenCount || u.input_tokens || 0;
        const completionTokens = u.completion_tokens || u.candidatesTokenCount || u.output_tokens || 0;
        const totalTokens = u.total_tokens || u.totalTokenCount || (promptTokens + completionTokens);

        const cachedTokens = u.prompt_tokens_details?.cached_tokens
            || u.prompt_tokens_details?.cache_read_input_tokens
            || u.cachedContentTokenCount
            || u.cache_read_input_tokens
            || 0;

        const thoughtsTokens = u.completion_tokens_details?.reasoning_tokens
            || u.thoughtsTokenCount
            || u.reasoning_tokens
            || 0;

        return {
            totalTokenCount: totalTokens,
            promptTokenCount: promptTokens,
            candidatesTokenCount: completionTokens,
            cachedContentTokenCount: cachedTokens,
            thoughtsTokenCount: thoughtsTokens
        };
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
            if (cleanLine === 'data: [DONE]' || cleanLine === 'data: [DONE]\r') {
                isDone = true;
            } else {
                try {
                    const json = JSON.parse(cleanLine.substring(6));
                    if (json.error) {
                        const streamErr = json.error.metadata?.raw || json.error.message || (typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
                        throw new Error(`Custom OpenAI Stream Error: ${streamErr}`);
                    }

                    const choice = json.choices?.[0];
                    const delta = choice?.delta;

                    if (choice?.finish_reason && choice.finish_reason !== 'null') {
                        isDone = true;
                    }

                    const usageMeta = extractUsage(json);
                    if (usageMeta) {
                        latestUsageMetadata = usageMeta;
                        hasNewData = true;
                    }

                    const thought = extractThought(delta, choice);
                    if (thought) {
                        pendingParts.push({ text: thought, thought: true });
                        hasNewData = true;
                    }

                    const contentText = extractContent(delta, choice);
                    if (contentText) {
                        pendingParts.push({ text: contentText });
                        hasNewData = true;
                    }
                } catch (e) {
                    if (e.message && e.message.startsWith('Custom OpenAI Stream Error:')) {
                        throw e;
                    }
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
