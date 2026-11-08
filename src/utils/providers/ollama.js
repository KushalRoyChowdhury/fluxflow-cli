import { Ollama } from 'ollama';
import { getMappedThinkingLevel } from '../../data/thinking_config.js';
import { NULL_KEY_SENTINEL } from '../secrets_v2.js';

// Module-level in-memory cache for model thinking configs: Map<cacheKey, thinkingConfig | null>
const thinkingConfigCache = new Map();

async function getModelThinkingConfig(ollamaClient, host, model) {
    const cacheKey = `${host}::${model}`;
    if (thinkingConfigCache.has(cacheKey)) {
        return thinkingConfigCache.get(cacheKey);
    }

    try {
        const info = await ollamaClient.show({ model });
        const thinking = info?.thinking || null;
        thinkingConfigCache.set(cacheKey, thinking);
        return thinking;
    } catch {
        // Fallback gracefully if endpoint fails or doesn't support /api/show
        thinkingConfigCache.set(cacheKey, null);
        return null;
    }
}

function resolveThinkingParam(thinkingConfig, thinkingLevel) {
    const values = thinkingConfig?.values;
    const isBooleanConfig = Array.isArray(values) && values.some(v => typeof v === 'boolean');
    const isLevelConfig = Array.isArray(values) && values.some(v => typeof v === 'string');

    if (isBooleanConfig) {
        // Boolean values: [false, true]
        switch (thinkingLevel) {
            case 'Fast':
                return false;
            case 'Low':
            case 'Medium':
            case 'Standard':
            case 'High':
            case 'xHigh':
                return true;
            default:
                return true;
        }
    }

    if (isLevelConfig) {
        // String levels: e.g. ["low", "medium", "high"]
        switch (thinkingLevel) {
            case 'Fast':
                return values.includes('low') ? 'low' : false;
            case 'Low':
                return 'low';
            case 'Medium':
            case 'Standard':
                return 'medium';
            case 'High':
            case 'xHigh':
                return 'high';
            default:
                return 'medium';
        }
    }

    // Default fallback when model thinking config is unknown or missing
    const thinkMap = {
        'Fast': false,
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };
    return thinkMap[thinkingLevel] !== undefined ? thinkMap[thinkingLevel] : true;
}

export const getOllamaStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 1.0, endpointType = 'Cloud') {
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    for (const content of contents) {
        const role = content.role === 'user' ? 'user' : 'assistant';
        let text = '';
        const images = [];

        if (Array.isArray(content.parts)) {
            text = content.parts.map(p => p.text || '').filter(Boolean).join('\n');
            for (const p of content.parts) {
                const imgObj = p.inlineData || p.inline_data;
                if (imgObj && imgObj.data) {
                    images.push(imgObj.data);
                }
            }
        } else {
            text = content.text || '';
        }

        if (text || images.length > 0) {
            const msgObj = { role, content: text };
            if (images.length > 0) {
                msgObj.images = images;
            }
            messages.push(msgObj);
        }
    }

    // /key use --null: treat as keyless local endpoint (no Authorization header).
    const isNullKey = apiKey === NULL_KEY_SENTINEL;
    const isLocal = isNullKey || endpointType === 'Local' || !apiKey || apiKey === 'LOCAL';
    const host = isLocal
        ? (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434')
        : (process.env.OLLAMA_HOST || 'https://ollama.com');

    const ollamaOptions = { host };
    if (!isLocal && apiKey) {
        ollamaOptions.headers = { Authorization: 'Bearer ' + apiKey };
    }

    const ollamaClient = new Ollama(ollamaOptions);

    let pendingParts = [];
    let latestUsageMetadata = null;
    let lastFlushTime = Date.now();
    let hasNewData = false;

    const customThink = getMappedThinkingLevel('Ollama', model, thinkingLevel);
    let thinkParam;
    if (customThink !== null) {
        thinkParam = (customThink === 'false' || customThink === false) ? false : (customThink === 'true' || customThink === true) ? true : customThink;
    } else {
        const thinkingConfig = await getModelThinkingConfig(ollamaClient, host, model);
        thinkParam = resolveThinkingParam(thinkingConfig, thinkingLevel);
    }

    // Gemma 4 requires <|think|> in system prompt to trigger reasoning
    if (thinkParam && model && model.toLowerCase().includes('gemma4')) {
        const sysIdx = messages.findIndex(m => m.role === 'system');
        if (sysIdx !== -1) {
            if (!messages[sysIdx].content.includes('<|think|>')) {
                messages[sysIdx].content = `<|think|>\n${messages[sysIdx].content}`;
            }
        } else {
            messages.unshift({ role: 'system', content: '<|think|>' });
        }
    }

    const chatParams = {
        model: model,
        messages: messages,
        stream: true,
        think: thinkParam,
        keep_alive: '10m',
        tools: [], // Forcing models not to fallback to API function calls
        tool_choice: "none",
        options: { temperature }
    };

    const responseStream = await ollamaClient.chat(chatParams);

    for await (const chunk of responseStream) {
        if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }

        if (chunk.message?.thinking) {
            pendingParts.push({ text: chunk.message.thinking, thought: true });
            hasNewData = true;
        }

        if (chunk.message?.content) {
            pendingParts.push({ text: chunk.message.content });
            hasNewData = true;
        }

        if (chunk.done) {
            // 1. First check explicit fields returned by newer Ollama versions
            let cachedCount = chunk.prompt_eval_cached_count || 0;
            // Ollama finally started reporting cached tokens directly under `prompt_eval_cached_count`. We dont need to check '2' anymore on updated clients.

            // 2. Fallback to duration heuristic if explicit field is missing
            if (!cachedCount && chunk.prompt_eval_count) {
                const evalNs = chunk.prompt_eval_duration || 0;
                // Under ~50ms typically implies cache hits
                if (evalNs > 0 && evalNs < 50000000) {
                    cachedCount = chunk.prompt_eval_count;
                }
            }

            latestUsageMetadata = {
                totalTokenCount: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0),
                promptTokenCount: chunk.prompt_eval_count || 0,
                candidatesTokenCount: chunk.eval_count || 0,
                cachedContentTokenCount: cachedCount,
                thoughtsTokenCount: 0 // Note: Ollama does not natively return a separate sub-count for thoughts yet
            };
            hasNewData = true;
        }

        // Force an immediate flush if it's the final chunk (chunk.done),
        // ignoring the 150ms throttle rule so metadata isn't stranded.
        if (chunk.done || (Date.now() - lastFlushTime >= 150 && hasNewData)) {
            yield {
                candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
                usageMetadata: latestUsageMetadata
            };
            pendingParts = [];
            lastFlushTime = Date.now();
            hasNewData = false;
        }
    }


    if (hasNewData && (pendingParts.length > 0 || latestUsageMetadata)) {
        yield {
            candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
            usageMetadata: latestUsageMetadata
        };
    }
};
