import { fetchWithBackoff } from './_shared.js';
import { isModelMultimodal } from '../../data/model_config.js';

export const getNVIDIAStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal = false, signal, temperature = 1.0) {
    const messages = [];
    if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
    }

    contents.forEach(item => {
        const role = item.role === 'model' ? 'assistant' : 'user';
        const msgContent = [];

        if (Array.isArray(item.parts)) {
            item.parts.forEach(part => {
                if (part.text) {
                    msgContent.push({ type: 'text', text: part.text });
                } else if (part.inlineData && isMultiModal) {
                    const mimeType = part.inlineData.mimeType;
                    const data = part.inlineData.data;
                    const isImage = mimeType.startsWith('image/');

                    if (isImage && isModelMultimodal(model)) {
                        msgContent.push({
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${data}`
                            }
                        });
                    }
                }
            });
        }

        messages.push({
            role,
            content: (msgContent.length === 1 && msgContent[0].type === 'text') ? msgContent[0].text : msgContent
        });
    });

    const thinkingLevelMap = {
        'Fast': 'Fast',
        'Low': 'Fast',
        'Medium': 'Standard',
        'Standard': 'Standard',
        'High': 'High',
        'xHigh': 'High'
    };
    const apiLevel = thinkingLevelMap[thinkingLevel] || 'High';
    const isThinking = apiLevel !== 'Fast';

    const isKimi = model.includes('kimi');
    const isGemma = model.includes('gemma');
    const isDeepSeek = model.includes('deepseek');
    const isGlm = model.includes('glm');
    const isMistral = model.includes('mistral');
    const isMinimax = model.includes('minimax');
    const isGPT = model.includes('gpt');
    const isQwen = model.includes('qwen');
    const isNemotron = model.includes('nemotron');
    const isLlama3 = model.includes('llama-3');
    const isBytedance = model.includes('seed');
    const isPoolside = model.includes('poolside');
    const isThinkingmachines = model.includes('thinkingmachines') || model.includes('muse');

    const skipModels = isLlama3;

    const rpModels = null;

    const GPT_THINKING_LEVELS = {
        'Fast': 'low',
        'Low': 'low',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'high',
        'xHigh': 'high'
    };

    const BYTEDANCE_THINKING_BUDGETS = {
        'Fast': '64',
        'Low': '64',
        'Medium': '4096',
        'Standard': '4096',
        'High': '16384',
        'xHigh': '16384'
    };

    const THINKINGMACHINES_REASONING_VALUES = {
        'Fast': 'none',
        'Low': 'minimal',
        'Medium': 'medium',
        'Standard': 'medium',
        'High': 'max',
        'xHigh': 'max'
    };

    let maxTokens = (isMinimax || isDeepSeek || isPoolside || isThinkingmachines) ? 16384 : 32768;
    maxTokens = process.env.NVIDIA_BASE_URL ? 1024 : maxTokens;
    maxTokens = rpModels ? 1024 : maxTokens;

    const body = {
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        ...(isGPT && { thinking: GPT_THINKING_LEVELS[thinkingLevel] || 'high' })
    };

    if (process.env.NVIDIA_BASE_URL || skipModels || rpModels) {
        // Skip extra reasoning/thinking parameters for custom NVIDIA endpoints or skipable models
    } else if (isKimi) {
        body.chat_template_kwargs = { thinking: isThinking };
    } else if (isGemma) {
        body.chat_template_kwargs = { enable_thinking: isThinking };
    } else if (isDeepSeek) {
        if (isThinking) {
            const effort = apiLevel === 'High' ? 'max' : 'high';
            body.chat_template_kwargs = { thinking: true, reasoning_effort: effort };
        } else {
            body.chat_template_kwargs = { thinking: false };
        }
    } else if (isGlm) {
        body.chat_template_kwargs = { enable_thinking: isThinking, clear_thinking: !isThinking };
    } else if (isMistral) {
        body.reasoning_effort = isThinking ? 'high' : 'none';
    } else if (isMinimax && model.includes('minimax-m3')) {
        body.chat_template_kwargs = { thinking_mode: isThinking ? 'enabled' : 'disabled' };
    } else if (isQwen) {
        body.chat_template_kwargs = { enable_thinking: isThinking };
    } else if (isNemotron) {
        if (apiLevel === 'High') {
            body.chat_template_kwargs = { enable_thinking: true };
        } else if (apiLevel === 'Standard') {
            body.chat_template_kwargs = { enable_thinking: true, medium_effort: true };
        } else {
            body.chat_template_kwargs = { enable_thinking: false };
        }
    } else if (isBytedance) {
        if (isThinking) {
            body.extra_body = {
                thinking_budget: parseInt(BYTEDANCE_THINKING_BUDGETS[apiLevel] ?? '4096')
            };
        }
    } else if (isPoolside) {
        body.chat_template_kwargs = { enable_thinking: isThinking };
    } else if (isThinkingmachines) {
        body.reasoning_effort = THINKINGMACHINES_REASONING_VALUES[apiLevel] || 'medium';
    }

    let attempts = 0;
    const maxAttempts = 6;
    let hasYielded = false;

    let _baseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions';
    let _apiKey = process.env.NVIDIA_API_KEY && process.env.NVIDIA_BASE_URL ? process.env.NVIDIA_API_KEY : apiKey;
    if (!_baseUrl.endsWith('/chat/completions')) {
        _baseUrl = _baseUrl.replace(/\/+$/, '') + '/chat/completions';
    }

    while (attempts < maxAttempts) {
        // fs.appendFileSync("NVIDIA_REQUEST.txt", `${JSON.stringify(body)}\n\n`);
        attempts++;
        try {
            const response = await fetchWithBackoff(_baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${_apiKey}`
                },
                body: JSON.stringify(body),
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
                const error = new Error(`NVIDIA API Error (${response.status}): ${errMsg}`);
                error.status = response.status;
                throw error;
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
                        hasYielded = true;
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                // fs.appendFileSync("NVIDIA_STREAM_DEBUG.txt", `${decoder.decode(value)}\n\n`); // [DEBUGGING POINT]
                buffer = lines.pop();

                let isDone = false;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    if (trimmed === 'data: [DONE]') {
                        isDone = true;
                        break;
                    }
                    if (trimmed.startsWith('data: ')) {
                        let json;
                        try {
                            json = JSON.parse(trimmed.substring(6));
                        } catch (e) {
                            continue;
                        }

                        if (json.error) {
                            throw new Error(`NVIDIA Stream Error: ${json.error.message || JSON.stringify(json.error)}`);
                        }

                        try {
                            const usage = json.usage;
                            if (usage) {
                                latestUsageMetadata = {
                                    totalTokenCount: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens),
                                    promptTokenCount: usage.prompt_tokens || 0,
                                    candidatesTokenCount: usage.completion_tokens || 0,
                                    cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
                                    thoughtsTokenCount: (usage.completion_tokens_details?.reasoning_tokens || 0) + (usage.completion_tokens_details?.thoughts_tokens || 0)
                                };
                                hasNewData = true;
                            }

                            const thinking = json.choices?.[0]?.delta?.reasoning || json.choices?.[0]?.delta?.reasoning_content || '';
                            const content = json.choices?.[0]?.delta?.content || '';

                            if (thinking) {
                                pendingParts.push({ text: thinking, thought: true });
                                hasNewData = true;
                            }
                            if (content) {
                                pendingParts.push({ text: content });
                                hasNewData = true;
                            }
                        } catch (e) { }
                    }
                }

                if ((isDone || Date.now() - lastFlushTime >= 350) && hasNewData) {
                    // fs.appendFileSync('debug.log', JSON.stringify(pendingParts) + '\n');
                    yield {
                        candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
                        usageMetadata: latestUsageMetadata
                    };
                    hasYielded = true;
                    pendingParts = [];
                    lastFlushTime = Date.now();
                    hasNewData = false;
                }

                if (isDone) break;
            }

            // Stream completed successfully
            break;

        } catch (error) {
            // Only retry if we haven't yielded any tokens to the client yet
            if (hasYielded || attempts >= maxAttempts) {
                throw error;
            }
            // Wait 3 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 3500));
        }
    }
};

export const wrapNvidiaStreamWithQueueDepth = async function* (stream, modelName) {
    const queue = [];
    let resolveNext = null;
    let done = false;
    let error = null;

    const push = (item) => {
        queue.push(item);
        if (resolveNext) {
            const resolve = resolveNext;
            resolveNext = null;
            resolve();
        }
    };

    let cleanModelId = modelName.split('/').pop();

    // Llama 3.3 uses . while the API craves _
    cleanModelId = cleanModelId.replace('llama-3.3', 'llama-3_3');


    const pollUrl = `https://api.ngc.nvidia.com/v2/predict/queues/models/qc69jvmznzxy/${cleanModelId}`;

    let isStreamingStarted = false;
    let pollInterval = null;

    const poll = async () => {
        try {
            const res = await fetch(pollUrl);
            if (res.ok) {
                const data = await res.json();
                if (data && data.queues && data.queues[0] && typeof data.queues[0].queueDepth === 'number') {
                    const depth = data.queues[0].queueDepth;
                    if (!isStreamingStarted) {
                        push({ value: { type: 'status', content: `Queue ${depth || 1}` }, done: false });
                    }
                }
            } else if (!isStreamingStarted) {
                // push({ value: { type: 'status', content: `Queue ${res.status}` }, done: false });
            }
        } catch (e) {
            // Network-level error — no status code available, stay silent
        }

    };

    // Run first poll immediately unless custom NVIDIA_BASE_URL is set
    if (!process.env.NVIDIA_BASE_URL) {
        poll();
        pollInterval = setInterval(poll, 5000);
    }

    // Consume the raw stream in the background
    (async () => {
        try {
            const iterator = stream[Symbol.asyncIterator]();
            while (true) {
                const { value, done: streamDone } = await iterator.next();
                if (streamDone) {
                    break;
                }
                isStreamingStarted = true;
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                push({ value, done: false });
            }
            done = true;
            push(null);
        } catch (e) {
            error = e;
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            if (resolveNext) {
                const resolve = resolveNext;
                resolveNext = null;
                resolve();
            }
        }
    })();

    try {
        while (true) {
            if (error) {
                throw error;
            }
            if (queue.length > 0) {
                const item = queue.shift();
                if (item === null && done) {
                    break;
                }
                yield item.value;
            } else {
                if (done) {
                    break;
                }
                await new Promise((resolve) => {
                    resolveNext = resolve;
                });
            }
        }
    } finally {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }
};
