import { Ollama } from 'ollama';

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

    const isLocal = endpointType === 'Local' || !apiKey || apiKey === 'LOCAL';
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

    const thinkMap = {
        'Fast': false,
        'Low': 'medium',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };
    const thinkParam = thinkMap[thinkingLevel] !== undefined ? thinkMap[thinkingLevel] : true;

    const chatParams = {
        model: model,
        messages: messages,
        stream: true,
        think: thinkParam,
        keep_alive: '10m',
        options: { temperature }
    };

    const responseStream = await ollamaClient.chat(chatParams);

    for await (const chunk of responseStream) {
        if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }

        // fs.appendFileSync("OLLAMA.txt", `${JSON.stringify(chunk, null, 2)}\n`)

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
            let cachedCount = chunk.prompt_cached_count || 0;

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
