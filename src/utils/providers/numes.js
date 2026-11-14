import { fetchWithBackoff, hash, extractSseLines } from './_shared.js';
import { getMappedThinkingLevel } from '../../data/thinking_config.js';

// Numes — OpenAI Chat Completions compatible inference marketplace.
// Base: https://api.numes.ai/api/v1   Chat: POST /chat/completions
//
// Routing model notes (IMPORTANT — differs from Infron/OpenRouter):
//  - `provider` is a CLOSED schema. Unknown properties are rejected with 400.
//  - `sort`   : price | throughput | latency | quality      (no 'ttft')
//  - `only`   : provider slugs (display names are NOT selectors)
//  - `allow_fallbacks` is ALWAYS forced to false when a slug or sort is given,
//    so the chosen provider/order is respected strictly (no silent rerouting).
//  - There is NO `service_tier` field here (that is Infron-specific).
//
// Model string syntax supported by this module (routing + sorting only):
//   <slug>::<model>        -> provider.only = [slug]        (same as Infron)
//   <model>:price          -> provider.sort = 'price'
//   <model>:throughput     -> provider.sort = 'throughput'
//   <model>:latency        -> provider.sort = 'latency'
//   <model>:quality        -> provider.sort = 'quality'
// Suffixes are peeled right-to-left and can be chained, e.g.
//   `anthropic::claude-sonnet-4.5:throughput`

const VALID_SORTS = ['price', 'throughput', 'latency', 'quality'];

export const parseNumesModel = (model) => {
    let cleanModel = typeof model === 'string' ? model : String(model || '');
    const providerConfig = {};

    // 1) Explicit provider allowlist: slug::model
    if (cleanModel.includes('::')) {
        const dIdx = cleanModel.indexOf('::');
        const onlyProvider = cleanModel.slice(0, dIdx).trim();
        if (onlyProvider) providerConfig.only = [onlyProvider];
        cleanModel = cleanModel.slice(dIdx + 2).trim();
    }

    // 2) Peel trailing routing suffixes right-to-left
    if (cleanModel.includes(':')) {
        const parts = cleanModel.split(':');
        while (parts.length > 1) {
            const lastToken = parts[parts.length - 1].toLowerCase().trim();

            if (VALID_SORTS.includes(lastToken)) {
                providerConfig.sort = lastToken;
            } else {
                // Not a routing option (model sub-identifier, etc.) — stop peeling
                break;
            }
            parts.pop();
        }
        cleanModel = parts.join(':').trim();
    }

    // 3) Strict routing: any explicit provider slug or sort ⇒ never fall back
    if (providerConfig.only || providerConfig.sort) {
        providerConfig.allow_fallbacks = false;
    }

    return { cleanModel, providerPayload: Object.keys(providerConfig).length > 0 ? providerConfig : null };
};

export const getNumesStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0, chatId = null) {
    const { cleanModel, providerPayload } = parseNumesModel(model);

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
                            image_url: { url: `data:${mimeType};base64,${data}` }
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

    const customEffort = getMappedThinkingLevel('Numes', cleanModel, thinkingLevel);
    const reasoningEffortMap = {
        'Fast': 'none',
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'xhigh'
    };
    const effort = customEffort !== null ? customEffort : reasoningEffortMap[thinkingLevel];

    // Sticky session (docs §7): `session_id` groups a conversation for endpoint affinity,
    // which keeps prompt-cache prefixes warm and lets reasoning_details continuations
    // replay on the SAME endpoint. Same ingredients as OpenRouter/Mistral, plus the
    // resolved routing payload (provider.only / sort) since that narrows eligible endpoints.
    // Numes only receives this opaque hash, never the raw ingredients.
    const rawSessionId = `${(apiKey || '').slice(-5)}${chatId || ''}${thinkingLevel}${cleanModel}${providerPayload ? JSON.stringify(providerPayload) : ''}`;
    const sessionId = await hash(rawSessionId);

    const requestPayload = {
        model: cleanModel,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        tools: [],           // prevent models from falling back to API function calls
        tool_choice: 'none',
        session_id: sessionId  // body wins over the X-Session-Id header
    };

    if (providerPayload) {
        requestPayload.provider = providerPayload;
    }

    // Numes accepts `reasoning.effort`; `reasoning_effort` is an accepted alias.
    if (effort && effort !== 'none') {
        requestPayload.reasoning = { effort };
    }

    const baseUrl = process.env.NUMES_URL || 'https://api.numes.ai/api/v1/chat/completions';

    const headers = {
        'Content-Type': 'application/json',
        'X-Title': 'FluxFlow',
        'User-Agent': 'FluxFlow',
        'HTTP-Referer': 'https://fluxflow-cli.onrender.com/'
    };

    const effectiveKey = apiKey || process.env.NUMES_API_KEY || '';
    headers['Authorization'] = `Bearer ${effectiveKey}`;

    const response = await fetchWithBackoff(baseUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let errMsg = response.statusText;
        try {
            const errData = JSON.parse(raw);
            // Numes error envelope: { error: { code error_type } } }
            errMsg = errData.error?.message || errData.message || errMsg;
            if (errData.error?.metadata?.error_type) {
                errMsg += ` [${errData.error.metadata.error_type}]`;
            }
        } catch (e) {
            if (raw) errMsg = raw.slice(0, 300); // some ingress 429s are plain text
        }
        throw new Error(`Numes Error (${response.status}): ${errMsg}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;

    const flush = () => ({
        candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
        usageMetadata: latestUsageMetadata
    });

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { lines, uncompleted } = extractSseLines(buffer);
        buffer = uncompleted;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // blank lines + SSE comments

            if (trimmed === 'data: [DONE]') {
                if (pendingParts.length > 0 || hasNewData) {
                    yield flush();
                    pendingParts = [];
                }
                return;
            }

            let isDone = false;
            const jsonStr = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : null;

            if (jsonStr) {
                if (jsonStr === '[DONE]') {
                    isDone = true;
                } else {
                    try {
                        const parsed = JSON.parse(jsonStr);

                        // In-stream failure: HTTP stays 200, chunk carries `error`
                        if (parsed.error) {
                            const m = parsed.error.message || parsed.error.metadata?.error_type || 'stream error';
                            throw new Error(`Numes Stream Error: ${m}`);
                        }

                        if (parsed.usage) {
                            const u = parsed.usage;
                            latestUsageMetadata = {
                                totalTokenCount: u.total_tokens || ((u.prompt_tokens || 0) + (u.completion_tokens || 0)),
                                promptTokenCount: u.prompt_tokens || 0,
                                candidatesTokenCount: u.completion_tokens || 0,
                                cachedContentTokenCount: u.prompt_tokens_details?.cached_tokens
                                    || u.cache_read_input_tokens
                                    || 0,
                                thoughtsTokenCount: u.completion_tokens_details?.reasoning_tokens
                                    || u.reasoning_tokens
                                    || 0
                            };
                            hasNewData = true;
                        }

                        const choice = parsed.choices?.[0];
                        const delta = choice?.delta;

                        if (delta) {
                            // Read reasoning from ONE source only (docs warn about duplication)
                            let thought = delta.reasoning_content || delta.reasoning || null;
                            if (!thought && Array.isArray(delta.reasoning_details) && delta.reasoning_details.length > 0) {
                                thought = delta.reasoning_details
                                    .map(d => (d.type === 'reasoning.text' || !d.type) ? (d.text || '') : '')
                                    .filter(Boolean)
                                    .join('');
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

                        if (choice?.finish_reason === 'error') {
                            throw new Error('Numes Stream Error: generation failed before completion');
                        }
                    } catch (e) {
                        if (e && typeof e.message === 'string' && e.message.startsWith('Numes')) throw e;
                        // ignore malformed partial JSON
                    }
                }
            }

            if ((isDone || Date.now() - lastFlushTime >= 150) && hasNewData) {
                yield flush();
                pendingParts = [];
                lastFlushTime = Date.now();
                hasNewData = false;
            }

            if (isDone) break;
        }

        if (Date.now() - lastFlushTime >= 150 && hasNewData) {
            yield flush();
            pendingParts = [];
            lastFlushTime = Date.now();
            hasNewData = false;
        }
    }

    // Stream ended without [DONE] — flush whatever we have
    if (pendingParts.length > 0 || hasNewData) {
        yield flush();
    }
};
