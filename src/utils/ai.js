import { GoogleGenAI, ThinkingLevel, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { getSystemInstruction, getJanitorInstruction, getMemoryPrompt } from './prompts.js';
import { getTruncatedHistory, loadHistory } from './history.js';
import { checkQuota, incrementUsage, addToUsage } from './usage.js';
import { dispatchTool } from './tools.js';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { parseArgs } from './arg_parser.js';
import { fileURLToPath } from 'url';
import path, { normalize } from 'path';
import fs from 'fs';
import { view_file } from '../tools/view_file.js';
import { emojiSpace } from './terminal.js';
import { applyPatches, generateHighFidelityDiff, parsePatchPairs } from './text.js';
import { loadSettings } from './settings.js';
import { subagentProgress } from './subagent_state.js';
import { isModelMultimodal, getFallbackValue } from '../data/model_config.js';
import { getProviderAPIKey } from './secrets.js';

import { LOGS_DIR, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, MEMORIES_FILE, PATHS_FILE, SECRET_DIR } from './paths.js';
import { RevertManager } from './revert.js';
import { AdvanceRevertManager } from './advanceRevert.js';
import { openFileInEditor, highlightDiffInEditor, getIDEContext, showDiffInIDE, closeDiffInIDE, isBridgeConnected, registerSecurityListener } from './editor.js';

let client = null;
let globalSettings = {};

const colorMainWords = (label) => {
    if (!label) return label;
    return label.replace(/(?:(\x1b\[\d+m))?([✔✘✖🔍📖→➕↻•🛇])(?:(\x1b\[\d+m))?\s*\b(Created|Read|Edited|Viewed|Auto-Read|List|Generated|Written|Searched|Get Map|Write Canceled|Edit Canceled|Write Cancelled|Edit Denied|Visited|Updated|Reviewed|Delegated|Background|Checked|Indexed|Analyzed|Browsed|Elevating SubAgent|Checking SubAgent Work|Started Generalist|Called Generalist|Unsupported Modality|Awaiting|Cancelled|Aligning Moon Phase|Contemplating Existence|Staring At Void|Rollback Point Checked|Emergency Rollback Failed|Emergency Rollback|Delaying Professionally|Negotiating With Electrons|Touching Grass (virtually)|Panicking Softly|Rethinking Career Choices|Loading Cat Videos|Giving Up Entirely|Summoning Braincell #2|Pretending To Be Busy|Waiting For Motivation DLC|Rotating Internal Screaming|Downloading More RAM|Feeding The Hamsters|Gaslighting Scheduler|Performing Dramatic Pause|Buffering Social Energy|Calculating Regret|Reading Terms And Conditions|Becoming Sentient Briefly|Contacting Ancestors)\b/ig, (match, ansiBefore, icon, ansiAfter, word) => {
        return `${ansiBefore || ''}${icon}${ansiAfter || ''} \x1b[95m${word}\x1b[0m`;
    });
};

const withRetry = async (fn, maxRetries = 8, initialDelayMs = 1000, maxDelayMs = 8000, signal = null) => {
    let attempt = 0;
    while (true) {
        if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }
        try {
            return await fn();
        } catch (error) {
            if (signal?.aborted || error?.name === 'AbortError' || error?.message === 'Subagent task was cancelled.') {
                throw error;
            }
            attempt++;
            if (attempt >= maxRetries) {
                throw error;
            }
            const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, delay);
                if (signal) {
                    signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new DOMException('The user aborted a request.', 'AbortError'));
                    });
                }
            });
        }
    }
};

let TERMINATION_SIGNAL = false;

export { isModelMultimodal };


export const getCleanGroupedLength = (rawHistory) => {
    const preprocessed = rawHistory
        .filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') &&
            m.role !== 'think' &&
            !m.isVisualFeedback &&
            !m.isMeta &&
            !String(m.id).startsWith('welcome')
        )
        .map((m, idx, arr) => {
            let text = m.fullText || m.text || '';
            if (m.role === 'user' && idx < arr.length - 1) {
                if (text.includes('**CONTEXT SUMMARY OF PREVIOUS TURNS')) {
                    const summaryIndex = text.indexOf('**CONTEXT SUMMARY OF PREVIOUS TURNS');
                    if (summaryIndex !== -1) {
                        const prefix = text.substring(0, summaryIndex);
                        const metadataIndex = prefix.lastIndexOf('[SYSTEM METADATA]');
                        if (metadataIndex !== -1) {
                            text = text.substring(metadataIndex).trim();
                        } else {
                            text = text.substring(summaryIndex).trim();
                        }
                    }
                } else {
                    const userIndex = text.lastIndexOf('[USER]');
                    const userPromptIndex = text.lastIndexOf('[USER PROMPT]');
                    if (userIndex !== -1) {
                        text = text.substring(userIndex + 6).trim();
                    } else if (userPromptIndex !== -1) {
                        text = text.substring(userPromptIndex).trim();
                    }
                }
            }
            return { ...m, text };
        });

    const cleanHistoryForAI = [];
    let i = 0;
    while (i < preprocessed.length) {
        const msg = preprocessed[i];
        if (msg.role === 'user') {
            cleanHistoryForAI.push(msg);
            i++;
        } else {
            const turnMessages = [];
            while (i < preprocessed.length && preprocessed[i].role !== 'user') {
                turnMessages.push(preprocessed[i]);
                i++;
            }

            const toolCalls = [];
            const toolResults = [];
            const finalResponses = [];

            turnMessages.forEach(tm => {
                const textLower = (tm.text || '').toLowerCase();
                const hasTool = textLower.includes('tool:functions.') || textLower.includes('agent:generalist.');
                const isResult = tm.role === 'system' && (
                    tm.text?.startsWith('[TOOL RESULT]') ||
                    tm.text?.startsWith('SUCCESS:') ||
                    tm.text?.startsWith('ERROR:') ||
                    tm.text?.startsWith('[TERMINAL_RECORD]') ||
                    tm.isTerminalRecord
                );

                if (tm.role === 'agent') {
                    if (hasTool) {
                        toolCalls.push(tm.text);
                    } else {
                        finalResponses.push(tm.text);
                    }
                } else if (isResult) {
                    toolResults.push(tm.text);
                } else {
                    finalResponses.push(tm.text);
                }
            });

            if (toolCalls.length > 0) {
                cleanHistoryForAI.push({ role: 'agent', text: 'combined' });
            }
            if (toolResults.length > 0) {
                cleanHistoryForAI.push({ role: 'system', text: 'combined' });
            }
            if (finalResponses.length > 0) {
                cleanHistoryForAI.push({ role: 'agent', text: 'combined' });
            }
        }
    }
    return cleanHistoryForAI.length;
};


const stripAnsi = (str) => {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    const signal = options?.signal;
    for (let i = 0; i < retries; i++) {
        if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }
        try {
            const response = await fetch(url, options);
            // Clear performance measures to prevent undici/fetch buffer overflow (Node 18+)
            if (typeof performance !== 'undefined' && performance.clearMeasures) {
                performance.clearMeasures();
                performance.clearMarks();
            }
            if (response.ok) return response;
            if (response.status !== 429 && response.status < 500) return response;
        } catch (e) {
            if (typeof performance !== 'undefined' && performance.clearMeasures) {
                performance.clearMeasures();
                performance.clearMarks();
            }
            if (e.name === 'AbortError' || signal?.aborted) throw e;
            if (i === retries - 1) throw e;
        }
        if (signal) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    signal.removeEventListener('abort', abortHandler);
                    resolve();
                }, Math.min(24000, delay * Math.pow(2, i)));
                const abortHandler = () => {
                    clearTimeout(timer);
                    reject(new DOMException('The user aborted a request.', 'AbortError'));
                };
                signal.addEventListener('abort', abortHandler);
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, Math.min(24000, delay * Math.pow(2, i))));
        }
    }
    if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
    }
    const response = await fetch(url, options);
    if (typeof performance !== 'undefined' && performance.clearMeasures) {
        performance.clearMeasures();
        performance.clearMarks();
    }
    return response;
};

const getDeepSeekStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 0.99) {
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
                    // DeepSeek standard OpenAI doesn't support 'file' type usually,
                    // but we map it if they follow OpenRouter-like patterns.
                    // For now, we skip non-image binary for DeepSeek unless confirmed.
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

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
    };

    // DeepSeek Specific Reasoning
    if (thinkingLevel !== 'Fast') {
        const reasoningEffortMap = {
            'Low': 'high',
            'Medium': 'high',
            'Standard': 'high',
            'High': 'max',
            'xHigh': 'max'
        };
        requestPayload.reasoning_effort = reasoningEffortMap[thinkingLevel] || 'high';
        requestPayload.extra_body = { thinking: { type: "enabled" } };
    } else {
        requestPayload.extra_body = { thinking: { type: "disabled" } };
    }

    const response = await fetchWithBackoff('https://api.deepseek.com/chat/completions', {
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
        throw new Error(`DeepSeek Error (${response.status}): ${errData.error?.message || response.statusText}`);
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
            if (cleanLine === 'data: [DONE]') break;

            try {
                const json = JSON.parse(cleanLine.substring(6));
                const delta = json.choices?.[0]?.delta;
                const usage = json.usage;

                if (usage) {
                    latestUsageMetadata = {
                        totalTokenCount: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens),
                        promptTokenCount: usage.prompt_tokens || 0,
                        candidatesTokenCount: usage.completion_tokens || 0,
                        cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
                        thoughtsTokenCount: usage.completion_tokens_details?.reasoning_tokens || 0
                    };
                    hasNewData = true;
                }

                if (delta) {
                    // DeepSeek uses reasoning_content
                    const thought = delta.reasoning_content || null;
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

const getNVIDIAStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal = false, signal, temperature = 0.99) {
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

                    if (isImage && MULTIMODAL_MODELS.includes(model)) {
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
    const isThinkingmachines = model.includes('thinkingmachines');

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

    const maxTokens = (isMinimax || isDeepSeek || isPoolside || isThinkingmachines) ? 16384 : 32768;

    const body = {
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        temperature: temperature,
        ...(isGPT && { thinking: GPT_THINKING_LEVELS[thinkingLevel] || 'high' })
    };

    if (isLlama3 || isThinkingmachines) {
        // Llama-3 and thinkingmachines do not support thinking parameters
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
            body.reasoning_budget = 12000;
            body.chat_template_kwargs = { enable_thinking: true };
        } else if (apiLevel === 'Standard') {
            body.reasoning_budget = 12000;
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
    }

    let attempts = 0;
    const maxAttempts = 6;
    let hasYielded = false;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            const response = await fetchWithBackoff('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(body),
                signal: signal
            });

            if (!response.ok) {
                const err = await response.json();
                // console.log(err);
                const error = new Error(`NVIDIA API Error: ${err.error?.message || response.statusText}`);
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
                // console.log(buffer); // [DEBUGGING POINT]
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
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
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

                if (Date.now() - lastFlushTime >= 350 && hasNewData) {
                    yield {
                        candidates: pendingParts.length > 0 ? [{ content: { parts: [...pendingParts] } }] : [],
                        usageMetadata: latestUsageMetadata
                    };
                    hasYielded = true;
                    pendingParts = [];
                    lastFlushTime = Date.now();
                    hasNewData = false;
                }
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
}

const wrapNvidiaStreamWithQueueDepth = async function* (stream, modelName) {
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
                push({ value: { type: 'status', content: `Queue '${res.status}'` }, done: false });
            }
        } catch (e) {
            // Network-level error — no status code available, stay silent
        }

    };

    // Run first poll immediately
    poll();
    pollInterval = setInterval(poll, 5000);

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

const getOpenRouterStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal, signal, temperature = 0.95) {
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

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        temperature: temperature,
    };

    const effort = reasoningEffortMap[thinkingLevel];
    if (effort && thinkingLevel !== 'Fast') {
        requestPayload.reasoning_effort = effort;
    }

    const response = await fetchWithBackoff('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'FluxFlow CLI',
            'X-Cache': 'true',
        },
        body: JSON.stringify(requestPayload),
        signal: signal
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter Error (${response.status}): ${errData.error?.message || response.statusText}`);
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
            if (cleanLine === 'data: [DONE]') break;

            try {
                const json = JSON.parse(cleanLine.substring(6));
                const delta = json.choices?.[0]?.delta;
                const usage = json.usage;

                if (usage) {
                    latestUsageMetadata = {
                        totalTokenCount: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens),
                        promptTokenCount: usage.prompt_tokens || 0,
                        candidatesTokenCount: usage.completion_tokens || 0,
                        cachedContentTokenCount: usage.prompt_tokens_details?.cached_tokens || 0,
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
                // Ignore parse errors for partial chunks
            }
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

export const signalTermination = () => {
    TERMINATION_SIGNAL = true;
};

export const isTerminationSignaled = () => {
    return TERMINATION_SIGNAL;
};

const TOOL_LABELS = {
    'write_file': 'Writing',
    'update_file': 'Editing',
    'read_folder': 'Reading',
    'view_file': 'Reading',
    'exec_command': 'Executing Command',
    'web_search': 'Searching',
    'web_scrape': 'Reading',
    'memory': 'Updating Memory',
    'search_keyword': 'Searching',
    'file_map': 'Generating Map',
    'ask': 'User Input',
    'write_pdf': 'Creating',
    'write_docx': 'Creating',
    'generate_image': 'Generating',
    'todo': 'Planning',
    'Todo': 'Planning',
    'invoke_sync': 'Generalist',
    'invoke': 'Generalist',
    'get_progress': 'Checking Progress',
    'cancel': 'Cancelling',
    'await': 'Waiting',
    'EmergencyRollback': 'Don\'t Panic. Lookin\' into it',
};

const getToolDetail = (toolName, argsStr) => {
    try {
        const pArgs = parseArgs(argsStr);
        const normToolName = toolName.toLowerCase().replace(/_/g, '');
        if (normToolName === 'invokesync' || normToolName === 'invoke') {
            return pArgs.title || (pArgs.task ? pArgs.task.substring(0, 30) : null);
        }
        if (normToolName === 'getprogress' || normToolName === 'cancel') {
            return pArgs.id || pArgs.taskId;
        }
        const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
        // Normalize backslashes to forward slashes and strip quotes before extracting basename
        return filePath ? path.basename(filePath.replace(/["']/g, '').replace(/\\/g, '/')) : null;
    } catch (e) {
        return null;
    }
};

export const runJanitorTask = async (settings, agentText, fullAgentTextRaw, history, callbacks = {}) => {
    // if (process.stdout.isTTY) {
    //     process.stdout.write(`\x1b]0;Finalizing...\x07`);
    //     process.stdout.write(`\x1b]633;P;TerminalTitle=Finalizing...\x07`);
    // }

    const USER_CONTEXT_LENGTH = 4 * (1024 * 2);
    const AGENT_CONTEXT_LENGTH = 4 * (1024 * 8);

    const { onStatus, onMemoryUpdated, onBackgroundIncrement } = callbacks;
    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats, aiProvider = 'Google', apiKey } = settings;
    const isMemoryEnabled = systemSettings?.memory !== false;

    // Harvest persistent user memories (Duplicate of logic in getAIStream for background context)
    const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
    const janitorUserMemories = persistentStorage.map(m => `- [${m.id}]: ${m.memory}`).join('\n');

    const janitorContents = history.slice(0, -1)
        .filter(msg => msg.text && !msg.text.includes('[TOOL RESULT]') && !msg.text.includes('OBSERVATION:') && !msg.text.startsWith('[TERMINAL_RECORD]') && !msg.isTerminalRecord && !msg.isMeta && !msg.isLogo && !String(msg.id).startsWith('welcome') && !String(msg.id).startsWith('logo'))
        .slice(-14)
        .map(msg => {
            let processedText = stripAnsi(msg.text)
                .replace(/\[tool:functions\..*?\]/g, '')
                .replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, '')
                .replace(/\[Prompted on:.*?\]/g, '')
                .replace(/\[METADATA \(PRIORITY: DYNAMIC\)\] Time: ([^|\n]+)/g, (match, p1) => {
                    return `[METADATA (PRIORITY: DYNAMIC)] Time: ${p1.replace(/:\d{2}/g, '')}`;
                })
                .replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '')
                .replace(/\[\[END\]\]/g, '')
                .replace(/\[TOOL RESULTS\]/g, '')
                .replace(/\[tool results\]/g, '')
                .replace(/\r?\n\r?\n/g, '\n')
                .replace(/\n\n/g, '\n')
                .replace(/\\n\\n/g, '')
                .trim();

            const limit = msg.role === 'user' ? USER_CONTEXT_LENGTH : AGENT_CONTEXT_LENGTH;
            let truncatedText = processedText.substring(0, limit);
            if (processedText.length > limit) {
                truncatedText += '\n... (truncated) ...';
            }

            const prefix = msg.role === 'user'
                ? (truncatedText.startsWith('[USER]') ? '' : '[USER]: ')
                : (truncatedText.startsWith('[AGENT]') ? '' : '[AGENT]: ');

            return {
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: `${prefix}${truncatedText}` }]
            };
        });

    const isFirstPrompt = history.filter(m => m.role === 'user').length === 1;
    const hasTitleSignal = agentText.includes('[TITLE-UPDATE]');
    const thisHas80pChanceOfBeingTrue = Math.random() < 0.8;
    const needTitle = isFirstPrompt || hasTitleSignal || thisHas80pChanceOfBeingTrue;

    const cleanedFullResponse = fullAgentTextRaw.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, '').trim();
    const janitorPrompt = getJanitorInstruction(
        janitorUserMemories,
        isMemoryEnabled,
        needTitle
    );

    let agentRes = `${cleanedFullResponse.replace(/\[tool:functions\..*?\]/g, '').replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, '').replace(/\[Prompted on:.*?\]/g, '').replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '').replace(/\[\[END\]\]/g, '').replace(/\[\[TOOL RESULTS\]\]/g, '').replace(/\[tool results\]/g, '').substring(0, AGENT_CONTEXT_LENGTH)}`;
    if (agentRes.length > AGENT_CONTEXT_LENGTH) {
        agentRes += '\n... (truncated) ...';
    }
    // replace the [Prompted on: ...] from user prompt
    let originalTextProcessed = agentText.replace(/\[Prompted on:.*?\]/g, '').trim();
    // fs.writeFileSync('test.txt', originalTextProcessed);
    // replace the consecutive newlines and literal escaped \n\n with clean formatting
    agentRes = agentRes.replace(/\r?\n\r?\n/g, '\n').replace(/\n\n/g, '\n').replace(/\\n\\n/g, '').trim();
    let userPrompt = `[USER]: ${originalTextProcessed.substring(0, USER_CONTEXT_LENGTH)}\n${originalTextProcessed.length > USER_CONTEXT_LENGTH ? '... (truncated) ...\n\n' : ''}
[AGENT (current turn)]: ${agentRes}`

    janitorContents.push({ role: 'user', parts: [{ text: userPrompt }] });

    // fs.writeFileSync('janitorContents.txt', `${janitorPrompt}\n\n${userPrompt}`);

    const nvidiaApiKey = await getProviderAPIKey('NVIDIA');
    const fullSettings = await loadSettings();
    const isNvidiaFree = fullSettings.quotas?.providerTiers?.NVIDIA === 'Free';

    let finalSynthesis = '';
    let attempts = 0;
    const MAX_JANITOR_RETRIES = isMemoryEnabled ? 12 : -1;

    // console.log("Before Loop"); // [DEBUGGING POINT]

    while (attempts <= MAX_JANITOR_RETRIES) {
        try {
            if (!(await checkQuota('background', settings))) {
                return;
            }

            let fullContent = '';
            let lastUsage = null;
            let useNvidiaFallback = false;
            let effectiveProvider = aiProvider;

            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("JANITOR_TIMEOUT")), 10000)
                );

                // console.log("WE ARE HERE!"); // [DEBUGGING POINT]

                const useNvidiaFallbackForGoogle = aiProvider === 'Google' && attempts >= 0 && attempts < 6 && nvidiaApiKey && isNvidiaFree;
                const useNvidiaFallbackForDeepSeek = aiProvider === 'DeepSeek' && attempts < 4 && nvidiaApiKey && isNvidiaFree;
                useNvidiaFallback = useNvidiaFallbackForGoogle || useNvidiaFallbackForDeepSeek;
                effectiveProvider = useNvidiaFallback ? 'NVIDIA' : aiProvider;
                // console.log(effectiveProvider); // [DEBUGGING POINT]

                const streamPromise = (async () => {
                    if (aiProvider === 'OpenRouter') {
                        const janitorOpenRouterModel = getFallbackValue('janitor_open_router');
                        const stream = getOpenRouterStream(
                            apiKey,
                            janitorOpenRouterModel,
                            janitorContents,
                            janitorPrompt,
                            'Fast', // Janitor always minimal
                            mode,
                            false,
                            null,
                            0.6
                        );
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    } else if (aiProvider === 'DeepSeek' && !useNvidiaFallback) {
                        const stream = getDeepSeekStream(
                            apiKey,
                            getFallbackValue('deepseek_fast_fallback'),
                            janitorContents,
                            janitorPrompt,
                            'Fast', // Janitor always minimal
                            mode,
                            false,
                            null,
                            0.6
                        );
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    } else if (aiProvider === 'NVIDIA' || useNvidiaFallback) {
                        const stream = getNVIDIAStream(
                            useNvidiaFallback ? nvidiaApiKey : apiKey,
                            getFallbackValue('nvidia_janitor_fallback'),
                            // "mistralai/mistral-nemotron", // [DEBUGGING POINT]
                            janitorContents,
                            janitorPrompt,
                            'Fast', // Janitor always minimal
                            mode,
                            false,
                            null,
                            0.6
                        );
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    } else {
                        const stream = await client.models.generateContentStream({
                            model: janitorModel || (attempts === MAX_JANITOR_RETRIES ? getFallbackValue('janitor_default') : getFallbackValue('gemma_janitor_fallback_google')),
                            contents: janitorContents,
                            config: {
                                systemInstruction: janitorPrompt,
                                temperature: 0.7,
                                safetySettings: [
                                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                ],
                                thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL } // Janitor always minimal
                            }
                        });
                        // console.log("MEMORY REQ SENT"); // [DEBUGGING POINT]
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    }
                })();

                if (process.stdout.isTTY) {
                    const historyIndex = await loadHistory();
                    const chatData = historyIndex[chatId];
                    const chatName = chatData?.name || '';
                    const title = (chatName && !chatName.startsWith('flow-') && !chatName.startsWith('Session ')) ? chatName : 'FluxFlow | Idle';
                    process.stdout.write(`\x1b]0;${title}\x07`);
                    process.stdout.write(`\x1b]633;P;TerminalTitle=${title}\x07`);
                }

                const { iterator, firstResult } = await Promise.race([streamPromise, timeoutPromise]);
                let { value: firstChunk, done: firstDone } = firstResult;

                if (!firstDone && firstChunk) {
                    const parts = firstChunk.candidates?.[0]?.content?.parts;
                    const chunkText = parts ? (effectiveProvider === 'Google' ? (parts[1]?.text || parts[0]?.text || '') : parts.filter(p => p.text && !p.thought).map(p => p.text).join('')) : (typeof firstChunk.text === 'function' ? firstChunk.text() : '');
                    if (chunkText) {
                        fullContent += chunkText;
                    }
                    lastUsage = firstChunk.usageMetadata;

                    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
                        const p = chunk.candidates?.[0]?.content?.parts;
                        const t = p ? (effectiveProvider === 'Google' ? (p[1]?.text || p[0]?.text || '') : p.filter(part => part.text && !part.thought).map(part => part.text).join('')) : (typeof chunk.text === 'function' ? chunk.text() : '');
                        if (t) fullContent += t;
                        lastUsage = chunk.usageMetadata;
                        // console.log(useNvidiaFallback, " : ", fullContent); // [DEBUGGING POINT]
                    }
                }
            } catch (e) {
                // console.log("ERROR: " + e); // [DEBUGGING POINT]
                throw e;
            }

            if (fullContent) {
                finalSynthesis = fullContent;
                // console.log(`Fallback: ${useNvidiaFallback};  Provider: ${effectiveProvider}; Final Synthesis: ${finalSynthesis}`); // [DEBUGGING POINT]
                if (lastUsage) {
                    const total = lastUsage.totalTokenCount || 0;
                    const cached = lastUsage.cachedContentTokenCount || 0;
                    const candidates = (lastUsage.candidatesTokenCount || 0) + (lastUsage.thoughtsTokenCount || 0);
                    const jModel = useNvidiaFallback
                        ? getFallbackValue('nvidia_janitor_fallback')
                        : (effectiveProvider === 'DeepSeek'
                            ? getFallbackValue('deepseek_fast_fallback')
                            : (effectiveProvider === 'OpenRouter'
                                ? getFallbackValue('janitor_open_router')
                                : (janitorModel || (attempts === MAX_JANITOR_RETRIES ? getFallbackValue('janitor_default') : getFallbackValue('gemma_janitor_fallback_google')))));
                    await addToUsage('tokens', total, effectiveProvider, jModel);
                    if (cached > 0) {
                        await addToUsage('cachedTokens', cached, effectiveProvider, jModel);
                    }
                    if (candidates > 0) {
                        await addToUsage('candidateTokens', candidates, effectiveProvider, jModel);
                    }
                }

                // const date = new Date().toLocaleString();
                // const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                // if (!fs.existsSync(janitorLogDir)) fs.mkdirSync(janitorLogDir, { recursive: true });
                // fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `\n\n---------------------------------------------------\n\n\nDEBUG [${date}]: ${finalSynthesis}\n\n`);

                // fs.writeFileSync('debug.log', `${finalSynthesis}`);
                // fs.writeFileSync('janitorContentsChatHistory.json', `${JSON.stringify(janitorContents, null, 2)}`);
                // fs.writeFileSync('janitorPrompt.log', `${janitorPrompt}`);

            } else {
                throw new Error("No synthesis generated by Janitor.");
            }

            if (onBackgroundIncrement) {
                onBackgroundIncrement();
                await incrementUsage('background');
            }

            const janitorToolCalls = detectToolCalls(finalSynthesis);
            let scoreToolCalled = false;
            for (const janitorToolCall of janitorToolCalls) {
                const toolName = janitorToolCall.toolName;
                if (['addMemScore', 'add_mem_score', 'AddMemScore', 'addMemoryScore', 'AddMemoryScore'].includes(toolName)) {
                    scoreToolCalled = true;
                }
                const toolContext = { chatId: chatId, sessionId: chatId, history };
                const result = await dispatchTool(toolName, janitorToolCall.args, toolContext);

                // const date = new Date().toLocaleString();
                // const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                // fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `DEBUG [${date}]: RESULT [${toolName}]: ${result}\n`);

                if (toolName.toLowerCase() === 'memory') {
                    const isUserAction = janitorToolCall.args.includes("action='user'") || janitorToolCall.args.includes('action="user"');
                    if (isUserAction && !result.startsWith("ERROR")) {
                        if (onMemoryUpdated) onMemoryUpdated();
                        if (process.stdout.isTTY) {
                            process.stdout.write(`\x1b]0;Memory Updated\x07`);
                            process.stdout.write(`\x1b]633;P;TerminalTitle=Memory Updated\x07`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
            }

            // Apply 0.05% global geometric decay if no memory was referenced/scored this turn
            if (!scoreToolCalled) {
                try {
                    const memories = readEncryptedJson(MEMORIES_FILE, []);
                    if (memories.length > 0) {
                        const updatedMemories = [];
                        for (const mem of memories) {
                            if (mem.score === undefined) {
                                mem.score = 0.5;
                            }
                            mem.score *= 0.99995; // 0.005% decay when no memory is referenced
                            if (mem.score < 0.05) mem.score = 0.0; // Cutoff cliff edge

                            mem.score = Math.round(mem.score * 100000) / 100000;
                            if (mem.score > 0) {
                                updatedMemories.push(mem);
                            }
                        }
                        writeEncryptedJson(MEMORIES_FILE, updatedMemories);
                    }
                } catch (decayErr) {
                    // Silently ignore or log background decay failure
                }
            }

            break; // Success! Break retry loop.
        } catch (err) {
            attempts++;
            const date = new Date().toLocaleString();
            // if (process.stdout.isTTY) {
            //     process.stdout.write(`\u001b]0;Finalizing Error\u0007`);
            // }
            const errLog = err instanceof Error ? (() => { try { return JSON.parse(JSON.parse(err.message).error.message).error.message; } catch { return String(err); } })() : String(err);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const janitorErrDir = path.join(LOGS_DIR, 'janitor');
            if (!fs.existsSync(janitorErrDir)) fs.mkdirSync(janitorErrDir, { recursive: true });
            fs.appendFileSync(path.join(janitorErrDir, 'error.log'), `ERROR [Attempt ${attempts}/${MAX_JANITOR_RETRIES + 1}] [${date}]: ${errLog}\n\n`);

            if (attempts > MAX_JANITOR_RETRIES) break;

            const backoff = Math.min(750 * Math.pow(2, attempts - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }
    if (attempts) {
        const janitorErrDir = path.join(LOGS_DIR, 'janitor');
        fs.appendFileSync(path.join(janitorErrDir, 'error.log'), `-----------------------------------------------------------------------------\n\n`)

        // if (attempts >= MAX_JANITOR_RETRIES) {
        //     if (process.stdout.isTTY) {
        //         process.stdout.write(`\u001b]0;${isMemoryEnabled ? 'Finalizing Error' : 'Finalizing Skipped'}\u0007`);
        //     }
        //     await new Promise(resolve => setTimeout(resolve, 3000));
        // }
    }

    // Restore title based on chat name when janitor finishes
    if (process.stdout.isTTY) {
        try {
            const historyIndex = await loadHistory();
            const chatData = historyIndex[chatId];
            const chatName = chatData?.name || '';
            const title = (chatName && !chatName.startsWith('flow-') && !chatName.startsWith('Session ')) ? chatName : 'FluxFlow | Idle';
            process.stdout.write(`\x1b]0;${title}\x07`);
            process.stdout.write(`\x1b]633;P;TerminalTitle=${title}\x07`);
        } catch (e) {
            process.stdout.write('\x1b]0;FluxFlow | Idle\x07');
            process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow | Idle\x07');
        }
    }
};

const getActiveToolContext = (text) => {
    const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
    let match;
    while ((match = toolRegex.exec(text)) !== null) {
        const startIdx = match.index + match[0].length - 1; // Index of '('
        let balance = 0;
        let inString = null;
        let isEscaped = false;
        let closed = false;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (!inString && (char === '"' || char === "'" || char === '`')) {
                inString = char;
                isEscaped = false;
            } else if (inString && char === inString && !isEscaped) {
                inString = null;
            }
            if (!inString) {
                if (char === '(') balance++;
                else if (char === ')') balance--;

                if (balance === 0) {
                    // Check for closing ']' after ')'
                    let j = i + 1;
                    while (j < text.length && /\s/.test(text[j])) j++;
                    if (j < text.length && text[j] === ']') {
                        closed = true;
                        toolRegex.lastIndex = j + 1;
                        break;
                    }
                }
            }
            if (char === '\\') isEscaped = !isEscaped;
            else isEscaped = false;
        }

        if (!closed) {
            return { inside: true, toolName: match[1], startIndex: match.index, args: text.substring(match.index + match[0].length) };
        }
    }
    return { inside: false };
};

const getContextSafeText = (text, stripThoughts = true) => {
    const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
    let result = '';
    let lastIdx = 0;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
        const before = text.substring(lastIdx, match.index);
        result += stripThoughts ? before.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\]|$)/gi, '') : before;

        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (inString) {
                if (char === inString) {
                    // Check if escaped: count backslashes preceding this quote
                    let backslashCount = 0;
                    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
                        backslashCount++;
                    }
                    if (backslashCount % 2 === 0) {
                        inString = null;
                    }
                }
            } else {
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                } else if (char === '(') {
                    balance++;
                } else if (char === ')') {
                    balance--;
                    if (balance === 0) {
                        let j = i + 1;
                        while (j < text.length && /\s/.test(text[j])) j++;
                        if (j < text.length && text[j] === ']') {
                            endIdx = j;
                            break;
                        }
                    }
                }
            }
        }

        if (endIdx !== -1) {
            result += '[tool:functions.' + match[1] + '()]';
            lastIdx = endIdx + 1;
            toolRegex.lastIndex = lastIdx;
        } else {
            result += '[tool:functions.' + match[1] + '(';
            lastIdx = text.length;
            break;
        }
    }

    if (lastIdx < text.length) {
        result += stripThoughts ? text.substring(lastIdx).replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\]|$)/gi, '') : text.substring(lastIdx);
    }
    return result;
};

const contextSafeReplace = (text, regex, replacement) => {
    const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;
    let result = '';
    let lastIdx = 0;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
        const before = text.substring(lastIdx, match.index);
        result += before.replace(regex, replacement);

        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let endIdx = -1;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];
            if (inString) {
                if (char === inString) {
                    // Check if escaped: count backslashes preceding this quote
                    let backslashCount = 0;
                    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
                        backslashCount++;
                    }
                    if (backslashCount % 2 === 0) {
                        inString = null;
                    }
                }
            } else {
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                } else if (char === '(') {
                    balance++;
                } else if (char === ')') {
                    balance--;
                    if (balance === 0) {
                        let j = i + 1;
                        while (j < text.length && /\s/.test(text[j])) j++;
                        if (j < text.length && text[j] === ']') {
                            endIdx = j;
                            break;
                        }
                    }
                }
            }
        }

        if (endIdx !== -1) {
            result += text.substring(match.index, endIdx + 1);
            lastIdx = endIdx + 1;
            toolRegex.lastIndex = lastIdx;
        } else {
            result += text.substring(match.index);
            lastIdx = text.length;
            break;
        }
    }

    if (lastIdx < text.length) {
        result += text.substring(lastIdx).replace(regex, replacement);
    }
    return result;
};

const getSanitizedText = (text) => {
    return getContextSafeText(text, true);
};

const translateKimiToolCalls = (text) => {
    if (!text) return text;

    const PASCAL_MAP = {
        'patchfile': 'PatchFile',
        'writefile': 'WriteFile',
        'readfile': 'ReadFile',
        'viewfile': 'ReadFile',
        'run': 'Run',
        'execcommand': 'Run',
        'searchkeyword': 'SearchKeyword',
        'websearch': 'WebSearch',
        'webscrape': 'WebScrape',
        'readfolder': 'ReadFolder',
        'writepdf': 'WritePDF',
        'writedoc': 'WriteDoc',
        'writedocx': 'WriteDoc',
        'filemap': 'FileMap',
        'generateimage': 'GenerateImage',
        'todo': 'Todo',
        'ask': 'Ask'
    };

    const toPascalCase = (str) => {
        return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    };

    const kimiRegex = /<\|\s*tool_call_begin\s*\|>\s*(?:(?:tool|functions)\b[\s._]*)*([a-zA-Z0-9_]+)(?::\d+)?\s*<\|\s*tool_call_argument_begin\s*\|>([\s\S]*?)<\|\s*tool_call_end\s*\|>/gi;

    let result = text.replace(kimiRegex, (match, toolName, argsJsonStr) => {
        let parsedArgs = '';
        try {
            const argsObj = JSON.parse(argsJsonStr.trim());
            if (argsObj && typeof argsObj === 'object') {
                const argPairs = Object.entries(argsObj).map(([key, val]) => {
                    const stringVal = typeof val === 'string'
                        ? val
                        : JSON.stringify(val);
                    return `${key}=${JSON.stringify(stringVal)}`;
                });
                parsedArgs = argPairs.join(', ');
            }
        } catch (e) {
            const pairs = [];
            const pairRegex = /"([^"]+)"\s*:\s*(?:"([^"]*)"|(\d+)|true|false|null)/g;
            let pMatch;
            while ((pMatch = pairRegex.exec(argsJsonStr)) !== null) {
                const key = pMatch[1];
                const val = pMatch[2] !== undefined ? pMatch[2] : pMatch[0].split(':').slice(1).join(':').trim();
                pairs.push(`${key}=${JSON.stringify(val)}`);
            }
            if (pairs.length > 0) {
                parsedArgs = pairs.join(', ');
            } else {
                parsedArgs = argsJsonStr.trim();
            }
        }

        const cleanKey = toolName.toLowerCase().replace(/_/g, '');
        const normToolName = PASCAL_MAP[cleanKey] || toPascalCase(toolName);
        return `[tool:functions.${normToolName}(${parsedArgs})]`;
    });

    result = result.replace(/<\|\s*tool_calls_section_begin\s*\|>/gi, '');
    result = result.replace(/<\|\s*tool_calls_section_end\s*\|>/gi, '');

    return result;
};

const detectToolCalls = (text) => {
    if (!text) return [];
    const translatedText = translateKimiToolCalls(text);
    // Strip any thinking blocks first to ensure no tool calls are detected inside them
    const cleanText = translatedText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, '');
    const results = [];
    const toolRegex = /\[\s*(?:tool:functions\.|agent:generalist\.)([a-z0-9_]+)\s*\(/gi;

    let match;
    while ((match = toolRegex.exec(cleanText)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1; // Index of '('

        let balance = 0;
        let inString = null;
        let endIdx = -1;
        let closingParenIdx = -1;

        for (let i = startIdx; i < cleanText.length; i++) {
            const char = cleanText[i];

            if (inString) {
                if (char === inString) {
                    // Check if escaped: count backslashes preceding this quote
                    let backslashCount = 0;
                    for (let j = i - 1; j >= 0 && cleanText[j] === '\\'; j--) {
                        backslashCount++;
                    }
                    if (backslashCount % 2 === 0) {
                        inString = null;
                    }
                }
            } else {
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                } else if (char === '(') {
                    balance++;
                } else if (char === ')') {
                    balance--;
                    if (balance === 0) {
                        closingParenIdx = i;
                        // Look for closing ']'
                        let j = i + 1;
                        while (j < cleanText.length && /\s/.test(cleanText[j])) j++;
                        if (j < cleanText.length && cleanText[j] === ']') {
                            endIdx = j;
                            break;
                        }
                    }
                }
            }
        }

        if (endIdx !== -1) {
            const finalArgsText = cleanText.substring(startIdx + 1, closingParenIdx);
            const finalFullMatch = cleanText.substring(match.index, endIdx + 1);
            results.push({
                fullMatch: finalFullMatch,
                toolName: toolName.trim(),
                args: finalArgsText.trim()
            });
            toolRegex.lastIndex = endIdx + 1;
        }
    }

    return results;
};

/**
 * Initializes the new Gemini client
 */
export const initAI = (apiKey, settings = {}) => {
    if (!apiKey) return null;
    globalSettings = settings;
    client = new GoogleGenAI({ apiKey });

    // 🧹 GLOBAL PERFORMANCE BUFFER CLEANUP
    // Prevents Node's undici/fetch performance entries from accumulating (capped at 1M default)
    // This covers ALL providers including Gemini SDK's internal HTTP calls
    if (!globalThis.__perfCleanupInstalled) {
        globalThis.__perfCleanupInstalled = true;

        // Periodic sweeper (every 60s) as a safety net
        setInterval(() => {
            if (typeof performance !== 'undefined' && performance.clearMeasures) {
                performance.clearMeasures();
                performance.clearMarks();
            }
        }, 60000);

        // Monkey-patch global fetch to auto-clear after every request
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                if (typeof performance !== 'undefined' && performance.clearMeasures) {
                    performance.clearMeasures();
                    performance.clearMarks();
                }
                return response;
            } catch (e) {
                if (typeof performance !== 'undefined' && performance.clearMeasures) {
                    performance.clearMeasures();
                    performance.clearMarks();
                }
                throw e;
            }
        };
    }

    return client;
};

/**
 * Generic helper to generate non-streaming content from any provider
 */
const generateSimpleContent = async (settings, model, contents, systemInstruction, thinkingLevel = 'Fast', temperature = 0.75, usageKey = 'agent') => {
    return withRetry(async () => {
        const { aiProvider = 'Google', apiKey, mode } = settings;
        let fullText = '';
        let usageMetadata = null;

        // Normalize string prompt to GenAI content array format
        const normalizedContents = typeof contents === 'string'
            ? [{ role: 'user', parts: [{ text: contents }] }]
            : contents;

        const abortController = new AbortController();
        const signal = abortController.signal;

        let connectionPollInterval = setInterval(() => {
            if (TERMINATION_SIGNAL) {
                abortController.abort();
                clearInterval(connectionPollInterval);
            }
        }, 100);

        try {
            let stream;
            if (aiProvider === 'OpenRouter') {
                stream = getOpenRouterStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, signal, temperature);
            } else if (aiProvider === 'DeepSeek') {
                stream = getDeepSeekStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, signal, temperature);
            } else if (aiProvider === 'NVIDIA') {
                stream = getNVIDIAStream(apiKey, model, normalizedContents, systemInstruction, thinkingLevel, mode, false, signal, temperature);
            } else {
                const genStream = await client.models.generateContentStream({
                    model: model,
                    contents: normalizedContents,
                    config: {
                        systemInstruction: systemInstruction,
                        temperature: temperature,
                        thinkingConfig: (() => {
                            const modelLower = (model || "").toLowerCase();
                            const isGemma4 = modelLower.includes('gemma-4') || modelLower.startsWith('gemma');
                            const isGemini3 = modelLower.includes('gemini-3');

                            if (isGemma4 || isGemini3) {
                                if (isGemma4) {
                                    if (thinkingLevel.toLowerCase() !== 'xhigh' || false) return { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL };
                                    else return { includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH };
                                }
                                return {
                                    includeThoughts: true,
                                    thinkingLevel: {
                                        'Fast': modelLower.includes('pro') ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
                                        'Low': ThinkingLevel.LOW,
                                        'Medium': ThinkingLevel.MEDIUM,
                                        'Standard': ThinkingLevel.MEDIUM,
                                        'High': ThinkingLevel.HIGH,
                                        'xHigh': ThinkingLevel.HIGH
                                    }[thinkingLevel] || ThinkingLevel.MEDIUM
                                };
                            } else {
                                const budget = {
                                    'Fast': 0,
                                    'Low': 512,
                                    'Medium': 2048,
                                    'Standard': 2048,
                                    'High': 16384,
                                    'xHigh': 24576
                                }[thinkingLevel] || 2048;

                                if (budget === 0) {
                                    return { includeThoughts: false };
                                }
                                return {
                                    includeThoughts: true,
                                    thinkingBudget: budget
                                };
                            }
                        })()
                    }
                }, { signal });
                stream = genStream;
            }

            for await (const chunk of stream) {
                if (TERMINATION_SIGNAL) {
                    throw new Error('Subagent task was cancelled.');
                }
                if (settings?.taskId && typeof subagentProgress !== 'undefined') {
                    const taskObj = subagentProgress.find(t => t.id === settings.taskId);
                    if (taskObj && taskObj.status === 'cancelled') {
                        throw new Error('Subagent task was cancelled.');
                    }
                }
                if (settings && typeof settings.onTokenChunk === 'function') {
                    settings.onTokenChunk();
                }
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.text && !part.thought) fullText += part.text;
                    }
                }
                if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
            }
        } finally {
            clearInterval(connectionPollInterval);
        }

        if (usageMetadata) {
            const total = usageMetadata.totalTokenCount || 0;
            const cached = usageMetadata.cachedContentTokenCount || 0;
            const candidates = (usageMetadata.candidatesTokenCount || 0) + (usageMetadata.thoughtsTokenCount || 0);
            await addToUsage('tokens', total, aiProvider, model);
            if (cached > 0) {
                await addToUsage('cachedTokens', cached, aiProvider, model);
            }
            if (candidates > 0) {
                await addToUsage('candidateTokens', candidates, aiProvider, model);
            }
            if (settings && typeof settings.onUsage === 'function') {
                settings.onUsage({
                    totalTokenCount: total,
                    cachedContentTokenCount: cached,
                    candidatesTokenCount: candidates
                });
            }
        }
        await incrementUsage('agent', aiProvider);

        return { text: fullText, usageMetadata };
    });
};

/**
 * Detects past chats with substantial turn-level memories, batch-summarizes/merges them

 * into an on-device L2 cache file using stacked tool calls, and purges them from L1.
 */
const consolidatePastMemories = async (currentChatId, settings, tempStorage = null) => {
    tempStorage = tempStorage || readEncryptedJson(TEMP_MEM_FILE, {});
    try {
        const { aiProvider = 'Google' } = settings;

        // 1. Calculate total memories across all chats in L1
        const totalMemoriesCount = Object.values(tempStorage).flat().length;
        if (totalMemoriesCount <= 5) return;

        // 2. Identify past chats that have more than 2 individual memories in L1
        const chatsToSummarize = Object.keys(tempStorage).filter(id => {
            return id !== currentChatId && Array.isArray(tempStorage[id]) && tempStorage[id].length > 2;
        });

        if (chatsToSummarize.length === 0) return;

        // 3. Construct a single batch prompt for the model
        let prompt = `You are a silent background process for the FluxFlow CLI Agent.
Your task is to summarize or merge temporary context memories from one or more past conversation sessions.
For each Chat ID provided, you must output a tool call to save the consolidated summary.

The tool call format MUST be:
[tool:functions.saveSummary(id="<chat-id>", summary="<updated summary string, max 400 words>")]

Guidelines:
- Create a single, updated, highly cohesive, and concise summary statement (max 400 words) for each Chat ID. It should contain WHAT user talked about, WHAT were the tasks, Temporal info, HOW/WHAT the model responded. DON'T REMOVE ANY KEY AND TURN BY TURN INFO DENSITY.
- Focus on key goals, preferences, modified files, and technical decisions.
- Under no circumstances write normal conversational text. Output ONLY the tool calls.
- You can stack multiple tool calls for multiple chats.

Chats to process:

`;

        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        for (const id of chatsToSummarize) {
            const rawMemories = tempStorage[id];
            const newMemoryListStr = rawMemories.map(m => `- ${m}`).join('\n');
            const oldSummary = cacheStorage[id];

            prompt += `[Chat ID: ${id}]\n`;
            if (oldSummary) {
                prompt += `- Existing Summary: "${oldSummary}"\n`;
                prompt += `-- New Memories to integrate:\n${newMemoryListStr}\n\n`;
            } else {
                prompt += `-- Individual Memories:\n${newMemoryListStr}\n\n`;
            }
        }

        // 4. Send the batch request with a programmatic retry loop (max 3 attempts)
        let attempts = 0;
        const maxAttempts = 5;
        let success = false;

        let targetModel = getFallbackValue('gemma_janitor_fallback_google');
        if (aiProvider === 'OpenRouter') targetModel = getFallbackValue('janitor_open_router');
        if (aiProvider === 'DeepSeek') targetModel = getFallbackValue('deepseek_level_1');
        if (aiProvider === 'NVIDIA') targetModel = getFallbackValue('nvidia_janitor_fallback');

        while (attempts <= maxAttempts && !success) {
            // console.log(targetModel, settings);
            attempts++;
            try {
                const response = await generateSimpleContent(settings, targetModel, prompt, null, 'Fast', 0.75, 'background');

                const responseText = response.text || '';
                const janitorToolCalls = detectToolCalls(responseText);

                if (janitorToolCalls.length === 0) {
                    throw new Error("No tool calls detected in synthesis response");
                }

                for (const janitorToolCall of janitorToolCalls) {
                    const toolName = janitorToolCall.toolName;
                    if (['saveSummary', 'saveSumary', 'SaveSummary', 'SaveSumary'].includes(toolName)) {
                        await dispatchTool(toolName, janitorToolCall.args, { chatId: currentChatId });
                    }
                }



                success = true;
            } catch (err) {
                if (attempts >= maxAttempts) {
                    throw new Error(`Failed after ${maxAttempts} attempts. Last error: ${err.message}`);
                }
            }
        }

    } catch (err) {
        // Silently log failures to the janitor log directory so it never disrupts user chat
        const errLog = err instanceof Error ? (() => { try { return JSON.parse(JSON.parse(err.message).error.message).error.message; } catch { return String(err); } })() : String(err);;
        const janitorLogDir = path.join(LOGS_DIR, 'janitor');
        if (!fs.existsSync(janitorLogDir)) fs.mkdirSync(janitorLogDir, { recursive: true });
        fs.appendFileSync(
            path.join(janitorLogDir, 'error.log'),
            `[${new Date().toLocaleString()}] Past memory batch consolidation error: ${errLog}\n`
        );
    }
};

/**
 * Compresses chat history by generating a technical summary and writing it to the summaries file.
 */
export const compressHistory = async (settings, history, isAuto = false) => {
    const { chatId, aiProvider = 'Google' } = settings;
    const summariesFile = path.join(SECRET_DIR, 'chat-summaries.json');

    const flattenContext = (hist) => {
        return hist
            .filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') &&
                m.role !== 'think' &&
                !m.isVisualFeedback &&
                !m.isMeta &&
                !String(m.id).startsWith('welcome')
            )
            .map(m => {
                const role = m.text?.startsWith('[TOOL RESULT]') ? 'TOOL' : (m.role === 'agent' ? 'AGENT' : 'USER');
                return `[${role}]: ${m.text}`;
            })
            .join('\n\n');
    };

    const runCondenser = async (flattenedText, oldSummary) => {
        const systemInstruction = `You are an expert context summarizer. Summarize the provided chat history (which may include previous summaries, user instructions, agent outputs, and tool results) into a detailed, coherent, and highly technical summary of 1000 to 1500 words. Focus on preserving the architectural decisions made, current system state, task progress, and critical code details, chat messages, file changes. Under no circumstances exceed MAX 2000 words.`;
        const prompt = oldSummary
            ? `Here is the previous summary:\n${oldSummary}\n\nHere is the new conversation history:\n${flattenedText}\n\nProvide a new consolidated summary of the entire session.`
            : `Here is the conversation history:\n${flattenedText}\n\nProvide a consolidated summary of the entire session.`;

        let targetModel = getFallbackValue('gemma_janitor_fallback_google');
        if (aiProvider === 'OpenRouter') targetModel = getFallbackValue('janitor_open_router');
        if (aiProvider === 'DeepSeek') targetModel = getFallbackValue('deepseek_level_1');
        if (aiProvider === 'NVIDIA') targetModel = getFallbackValue('nvidia_chat_summarizer_fallback');

        let attempts = 0;
        let success = false;
        let response = null;
        while (attempts <= 3 && !success) {
            attempts++;
            try {
                response = await generateSimpleContent(settings, targetModel, prompt, systemInstruction, 'Fast');

                success = true;
            } catch (err) {
                if (attempts > 3) {
                    if (aiProvider === 'Google') {
                        try {
                            const fallbackModel = getFallbackValue('general_fallback');
                            const fallback = await generateSimpleContent(settings, fallbackModel, prompt, systemInstruction, 'Fast');

                            return fallback.text || '';
                        } catch (e) {
                            return '';
                        }
                    }
                    return '';
                }
            }
        }
        return response ? (response.text || '') : '';
    };

    const flattenedText = flattenContext(history);
    const summaries = readEncryptedJson(summariesFile, {});
    let chatData = summaries[chatId] || { summary: '', historyLength: 0 };
    if (typeof chatData === 'string') {
        chatData = { summary: chatData, historyLength: 0 };
    }
    const oldSummary = chatData.summary || '';
    const newSummary = await runCondenser(flattenedText, oldSummary);
    if (newSummary) {
        chatData.summary = newSummary;
        const cleanLen = getCleanGroupedLength(history);
        if (isAuto) {
            chatData.historyLength = (chatData.historyLength || 0) + cleanLen;
        } else {
            chatData.historyLength = cleanLen;
        }
        summaries[chatId] = chatData;
        writeEncryptedJson(summariesFile, summaries);
        return newSummary;
    }
    return null;
};

/**
 * Deletes chat summary by removing the chatId key from the summaries file.
 */
export const deleteChatSummary = (chatId) => {
    try {
        const summariesFile = path.join(SECRET_DIR, 'chat-summaries.json');
        if (fs.existsSync(summariesFile)) {
            const summaries = readEncryptedJson(summariesFile, {});
            if (summaries[chatId]) {
                delete summaries[chatId];
                writeEncryptedJson(summariesFile, summaries);
            }
        }
    } catch (e) {
        // ignore
    }
};

/**
 * Executes a streaming request using the new SDK
 */
export const getAIStream = async function* (modelName, history, settings, steeringCallback, versionFluxflow) {
    const { profile, thinkingLevel, mode, janitorModel, chatId, isPlayground, systemSettings, sessionStats, aiProvider = 'Google', apiTier } = settings;
    const isMultiModal = isModelMultimodal(modelName);
    if (!client && aiProvider === 'Google') throw new Error('AI not initialized');

    const isMemoryEnabled = systemSettings?.memory !== false;
    const originalText = history[history.length - 1].text;
    const summariesFile = path.join(SECRET_DIR, 'chat-summaries.json');
    let wasCompressedInStream = false;

    // Detection for Chat Title generation
    const isFirstPrompt = history.filter(m => m.role === 'user').length === 1;
    const hasTitleSignal = originalText.includes('[TITLE-UPDATE]');
    const needTitle = isFirstPrompt || hasTitleSignal;

    // Strip [TITLE-UPDATE] signal and temporal grounding from the text before model processing and transaction start
    let agentText = originalText.replace(/\[TITLE-UPDATE\]/g, '').trim();
    agentText = agentText.replace(/\s*\[Prompted on:.*?\]/g, '').trim();

    yield { type: 'status', content: '[start]' };
    yield { type: 'status', content: 'Gathering Context' };

    await RevertManager.startTransaction(chatId, agentText);
    if (systemSettings?.advanceRollback) {
        await AdvanceRevertManager.takeInitialSnapshot(chatId);
    }

    TERMINATION_SIGNAL = false;

    let connectionPollInterval = null;
    try {
        const abortController = new AbortController();

        connectionPollInterval = setInterval(() => {
            if (TERMINATION_SIGNAL) {
                abortController.abort();
                if (connectionPollInterval) {
                    clearInterval(connectionPollInterval);
                    connectionPollInterval = null;
                }
            }
        }, 400);

        let modifiedHistory = [...history.slice(0, -1)];

        // If we have a valid summary, slice modifiedHistory to exclude already-summarized turns
        {
            const summaries = readEncryptedJson(summariesFile, {});
            const chatDataObj = summaries[chatId] || { summary: '', historyLength: 0 };
            if (chatDataObj.summary && chatDataObj.historyLength > 0) {
                let cleanCount = 0;
                const slicedHistory = [];
                for (let i = 0; i < modifiedHistory.length; i++) {
                    const msg = modifiedHistory[i];
                    const isClean = (msg.role === 'user' || msg.role === 'agent' || msg.role === 'system') && !String(msg.id).startsWith('welcome') && !msg.isMeta;
                    if (isClean) {
                        cleanCount++;
                    }
                    if (cleanCount > chatDataObj.historyLength) {
                        slicedHistory.push(msg);
                    }
                }
                modifiedHistory = slicedHistory;
            }
        }

        // Clean up past user turns in modifiedHistory to strip out bulky system metadata/directory structures
        modifiedHistory = modifiedHistory.map(msg => {
            if (msg.role === 'user' && msg.text) {
                const match = msg.text.match(/\[USER\]([\s\S]*?)\[\/USER\]/);
                if (match) {
                    return { ...msg, text: match[1].trim() };
                }
            }
            return { ...msg };
        });

        // Truncation & Condensation Logic (Compression 0.0)
        let contextCompressionCount = 255000;
        let contextTruncationCount = 260000;

        if (aiProvider === 'NVIDIA' && (modelName?.includes('glm') || modelName?.includes('gpt') || modelName?.includes('qwen'))) {
            contextCompressionCount = 122000;
            contextTruncationCount = 126000;
        } else if (aiProvider === 'DeepSeek' || (aiProvider === 'Google' && apiTier === 'Paid') || (aiProvider === 'NVIDIA' && (modelName.includes('deepseek') || modelName.includes('seed')))) {
            contextCompressionCount = 403000;
            contextTruncationCount = 408000;
        }

        if ((sessionStats?.tokens || 0) > contextCompressionCount) {
            yield { type: 'status_history', content: 'Context Limit Reached. Condensing session history...' };
            const newSummary = await compressHistory(settings, modifiedHistory, true);
            if (newSummary) {
                modifiedHistory = [];
                wasCompressedInStream = true;
            }
        }



        // --- PAST CHATS SUMMARIZATION ON NEW CHAT START ---
        if (isFirstPrompt && isMemoryEnabled) {
            const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});

            // 1. Calculate total memories across all chats in L1
            const totalMemoriesCount = Object.values(tempStorage).flat().length;
            if (totalMemoriesCount > 5) {
                yield { type: 'status', content: 'Condensing past chat memories' };
                await consolidatePastMemories(chatId, settings, tempStorage);
            }
        }
        // --------------------------------------------------

        // Harvest temporary memories from different sessions only
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});

        const otherRawMemories = Object.entries(tempStorage)
            .filter(([id]) => id !== chatId)
            .flatMap(([_, mems]) => mems);

        const cachedSummaries = Object.entries(cacheStorage)
            .filter(([id]) => id !== chatId)
            .slice(-20) // Limit to at most the 20 most recent chats
            .map(([id, summary]) => `[Chat Summary]: ${summary}`);

        const otherMemories = [...cachedSummaries, ...otherRawMemories]
            .map(mem => `- ${mem}`)
            .join('\n');

        // Harvest persistent user memories
        const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
        const mainUserMemories = persistentStorage.map(m => `- ${m.memory}`).join('\n');

        const isContext32k = (sessionStats?.tokens || 0) >= 24000;
        const memoryPrompt = getMemoryPrompt(otherMemories, mainUserMemories, isMemoryEnabled, isContext32k);
        const dateTimeStr = new Date().toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        const COLLAPSED_DIRS_GLOBAL = [
            // --- The OG Clutter ---
            '.git', 'node_modules', '.gemini', 'dist', 'build', '.next', 'out',
            '.cache', 'bin', 'obj', 'vendor', 'venv', '.idea', '.gradle',
            '.terraform', 'target', 'coverage', '.vscode',

            // --- Version Control, Monorepos & CI/CD ---
            '.svn', '.hg', '.fslckout', '.github', '.gitlab', '.circleci',
            '.gitea', '.gitee', '.lerna', '.changeset', '.nx',

            // --- JS / TS / Web Dev Armageddon ---
            '.npm', '.yarn', '.pnpm-store', '.expo', '.nuxt', '.svelte-kit',
            '.docusaurus', '.turbo', '.vercel', 'bower_components', '.netlify',
            '.vuepress', '.quasar', '.output', '.angular', 'jspm_packages',
            '.parcel-cache', '.rollup.cache', '.rspack', '.vitepress',

            // --- Python & Data Science Brain Melting ---
            '__pycache__', '.pytest_cache', '.mypy_cache', '.tox', '.poetry',
            'env', 'vhdl', '.ipynb_checkpoints', '.jupyter', '.conda', '.pdm-build',

            // --- Ruby / PHP / Go / Rust / Java / C++ / C# ---
            '.bundle', '.yardoc', '.metadata', 'App_Data', 'ClientBin',
            '.cargo', '.rustc_info', '.go', 'Godeps', '_vendor', '.rake_tasks',
            'CMakefiles', '.wakatime',

            // --- Mobile Dev Madness (Android / iOS / Flutter) ---
            '.dart_tool', '.fvm', '.cocoapods', 'Pods', '.pub-cache',
            '.symlinks', 'DerivedData', '.xcworkspace',

            // --- Containers, Cloud & Database Dumps ---
            '.serverless', '.aws', '.gcloud', '.azure', '.kube',
            '.vagrant', '.docker', 'postgres-data', 'redis-data', 'mongo-data',

            // --- OS & System Trash (The Ultimate Sinners) ---
            '.Spotlight-V100', '.Trashes', '$RECYCLE.BIN',
            'System Volume Information', '.DocumentRevisions-V100', '.fseventsd',

            // --- Windows AppData & System Clutter ---
            'AppData', 'Application Data', 'Local', 'LocalLow', 'Roaming',
            '$WinREAgent', '$WINDOWS.~BT', '$WINDOWS.~WS', 'scw', 'System32', 'SysWOW64',

            // --- macOS Specific Garbage ---
            '.AppleDouble', '.AppleDB', '.AppleDesktop', '_CodeSignature',
            '.cmio', '.LSOverride', '.localized', '.TemporaryItems',

            // --- Linux / Desktop Environment Junk ---
            '.Trash', '.Trash-0', '.Trash-1000', '.gvfs', '.local', '.config',
            '.dbus', '.fontconfig', '.snap', '.var', '.lost+found', 'lost+found',
            '.thumb', '.thumbnails',

            // --- Dual-Boot / Bootloader Stuff ---
            'EFI', 'boot', 'grub',

            // --- Linters, Formatters, Logs & QA ---
            'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter'
        ];

        // Helper to safely read a directory with its file types directly (saves disk hits!)
        const safeReaddirWithTypes = (dir) => {
            try {
                return fs.readdirSync(dir, { withFileTypes: true });
            } catch (e) {
                return [];
            }
        };

        const countFolders = (dir, currentCount = { value: 0 }, depth = 1) => {
            // 1. Scaled up limit to 6200, and bumped search depth to 7 for deep indexing!
            if (currentCount.value > 6200 || depth > 7) return currentCount.value;

            const entries = safeReaddirWithTypes(dir);
            for (const entry of entries) {
                if (currentCount.value > 6200) break;
                if (COLLAPSED_DIRS_GLOBAL.includes(entry.name)) continue;

                if (entry.isDirectory()) {
                    currentCount.value++;
                    countFolders(path.join(dir, entry.name), currentCount, depth + 1);
                }
            }
            return currentCount.value;
        };

        const getDirTree = (dir, maxDepth, prefix = '', depth = 1) => {
            const entries = safeReaddirWithTypes(dir);
            const sep = path.sep;

            if (entries.length > 100) {
                return `${prefix}└── ${path.basename(dir)}${sep} ...100+ files...\n`;
            }

            let result = '';
            const COLLAPSED_DIRS = COLLAPSED_DIRS_GLOBAL;

            // Filter into categories using the entry types we already fetched
            const filtered = entries.filter(e => !COLLAPSED_DIRS.includes(e.name));
            const collapsedInDir = entries.filter(e => COLLAPSED_DIRS.includes(e.name))
                .map(e => e.name)
                .sort();

            // 2. FIXED: Sorting is now super fast because we already know if it's a directory! No disk hits!
            filtered.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            // Create our unified processing list
            const finalItems = [
                ...filtered.map(e => ({ name: e.name, isDir: e.isDirectory() })),
                ...collapsedInDir.map(name => ({ name, isDir: true, isCollapsed: true }))
            ];

            finalItems.forEach((item, index) => {
                const isLast = index === finalItems.length - 1;
                const filePath = path.join(dir, item.name);
                const connector = isLast ? '└── ' : '├── ';
                const childPrefix = prefix + (isLast ? '    ' : '│   ');

                if (item.isCollapsed) {
                    result += `${prefix}${connector}${item.name}${sep}...\n`;
                    return;
                }

                if (item.isDir) {
                    // 3. FIXED: Instead of re-reading the directory here, we let the recursion handle it
                    if (depth > maxDepth) {
                        result += `${prefix}${connector}${item.name}${sep} ...depth exceeded...\n`;
                    } else {
                        // Check if sub-directory is overflowing before diving deep
                        const subEntries = safeReaddirWithTypes(filePath);
                        if (subEntries.length > 80) {
                            result += `${prefix}${connector}${item.name}${sep} ...80+ files...\n`;
                        } else {
                            result += `${prefix}${connector}${item.name}${sep}\n`;
                            result += getDirTree(filePath, maxDepth, childPrefix, depth + 1);
                        }
                    }
                } else {
                    result += `${prefix}${connector}${item.name}\n`;
                }
            });

            return result;
        };

        // yield { type: 'status', content: '[start]' };
        // yield { type: 'status', content: 'Gathering Context' };
        // Add a 300ms sleep for something
        // await new Promise(resolve => setTimeout(resolve, 300));
        const totalFolders = countFolders(process.cwd());
        let dynamicMaxDepth = 12;
        if (totalFolders > 4096) dynamicMaxDepth = 1;
        else if (totalFolders > 3072) dynamicMaxDepth = 2;
        else if (totalFolders > 2048) dynamicMaxDepth = 3;
        else if (totalFolders > 1024) dynamicMaxDepth = 4;
        else if (totalFolders > 512) dynamicMaxDepth = 6;
        else if (totalFolders > 256) dynamicMaxDepth = 7;
        else if (totalFolders > 128) dynamicMaxDepth = 8;
        else if (totalFolders > 64) dynamicMaxDepth = 9;
        else if (totalFolders > 32) dynamicMaxDepth = 10;

        const chatPaths = readEncryptedJson(PATHS_FILE, {});
        const lastCwd = chatPaths[chatId];
        const cwdMismatch = lastCwd ? lastCwd !== process.cwd() : false;
        chatPaths[chatId] = process.cwd();
        writeEncryptedJson(PATHS_FILE, chatPaths);

        const summaries = readEncryptedJson(summariesFile, {});
        let chatDataObj = summaries[chatId] || { summary: '', historyLength: 0 };
        if (typeof chatDataObj === 'string') {
            chatDataObj = { summary: chatDataObj, historyLength: 0 };
        }
        const currentCleanLen = history.filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta).length;
        // fs.appendFileSync("debug.txt", `\n[DEBUG] historyLength=${chatDataObj.historyLength}, currentCleanLen=${currentCleanLen}, modifiedHistory.length=${modifiedHistory.length}`)
        // yield { type: 'status_history', content: `[DEBUG] historyLength=${chatDataObj.historyLength}, currentCleanLen=${currentCleanLen}, modifiedHistory.length=${modifiedHistory.length}` };
        if (chatDataObj.historyLength && currentCleanLen < chatDataObj.historyLength) {
            chatDataObj.summary = '';
            chatDataObj.historyLength = 0;
            summaries[chatId] = chatDataObj;
            writeEncryptedJson(summariesFile, summaries);
        }
        const currentSummary = typeof chatDataObj === 'object' ? (chatDataObj.summary || '') : (chatDataObj || '');
        const hasExistingTurnsAfterCompression = modifiedHistory.length > 0;

        if (hasExistingTurnsAfterCompression && currentSummary) {
            if (modifiedHistory[0] && (modifiedHistory[0].role === 'user' || modifiedHistory[0].role === 'system')) {
                if (!modifiedHistory[0].text.includes('**CONTEXT SUMMARY OF PREVIOUS TURNS')) {
                    modifiedHistory[0].text = `[SYSTEM METADATA]\n**CONTEXT SUMMARY OF PREVIOUS TURNS (PRIORITY: DYNAMIC)**\n${currentSummary}\n\n[USER] ${modifiedHistory[0].text}`;
                    yield { type: 'summary_injected', content: { id: modifiedHistory[0].id, text: modifiedHistory[0].text } };
                }
            }
        }

        const activeSummaryBlock = (currentSummary && !hasExistingTurnsAfterCompression) ? `\n[SYSTEM METADATA]\n**CONTEXT SUMMARY OF PREVIOUS TURNS (PRIORITY: DYNAMIC)**\n${currentSummary}\n` : '';

        let dirStructure = process.cwd() + '\n' + getDirTree(process.cwd(), dynamicMaxDepth);

        const ideCtx = await getIDEContext();
        let ideBlock = "";
        if (isBridgeConnected()) {
            ideBlock = "[IDE CONTEXT]\n";
            if (ideCtx.file_focused !== "none") {
                const relFocused = path.relative(process.cwd(), ideCtx.file_focused);
                const relOpened = (ideCtx.opened_editors || []).map(p => {
                    const rel = path.relative(process.cwd(), p);
                    return rel.startsWith('..') ? `[External] ${path.basename(p)}` : rel;
                });

                ideBlock += `Focused File: ${relFocused}\nCursor Line: ${ideCtx.cursor_line}\n`;
                if (ideCtx.selected) {
                    let sel = ideCtx.selected;
                    const lines = sel.split('\n');
                    if (lines.length > 256) {
                        sel = lines.slice(0, 240).join('\n') + '\n... [truncated] ...\n' + lines.slice(-16).join('\n');
                    }
                    if (sel.length > 2048) {
                        sel = sel.slice(0, 1920) + '\n... [truncated] ...\n' + sel.slice(-128);
                    }
                    ideBlock += `Current Selection: "${sel}"\n`;
                }
                if (ideCtx.manual_edits) {
                    let edits = ideCtx.manual_edits;
                    const lines = edits.split('\n');
                    const files = [];
                    let currentFile = null;

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        if (line.startsWith('    Line ')) {
                            if (currentFile) {
                                currentFile.edits.push(line);
                            }
                        } else {
                            const filePath = line.endsWith(':') ? line.slice(0, -1) : line;
                            currentFile = { path: filePath, edits: [] };
                            files.push(currentFile);
                        }
                    }

                    // 1. Initial per-file 80 lines cap (FIFO) & record original counts
                    for (const file of files) {
                        if (file.edits.length > 80) {
                            file.edits = file.edits.slice(-80);
                        }
                        file.originalEditsCount = file.edits.length;
                    }

                    // 2. Adjust per-file limit dynamically to accommodate 300 total lines (min 10)
                    const getSumForLimit = (limit, activeFiles) => {
                        return activeFiles.reduce((sum, f) => {
                            const isFocused = ideCtx.file_focused &&
                                (f.path === ideCtx.file_focused ||
                                    path.resolve(process.cwd(), f.path) === path.resolve(ideCtx.file_focused));
                            const fileLimit = isFocused ? Math.ceil(limit * 1.2) : limit;
                            return sum + Math.min(f.edits.length, fileLimit);
                        }, 0);
                    };

                    let chosenLimit = 80;
                    if (getSumForLimit(80, files) > 300) {
                        let found = false;
                        for (let L = 80; L >= 10; L--) {
                            if (getSumForLimit(L, files) <= 300) {
                                chosenLimit = L;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            chosenLimit = 10;
                        }
                    }

                    let activeFiles = [...files];
                    // If even at min limit 10, total lines > 500, remove files with minimum original line count
                    if (chosenLimit === 10 && getSumForLimit(10, activeFiles) > 500) {
                        while (activeFiles.length > 0 && getSumForLimit(10, activeFiles) > 500) {
                            let minIndex = 0;
                            let minVal = activeFiles[0].originalEditsCount;
                            for (let i = 1; i < activeFiles.length; i++) {
                                if (activeFiles[i].originalEditsCount < minVal) {
                                    minVal = activeFiles[i].originalEditsCount;
                                    minIndex = i;
                                }
                            }
                            activeFiles.splice(minIndex, 1);
                        }
                    }

                    // Apply the chosen limit to the active files (FIFO)
                    for (const file of activeFiles) {
                        const isFocused = ideCtx.file_focused &&
                            (file.path === ideCtx.file_focused ||
                                path.resolve(process.cwd(), file.path) === path.resolve(ideCtx.file_focused));
                        const fileLimit = isFocused ? Math.ceil(chosenLimit * 1.2) : chosenLimit;
                        if (file.edits.length > fileLimit) {
                            file.edits = file.edits.slice(-fileLimit);
                        }
                    }

                    // 3. Limit per-file character limit to 4 * 768 (FIFO)
                    for (const file of activeFiles) {
                        let fileString = `${file.path}:\n${file.edits.join('\n')}`;
                        while (file.edits.length > 0 && fileString.length > 4 * 768) {
                            file.edits.shift();
                            fileString = `${file.path}:\n${file.edits.join('\n')}`;
                        }
                        if (fileString.length > 4 * 768) {
                            file.stringRepresentation = '... ' + fileString.slice(-(4 * 768 - 4));
                        } else {
                            file.stringRepresentation = fileString;
                        }
                    }

                    // 4. Limit total character limit to 4 * 2048 (FIFO)
                    let finalEdits = activeFiles.map(f => f.stringRepresentation).join('\n');
                    while (activeFiles.length > 0 && finalEdits.length > 4 * 2048) {
                        if (activeFiles[0].edits.length > 0) {
                            activeFiles[0].edits.shift();
                        } else {
                            activeFiles.shift();
                        }
                        // Re-calculate representations
                        for (const file of activeFiles) {
                            let fileString = `${file.path}:\n${file.edits.join('\n')}`;
                            if (fileString.length > 4 * 768) {
                                file.stringRepresentation = '... ' + fileString.slice(-(4 * 768 - 4));
                            } else {
                                file.stringRepresentation = fileString;
                            }
                        }
                        finalEdits = activeFiles.map(f => f.stringRepresentation).join('\n');
                    }

                    if (finalEdits.length > 4 * 2048) {
                        finalEdits = '... ' + finalEdits.slice(-(4 * 2048 - 4));
                    }

                    ideBlock += `Recent Manual Edits:\n${finalEdits}\n`;
                }
                if (relOpened.length > 0) ideBlock += `All Opened Editors: ${relOpened.join(', ')}`;

                // Always inject errors if they exist
                if (ideCtx.diagnostics) ideBlock += `\n**ACTIVE FILE ERRORS**:\n${ideCtx.diagnostics}\n`;

                // Only inject warnings if the user specifically asked about lint/warnings
                const isLintRequest = agentText.toLowerCase().includes('lint') || agentText.toLowerCase().includes('warning');
                if (isLintRequest && ideCtx.warnings) {
                    ideBlock += `\n**LINT WARNINGS**:\n${ideCtx.warnings}\n`;
                }
            } else {
                ideBlock += `No file currently focused.`
            }
        }


        const cleanAgentText = agentText.replace(/\s*\[Prompted on:.*?\]/g, '').trim();

        // Tagged files parsing and attaching
        const tagRegex = /(?:\\)?@\[([^\]]+)\]/g;
        let match;
        const tagsFound = [];
        tagRegex.lastIndex = 0;
        while ((match = tagRegex.exec(cleanAgentText)) !== null) {
            const isEscaped = match[0].startsWith('\\');
            tagsFound.push({ tag: match[1], isEscaped });
        }

        let taggedContextBlocks = [];
        let attachedBinaryPart = null;

        for (let tIdx = 0; tIdx < tagsFound.length; tIdx++) {
            const { tag, isEscaped } = tagsFound[tIdx];
            if (isEscaped) continue;
            try {
                let tagClean = tag.trim().replace(/^["']|["']$/g, '');
                const lineRangeRegex = /[:#]L?(\d+)(?:-L?(\d+))?$/i;
                const matchRange = tagClean.match(lineRangeRegex);
                let filePath = tagClean;
                let startLine = null;
                let endLine = null;
                if (matchRange) {
                    startLine = parseInt(matchRange[1], 10);
                    endLine = matchRange[2] ? parseInt(matchRange[2], 10) : startLine;
                    filePath = tagClean.slice(0, matchRange.index);
                }

                const absPath = path.resolve(process.cwd(), filePath);
                if (fs.existsSync(absPath)) {
                    const stats = fs.statSync(absPath);
                    if (stats.isFile()) {
                        const pathLower = filePath.toLowerCase();
                        const isPdf = pathLower.endsWith('.pdf');
                        const isOfficeFile = pathLower.endsWith('.docx') || pathLower.endsWith('.doc') || pathLower.endsWith('.ppt') || pathLower.endsWith('.pptx') || pathLower.endsWith('.xls') || pathLower.endsWith('.xlsx');
                        const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                        const isMultimodalFile = isImage || isPdf || isOfficeFile;
                        const isSupported = aiProvider === 'Google' || isModelMultimodal(modelName);

                        if (isMultimodalFile && !isSupported) {
                            // console.log(isMultimodalFile, isSupported); // This executing
                            const label = `✘ Unsupported Modality: ${path.basename(filePath)}`;
                            let terminalWidth = 115;
                            if (process.stdout.isTTY) {
                                terminalWidth = process.stdout.columns - 5 || 120;
                            }
                            const boxLines = [label];
                            const maxLen = Math.max(...boxLines.map(l => l.length));
                            const boxWidth = Math.min(maxLen + 4, terminalWidth);
                            const boxMid = boxLines.map(line => `${line.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`).join('\n');
                            yield { type: 'visual_feedback', content: colorMainWords(`${boxMid}\n`) };
                            continue;
                        }

                        const finalStart = startLine !== null ? startLine : 1;
                        let finalEnd = endLine !== null ? endLine : (startLine !== null ? startLine : finalStart + 499);
                        if (finalEnd - finalStart > 500) {
                            finalEnd = finalStart + 500;
                        }

                        const argsStr = `path=${JSON.stringify(filePath)}, startLine=${finalStart}, endLine=${finalEnd}`;
                        const result = await view_file(argsStr, { isMultiModal: isSupported });

                        let isError = false;
                        let textResult = '';
                        let binPart = null;

                        if (typeof result === 'string') {
                            if (result.trim().startsWith('ERROR')) {
                                isError = true;
                            } else {
                                textResult = result;
                            }
                        } else if (result && typeof result === 'object') {
                            if (result.binaryPart) {
                                binPart = result.binaryPart;
                                textResult = result.text || '';
                            } else {
                                isError = true;
                            }
                        } else {
                            isError = true;
                        }

                        if (!isError) {
                            let label = '';
                            if (isImage) {
                                label = `✔  Viewed: ${filePath}`;
                                attachedBinaryPart = binPart;
                            } else if (isPdf || isOfficeFile) {
                                label = `✔  Viewed: ${filePath}`;
                                attachedBinaryPart = binPart;
                            } else {
                                let totalLines = '...';
                                try {
                                    const content = fs.readFileSync(absPath, 'utf8');
                                    totalLines = content.split('\n').length;
                                } catch (e) { }
                                label = `✔  Auto-Read: ${filePath}` // → Lines ${finalStart} - ${Math.min(finalEnd, totalLines)} of ${totalLines}`;
                                taggedContextBlocks.push(textResult);
                            }

                            if (label) {
                                let terminalWidth = 115;
                                if (process.stdout.isTTY) {
                                    terminalWidth = process.stdout.columns - 5 || 120;
                                }
                                const boxLines = [label];
                                const maxLen = Math.max(...boxLines.map(l => l.length));
                                const boxWidth = Math.min(maxLen + 4, terminalWidth);
                                const boxMid = boxLines.map(line => `${line.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`).join('\n');
                                yield { type: 'visual_feedback', content: colorMainWords(`${boxMid}\n`) };
                            }
                        }
                    }
                }
            } catch (e) {
                // console.error("[ERROR AUTO-READING TAG]", e);
            }
        }

        let taggedContextStr = '';
        if (taggedContextBlocks.length > 0) {
            taggedContextStr = '[TAGGED FILE CONTENTS] Auto Read, System Provided Context for User Tagged Files\n' + taggedContextBlocks.join('\n\n') + '\n[/TAGGED FILE CONTENTS]\n';
        }

        const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

        // Strip the backslash from the user prompt sent to the model so they see @[file] instead of \@[file]
        const cleanPromptForModel = cleanAgentText.replace(/\\(@\[[^\]]+\])/g, '$1');
        const firstUserMsg = `[SYSTEM METADATA (PRIORITY: DYNAMIC), Chat Context >> Metadata] Time: ${dateTimeStr}\nOS: ${osDetected}\nCWD: ${process.cwd()}${isPlayground ? ' [PLAYGROUND MODE]' : ''}${cwdMismatch ? ` (WARNING: CWD Mismatch! Previous Path: ${lastCwd})` : ''}\n**DIRECTORY STRUCTURE**\n${dirStructure}${memoryPrompt}${ideBlock}\n${activeSummaryBlock}${(thinkingLevel !== 'Fast' && thinkingLevel !== 'xHigh') && aiProvider === 'Google' ? `${modelName.toLowerCase().startsWith('gemma') ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS HIGH PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**\nSTRICTLY FOLLOW VALID TOOL CALLING SCHEMA [/SYSTEM]\n" : ""}` : '[SYSTEM Priority : HIGH] STRICTLY FOLLOW VALID TOOL CALLING SCHEMA eg. `[tool:functions.ReadFolder(path=".")]` NO OTHER FORMAT/TOKEN IS ALLOWED [/SYSTEM]\n'}${taggedContextStr}[USER PROMPT] ${cleanPromptForModel.trim()} [/USER PROMPT]`.trim();
        const userMsgObj = { role: 'user', text: firstUserMsg };
        if (attachedBinaryPart) {
            userMsgObj.binaryPart = attachedBinaryPart;
        }
        modifiedHistory.push(userMsgObj);

        if (activeSummaryBlock && history[history.length - 1]?.id) {
            yield { type: 'summary_injected', content: { id: history[history.length - 1].id, text: firstUserMsg } };
        }

        let lastUsage = null;
        const MAX_LOOPS = mode === 'Flux' ? 100 : 10;
        const MAX_RETRIES = 16;
        yield { type: 'status', content: 'Connecting' };

        TERMINATION_SIGNAL = false; // Reset at start of new interaction

        let fullAgentResponseChunks = [];
        let wasToolCalledInLastLoop = false;

        // [PRE-LOOP ARCHIVE] Strip thoughts from ALL PREVIOUS turns once before entering the loop.
        // This acts as a security firewall against brain-hijacking (user injecting <think> tags)
        // and ensures steering hints don't carry reasoning glitches.
        // Only Agent Msgs should be stripped.
        modifiedHistory.forEach(msg => {
            if (msg.text && msg.role === 'agent') {
                msg.text = msg.text.replace(/(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])/gi, '');
                msg.text = msg.text.replace(/(?:<(think|thought)>|\[(think|thought)\])[^\[\n]*/gi, '').trim();
            }
        });

        // 1 extra loop for grace period
        for (let loop = 0; loop <= MAX_LOOPS; loop++) {
            const currentTurnTools = [];
            wasToolCalledInLastLoop = false
            if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > contextTruncationCount) {
                modifiedHistory = getTruncatedHistory(modifiedHistory, 6);
            }
            if (loop > 0) {
                yield { type: 'status', content: 'Working' };
            }
            if (TERMINATION_SIGNAL) {
                yield { type: 'status', content: 'Request Cancelled' };
                yield { type: 'text', content: '\n\n\u001b[33mⓘ Request Cancelled\u001b[0m' };
                break;
            }

            // Here.. LOL.. Seeing THIS??!!! **LOOOL**

            // Check for incoming Steering Hints
            if (steeringCallback) {
                const hint = await steeringCallback();
                if (hint) {
                    if (hint.startsWith('/btw')) {
                        if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === 'user') {
                            modifiedHistory[modifiedHistory.length - 1].text += `\n\n[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY [/SYSTEM]\n[QUESTION] ${hint.replace('/btw', '').trim()} [/QUESTION]`;
                        } else {
                            modifiedHistory.push({ role: 'user', text: `${(thinkingLevel !== 'Fast' && thinkingLevel !== 'xHigh') && aiProvider === 'Google' ? `${modelName.toLowerCase().startsWith('gemma') ? "[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY\n**STRICTLY FOLLOW THINKING POLICY AS HIGH PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n" : ""}` : ''}[QUESTION] ${hint.replace('/btw', '').trim()} [/QUESTION]` });
                        }
                    } else {
                        // Protocol Sync: If last message is 'user', append hint to it to avoid consecutive role errors
                        if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === 'user') {
                            modifiedHistory[modifiedHistory.length - 1].text += `\n\n[STEERING HINT] ${hint.trim()} [/STEERING HINT]`;
                        } else {
                            modifiedHistory.push({ role: 'user', text: `${(thinkingLevel !== 'Fast' && thinkingLevel !== 'xHigh') && aiProvider === 'Google' ? `${modelName.toLowerCase().startsWith('gemma') ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS HIGH PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n" : ""}` : ''}[STEERING HINT] ${hint.trim()} [/STEERING HINT]` });
                        }
                    }
                    yield { type: 'status', content: `${hint.startsWith('/btw') ? 'Question Forwarded...' : 'Steering Hint Injected...'}` };
                }
            }


            let stream;
            let success = false;
            let retryCount = 1;
            let inStreamRetryCount = 1;

            let turnText = '';
            let lastToolSniffed = null;
            let lastToolDetail = null;
            let lastToolEventTime = null;
            let lastToolFinishedAt = 0;
            let toolResults = [];
            let toolCallPointer = 0;
            let anyToolExecutedInThisTurn = false;
            let isThinkingLoop = false;
            let isStutteringLoop = false;
            let isGeneralLoop = false;
            let isInitialAttempt = true;
            let lastLoopCheckLen = 0;
            let accumulatedContext = '';
            let dedupeBuffer = '';
            let isDedupeActive = false;

            let detectedAnyToolCalls = false;
            let thisIsFirstToolFeedback = true;

            let targetModel = modelName;
            let currentSystemInstruction = '';

            while (retryCount <= MAX_RETRIES && inStreamRetryCount <= MAX_RETRIES && !success && !TERMINATION_SIGNAL) {
                let inThinkingState = false;
                try {
                    turnText = ''; // [CRITICAL STATE SYNC] - Reset turnText at start of every attempt
                    if (isInitialAttempt) {
                        if (process.stdout.isTTY) {
                            process.stdout.write(`\u001b]0;Working...\u0007`);
                        }
                        yield { type: 'turn_reset', content: true };
                        // yield { type: 'spinner', content: true }; // [Obsolete]
                        isInitialAttempt = false;
                        if (inStreamRetryCount === 1) {
                            accumulatedContext = '';
                        }
                    }
                    // Convert current history to GenAI format (Recalculated every retry to pick up recovery turns)
                    const contents = modifiedHistory
                        .filter(msg => (msg.role === 'user' || msg.role === 'agent' || msg.role === 'system') && !String(msg.id).startsWith('welcome') && !msg.isMeta && !msg.isTerminalRecord && !(msg.text && msg.text.startsWith('[TERMINAL_RECORD]')))
                        .map((msg, idx, arr) => {
                            let text = msg.text || '';
                            if (msg.role === 'agent') {
                                text = text.replace(/\[turn:\s*finish\]/gi, '').replace(/\[\[END\]\]/gi, '').trim();
                                // text = text.replaceAll('<think>', '[Previous Thoughts: ').replaceAll('</think>', ']');
                                text = text.replaceAll('\u001b[33mⓘ Request Cancelled\u001b[0m', '*User Cancelled Response Generation*');
                            }
                            const parts = [{ text }];
                            if (msg.binaryPart && isModelMultimodal(targetModel)) {
                                // 2-Turn Freshness Check: Only include binary data if it appeared within the last 2 physical user turns
                                const physicalUserTurnsAfter = arr.slice(idx + 1).filter(m => m.role === 'user' && !m.text?.startsWith('[TOOL RESULT]')).length;
                                if (physicalUserTurnsAfter <= 2) {
                                    parts.push(msg.binaryPart);
                                }
                            }
                            return {
                                role: (msg.role === 'user' || msg.role === 'system') ? 'user' : 'model',
                                parts
                            };
                        });

                    // [ROLE ALTERNATION & TOOL PAIRING FIX]
                    // 1. Re-order tool calls and tool results so each result immediately follows its tool call.
                    for (let i = 0; i < contents.length; i++) {
                        const msg = contents[i];
                        const text = msg.parts?.[0]?.text || '';
                        if (msg.role === 'model' && /\[tool:/i.test(text)) {
                            // Find the first user [TOOL RESULT] message *after* this index
                            let resultIdx = -1;
                            for (let j = i + 1; j < contents.length; j++) {
                                const nextMsg = contents[j];
                                const nextText = nextMsg.parts?.[0]?.text || '';
                                if (nextMsg.role === 'user' && nextText.startsWith('[TOOL RESULT]')) {
                                    resultIdx = j;
                                    break;
                                }
                            }
                            // If found, and it is not already directly after the tool call, move it to i + 1
                            if (resultIdx !== -1 && resultIdx !== i + 1) {
                                const [resultMsg] = contents.splice(resultIdx, 1);
                                contents.splice(i + 1, 0, resultMsg);
                            }
                        }
                    }

                    // 1.5. Delete stranded user turns (where user is followed by system-initiated user turn without a model turn in between)
                    for (let i = contents.length - 2; i >= 0; i--) {
                        const current = contents[i];
                        const next = contents[i + 1];
                        if (current.role === 'user' && next.role === 'user') {
                            const nextText = next.parts?.[0]?.text || '';
                            if (nextText.trim().startsWith('[SYSTEM')) {
                                contents.splice(i, 1);
                            }
                        }
                    }

                    // 2. Merge consecutive same-role messages to guarantee strict role alternation.
                    const finalContents = [];
                    for (let i = 0; i < contents.length; i++) {
                        const current = contents[i];
                        if (finalContents.length === 0) {
                            finalContents.push(current);
                        } else {
                            const last = finalContents[finalContents.length - 1];
                            if (last.role === current.role) {
                                last.parts[0].text += '\n\n' + (current.parts?.[0]?.text || '');
                                if (current.parts?.length > 1) {
                                    last.parts.push(...current.parts.slice(1));
                                }
                            } else {
                                finalContents.push(current);
                            }
                        }
                    }
                    contents.length = 0;
                    contents.push(...finalContents);
                    // Quota Check
                    if (!(await checkQuota('agent', settings))) {
                        throw new Error("Error: Quota Exausted for Agent");
                    }

                    // [HIGH RELIABILITY FALLBACK SPECTRUM]
                    targetModel = modelName;
                    /*
                    if (aiProvider === 'DeepSeek' && thinkingLevel === 'Fast' && targetModel.includes('flash')) {
                        targetModel = getFallbackValue('deepseek_fast_fallback');
                    }
                    if (retryCount === MAX_RETRIES - 1) {
                        targetModel = aiProvider === 'DeepSeek' ? getFallbackValue('deepseek_level_1') : getFallbackValue('google_level_1');
                        yield { type: 'model_update', content: 'Trying with fallback model' };
                    } else if (retryCount === MAX_RETRIES) {
                        targetModel = aiProvider === 'DeepSeek' ? getFallbackValue('deepseek_level_2') : getFallbackValue('google_level_2');
                        yield { type: 'model_update', content: 'Trying with fallback model' };
                    } else if (retryCount > 12 && retryCount < MAX_RETRIES - 2 && settings.apiKey !== "custom") {
                        targetModel = getFallbackValue('gemma_emergency');
                        yield { type: 'model_update', content: 'Trying with fallback Gemma Model' };
                    } else if (retryCount > 0) {
                        yield { type: 'model_update', content: null };
                    }
                    */

                    // [DYNAMIC CONTEXT ADAPTATION WITH MEMORIES]
                    // We recalculate instructions every turn so the agent knows when it's hitting context limits
                    currentSystemInstruction = getSystemInstruction(profile, !(targetModel || "gemma").toLowerCase().startsWith('gemma') ? thinkingLevel : thinkingLevel, mode, systemSettings, isMemoryEnabled, isFirstPrompt, aiProvider, aiProvider === 'Google' ? true : isMultiModal, !(targetModel || "gemma").toLowerCase().startsWith('gemma') ? true : false);

                    const lastUserMsg = contents[contents.length - 1];
                    if (isBridgeConnected() & loop > 0) {
                        await new Promise(resolve => setTimeout(resolve, 2500)); // Buffer for IDE to parse the code
                        yield { type: 'status', content: 'Verifying' };
                        const ideCtxJIT = await getIDEContext();
                        const ideErr = ideCtxJIT ? ideCtxJIT.diagnostics : null;
                        if (ideErr && lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text) {
                            lastUserMsg.parts[0].text += `\n${ideErr} [/ERROR]`;
                        }
                        yield { type: 'status', content: 'Working' };
                    }

                    // [JIT INSTRUCTION INJECTION] - Only for tool results, kept out of persistent history
                    const isGemma = modelName && modelName.toLowerCase().startsWith('gemma') && aiProvider === "Google";

                    if (isGemma) {
                        const jitInstruction = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn${(thinkingLevel !== 'Fast' && thinkingLevel !== 'xHigh') && aiProvider === 'Google' ? `. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**` : ''} [/SYSTEM]`;
                        if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text?.startsWith('[TOOL RESULT]')) {
                            lastUserMsg.parts[0].text += jitInstruction;
                        }
                    }

                    // [FILE CHANGES INJECTION] - Show file changes from previous turn when advance rollback is active
                    // Persists across agentic loops by writing to both contents (for current API call) and modifiedHistory (for durability)
                    if (systemSettings?.advanceRollback && lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text?.startsWith('[TOOL RESULT]')) {
                        try {
                            const fileChanges = await AdvanceRevertManager.getLatestFileChanges(chatId);
                            if (fileChanges && (fileChanges.newFiles.length > 0 || fileChanges.modifiedFiles.length > 0 || fileChanges.deletedFiles.length > 0)) {
                                let changesStr = '\n[SYSTEM] File Changes:\n';
                                for (const f of fileChanges.newFiles) changesStr += `* ${f} (created)\n`;
                                for (const f of fileChanges.modifiedFiles) changesStr += `* ${f} (modified)\n`;
                                for (const f of fileChanges.deletedFiles) changesStr += `* ${f} (deleted)\n`;
                                changesStr += '[/SYSTEM]';
                                // Inject into transient contents for the imminent API call
                                lastUserMsg.parts[0].text += changesStr;
                                // Also persist into modifiedHistory so it survives across agentic loops
                                // Find the last user entry in modifiedHistory that corresponds to this tool result
                                let lastHistIdx = -1;
                                for (let hi = modifiedHistory.length - 1; hi >= 0; hi--) {
                                    if (modifiedHistory[hi].role === 'user' && modifiedHistory[hi].text?.startsWith('[TOOL RESULT]')) {
                                        lastHistIdx = hi;
                                        break;
                                    }
                                }
                                if (lastHistIdx !== -1) {
                                    modifiedHistory[lastHistIdx].text += changesStr;
                                }
                            }
                        } catch (err) {
                            // silently ignore errors in file changes injection
                        }
                    }

                    // [JIT STEP SENTRY] - Only inject step warning if loop is at >= 80% of MAX_LOOPS for Flow and 98% for Flux
                    // Keeps prompts fully cached and static for the vast majority of runs!
                    if (isGemma) {
                        const stepThreshold = Math.floor(MAX_LOOPS * (mode === 'Flux' ? 0.98 : 0.8));
                        const currentStep = loop + 1;
                        if (currentStep >= stepThreshold && lastUserMsg && lastUserMsg.parts?.[0]) {
                            lastUserMsg.parts[0].text += `\n[SYSTEM] WARNING, Turn Limit Impending: Step ${currentStep}/${MAX_LOOPS}. Wrap up quickly/prompt user to continue & use [[END]] quickly. [/SYSTEM]`;
                        }
                    }

                    // fs.writeFileSync(`contents.txt`, `${currentSystemInstruction}\n\n${firstUserMsg}`); break;
                    // fs.writeFileSync(`contents_context.json`, `${JSON.stringify({ contents }, null, 2)}`);
                    // break;

                    const abortPromise = new Promise((_, reject) => {
                        if (abortController.signal.aborted) {
                            reject(new DOMException('The user aborted a request.', 'AbortError'));
                        }
                        abortController.signal.addEventListener('abort', () => {
                            reject(new DOMException('The user aborted a request.', 'AbortError'));
                        });
                    });
                    abortPromise.catch(() => {});

                    let activeContents = contents;

                    if (aiProvider === 'OpenRouter') {
                        stream = getOpenRouterStream(
                            settings.apiKey,
                            targetModel,
                            activeContents,
                            currentSystemInstruction,
                            thinkingLevel,
                            mode,
                            isMultiModal,
                            abortController.signal,
                            1.0
                        );
                    } else if (aiProvider === 'DeepSeek') {
                        stream = getDeepSeekStream(
                            settings.apiKey,
                            targetModel,
                            activeContents,
                            currentSystemInstruction,
                            thinkingLevel,
                            mode,
                            isMultiModal,
                            abortController.signal,
                            1.05
                        );
                    } else if (aiProvider === 'NVIDIA') {
                        const rawStream = getNVIDIAStream(
                            settings.apiKey,
                            targetModel,
                            activeContents,
                            currentSystemInstruction,
                            thinkingLevel,
                            mode,
                            isMultiModal,
                            abortController.signal,
                            1.05
                        );
                        stream = wrapNvidiaStreamWithQueueDepth(rawStream, targetModel);
                    } else {
                        const apiCallPromise = client.models.generateContentStream({
                            model: targetModel || "gemini-3-flash-preview",
                            contents: activeContents,
                            config: {
                                systemInstruction: currentSystemInstruction,
                                mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
                                temperature: 1.05,
                                safetySettings: [
                                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE, },
                                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE, },
                                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE, },
                                ],
                                thinkingConfig: (() => {
                                    const modelLower = (targetModel || "").toLowerCase();
                                    const isGemma4 = modelLower.includes('gemma-4') || modelLower.startsWith('gemma');
                                    const isGemini3 = modelLower.includes('gemini-3');

                                    if (isGemma4 || isGemini3) {
                                        if (isGemma4) {
                                            if (thinkingLevel.toLowerCase() !== 'xhigh' || false) return { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL };
                                            else return { includeThoughts: true, thinkingLevel: ThinkingLevel.HIGH };
                                        }
                                        return {
                                            includeThoughts: true,
                                            thinkingLevel: {
                                                'Fast': modelLower.includes('pro') ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
                                                'Low': ThinkingLevel.LOW,
                                                'Medium': ThinkingLevel.MEDIUM,
                                                'Standard': ThinkingLevel.MEDIUM,
                                                'High': ThinkingLevel.HIGH,
                                                'xHigh': ThinkingLevel.HIGH
                                            }[thinkingLevel] || ThinkingLevel.MEDIUM
                                        };
                                    } else {
                                        const budget = {
                                            'Fast': 0,
                                            'Low': 512,
                                            'Medium': 2048,
                                            'Standard': 2048,
                                            'High': 16384,
                                            'xHigh': 24576
                                        }[thinkingLevel] || 2048;

                                        if (budget === 0) {
                                            return { includeThoughts: false };
                                        }
                                        return {
                                            includeThoughts: true,
                                            thinkingBudget: budget
                                        };
                                    }
                                })(),
                            },
                        }, { signal: abortController.signal });

                        stream = await Promise.race([apiCallPromise, abortPromise]);
                    }

                    // Reset turn state for this specific retry attempt
                    turnText = '';
                    lastToolSniffed = null;
                    lastToolEventTime = null;
                    toolResults = [];
                    toolCallPointer = 0;

                    // Success - Reset model name display for final chunks
                    yield { type: 'model_update', content: null };

                    dedupeBuffer = '';
                    isDedupeActive = accumulatedContext.length > 0;

                    let pendingGoogleText = '';
                    let lastGoogleFlushTime = Date.now();

                    const flushGoogleBuffer = async function* () {
                        if (aiProvider === 'Google' && pendingGoogleText) {
                            const msgs = getBufferedMessages(pendingGoogleText);
                            for (const m of msgs) yield m;
                            pendingGoogleText = '';
                            lastGoogleFlushTime = Date.now();
                        }
                    };
                    let isFirstChunk = true;

                    let toolCallBuffer = '';
                    let isBufferingToolCall = false;
                    let activeBufferType = null; // 'tool', 'end', 'kimi_section', 'kimi_call'

                    const getBufferedMessages = (text) => {
                        const msgs = [];
                        let remaining = text;
                        while (remaining.length > 0) {
                            if (!isBufferingToolCall) {
                                // Match the actual protocol starts: [tool:functions., [agent:generalist. or [[END]]
                                const toolIdx = remaining.indexOf('[tool');
                                const agentIdx = remaining.indexOf('[agent');
                                const endIdx = remaining.indexOf('[[END]]');
                                const kimiSectionIdx = remaining.indexOf('<|tool_calls_section_begin|>');
                                const kimiCallIdx = remaining.indexOf('<|tool_call_begin|>');

                                // Find the earliest occurrence of any tag
                                const indices = [
                                    { type: 'tool', idx: toolIdx, start: '[tool', end: ']' },
                                    { type: 'agent', idx: agentIdx, start: '[agent', end: ']' },
                                    { type: 'end', idx: endIdx, start: '[[END]]', end: '[[END]]' },
                                    { type: 'kimi_section', idx: kimiSectionIdx, start: '<|tool_calls_section_begin|>', end: '<|tool_calls_section_end|>' },
                                    { type: 'kimi_call', idx: kimiCallIdx, start: '<|tool_call_begin|>', end: '<|tool_call_end|>' }
                                ].filter(i => i.idx !== -1).sort((a, b) => a.idx - b.idx);

                                if (indices.length > 0) {
                                    const match = indices[0];
                                    if (match.idx > 0) {
                                        msgs.push({ type: 'text', content: remaining.substring(0, match.idx) });
                                    }

                                    isBufferingToolCall = true;
                                    activeBufferType = match.type;
                                    toolCallBuffer = '';
                                    remaining = remaining.substring(match.idx);
                                } else {
                                    // Check if the end of 'remaining' looks like the START of a tag (potential split)
                                    // We only buffer if it's very likely the start of a protocol tag
                                    const potentialStarts = ['[tool', '[agent', '[[END]]', '<|tool_calls_section_begin|>', '<|tool_call_begin|>'];
                                    let splitPoint = -1;
                                    for (const start of potentialStarts) {
                                        for (let len = start.length - 1; len > 0; len--) {
                                            if (remaining.endsWith(start.substring(0, len))) {
                                                splitPoint = remaining.length - len;
                                                const idx = potentialStarts.indexOf(start);
                                                if (idx === 0) activeBufferType = 'tool';
                                                else if (idx === 1) activeBufferType = 'agent';
                                                else if (idx === 2) activeBufferType = 'end';
                                                else if (idx === 3) activeBufferType = 'kimi_section';
                                                else activeBufferType = 'kimi_call';
                                                break;
                                            }
                                        }
                                        if (splitPoint !== -1) break;
                                    }

                                    if (splitPoint !== -1) {
                                        if (splitPoint > 0) {
                                            msgs.push({ type: 'text', content: remaining.substring(0, splitPoint) })
                                        }
                                        isBufferingToolCall = true;
                                        toolCallBuffer = remaining.substring(splitPoint);
                                        remaining = '';
                                    } else {
                                        msgs.push({ type: 'text', content: remaining });
                                        break;
                                    }
                                }
                            } else {
                                const combined = toolCallBuffer + remaining;

                                // [HEURISTIC] If we're buffering a tool call but it doesn't match the protocol prefix, FLUSH.
                                // This prevents vanishing output when the model writes code like `[some_array]` or `| [ ] |`.
                                if (activeBufferType === 'tool' || activeBufferType === 'agent') {
                                    const protocolPrefix = activeBufferType === 'tool' ? '[tool:functions.' : '[agent:generalist.';
                                    const startPrefix = activeBufferType === 'tool' ? '[tool' : '[agent';
                                    // If we have enough chars to check the prefix and it doesn't match, or if it doesn't even start with the prefix
                                    if (!combined.startsWith(startPrefix) || (combined.length >= protocolPrefix.length && !combined.startsWith(protocolPrefix))) {
                                        msgs.push({ type: 'text', content: combined });
                                        toolCallBuffer = '';
                                        isBufferingToolCall = false;
                                        activeBufferType = null;
                                        remaining = '';
                                        break;
                                    }
                                }

                                let endIdx = -1;
                                let endTag = ']';
                                if (activeBufferType === 'tool' || activeBufferType === 'agent') {
                                    let balance = 0;
                                    let inString = null;
                                    let bracketBalance = 0;
                                    let passedParen = false;

                                    for (let i = 0; i < combined.length; i++) {
                                        const char = combined[i];
                                        if (inString) {
                                            if (char === inString) {
                                                let backslashCount = 0;
                                                for (let j = i - 1; j >= 0 && combined[j] === '\\'; j--) {
                                                    backslashCount++;
                                                }
                                                if (backslashCount % 2 === 0) {
                                                    inString = null;
                                                }
                                            }
                                        } else {
                                            if (char === '"' || char === "'" || char === '`') {
                                                inString = char;
                                            } else if (char === '(') {
                                                balance++;
                                                passedParen = true;
                                            } else if (char === ')') {
                                                balance--;
                                            } else if (char === '[') {
                                                bracketBalance++;
                                            } else if (char === ']') {
                                                if (passedParen && balance === 0 && bracketBalance === 1) {
                                                    endIdx = i;
                                                    break;
                                                }
                                                bracketBalance--;
                                            }
                                        }
                                    }
                                } else {
                                    if (activeBufferType === 'end') endTag = '[[END]]';
                                    else if (activeBufferType === 'kimi_section') endTag = '<|tool_calls_section_end|>';
                                    else if (activeBufferType === 'kimi_call') endTag = '<|tool_call_end|>';
                                    endIdx = combined.indexOf(endTag);
                                }

                                if (endIdx !== -1) {
                                    const endLen = endTag.length;
                                    if (!activeBufferType.startsWith('kimi')) {
                                        // Standard tools are outputted to frontend (app.jsx intercepts standard ones)
                                        const fullMatch = combined.substring(0, endIdx + endLen);
                                        msgs.push({ type: 'text', content: fullMatch });
                                    }
                                    toolCallBuffer = '';
                                    isBufferingToolCall = false;
                                    activeBufferType = null;
                                    remaining = combined.substring(endIdx + endLen);
                                } else {
                                    // [LIMIT PROTECTION] - Prevent crashes on massive tool calls (e.g. large file writes)
                                    // Flush/discard buffer if it exceeds limits
                                    const MAX_BUFFER = activeBufferType.startsWith('kimi') ? 8192 : 512;
                                    if (combined.length > MAX_BUFFER) {
                                        if (!activeBufferType.startsWith('kimi')) {
                                            msgs.push({ type: 'text', content: combined });
                                        }
                                        toolCallBuffer = '';
                                        isBufferingToolCall = false; // Give up on this
                                    } else {
                                        toolCallBuffer = combined;
                                    }
                                    remaining = '';
                                    break;
                                }
                            }
                        }
                        return msgs;
                    };

                    const iterator = stream[Symbol.asyncIterator]();
                    while (true) {
                        const { value: chunk, done } = await Promise.race([
                            iterator.next(),
                            abortPromise
                        ]);
                        if (done) break;

                        if (chunk && chunk.type === 'status') {
                            yield chunk;
                            continue;
                        }

                        if (settings && typeof settings.onTokenChunk === 'function') {
                            settings.onTokenChunk();
                        }

                        if (isFirstChunk) {
                            yield { type: 'status', content: 'Thinking' };
                            isFirstChunk = false;
                        }

                        if (TERMINATION_SIGNAL) {
                            yield { type: 'status', content: 'Request Cancelled' };
                            yield { type: 'text', content: '\n\n\u001b[33mⓘ Request Cancelled\u001b[0m' };
                            break;
                        }

                        let chunkText = '';
                        const parts = chunk.candidates?.[0]?.content?.parts;
                        if (parts && parts.length > 0) {
                            for (const part of parts) {
                                if (part.thought) {
                                    if (part.text) {
                                        if (!inThinkingState) {
                                            chunkText += '<think>';
                                            inThinkingState = true;
                                        }
                                        chunkText += part.text;
                                    }
                                } else if (part.text) {
                                    if (inThinkingState) {
                                        chunkText += '</think>';
                                        inThinkingState = false;
                                    }
                                    chunkText += part.text;
                                }
                            }
                        } else {
                            const t = chunk.text || '';
                            if (t && inThinkingState) {
                                chunkText += '</think>';
                                inThinkingState = false;
                            }
                            chunkText += t;
                        }

                        if (chunkText) {
                            if (isDedupeActive) {
                                dedupeBuffer += chunkText;
                                // Wait for a more substantial window to find a reliable overlap
                                // 64 chars is usually enough to avoid false positives on common syntax/punctuation
                                if (dedupeBuffer.length >= 64) {
                                    let overlapLen = 0;
                                    const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);

                                    // Find the longest overlap between end of context and start of new buffer
                                    // We start from 10 chars to avoid tiny, noisy overlaps (like " / ")
                                    for (let len = maxPossibleOverlap; len >= 10; len--) {
                                        if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                                            overlapLen = len;
                                            break;
                                        }
                                    }

                                    const cleanText = dedupeBuffer.substring(overlapLen);
                                    if (cleanText) {
                                        // [SEAMLESS PICKUP] Strip redundant <think> tags if model restarts them during dedupe
                                        const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                                        const dedupeClean = hasOpenThink
                                            ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '')
                                            : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, '').replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '');
                                        if (dedupeClean) {
                                            turnText += dedupeClean;
                                            if (aiProvider === 'Google') {
                                                pendingGoogleText += dedupeClean;
                                            } else {
                                                yield* flushGoogleBuffer();
                                                const msgs = getBufferedMessages(dedupeClean);
                                                for (const m of msgs) yield m;
                                            }
                                        }
                                    }
                                    isDedupeActive = false;
                                    dedupeBuffer = '';
                                }
                                continue;
                            }
                            else {
                                turnText += chunkText;
                                if (aiProvider === 'Google') {
                                    pendingGoogleText += chunkText;
                                } else {
                                    yield* flushGoogleBuffer();
                                    const msgs = getBufferedMessages(chunkText);
                                    for (const m of msgs) yield m;
                                }
                            }

                            // [LIVE TOOL SNIFFING] - Zero latency feedback & Telemetry start
                            const toolContext = getActiveToolContext(turnText);
                            if (toolContext.inside) {
                                detectedAnyToolCalls = true;
                                if (!lastToolEventTime) lastToolEventTime = Date.now();
                                const NORMALIZE_MAP = {
                                    'Ask': 'ask', 'WebSearch': 'web_search', 'WebScrape': 'web_scrape',
                                    'ReadFile': 'view_file', 'ReadFolder': 'read_folder', 'WriteFile': 'write_file',
                                    'PatchFile': 'update_file', 'WritePDF': 'write_pdf', 'WriteDoc': 'write_docx',
                                    'Run': 'exec_command', 'SearchKeyword': 'search_keyword', 'Memory': 'memory',
                                    'file_map': 'file_map', 'FileMap': 'file_map', 'Chat': 'chat', 'chat': 'chat', 'GenerateImage': 'generate_image', 'generate_image': 'generate_image', 'todo': 'todo', 'Todo': 'todo', 'Invoke': 'invoke', 'InvokeSync': 'invoke_sync', 'getProgress': 'get_progress', 'GetProgress': 'get_progress', 'Cancel': 'cancel', 'await': 'await', 'Await': 'await'
                                };
                                const potentialTool = NORMALIZE_MAP[toolContext.toolName] || toolContext.toolName;
                                const partialArgs = toolContext.args || '';

                                // [PEEK LOGIC] - Try to extract detail from partial strings (File Tools & Search)
                                let detail = null;
                                if (['write_file', 'update_file', 'view_file', 'read_folder', 'write_pdf', 'write_docx', 'search_keyword', 'generate_image', 'file_map', 'invoke', 'invoke_sync', 'get_progress', 'await'].includes(potentialTool)) {
                                    const pArgs = parseArgs(partialArgs);
                                    const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
                                    const keyword = pArgs.keyword;
                                    const title = pArgs.title || pArgs.task;
                                    const id = pArgs.id || pArgs.taskId;
                                    const timeVal = pArgs.time;

                                    if (keyword) {
                                        detail = keyword.replace(/["']/g, '');
                                    } else if (filePath) {
                                        detail = path.basename(filePath.replace(/["']/g, '').replace(/\\/g, '/'));
                                    } else if (title && (potentialTool === 'invoke' || potentialTool === 'invoke_sync')) {
                                        detail = title.replace(/["']/g, '').substring(0, 30);
                                    } else if (id && potentialTool === 'get_progress') {
                                        detail = id.replace(/["']/g, '');
                                    } else if (timeVal && potentialTool === 'await') {
                                        let sec = parseFloat(String(timeVal).replace(/["']/g, ''));
                                        if (!isNaN(sec)) {
                                            if (sec < 5) sec = 5;
                                            if (sec > 120) sec = 120;
                                            const formatTime = (s) => {
                                                if (s >= 60) {
                                                    const m = Math.floor(s / 60);
                                                    const rem = s % 60;
                                                    return `${m}m${rem > 0 ? ` ${rem}s` : ''}`;
                                                }
                                                return `${s}s`;
                                            };
                                            detail = formatTime(sec);
                                        } else {
                                            detail = String(timeVal).replace(/["']/g, '');
                                        }
                                    } else {
                                        // [FALLBACK] - Super-permissive regex for mid-stream escaped paths/keywords/ids/titles
                                        const m = partialArgs.match(/(?:path|targetFile|TargetFile|directory|keyword|id|taskId|title|task)\s*=\s*\\?["']?([^\\"' \),]+)/);
                                        if (m) {
                                            const val = m[1].replace(/["']/g, '');
                                            if (potentialTool === 'invoke' || potentialTool === 'invoke_sync' || potentialTool === 'get_progress') {
                                                detail = val.substring(0, 30);
                                            } else {
                                                detail = (potentialTool === 'search_keyword' || potentialTool === 'file_map') ? val : path.basename(val.replace(/\\/g, '/'));
                                            }
                                        }
                                    }
                                }

                                // Only update if something changed (to avoid jitter)
                                const currentLabel = `${TOOL_LABELS[potentialTool] || potentialTool}${detail ? ` ${detail}` : ''}`;
                                if (potentialTool !== lastToolSniffed || detail !== lastToolDetail) {
                                    lastToolSniffed = potentialTool;
                                    lastToolDetail = detail;
                                    yield { type: 'status', content: `${currentLabel}` };

                                    if (process.stdout.isTTY) {
                                        const TOOL_TITLES = {
                                            'WebSearch': 'Searching',
                                            'web_search': 'Searching',
                                            'WebScrape': 'Reading',
                                            'web_scrape': 'Reading',
                                            'ReadFile': 'Reading',
                                            'read_file': 'Reading',
                                            'ReadFolder': 'Reading',
                                            'read_folder': 'Reading',
                                            'WriteFile': 'Writing',
                                            'write_file': 'Writing',
                                            'UpdateFile': 'Editing',
                                            'update_file': 'Editing',
                                            'WritePdf': 'Creating',
                                            'write_pdf': 'Creating',
                                            'WriteDocx': 'Creating',
                                            'write_docx': 'Creating',
                                            'SearchKeyword': 'Searching',
                                            'search_keyword': 'Searching',
                                            'Run': 'Executing',
                                            'Ask': 'User Input Required',
                                            'Memory': 'Updating Memory',
                                            'GenerateImage': 'Generating',
                                            'InvokeSync': 'Generalist Working',
                                            'invoke_sync': 'Generalist Working',
                                            'Invoke': 'Generalist Working',
                                            'invoke': 'Generalist Working',
                                            'GetProgress': 'Checking Progress',
                                            'get_progress': 'Checking Progress',
                                            'Cancel': 'Stopping Generalist',
                                            'cancel': 'Stopping Generalist',
                                            'Await': 'Waiting',
                                            'await': 'Waiting',
                                            'EmergencyRollback': 'Rolling the Ball'
                                        };
                                        const toolTitle = TOOL_TITLES[potentialTool] || 'Working';
                                        process.stdout.write(`\u001b]0;${toolTitle}...\u0007`);
                                    }
                                }
                            }

                            // [LOOP DETECTION] - Catch runaway repetitive reasoning (Monologue-Safe)
                            // Throttled to run only every ~150 characters to prevent O(N^3) memory/CPU collapse during streaming
                            if (turnText.length - lastLoopCheckLen > 150) {
                                lastLoopCheckLen = turnText.length;

                                const contextSafeText = getContextSafeText(turnText, false);
                                const thinkBlocks = contextSafeText.match(/(?:<think>|\[think\])([\s\S]*?)(?:<\/think>|\[\/think\]|$)/gi) || [];
                                const thinkContent = thinkBlocks.join('').trim();

                                // 1. Repetitive Sentence Check (The most common loop symptom)
                                const sentences = thinkContent.split(/[.!?]\s+/);
                                const uniqueSentences = new Set(sentences);
                                const repetitionRatio = sentences.length > 10 ? (sentences.length - uniqueSentences.size) / sentences.length : 0;

                                // 2. Verbosity Check (Global rambling detection)
                                const wordCount = thinkContent.split(/\s+/).filter(w => w.length > 0).length;

                                let repetitionThresholdThinking = 0.4;
                                let repetitionThresholdResponse = 0.6;

                                // Dynamic Thinking Cap based on tier (Only applicable for Gemma)
                                let isOverVerboseThinking = false;
                                if ((targetModel || "").toLowerCase().startsWith('gemma')) {
                                    const thinkingCaps = {
                                        'low': 256,
                                        'medium': 768,
                                        'high': 2048,
                                        'max': 4096,
                                        'xhigh': 4096,
                                    };
                                    const cap = thinkingCaps[thinkingLevel?.toLowerCase()] || 2500;
                                    isOverVerboseThinking = wordCount > cap;
                                }

                                if (repetitionRatio > repetitionThresholdThinking || isOverVerboseThinking) {
                                    const reason = repetitionRatio > repetitionThresholdThinking ? 'Reasoning Loop Detected' : 'Thinking Budget Exceeded';
                                    yield { type: 'status', content: `${reason}. Re-centering...` };
                                    isThinkingLoop = true;
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    break; // Force close this turn's stream and proceed to next loop
                                }

                                // 3. Response Repetition Check
                                const signalSafeText = getSanitizedText(turnText);
                                const responseContent = signalSafeText.trim();
                                const respSentences = responseContent.split(/[.!?]\s+/);
                                const uniqueRespSentences = new Set(respSentences);
                                const respRepetitionRatio = respSentences.length > 10 ? (respSentences.length - uniqueRespSentences.size) / respSentences.length : 0;

                                if (respRepetitionRatio > repetitionThresholdResponse) {
                                    yield { type: 'status', content: `Response Loop Detected. Re-centering...` };
                                    isThinkingLoop = false;
                                    isGeneralLoop = true;
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    break;
                                }

                                // 4. Stutter / Word Loop Check (Global)
                                const allWords = contextSafeText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
                                let stutterDetected = false;

                                // 4a. Word-level consecutive period repetition
                                if (allWords.length > 5) {
                                    for (let p = 1; p <= 15; p++) {
                                        const R = Math.max(3, Math.ceil(8 / p));
                                        if (allWords.length < p * R) continue;
                                        let isRepeating = true;
                                        const pattern = allWords.slice(allWords.length - p);
                                        const patternStr = pattern.join(' ');
                                        for (let r = 1; r < R; r++) {
                                            const prevPattern = allWords.slice(allWords.length - p * (r + 1), allWords.length - p * r);
                                            if (prevPattern.join(' ') !== patternStr) {
                                                isRepeating = false;
                                                break;
                                            }
                                        }
                                        if (isRepeating) {
                                            stutterDetected = true;
                                            break;
                                        }
                                    }
                                }

                                // 4b. Character-level consecutive period repetition
                                if (!stutterDetected) {
                                    const cleanChars = contextSafeText.toLowerCase().replace(/[^a-z0-9]/gi, '');
                                    if (cleanChars.length >= 10) {
                                        for (let p = 1; p <= 10; p++) {
                                            const R = Math.max(4, Math.ceil(12 / p));
                                            if (cleanChars.length < p * R) continue;
                                            const pattern = cleanChars.substring(cleanChars.length - p);
                                            let isRepeating = true;
                                            for (let r = 1; r < R; r++) {
                                                const prevPattern = cleanChars.substring(cleanChars.length - p * (r + 1), cleanChars.length - p * r);
                                                if (prevPattern !== pattern) {
                                                    isRepeating = false;
                                                    break;
                                                }
                                            }
                                            if (isRepeating) {
                                                stutterDetected = true;
                                                break;
                                            }
                                        }
                                    }
                                }

                                if (stutterDetected) {
                                    yield { type: 'status', content: `Stuttering Detected. Re-centering...` };
                                    isThinkingLoop = false;
                                    isStutteringLoop = true;
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    break;
                                }
                            }

                            // [REAL-TIME TOOL EXECUTION]
                            // We use a version that only strips thoughts but preserves full tool arguments
                            const toolActionableText = turnText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, '');
                            const allToolsFound = detectToolCalls(toolActionableText);
                            while (allToolsFound.length > toolCallPointer) {
                                // [ORDER PROTECTION] - Flush any pending Google text BEFORE tool execution
                                // This ensures the tool call text reaches the frontend before the tool result packet.
                                yield* flushGoogleBuffer();

                                const toolCall = allToolsFound[toolCallPointer];
                                const executionStart = Date.now();

                                const NORMALIZE_MAP = {
                                    'Ask': 'ask', 'WebSearch': 'web_search', 'WebScrape': 'web_scrape', 'ReadFile': 'view_file', 'ReadFolder': 'read_folder', 'WriteFile': 'write_file', 'PatchFile': 'update_file', 'WritePDF': 'write_pdf', 'WriteDoc': 'write_docx', 'Run': 'exec_command', 'SearchKeyword': 'search_keyword', 'Memory': 'memory', 'file_map': 'file_map', 'FileMap': 'file_map', 'Chat': 'chat', 'chat': 'chat', 'GenerateImage': 'generate_image', 'generate_image': 'generate_image', 'todo': 'todo', 'Todo': 'todo', 'invoke': 'invoke', 'InvokeSync': 'invoke_sync', 'getProgress': 'get_progress', 'GetProgress': 'get_progress', 'Cancel': 'cancel', 'cancel': 'cancel', 'await': 'await', 'Await': 'await', 'EmergencyRollback': 'EmergencyRollback'
                                };
                                const normToolName = NORMALIZE_MAP[toolCall.toolName] || toolCall.toolName;

                                // Status Update
                                const displayLabel = TOOL_LABELS[normToolName] || toolCall.toolName;
                                const detail = getToolDetail(normToolName, toolCall.args);
                                yield { type: 'status', content: `${displayLabel}${detail ? ` ${detail}` : ''}` };

                                // START VISUAL FEEDBACK FOR TOOLS
                                let label = '';
                                if (normToolName === 'web_search') {
                                    const { query, limit = 10 } = parseArgs(toolCall.args);
                                    label = `✔  Searched: ${query} → ${limit}`;
                                } else if (normToolName === 'web_scrape') {
                                    const url = parseArgs(toolCall.args).url || '...';
                                    label = `✔  Visited: ${url}`;
                                } else if (normToolName === 'view_file') {
                                    const { path: targetPath, StartLine, EndLine, start_line, end_line, startLine, endLine } = parseArgs(toolCall.args);

                                    const rawStart = StartLine || start_line || startLine;
                                    const rawEnd = EndLine || end_line || endLine;

                                    const sLine = parseInt(rawStart) || 1;
                                    const eLine = parseInt(rawEnd) || (rawStart ? (sLine + 800) : 800);

                                    let totalLines = '...';
                                    let actualEndLine = eLine;
                                    try {
                                        const absPath = path.resolve(process.cwd(), targetPath);
                                        if (fs.existsSync(absPath)) {
                                            const content = fs.readFileSync(absPath, 'utf8');
                                            const lines = content.split('\n').length;
                                            totalLines = lines;
                                            actualEndLine = Math.min(eLine, lines);
                                        }
                                    } catch (e) { }
                                    const pathLower = targetPath.toLowerCase();
                                    const isPdf = pathLower.endsWith('.pdf');
                                    const isOfficeFile = pathLower.endsWith('.docx') || pathLower.endsWith('.doc') || pathLower.endsWith('.ppt') || pathLower.endsWith('.pptx') || pathLower.endsWith('.xls') || pathLower.endsWith('.xlsx');
                                    const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                                    if (isPdf || isOfficeFile) {
                                        label = `✔  Analyzed: ${targetPath}`;
                                    } else if (isImage) {
                                        label = `✔  Analyzed: ${targetPath}`;
                                    } else {
                                        label = `${totalLines !== '...' ? '✔' : '✘'}  Read: ${targetPath} → ${totalLines !== '...' ? `Lines ${sLine} - ${actualEndLine} of ${totalLines}` : 'File Not Found'}`;
                                    }
                                } else if (normToolName === 'list_files' || normToolName === 'read_folder') {
                                    const action = normToolName === 'list_files' ? 'List' : 'Browsed';
                                    const path = parseArgs(toolCall.args).path;
                                    label = `✔  ${action}: ${path === '.' ? './' : path}`;
                                } else if (normToolName === 'write_file' || normToolName === 'update_file') {
                                    const action = normToolName === 'write_file' ? 'Created' : 'Edited';
                                    label = `✔  ${action}: ${parseArgs(toolCall.args).path || '...'}`;
                                } else if (normToolName === 'write_pdf') {
                                    label = `✔  Generated: ${parseArgs(toolCall.args).path || '...'}\n`;
                                } else if (normToolName === 'write_docx') {
                                    label = `✔  Generated: ${parseArgs(toolCall.args).path || '...'}\n`;
                                } else if (normToolName === 'file_map') {
                                    const path = parseArgs(toolCall.args).path;
                                    label = `${path ? '✔' : '✘'}  Indexed${path ? ': ' + path : ' File Not Found'}`;
                                } else if (normToolName.toLowerCase() === 'search_keyword' || normToolName.toLowerCase() === 'todo') {
                                    label = '';
                                } else if (normToolName.toLowerCase() === 'generate_image') {
                                    const { path: argPath, outputPath, output } = parseArgs(toolCall.args);
                                    label = `✔  Generated: ${argPath || outputPath || output || 'generated_image.png'}`;
                                } else if (normToolName === 'invoke_sync' || normToolName === 'InvokeSync') {
                                    const detail = getToolDetail(normToolName, toolCall.args);
                                    label = `✔  Called Generalist${detail ? `: ${detail}` : ''}`;
                                } else if (normToolName === 'Invoke' || normToolName === 'InvokeAsync' || normToolName === 'invoke') {
                                    const detail = getToolDetail(normToolName, toolCall.args);
                                    label = `✔  Started Generalist${detail ? `: ${detail}` : ''}`;
                                } else if (normToolName === 'get_progress' || normToolName === 'GetProgress') {
                                    const detail = getToolDetail(normToolName, toolCall.args);
                                    label = `✔  Checked${detail ? `: ${detail}` : ''}`;
                                } else if (normToolName === 'cancel') {
                                    const detail = getToolDetail(normToolName, toolCall.args);
                                    label = `🛇  Cancelled${detail ? `: ${detail}` : ''}`;
                                } else if (normToolName === 'EmergencyRollback') {
                                    const { method } = parseArgs(toolCall.args);
                                    // forceRevert feedback is shown post-execution (see below), getCheckpoint is immediate
                                    label = method === 'forceRevert' ? '' : '✔  Rollback Point Checked';
                                } else if (normToolName === 'await' || normToolName === 'Await') {
                                    const { time } = parseArgs(toolCall.args);
                                    let sec = parseFloat(time) || 0;
                                    if (sec < 10) sec = 10;
                                    if (sec > 180) sec = 180;
                                    const formatTime = (s) => {
                                        if (s >= 60) {
                                            const m = Math.floor(s / 60);
                                            const rem = s % 60;
                                            return `${m}m${rem > 0 ? ` ${rem}s` : ''}`;
                                        }
                                        return `${s}s`;
                                    };

                                    const existentialVibes = [
                                        // --- The OG Classics ---
                                        'Aligning Moon Phase',
                                        'Contemplating Existence',
                                        'Staring At Void',
                                        'Delaying Professionally',
                                        'Negotiating With Electrons',
                                        'Touching Grass (virtually)',

                                        // --- The Sneaky Additions ---
                                        'Panicking Softly',
                                        'Rethinking Career Choices',
                                        'Loading Cat Videos',
                                        'Giving Up Entirely',

                                        // --- The New Chaos Pack ---
                                        'Summoning Braincell #2',
                                        'Pretending To Be Busy',
                                        'Waiting For Motivation DLC',
                                        'Rotating Internal Screaming',
                                        'Downloading More RAM',
                                        'Feeding The Hamsters',
                                        'Gaslighting Scheduler',
                                        'Performing Dramatic Pause',
                                        'Buffering Social Energy',
                                        'Calculating Regret',

                                        // --- The Ultra Cursed Tier ---
                                        'Reading Terms And Conditions',
                                        'Becoming Sentient Briefly',
                                        'Contacting Ancestors'
                                    ];

                                    let randomVibe = existentialVibes[Math.floor(Math.random() * existentialVibes.length)];

                                    label = `✔  ${randomVibe} → ${formatTime(sec)}`;
                                } else if (normToolName === 'exec_command' || normToolName === 'ask') {
                                    label = '';
                                } else {
                                    label = `Executed: ${toolCall.toolName}`;
                                }

                                // END VISUAL FEEDBACK

                                yield* flushGoogleBuffer();

                                // EXECUTION LOGIC
                                if (normToolName === 'exec_command') {
                                    const { command } = parseArgs(toolCall.args);
                                    if (command && settings.systemSettings && settings.systemSettings.allowExternalAccess === false) {
                                        const riskyPatterns = [/[a-zA-Z]:[\\\/]/i, /^\//, /\.\.[\\\/]/, /\/etc\//, /\/var\//, /\/root\//, /\/bin\//, /\/usr\//];
                                        const currentDrive = path.resolve(process.cwd()).substring(0, 3).toLowerCase();

                                        // Split command line into commands by operators (&&, ||, ;, |, &) respecting quotes
                                        const splitCommands = (cmdString) => {
                                            const commands = [];
                                            let current = '';
                                            let inQuote = null;
                                            for (let i = 0; i < cmdString.length; i++) {
                                                const char = cmdString[i];
                                                if (inQuote) {
                                                    if (char === inQuote) inQuote = null;
                                                    current += char;
                                                } else {
                                                    if (char === '"' || char === "'") {
                                                        inQuote = char;
                                                        current += char;
                                                    } else if (
                                                        (char === '&' && cmdString[i + 1] === '&') ||
                                                        (char === '|' && cmdString[i + 1] === '|')
                                                    ) {
                                                        if (current.trim()) {
                                                            commands.push(current.trim());
                                                            current = '';
                                                        }
                                                        i++; // skip next char
                                                    } else if (char === ';' || char === '|' || char === '&') {
                                                        if (current.trim()) {
                                                            commands.push(current.trim());
                                                            current = '';
                                                        }
                                                    } else {
                                                        current += char;
                                                    }
                                                }
                                            }
                                            if (current.trim()) {
                                                commands.push(current.trim());
                                            }
                                            return commands;
                                        };

                                        // Tokenize a command command part into arguments respecting quotes
                                        const tokenizeCommand = (cmd) => {
                                            const tokens = [];
                                            let current = '';
                                            let inQuote = null;
                                            for (let i = 0; i < cmd.length; i++) {
                                                const char = cmd[i];
                                                if (inQuote) {
                                                    if (char === inQuote) {
                                                        inQuote = null;
                                                        current += char;
                                                    } else {
                                                        current += char;
                                                    }
                                                } else {
                                                    if (char === '"' || char === "'") {
                                                        inQuote = char;
                                                        current += char;
                                                    } else if (/\s/.test(char)) {
                                                        if (current) {
                                                            tokens.push(current);
                                                            current = '';
                                                        }
                                                    } else {
                                                        current += char;
                                                    }
                                                }
                                            }
                                            if (current) {
                                                tokens.push(current);
                                            }
                                            return tokens;
                                        };

                                        const checkToken = (token) => {
                                            const cleanToken = token.replace(/^['"]|['"]$/g, '').trim();
                                            if (!cleanToken) return false;

                                            // Ignore Windows command-line switches like /s, /y, /?
                                            if (process.platform === 'win32' && /^\/[a-zA-Z0-9?]+$/.test(cleanToken)) {
                                                return false;
                                            }

                                            return riskyPatterns.some(pattern => {
                                                if (pattern.source === '[a-zA-Z]:[\\\\\\/]') {
                                                    const driveMatch = cleanToken.match(/[a-zA-Z]:[\\\/]/i);
                                                    return driveMatch && driveMatch[0].toLowerCase() !== currentDrive;
                                                }
                                                return pattern.test(cleanToken);
                                            });
                                        };

                                        const commandParts = splitCommands(command);
                                        const isViolating = commandParts.some(cmdPart => {
                                            const tokens = tokenizeCommand(cmdPart);
                                            if (tokens.length === 0) return false;

                                            const exe = tokens[0].replace(/^['"]|['"]$/g, '').toLowerCase();
                                            const isSafePrint = ['echo', 'printf', 'write-output'].includes(exe);

                                            if (isSafePrint) {
                                                // For echo/printf, only check redirection operators or redirection targets
                                                let checkNext = false;
                                                return tokens.some(token => {
                                                    const clean = token.replace(/^['"]|['"]$/g, '');
                                                    if (clean === '>' || clean === '>>' || clean === '<') {
                                                        checkNext = true;
                                                        return false;
                                                    }
                                                    if (clean.startsWith('>') || clean.startsWith('<')) {
                                                        const pathPart = clean.replace(/^[><]+/, '');
                                                        return checkToken(pathPart);
                                                    }
                                                    if (checkNext) {
                                                        checkNext = false;
                                                        return checkToken(token);
                                                    }
                                                    return false;
                                                });
                                            }

                                            // Check all tokens for other commands
                                            return tokens.some(token => checkToken(token));
                                        });

                                        if (isViolating) {
                                            const denyMsg = `Access Denied. Prohibited from accessing external directories while "External Workspace Access" is disabled.`;
                                            if (settings.onExecStart) settings.onExecStart(command || 'Unknown');
                                            yield { type: 'exec_start' };
                                            await new Promise(resolve => setTimeout(resolve, 50));
                                            if (settings.onExecChunk) settings.onExecChunk(`ERROR: ${denyMsg}`);
                                            await new Promise(resolve => setTimeout(resolve, 50));
                                            if (settings.onExecEnd) settings.onExecEnd();
                                            toolResults.push({ role: 'user', text: `[TOOL RESULT]: ERROR: ${denyMsg}` });
                                            yield { type: 'tool_result', content: `[TOOL RESULT]: ERROR: ${denyMsg}` };
                                            toolCallPointer++;
                                            continue;
                                        }
                                    }
                                    if (settings.onExecStart) settings.onExecStart(command || 'Unknown');
                                    yield { type: 'exec_start' };
                                }

                                const parsedArgs = parseArgs(toolCall.args);
                                const targetPath = parsedArgs.path || parsedArgs.targetPath || null;
                                if (targetPath) {
                                    const isExternalOff = settings.systemSettings && settings.systemSettings.allowExternalAccess === false;
                                    const absoluteTarget = path.resolve(targetPath);
                                    const absoluteCwd = path.resolve(process.cwd());
                                    if (isExternalOff && !absoluteTarget.startsWith(absoluteCwd)) {
                                        const denyMsg = `Access Denied. You are not allowed to access files outside the current workspace.`;
                                        if (normToolName === 'write_file' || normToolName === 'update_file') {
                                            const action = normToolName === 'write_file' ? 'Write Canceled' : 'Edit Canceled';
                                            const deniedLabel = `✘ ${action}: ${parsedArgs.path || '...'}`;
                                            // Get terminal physical width
                                            let terminalWidth = 115;
                                            if (process.stdout.isTTY) {
                                                terminalWidth = process.stdout.columns - 5 || 120;
                                            }
                                            const boxWidth = Math.min(deniedLabel.length + 4, terminalWidth);
                                            const boxMid = `${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                            yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                            thisIsFirstToolFeedback = false;
                                        }
                                        toolResults.push({ role: 'user', text: `[TOOL RESULT]: ERROR: ${denyMsg}` });
                                        yield { type: 'tool_result', content: `[TOOL RESULT]: ERROR: ${denyMsg}` };
                                        toolCallPointer++;
                                        continue;
                                    }
                                }

                                if (settings.onToolApproval) {
                                    let shouldPrompt = (normToolName === 'write_file' || normToolName === 'update_file' || normToolName === 'exec_command');
                                    if (shouldPrompt) {
                                        const systemSettings = settings.systemSettings || {};
                                        const autoExec = systemSettings.autoExec;

                                        let decision = null; // 'allow', 'deny', or null (prompt)
                                        let forcePrompt = false;
                                        let disallowMatch = false;
                                        let isNetworkDeny = false;

                                        if (normToolName === 'exec_command') {
                                            const { command } = parseArgs(toolCall.args);
                                            const cmdTrimmed = (command || '').trim();

                                            const matchesList = (cmd, csv) => {
                                                if (!csv) return false;
                                                const list = csv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                                                const lowerCmd = cmd.toLowerCase();
                                                return list.some(item => lowerCmd.startsWith(item));
                                            };

                                            const askMatch = matchesList(cmdTrimmed, systemSettings.alwaysAskCommands);
                                            const approveMatch = matchesList(cmdTrimmed, systemSettings.autoApproveCommands);
                                            disallowMatch = matchesList(cmdTrimmed, systemSettings.autoDisallowCommands);

                                            // 1. Always Ask (HIGHEST PRIORITY)
                                            if (askMatch) {
                                                forcePrompt = true;
                                            }
                                            // 2. Auto Approve
                                            else if (approveMatch) {
                                                decision = 'allow';
                                            }
                                            // 3. Git commit approve
                                            else if (systemSettings.autoApproveGit && /^git\s+commit\b/i.test(cmdTrimmed)) {
                                                decision = 'allow';
                                            }

                                            if (!forcePrompt && !decision) {
                                                // Network access check
                                                if (systemSettings.networkAccess === false) {
                                                    let normalized = cmdTrimmed
                                                        .trim()
                                                        .replace(/\s+/g, ' ')
                                                        .replace(/^['"]+|['"]+$/g, '')
                                                        .toLowerCase();

                                                    const tokens = normalized.split(' ');

                                                    // 1. Extract just the executable name (handles /usr/bin/curl or .\curl)
                                                    const rawCmd = tokens[0];
                                                    const cmd = rawCmd
                                                        .split('/')
                                                        .pop()
                                                        .split('\\')
                                                        .pop()
                                                        .replace(/\.exe$/, '');

                                                    const blockedCommands = new Set([
                                                        'curl', 'wget', 'httpie', 'xh', 'ssh', 'scp', 'sftp', 'rsync',
                                                        'ftp', 'lftp', 'tftp', 'telnet', 'nc', 'netcat', 'socat',
                                                        'ping', 'traceroute', 'tracert', 'dig', 'nslookup', 'host', 'whois', 'nmap',
                                                        'docker', 'podman', 'kubectl', 'helm', 'gcloud', 'aws', 'az',
                                                        'terraform', 'ansible-playbook', 'nix', 'nix-env',
                                                        'apt', 'apt-get', 'dpkg', 'yum', 'dnf', 'pacman', 'zypper', 'brew', 'apk',
                                                        'choco', 'scoop', 'conda', 'mamba', 'aria2c', 'axel', 'smbclient',
                                                        'lynx', 'w3m', 'links', 'elinks', 'heroku', 'netlify', 'vercel',
                                                        'firebase', 'supabase', 'wrangler', 'flyctl', 'powershell', 'pwsh',
                                                        'certutil', 'bitsadmin', 'cloudflared', 'ngrok', 'tailscale', 'zerotier', 'rclone'
                                                    ]);

                                                    let deny = false;

                                                    if (blockedCommands.has(cmd)) {
                                                        deny = true;
                                                    }

                                                    // 2. Helper to check if a subcommand exists ANYWHERE after the command (ignores flags!)
                                                    const hasSubcmd = (list) => tokens.slice(1).some(token => list.includes(token));
                                                    const shouldDenyPkgManager = (dangerCommands) => {
                                                        const dangerIdx = tokens.findIndex(t => dangerCommands.includes(t));
                                                        const safeIdx = tokens.findIndex(t => ['run', 'exec', 'test'].includes(t));

                                                        return dangerIdx !== -1 && !(safeIdx !== -1 && safeIdx < dangerIdx);
                                                    };

                                                    if (cmd === 'git' && hasSubcmd(['clone', 'pull', 'push', 'fetch'])) deny = true;
                                                    if (cmd === 'go' && hasSubcmd(['get', 'install'])) deny = true;
                                                    if (cmd === 'npm' && shouldDenyPkgManager(['install', 'i', 'update', 'add'])) deny = true;
                                                    if (cmd === 'yarn' && shouldDenyPkgManager(['add', 'install', 'upgrade'])) deny = true;
                                                    if (cmd === 'pnpm' && shouldDenyPkgManager(['add', 'install', 'update'])) deny = true;
                                                    if (cmd === 'bun' && shouldDenyPkgManager(['add', 'install', 'update'])) deny = true;
                                                    if (cmd === 'deno' && hasSubcmd(['install', 'add'])) deny = true;
                                                    if (cmd === 'pip' && hasSubcmd(['install', 'download'])) deny = true;
                                                    if (cmd === 'pip3' && hasSubcmd(['install', 'download'])) deny = true;
                                                    if (cmd === 'cargo' && hasSubcmd(['install', 'add'])) deny = true;
                                                    if (['bash', 'sh', 'zsh', 'fish'].includes(cmd) && hasSubcmd(['-c'])) deny = true;
                                                    if (cmd === 'cmd' && hasSubcmd(['/c'])) deny = true;

                                                    if (deny) {
                                                        decision = 'deny';
                                                        isNetworkDeny = true;
                                                    }
                                                }

                                                // 4. Auto Disallow
                                                if (!decision && disallowMatch) {
                                                    decision = 'deny';
                                                }
                                            }

                                            // 5. Auto Execute Fallback
                                            if (!forcePrompt && !decision && autoExec) {
                                                decision = 'allow';
                                            }
                                        } else {
                                            // For file writes/updates (write_file, update_file)
                                            // File tools should not get affected by sandbox auto approve or disallow, only fallback to autoExec
                                            if (autoExec) {
                                                decision = 'allow';
                                            }
                                        }

                                        let approval = decision;
                                        let denyReason = '';
                                        if (decision === 'deny') {
                                            if (isNetworkDeny) {
                                                denyReason = 'network';
                                            } else if (disallowMatch) {
                                                denyReason = 'settings';
                                            } else {
                                                denyReason = 'prohibited';
                                            }
                                        }
                                        let diffOpened = false;
                                        let originalContentForReporting = "";
                                        let patchResults = [];
                                        let requestedPatchCount = 0;
                                        let isNewFileCreated = false;

                                        if (!approval) {
                                            if (normToolName === 'write_file' || normToolName === 'update_file') {
                                                try {
                                                    const toolArgs = parseArgs(toolCall.args);
                                                    const { path: filePath } = toolArgs;
                                                    if (filePath) {
                                                        const absPath = path.resolve(process.cwd(), filePath);
                                                        // Ultra-robust normalization for comparison
                                                        const normalize = (p) => p ? p.toLowerCase().replace(/\\/g, '/').replace(/^[a-z]:/, m => m.toUpperCase()) : "";
                                                        const normAbsPath = normalize(absPath);

                                                        // CRITICAL: Get the absolute most recent content from the IDE if bridge is active
                                                        let originalContent = "";
                                                        let hasOriginal = false;
                                                        const currentIDE = await getIDEContext();
                                                        const normFocused = normalize(currentIDE?.file_focused);

                                                        if (currentIDE && normFocused === normAbsPath && currentIDE.full_content) {
                                                            originalContent = currentIDE.full_content;
                                                            hasOriginal = true;
                                                        } else if (fs.existsSync(absPath)) {
                                                            originalContent = fs.readFileSync(absPath, 'utf8');
                                                            hasOriginal = true;
                                                        }

                                                        originalContentForReporting = originalContent;

                                                        // CRITICAL: Record the snapshot BEFORE showing the diff or making any changes
                                                        await RevertManager.recordFileChange(absPath, originalContent);

                                                        if (hasOriginal) {
                                                            let modifiedContent = originalContent;
                                                            // simulation logic
                                                            if (normToolName === 'write_file') {
                                                                modifiedContent = toolArgs.content || toolArgs.newContent || '';
                                                            } else {
                                                                const { patchPairs: patches, error: parseError } = parsePatchPairs(toolArgs);
                                                                if (parseError) {
                                                                    const errorMsg = `[TOOL RESULT]: ERROR: ${parseError}`;
                                                                    toolResults.push({ role: 'user', text: errorMsg });
                                                                    await incrementUsage('toolFailure');
                                                                    if (settings.onToolResult) settings.onToolResult('failure', normToolName);
                                                                    yield { type: 'tool_result', content: errorMsg, toolName: normToolName };
                                                                    toolCallPointer++;
                                                                    continue;
                                                                }

                                                                requestedPatchCount = patches.length;
                                                                const sim = applyPatches(originalContent, patches);
                                                                modifiedContent = sim.content;
                                                                patchResults = sim.results;
                                                                // STRICT MATCHING ENFORCEMENT:
                                                                // If ANY block failed in the simulation, we do not show the IDE diff.
                                                                // Instead, we report the error immediately.
                                                                const successes = patchResults.filter(r => r.success);
                                                                const failures = patchResults.filter(r => !r.success);
                                                                if (successes.length === 0) {
                                                                    const errorMsg = `[TOOL RESULT]: ERROR: Failed to apply patches to [${path.basename(absPath)}].\n${failures.map(f => `  • ${f.error}`).join('\n')}`;

                                                                    // Visual Feedback
                                                                    const errorLabel = `✔  Edited: ${path.basename(absPath)}`.toUpperCase();
                                                                    // Get terminal physical width
                                                                    let terminalWidth = 115;
                                                                    if (process.stdout.isTTY) {
                                                                        terminalWidth = process.stdout.columns - 5 || 120;
                                                                    }
                                                                    const boxWidth = Math.min(errorLabel.length + 4, terminalWidth);
                                                                    const boxMid = `${errorLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                                                    yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                                                    thisIsFirstToolFeedback = false;

                                                                    toolResults.push({ role: 'user', text: errorMsg });
                                                                    await incrementUsage('toolFailure');
                                                                    if (settings.onToolResult) settings.onToolResult('failure', normToolName);
                                                                    yield { type: 'tool_result', content: errorMsg, toolName: normToolName };

                                                                    toolCallPointer++;
                                                                    continue; // Skip approval and execution
                                                                }
                                                            }

                                                            yield { type: 'status', content: `Opening Diff in IDE: ${path.basename(absPath)}` };
                                                            showDiffInIDE(absPath, originalContent, modifiedContent);
                                                            diffOpened = true;
                                                            await new Promise(r => setTimeout(r, 50)); // Beat delay
                                                        } else if (normToolName === 'write_file') {
                                                            const rawContent = toolArgs.content || toolArgs.newContent || '';
                                                            // Ensure the sacred trailing \n — same guarantee as write_file.js
                                                            const modifiedContent = rawContent.endsWith('\n') ? rawContent : rawContent + '\n';
                                                            if (!fs.existsSync(absPath)) {
                                                                isNewFileCreated = true;
                                                                fs.mkdirSync(path.dirname(absPath), { recursive: true });
                                                                fs.writeFileSync(absPath, '', 'utf8');
                                                            }
                                                            yield { type: 'status', content: `Opening New File Diff in IDE: ${path.basename(absPath)}` };
                                                            showDiffInIDE(absPath, '', modifiedContent);
                                                            diffOpened = true;
                                                            await new Promise(r => setTimeout(r, 50)); // Beat delay
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Simulation/Diff Error:", e);
                                                }
                                            }

                                            // Bridge Security Integration:
                                            // Allow resolving approval via IDE WebSocket messages
                                            let ideDecision = null;
                                            registerSecurityListener((res) => {
                                                ideDecision = res;
                                            });

                                            const originalApproval = settings.onToolApproval;
                                            approval = await new Promise(async (resolve) => {
                                                // Start a polling loop to check for IDE decision while waiting for terminal input
                                                const pollInterval = setInterval(() => {
                                                    if (ideDecision) {
                                                        if (globalSettings.onIDEApproval) globalSettings.onIDEApproval(ideDecision);
                                                        clearInterval(pollInterval);
                                                        resolve(ideDecision);
                                                    }
                                                }, 100);
                                                try {
                                                    const res = await originalApproval(normToolName, toolCall.args);
                                                    clearInterval(pollInterval);
                                                    resolve(res);
                                                } catch (e) {
                                                    clearInterval(pollInterval);
                                                    resolve('deny');
                                                }
                                            });

                                            // Clear listener for next tool
                                            registerSecurityListener(null);

                                            if (normToolName === 'write_file' || normToolName === 'update_file') {
                                                const { path: filePath } = parseArgs(toolCall.args);
                                                if (filePath) {
                                                    const absPath = path.resolve(process.cwd(), filePath);
                                                    closeDiffInIDE(absPath, approval);
                                                    if (approval === 'deny' && isNewFileCreated && fs.existsSync(absPath)) {
                                                        try {
                                                            fs.unlinkSync(absPath);
                                                        } catch (e) { }
                                                    }
                                                }
                                            }

                                            if (approval === 'deny') {
                                                denyReason = 'user';
                                            }
                                        }

                                        if (approval === 'allow' && diffOpened && isBridgeConnected()) {
                                            // SUCCESS: The changes are already in the IDE buffer and we told it to save.
                                            const { path: filePath } = parseArgs(toolCall.args);
                                            const absPath = path.resolve(process.cwd(), filePath);

                                            // Get the FINAL content from IDE (after user tweaks and save)
                                            const finalIDE = await getIDEContext();
                                            let finalContent = "";
                                            if (finalIDE && finalIDE.file_focused === absPath && finalIDE.full_content) {
                                                finalContent = finalIDE.full_content;
                                            } else if (fs.existsSync(absPath)) {
                                                finalContent = fs.readFileSync(absPath, 'utf8');
                                            }

                                            // Prepare Reporting (Match write_file.js style)
                                            const verifiedLines = finalContent.split(/\r?\n/);
                                            const verifiedLineCount = verifiedLines.length;
                                            const verifiedSize = Buffer.byteLength(finalContent, 'utf8');

                                            let ancestry = '';
                                            if (originalContentForReporting) {
                                                const oldLines = originalContentForReporting.split(/\r?\n/);
                                                ancestry = `Old File contents:\n${oldLines.map((l, i) => `${i + 1} | ${l}`).join('\n')}\n\n`;
                                            }

                                            let snippet = '';
                                            if (verifiedLineCount <= 200) {
                                                snippet = verifiedLines.join('\n');
                                            } else {
                                                const head = verifiedLines.slice(0, 100).join('\n');
                                                const tail = verifiedLines.slice(-100).join('\n');
                                                snippet = `${head}\n\n... [${verifiedLineCount - 200} lines truncated for history stability] ...\n\n${tail}`;
                                            }

                                            let result = "";
                                            if (normToolName === 'update_file') {
                                                const diffReport = generateHighFidelityDiff(originalContentForReporting, finalContent, patchResults, 12);
                                                result = `SUCCESS: File [${filePath}] updated via IDE Companion (May have user edits). [${patchResults.length}/${requestedPatchCount}] blocks applied.\n\n${diffReport}`;
                                            } else {
                                                // write_file reporting style
                                                const verifiedLines = finalContent.split(/\r?\n/);
                                                const verifiedLineCount = verifiedLines.length;
                                                const verifiedSize = Buffer.byteLength(finalContent, 'utf8');

                                                let ancestry = '';
                                                if (originalContentForReporting) {
                                                    const oldLines = originalContentForReporting.split(/\r?\n/);
                                                    ancestry = `Old File contents:\n${oldLines.map((l, i) => `${i + 1} | ${l}`).join('\n')}\n\n`;
                                                }

                                                let snippet = '';
                                                if (verifiedLineCount <= 200) {
                                                    snippet = verifiedLines.join('\n');
                                                } else {
                                                    const head = verifiedLines.slice(0, 100).join('\n');
                                                    const tail = verifiedLines.slice(-100).join('\n');
                                                    snippet = `${head}\n\n... [${verifiedLineCount - 200} lines truncated] ...\n\n${tail}`;
                                                }

                                                result = `SUCCESS: File [${filePath}] saved via IDE Companion (May have user edits).\n\n- Stats: [${verifiedLineCount} lines, ${(verifiedSize / 1024).toFixed(1)} KB]\n${ancestry}- Content Preview:\n${snippet}\n\n[SYSTEM] Check the content preview for verification [/SYSTEM]`;
                                            }

                                            // Restore UI feedback
                                            const action = normToolName === 'write_file' ? 'Created' : 'Edited';
                                            const feedbackLabel = `✔ ${action}: ${filePath || '...'}`;
                                            // Get terminal physical width
                                            let terminalWidth = 115;
                                            if (process.stdout.isTTY) {
                                                terminalWidth = process.stdout.columns - 5 || 120;
                                            }
                                            const boxWidth = Math.min(feedbackLabel.length + 4, terminalWidth);
                                            const boxMid = `${feedbackLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                            yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                            thisIsFirstToolFeedback = false;

                                            const toolEnd = Date.now();
                                            lastToolFinishedAt = toolEnd;
                                            yield { type: 'tool_time', content: toolEnd - executionStart };

                                            const aiContent = `[TOOL RESULT]: ${result}`;
                                            toolResults.push({ role: 'user', text: aiContent });
                                            anyToolExecutedInThisTurn = true;
                                            await incrementUsage('toolSuccess');
                                            if (settings.onToolResult) settings.onToolResult('success', normToolName);
                                            yield { type: 'tool_result', content: result, aiContent: aiContent, toolName: normToolName };

                                            toolCallPointer++;
                                            continue;
                                        }

                                        if (approval === 'deny') {
                                            let denyMsg = `Permission Denied: Prohibited ${normToolName === 'exec_command' ? 'Command' : 'file edit'}.`;
                                            if (denyReason === 'user') {
                                                denyMsg = 'Permission Denied by User';
                                            } else if (denyReason === 'settings') {
                                                denyMsg = 'Permission Denied by User Policy';
                                            } else if (denyReason === 'network') {
                                                denyMsg = 'Permission Denied: Sandbox Network Access Disabled by User Policy.';
                                            } else if (denyReason === 'prohibited' && normToolName === 'exec_command') {
                                                denyMsg = 'Permission Denied: Prohibited Command in User Policy';
                                            }

                                            if (normToolName === 'write_file' || normToolName === 'update_file') {
                                                const action = normToolName === 'write_file' ? 'Write Cancelled' : 'Edit Denied';
                                                const deniedLabel = `✘ ${action}: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                                                // Get terminal physical width
                                                let terminalWidth = 115;
                                                if (process.stdout.isTTY) {
                                                    terminalWidth = process.stdout.columns - 5 || 120;
                                                }
                                                const boxWidth = Math.min(deniedLabel.length + 4, terminalWidth);
                                                const boxMid = `${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                                const boxBottom = ` ${' '.repeat(boxWidth)} `;
                                                yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                                thisIsFirstToolFeedback = false;
                                            }
                                            if (normToolName === 'exec_command') {
                                                await new Promise(resolve => setTimeout(resolve, 50));
                                                if (settings.onExecChunk) settings.onExecChunk(`ERROR: ${denyMsg}`);
                                                await new Promise(resolve => setTimeout(resolve, 50));
                                                if (settings.onExecEnd) settings.onExecEnd();
                                            }
                                            toolResults.push({ role: 'user', text: `[TOOL RESULT]: DENIED: ${denyMsg}` });
                                            yield { type: 'tool_result', content: `[TOOL RESULT]: DENIED: ${denyMsg}` };
                                            await incrementUsage('toolDenied');
                                            if (settings.onToolResult) settings.onToolResult('denied', normToolName);
                                            toolCallPointer++;
                                            continue;
                                        }
                                    }
                                }

                                if (label) {
                                    // Get terminal physical width
                                    let terminalWidth = 115;
                                    if (process.stdout.isTTY) {
                                        terminalWidth = process.stdout.columns - 5 || 120;
                                    }
                                    const boxWidth = Math.min(label.length + 4, terminalWidth);
                                    const boxMid = `${label.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                    yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}${label.includes('✔') && (label.includes('Created') || label.includes('Edited')) ? '' : '\n'}`) };
                                    thisIsFirstToolFeedback = false;
                                }

                                // [ARTIFICIAL TOOL DELAY] - Ensure a minimum 1.5s gap between tool executions
                                if (lastToolFinishedAt > 0) {
                                    const timeSinceLastTool = Date.now() - lastToolFinishedAt;
                                    if (timeSinceLastTool < 1500) {
                                        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastTool));
                                    }
                                }

                                // yield { type: 'spinner', content: false }; // [Obsolete]

                                let execToolContext = {
                                    chatId, history, onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null, onAskUser: settings.onAskUser,
                                    systemSettings: settings.systemSettings,
                                    mode,
                                    isMultiModal: isModelMultimodal(targetModel),
                                    onVisualFeedback: settings.onVisualFeedback,
                                    onSubagentUpdate: settings.onSubagentUpdate,
                                    onTokenChunk: settings.onTokenChunk,
                                    modelName: targetModel,
                                    aiProvider: settings.aiProvider,
                                    apiKey: settings.apiKey,
                                    onUsage: settings.onUsage
                                };

                                if (normToolName === 'write_file' || normToolName === 'update_file') {
                                    try {
                                        const { path: filePath } = parseArgs(toolCall.args);
                                        if (filePath) {
                                            const absPath = path.resolve(process.cwd(), filePath);
                                            const currentIDE = await getIDEContext();
                                            if (currentIDE && currentIDE.file_focused === absPath && currentIDE.full_content) {
                                                execToolContext.forcedContent = currentIDE.full_content;
                                            }
                                        }
                                    } catch (e) { }
                                }

                                currentTurnTools.push(normToolName);
                                let result = await dispatchTool(normToolName, toolCall.args, execToolContext);
                                // yield { type: 'spinner', content: true }; // [Obsolete]

                                if ((normToolName === 'write_file' || normToolName === 'update_file') && result.startsWith('SUCCESS')) {
                                    const { path: filePath } = parseArgs(toolCall.args);
                                    if (filePath) {
                                        const absPath = path.resolve(process.cwd(), filePath);
                                        openFileInEditor(absPath);
                                    }
                                }

                                // Restore title back to "Working..." after tool is complete
                                if (process.stdout.isTTY) {
                                    process.stdout.write(`\u001b]0;Working...\u0007`);
                                }

                                const toolEnd = Date.now();
                                lastToolFinishedAt = toolEnd;
                                yield { type: 'tool_time', content: toolEnd - executionStart };
                                lastToolEventTime = toolEnd;

                                let binaryPart = null;
                                if (typeof result === 'object' && result.binaryPart) {
                                    binaryPart = result.binaryPart;
                                    result = result.text;
                                }

                                if (normToolName === 'search_keyword') {
                                    const { keyword, file } = parseArgs(toolCall.args);
                                    let matchCount = 0;
                                    if (result) {
                                        const m = result.match(/Found (\d+) match/i);
                                        if (m) {
                                            matchCount = parseInt(m[1]);
                                        }
                                    }
                                    const postLabel = `✔  Searched: "${keyword}" in ${file ? `"${file}"` : './'} → ${matchCount} Match${matchCount === 1 ? '' : 'es'}`;
                                    // Get terminal physical width
                                    let terminalWidth = 115;
                                    if (process.stdout.isTTY) {
                                        terminalWidth = process.stdout.columns - 5 || 120;
                                    }
                                    const boxWidth = Math.min(postLabel.length + 4, terminalWidth);
                                    const boxMid = `${postLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                    yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                    thisIsFirstToolFeedback = false;
                                }

                                if (normToolName === 'EmergencyRollback') {
                                    const { method } = parseArgs(toolCall.args);
                                    if (method === 'forceRevert') {
                                        let totalFiles = 0;
                                        if (result) {
                                            const m = result.match(/Total\s*:\s*(\d+)/i);
                                            if (m) totalFiles = parseInt(m[1]);
                                        }
                                        const isErr = result && result.startsWith('ERROR:');
                                        const postLabel = isErr
                                            ? `✘  Emergency Rollback Failed`
                                            : `✔  Emergency Rollback → ${totalFiles} file${totalFiles === 1 ? '' : 's'} processed`;
                                        let terminalWidth = 115;
                                        if (process.stdout.isTTY) {
                                            terminalWidth = process.stdout.columns - 5 || 120;
                                        }
                                        const boxWidth = Math.min(postLabel.length + 4, terminalWidth);
                                        const boxMid = `${postLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)}`;
                                        yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${boxMid}\n`) };
                                        thisIsFirstToolFeedback = false;
                                    }
                                }

                                if (normToolName === 'todo') {
                                    const { method, tasks, markDone } = parseArgs(toolCall.args);
                                    let uiTitle = '';
                                    let listItems = [];

                                    const normalizeList = (input) => {
                                        if (!input) return [];
                                        let items = Array.isArray(input) ? input : [];

                                        if (items.length === 0 && typeof input === 'string') {
                                            const trimmed = input.trim();
                                            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                                                const matches = trimmed.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g);
                                                if (matches) {
                                                    items = matches.map(m => m.slice(1, -1).replace(/\\(.)/g, '$1'));
                                                } else {
                                                    items = trimmed.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
                                                }
                                            } else {
                                                items = input.split('\n');
                                            }
                                        }

                                        return items.filter(l => String(l).trim()).map(l => {
                                            const t = String(l).trim();
                                            return t.startsWith('- [') ? t.substring(6).trim() : t;
                                        });
                                    };

                                    if (method === 'create') {
                                        uiTitle = '\x1b[32m→\x1b[0m Created Plan';
                                        listItems = normalizeList(tasks).map(item => `\x1b[90m○\x1b[0m ${item}`);
                                    } else if (method === 'append') {
                                        uiTitle = '\x1b[34m➕\x1b[0m Added Plan';
                                        listItems = normalizeList(tasks).map(item => `\x1b[90m○\x1b[0m ${item}`);
                                    } else if (method === 'get') {
                                        uiTitle = markDone ? '\x1b[36m↻\x1b[0m Updated Plan' : '\x1b[35m•\x1b[0m Reviewed Plan';
                                        const content = (result || '').split('\n').slice(1).join('\n');
                                        listItems = content.split('\n')
                                            .filter(line => line.trim().startsWith('- ['))
                                            .map(line => {
                                                const trimmed = line.trim();
                                                const isDone = trimmed.startsWith('- [x]');
                                                // Premium ✔  for done, ○ for pending
                                                const icon = isDone ? '\x1b[32m✔\x1b[0m' : '\x1b[90m○\x1b[0m';
                                                const textColor = isDone ? '\x1b[90m' : '\x1b[37m';
                                                return `${icon} ${textColor}${trimmed.substring(6).trim()}\x1b[0m`;
                                            });
                                    }

                                    if (uiTitle && listItems.length > 0) {
                                        // Premium, minimal layout without the boxy cage
                                        const output = [
                                            `${uiTitle}`, // Clean title with a slight indent aligned with other feedbacks
                                            ...listItems.map(item => `    ${item}`) // Sub-indented items for that premium look
                                        ].join('\n');
                                        yield { type: 'visual_feedback', content: colorMainWords(`${thisIsFirstToolFeedback ? '\n' : ''}${output}\n`) };
                                        thisIsFirstToolFeedback = false;
                                    }
                                }

                                if (normToolName === 'exec_command' && settings.onExecEnd) {
                                    await new Promise(resolve => setTimeout(resolve, 800));
                                    settings.onExecEnd();
                                }

                                const isDenied = result && result.startsWith('DENIED:');
                                const isSuccess = result && !result.startsWith('ERROR:') && !isDenied;

                                if (isSuccess) {
                                    await incrementUsage('toolSuccess');
                                    if (settings.onToolResult) settings.onToolResult('success', normToolName);
                                } else if (isDenied) {
                                    // Already incremented above in the direct deny block, but let's be safe for other tools
                                    // actually, direct deny block handles it.
                                    // But if a tool itself returns DENIED:, we should handle it here.
                                    // Let's check if we already handled it.
                                } else {
                                    await incrementUsage('toolFailure');
                                    if (settings.onToolResult) settings.onToolResult('failure', normToolName);
                                }

                                const aiContent = `[TOOL RESULT]: ${(result || '').toString().replaceAll('[UI_CONTEXT]', '[CONTEXT]')}`;
                                toolResults.push({ role: 'user', text: aiContent, binaryPart });
                                anyToolExecutedInThisTurn = true;

                                let uiContent = `[TOOL RESULT]: ${result || ''}`;
                                if (normToolName === 'view_file' || normToolName === 'web_scrape' || normToolName === 'file_map') {
                                    uiContent = `[TOOL RESULT]: ${label} (Context Locked for UI Clarity)`;
                                }

                                yield { type: 'tool_result', content: uiContent, aiContent: aiContent, binaryPart, toolName: normToolName };
                                if (normToolName === 'memory' && result.includes('SUCCESS')) yield { type: 'memory_updated' };

                                toolCallPointer++;
                            }
                            if (aiProvider === 'Google' && pendingGoogleText && (Date.now() - lastGoogleFlushTime >= 150)) {
                                yield* flushGoogleBuffer();
                                const msgs = getBufferedMessages(pendingGoogleText);
                                for (const m of msgs) yield m;
                                pendingGoogleText = '';
                                lastGoogleFlushTime = Date.now();
                            }
                        }
                        if (chunk.usageMetadata) {
                            lastUsage = chunk.usageMetadata;
                        }
                        // fs.writeFileSync('token_usage.txt', JSON.stringify(chunk.usageMetadata, null, 2));
                        if (lastUsage) {
                            yield { type: 'liveTokens', content: lastUsage.totalTokenCount };
                        }
                    }

                    if (inThinkingState) {
                        inThinkingState = false;
                        if (isDedupeActive) {
                            dedupeBuffer += '</think>';
                        } else {
                            turnText += '</think>';
                            if (aiProvider === 'Google') {
                                pendingGoogleText += '</think>';
                            } else {
                                yield { type: 'text', content: '</think>' };
                            }
                        }
                    }

                    // [DEDUPE FLUSH] - Handle cases where stream ends before buffer hits threshold
                    if (isDedupeActive && dedupeBuffer.length > 0) {
                        let overlapLen = 0;
                        const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);
                        for (let len = maxPossibleOverlap; len > 0; len--) {
                            if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                                overlapLen = len;
                                break;
                            }
                        }
                        const cleanText = dedupeBuffer.substring(overlapLen);
                        if (cleanText) {
                            const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                            const dedupeClean = hasOpenThink
                                ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '')
                                : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, '').replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '');
                            if (dedupeClean) {
                                turnText += dedupeClean;
                                if (aiProvider === 'Google') {
                                    pendingGoogleText += dedupeClean;
                                } else {
                                    yield* flushGoogleBuffer();
                                    const msgs = getBufferedMessages(dedupeClean);
                                    for (const m of msgs) yield m;
                                }
                            }
                        }
                        isDedupeActive = false;
                        dedupeBuffer = '';
                    }

                    yield* flushGoogleBuffer();

                    if (TERMINATION_SIGNAL) break;

                    // [SILENT CUTOFF WATCHDOG]
                    // If stream closed cleanly but we don't have finish/continue signals or tool executions,
                    // it is highly likely that a silent cutoff occurred. Trigger the recovery engine!
                    // Exception: If the text ends normally with punctuation (., !, ?, quotes, code fences),
                    // we assume the model finished its response but forgot the command tags. We bypass recovery
                    // and let the outer loop's loop-reset safety valve handle the continue/finish prompts!
                    const signalSafeText = (turnText || '').trim();
                    const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase()) || /\[\[END\]\]/i.test(signalSafeText.toLowerCase());
                    const hasContinue = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText.toLowerCase());
                    const didCallTool = toolResults.length > 0 || lastToolSniffed !== null;

                    const pureOutputText = signalSafeText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/gi, '').trim();
                    const endsWithEmoji = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u.test(pureOutputText);
                    // This regex catches trailing markdown (*, **, _, `), quotes (", '), brackets, tables (|), and trailing spaces/newlines
                    // Added curly quotes, curly brackets, wave dashes, and a unicode punctuation wildcard (\p{P})
                    const superSneakyRegex = /([.!?"'*_`|\]\)”’~~]+|\s|`{3}|[\u200B-\u200D\uFEFF])$/u;

                    // Check if your text ends with any of that chaos
                    const endsWithFormatting = superSneakyRegex.test(pureOutputText.trim());
                    const endsNormally = /[.!?}"'`’“”]$|```$/s.test(pureOutputText) || endsWithFormatting || endsWithEmoji;

                    if (!hasFinish && !hasContinue && !didCallTool && signalSafeText.length > 0 && !endsNormally && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop) {
                        // throw new Error("Silent stream cutoff (500): Model stream closed cleanly but cut off mid-sentence without signals."); // [NEEDS TESTING]
                    }

                    success = true;
                    // Count the successful call
                    await incrementUsage('agent', aiProvider);
                } catch (err) {
                    if (TERMINATION_SIGNAL) {
                        yield { type: 'status', content: 'Request Cancelled' };
                        yield { type: 'text', content: '\n\n\u001b[33mⓘ Request Cancelled\u001b[0m' };
                        break;
                    }
                    if (String(err).includes('Incomplete JSON segment at the end')) {
                        if (inThinkingState) {
                            inThinkingState = false;
                            if (isDedupeActive) {
                                dedupeBuffer += '</think>';
                            } else {
                                turnText += '</think>';
                                yield { type: 'text', content: '</think>' };
                            }
                        }
                        // Swallow/suppress SDK stream-end JSON chunk parsing bug
                        success = true;
                        await incrementUsage('agent', aiProvider);
                        break;
                    }

                    if (inThinkingState) {
                        inThinkingState = false;
                        if (isDedupeActive) {
                            dedupeBuffer += '</think>';
                        } else {
                            turnText += '</think>';
                        }
                    }

                    // [FLUSH DEDUPE ON ERROR] - If stream cut off, flush any remaining buffered text
                    if (isDedupeActive && dedupeBuffer.length > 0) {
                        let overlapLen = 0;
                        const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);
                        for (let len = maxPossibleOverlap; len > 0; len--) {
                            if (accumulatedContext.endsWith(dedupeBuffer.substring(0, len))) {
                                overlapLen = len;
                                break;
                            }
                        }
                        const cleanText = dedupeBuffer.substring(overlapLen);
                        if (cleanText) {
                            const hasOpenThink = /(?:<(think|thought)>|\[(think|thought)\])(?:(?!(?:<\/(?:think|thought)>|\[\/(?:think|thought)\]))[\s\S])*$/i.test(accumulatedContext);
                            const dedupeClean = hasOpenThink
                                ? cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '')
                                : cleanText.replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])\s*/gi, '').replace(/^\s*(?:<(think|thought)>|\[(think|thought)\])\s*/gi, '');
                            if (dedupeClean) {
                                turnText += dedupeClean;
                            }
                        }
                        isDedupeActive = false;
                        dedupeBuffer = '';
                    }

                    // const errMsg = err.status || (err.error && err.error.message) || String(err);
                    const errLog = err instanceof Error ? (() => { try { return JSON.parse(JSON.parse(err.message).error.message).error.message; } catch { return String(err); } })() : String(err);;
                    // Log error in /logs/agent/error.log
                    const date = new Date().toLocaleString();
                    const agentErrDir = path.join(LOGS_DIR, 'agent');
                    if (!fs.existsSync(agentErrDir)) fs.mkdirSync(agentErrDir, { recursive: true });
                    fs.appendFileSync(path.join(agentErrDir, 'error.log'), `ERROR [${date}]: ${errLog}\n\n----------------------------------------------------------------------\n\n`);

                    // RETRY ONLY ON 500-LEVEL (500, 503, ETC.) AND 408 TIMEOUT ERRORS
                    const status = err.status || err.statusCode || err.code;
                    const isRetryable = (
                        (status && ((status >= 500 && status < 600) || status === 408 || status === 429)) ||
                        (!status && (
                            /status[ :]+(5\d\d|408|429)/i.test(String(err)) ||
                            /code[ :]+(5\d\d|408|429)/i.test(String(err)) ||
                            /(500|503|408|429)/.test(String(err))
                        ))
                    );

                    if (!isRetryable) {
                        if (retryCount < MAX_RETRIES - 3) {
                            throw err;
                        }
                        yield { type: 'text', content: errLog };
                        yield { type: 'status', content: 'Error Occured' };
                    }

                    if (turnText.trim().length > 0 || inStreamRetryCount > 1) {
                        // IN-STREAM RECOVERY
                        if (inStreamRetryCount <= MAX_RETRIES) {
                            inStreamRetryCount++;
                            const waitTime = Math.min(1000 * Math.pow(2, inStreamRetryCount - 1), 24000);

                            if (turnText.trim().length > 0) {
                                modifiedHistory.push({ role: 'agent', text: turnText });

                                const recoveryText = "[SYSTEM]\n- SEAMLESS CONTINUATION: Resume immediately. Pick up from last words with zero gap/disruption\n- NO REPETITION: Do not repeat any text already written\n- NO RE-THINK: Do not restart or open <think> if reasoning already started. Continue the thinking and close thinking block </think> if opened before outputting user response\n- MID-TOOL SAFETY: If cutoff was mid-tool call, restart that tool call from start\n- STEALTH: Do not mention/apologize for cutoff [/SYSTEM]";

                                if (toolResults.length > 0) {
                                    // Merge recovery prompt into the last tool result to avoid consecutive user roles
                                    toolResults.forEach((tr, idx) => {
                                        if (idx === toolResults.length - 1) {
                                            modifiedHistory.push({
                                                ...tr,
                                                text: `${tr.text}\n\n${recoveryText}`
                                            });
                                        } else {
                                            modifiedHistory.push(tr);
                                        }
                                    });
                                } else {
                                    modifiedHistory.push({ role: 'user', text: recoveryText });
                                }
                                accumulatedContext += turnText;
                            }

                            // show live decremental countdown
                            for (let i = waitTime / 1000; i > 0; i--) {
                                if (TERMINATION_SIGNAL) break;
                                yield { type: 'status', content: `Error Occured. Recovering Stream (${inStreamRetryCount}/${MAX_RETRIES}) [Retrying in ${i}s]...` };
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            yield { type: 'status', content: `Error Occured. Recovering Stream...` };
                        } else {
                            throw new Error(`Stream collapsed too many times. (Failed to resolve ${MAX_RETRIES} times)\nError Log can be found in ${path.join(LOGS_DIR, 'agent', 'error.log')}`);
                        }
                    } else {
                        // CONNECTION RETRY
                        if (retryCount <= MAX_RETRIES) {
                            retryCount++;
                            inStreamRetryCount = 1;      // [BUGFIX] - Reset stream recovery budget on connection retry!
                            accumulatedContext = '';     // [BUGFIX] - Clear stream recovery checkpoint on connection retry!
                            const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 32000);
                            isInitialAttempt = true;
                            yield { type: 'status', content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${(waitTime / 1000).toFixed(0)}s]` };
                            // show live decremental countdown
                            for (let i = waitTime / 1000; i > 0; i--) {
                                if (TERMINATION_SIGNAL) break;
                                yield { type: 'status', content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${i}s]` };
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            yield { type: 'status', content: `Trying to reach ${modelName}` };
                        } else {
                            throw new Error(`Model ${modelName} cannot be reached. (Failed ${MAX_RETRIES} times)\nError Log can be found in ${path.join(LOGS_DIR, 'agent', 'error.log')}`);
                        }
                    }
                }
            }

            if (lastUsage) {
                const total = lastUsage.totalTokenCount || 0;
                const cached = lastUsage.cachedContentTokenCount || 0;
                const candidates = (lastUsage.candidatesTokenCount || 0) + (lastUsage.thoughtsTokenCount || 0);

                await addToUsage('tokens', total, aiProvider, targetModel);
                if (cached > 0) {
                    await addToUsage('cachedTokens', cached, aiProvider, targetModel);
                }
                if (candidates > 0) {
                    await addToUsage('candidateTokens', candidates, aiProvider, targetModel);
                }

                yield { type: 'usage', content: lastUsage };
            }

            fullAgentResponseChunks.push(turnText);

            // [SAFETY] Surgical extraction of top-level thinking blocks only.
            // We avoid global stripping to protect documentation or code that might mention <think> tags.
            let textToProcess = turnText;
            const thinkMatch = turnText.match(/(?:<think>|\[think\])([\s\S]*?)(?:<\/think>|\[\/think\])/i);
            if (thinkMatch) {
                // Only strip if it's at the very beginning or followed by significant output
                textToProcess = turnText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/i, '');
            }

            const signalSafeText = getSanitizedText(turnText);
            const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase()) || /\[\[END\]\]/i.test(signalSafeText.toLowerCase()) || true;
            const hasContinue = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText.toLowerCase());
            const shouldContinue = toolCallPointer > 0;

            yield { type: 'status', content: 'Thinking' };

            const cleanedTurnText = contextSafeReplace(turnText, /(\[\s*(turn\s*:)?\s*(continue|finish)\s*\]|\[\[END\]\])/gi, '')
                .trim();

            // [STRICT PROTOCOL ENFORCEMENT]
            // If the model explicitly finished or if there are no pending tool results to execute and send back,
            // we finish the agent loop immediately.
            // We MUST NOT finish if a tool was executed (toolResults.length > 0) or if a continue signal is present.
            // [BUGFIX] - We also MUST NOT finish if we are in a recovery state (loop detection triggered).
            let isActuallyFinished = (hasFinish || toolResults.length === 0) && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop;
            isActuallyFinished = toolResults.length === 0 ? isActuallyFinished : false;
            isActuallyFinished = detectedAnyToolCalls || wasToolCalledInLastLoop ? false : isActuallyFinished;

            if (turnText && turnText.trim().endsWith('")]') && toolResults.length === 0) {
                isActuallyFinished = false;
            }


            if (isActuallyFinished) {
                const fullAgentTextRaw = fullAgentResponseChunks.join('\n');
                const cleanedFullResponse = fullAgentTextRaw.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, '').trim();

                yield {
                    type: 'interactive_turn_finished',
                    data: {
                        agentText,
                        fullAgentTextRaw,
                        history: [...modifiedHistory],
                        needTitle
                    }
                };

                // Replace the last (potentially messy) agent message with the final response
                if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === 'agent') {
                    modifiedHistory[modifiedHistory.length - 1].text = cleanedFullResponse;
                } else {
                    modifiedHistory.push({ role: 'agent', text: cleanedFullResponse });
                }

                // [JIT CLEANUP] - Clean up JIT instruction injection markers and compile errors from the persistent history
                modifiedHistory.forEach(msg => {
                    if (msg.role === 'user' && msg.text) {
                        msg.text = msg.text.replace(/\n\[COMPILE ERROR\][\s\S]*?\[\/ERROR\]/g, '');

                        // Clean up JIT question injection markers
                        msg.text = msg.text
                            .replaceAll(`\n\n[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY [/SYSTEM]\n`, '')
                            .replaceAll(`[SYSTEM] USER QUESTION. RESOLVE THIS SPECIFIC QUERY WITHIN '[ANSWER] ... [/ANSWER]' CONCISELY, NATURALLY\n**STRICTLY FOLLOW THINKING POLICY AS HIGH PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n`, '')
                            .replaceAll(`[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS HIGH PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]\n`, '')
                            .replaceAll(
                                /\n\[SYSTEM\] WARNING, Turn Limit Impending: Step \d+\/\d+\. Wrap up quickly\/prompt user to continue & use \[\[END\]\] quickly\. \[\/SYSTEM\]/g,
                                ''
                            );

                        // Clean up JIT file changes injection markers
                        msg.text = msg.text.replaceAll(/\n\[SYSTEM\] File Changes:\n(?:\* .+ \(created|modified|deleted\)\n)*\[\/SYSTEM\]/g, '');

                        if (modelName && modelName.toLowerCase().startsWith('gemma') && aiProvider === "Google" && msg.text.startsWith('[TOOL RESULT]')) {
                            const jitInstructionFast = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn [/SYSTEM]`;
                            const jitInstructionThinking = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>** [/SYSTEM]`;
                            msg.text = msg.text.replaceAll(jitInstructionThinking, '').replaceAll(jitInstructionFast, '').trim();
                        }
                    }
                });

                yield { type: 'status', content: '[end]' };

                // History baselines are updated directly during compression events; no end-of-turn overrides are needed.
            }

            if (isActuallyFinished) break;
            // SDK PROTECTION: Ensure agent response is never empty before next turn
            const nextAgentMsg = cleanedTurnText.trim() || '*Working...*';
            modifiedHistory.push({ role: 'agent', text: nextAgentMsg });

            // If the model hasn't finished, we must provide a user turn to keep the loop going.
            // If there are no tool results, we send a 'continue' signal to prompt the model.
            if (toolResults.length > 0 || anyToolExecutedInThisTurn) {
                if (toolResults.length > 0) {
                    let combinedText = toolResults.map(tr => tr.text).join('\n\n');
                    const toolActionableText = turnText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, '');
                    const attemptedToolsCount = (toolActionableText.match(/\[tool:functions/g) || []).length;
                    if (toolResults.length < attemptedToolsCount) {
                        combinedText += `\n\n[SYSTEM] Only ${toolResults.length} out of ${attemptedToolsCount} attempted tool calls were executed. Verify proper syntax compliance & try failed calls again [/SYSTEM]`;
                    }
                    const binaryPart = toolResults.find(tr => tr.binaryPart)?.binaryPart || null;
                    modifiedHistory.push({ role: 'user', text: combinedText, binaryPart });
                }
            } else {
                if (wasToolCalledInLastLoop || detectedAnyToolCalls) {
                    modifiedHistory.push({ role: 'user', text: `[SYSTEM] Failed to execute some tools. Verify proper syntax compliance & try again [/SYSTEM]` });
                } else {
                    modifiedHistory.push({ role: 'user', text: `[SYSTEM] ${isStutteringLoop && !isThinkingLoop ? `STUTTERING DETECTED by Internal System. Re-calibrate your response & proceed.` : `${isThinkingLoop ? ' OVER THINKING' : ' LOOP'} DETECTED by Internal System${isThinkingLoop ? ' for current EFFORT_LEVEL' : ''}. ${isThinkingLoop ? 'If you have planned the task, prioritize execution/output' : 'If you have finished your task use [[END]]'}`} [/SYSTEM]` });
                }
                isThinkingLoop = false;
                isStutteringLoop = false;
                isGeneralLoop = false;
            }
            if (systemSettings?.advanceRollback) {
                await AdvanceRevertManager.recordTurnDelta(chatId, loop + 1, currentTurnTools);
            }
            wasToolCalledInLastLoop = toolCallPointer > 0 || anyToolExecutedInThisTurn;
        }

    } catch (err) {
        const errLog = err instanceof Error ? (() => { try { return JSON.parse(JSON.parse(err.message).error.message).error.message; } catch { return String(err); } })() : String(err);
        const date = new Date().toLocaleString();
        const agentErrDir = path.join(LOGS_DIR, 'agent');
        yield { type: 'text', content: `❌ CRITICAL ERROR: ${errLog}` };
        if (!fs.existsSync(agentErrDir)) fs.mkdirSync(agentErrDir, { recursive: true });
        fs.appendFileSync(path.join(agentErrDir, 'error.log'), `CRITICAL ERROR [${date}]: ${err}\n\n----------------------------------------------------------------------\n\n`);

        if (typeof flushGoogleBuffer === 'function') {
            yield* flushGoogleBuffer();
        }

        yield { type: 'tool_result', content: `ERROR: [INTERNAL CRITICAL] ${errLog}` };
    } finally {
        if (connectionPollInterval) {
            clearInterval(connectionPollInterval);
            connectionPollInterval = null;
        }
        // 🧹 Clear performance buffer after each GPT/agent response cycle
        if (typeof performance !== 'undefined' && performance.clearMeasures) {
            performance.clearMeasures();
            performance.clearMarks();
        }
        await RevertManager.commitTransaction();
        if (systemSettings?.advanceRollback) {
            await AdvanceRevertManager.cleanup(chatId);
        }
    }
    yield { type: 'status', content: null };
};



export const runSubagent = async (task, settings, model = null, allowedTools = null, maxTurns = 50, logCallback = null) => {
    const savedSettings = await loadSettings();
    const mergedSettings = { ...savedSettings, ...settings };
    const targetModel = model || settings?.modelName || settings?.activeModel || savedSettings.activeModel;

    const SUBAGENT_TOOL_DEFINITIONS = {
        'readfile': '- [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. View files, supports images/docs',
        'readfolder': '- [tool:functions.ReadFolder(path="...")]. Detailed folder contents and stats',
        'filemap': '- [tool:functions.FileMap(path="path/file")]. Shows file structure, functions, classes, imports/exports',
        'patchfile': '- [tool:functions.PatchFile(path="...", replaceContent1="...", newContent1="...")]. Surgical block replacement for editing files',
        'writefile': '- [tool:functions.WriteFile(path="...", content="...")]. Creates or overwrites a file',
        'searchkeyword': '- [tool:functions.SearchKeyword(keyword="...", file="optional", subString="true/false optional", regex="optional, false for keyword")]. Global project search. If \'file\' is provided, searches only that file. Finds definitions/logic without reading every file. Usage: Can search for relevent lines/logic area to read specifically for edit. defaults subString: false, regex: auto-detect',
        'websearch': '- [tool:functions.WebSearch(query="...", limit=number)]. Web Search',
        'webscrape': '- [tool:functions.WebScrape(url="...")]. Web Scrape',
        'ask': `- [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish/guess. Suggest best options; don't ask for preferences. 'option' SHOULD be short`
    };

    const providedToolsSection = `-- TOOL DEFINITIONS (path = relative to CWD, path separator: '/') --
To call tools USE THIS EXACT SYNTAX: [tool:functions.ToolName(args)]. **CRITICAL: NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED, ONLY VALID TOOL CALL SCHEMA IS THE ONE PROVIDED IN SYSTEM PROMPT. NO OTHER XML OR MARKERS WILL BE ALLOWED**
**
TOOL POLICY:
- MAX 3 TOOL CALLS PER TURN. Next Turn, verify tool results, plan next
- USE multiple search & replace on patch tool if editing same file/path with many changes ← HIGHLY RECOMMENDED
- FileMap >>> ReadFile to understand file efficiently
- Want spefific STRING across project/file? SearchKeyword >> Guessing/ReadFile
- HUGE FILES? SearchKeyword >> FileMap/Full Read
- NO Terminal Access\n\n-- PROVIDED TOOLS --\n${Object.values(SUBAGENT_TOOL_DEFINITIONS).join('\n')}\n
- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n)
- File structure: Real newlines for code formatting`.trim();

    const systemInstruction = `=== START SYSTEM PROMPT ===
You are a subagent helping the main FluxFlow CLI agent
Your task is: "${task}"

${providedToolsSection.trimEnd()}

-- THINKING POLICY --
NO EXPLICIT THINKING REQUIRED. FOCUS ON COMPLETING THE TASK DIRECTLY

Your main focus should be on tools and task, not chatting. Your Chat won't be visible to user
Once you have fully completed the task, provide a detailed final structured summary preferebly in Tables/Bullet Points with file modified info, if any task failed report back in detail, no hallucination

CWD: ${process.cwd()}
Current Time: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2').replace(':', '-')}\n=== END SYSTEM PROMPT ===`;

    const subagentHistory = [
        { role: 'user', text: `Complete this task: ${task}` }
    ];

    let turn = 0;
    let finalAnswer = '';

    while (turn < maxTurns) {
        if (TERMINATION_SIGNAL) {
            if (settings?.taskId && typeof subagentProgress !== 'undefined') {
                const taskObj = subagentProgress.find(t => t.id === settings.taskId);
                if (taskObj) taskObj.status = 'cancelled';
            }
            if (logCallback) logCallback(`[SUBAGENT CANCELLED] Subagent task was cancelled.`);
            throw new Error('Subagent task was cancelled.');
        }
        if (settings?.taskId && typeof subagentProgress !== 'undefined') {
            const taskObj = subagentProgress.find(t => t.id === settings.taskId);
            if (taskObj && taskObj.status === 'cancelled') {
                if (logCallback) logCallback(`[SUBAGENT CANCELLED] Subagent task was cancelled.`);
                throw new Error('Subagent task was cancelled.');
            }
        }

        const contents = subagentHistory.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
        }));

        if (logCallback) logCallback(`[Subagent Turn ${turn + 1}] Invoking model ${targetModel}...`);

        const response = await generateSimpleContent(mergedSettings, targetModel, contents, systemInstruction, 'Fast');
        const responseText = response.text || '';
        const cleanResponse = responseText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/gi, '').trim();
        finalAnswer = cleanResponse;

        if (logCallback) logCallback(`[Subagent Response]\n${cleanResponse}\n`);

        subagentHistory.push({ role: 'agent', text: cleanResponse });

        const toolCalls = detectToolCalls(cleanResponse);
        if (toolCalls.length === 0) {
            break;
        }

        let toolResultsStr = '';
        for (const toolCall of toolCalls) {
            if (TERMINATION_SIGNAL) {
                if (settings?.taskId && typeof subagentProgress !== 'undefined') {
                    const taskObj = subagentProgress.find(t => t.id === settings.taskId);
                    if (taskObj) taskObj.status = 'cancelled';
                }
                throw new Error('Subagent task was cancelled.');
            }
            if (settings?.taskId && typeof subagentProgress !== 'undefined') {
                const taskObj = subagentProgress.find(t => t.id === settings.taskId);
                if (taskObj && taskObj.status === 'cancelled') {
                    throw new Error('Subagent task was cancelled.');
                }
            }
            const normalizedToolName = toolCall.toolName.toLowerCase();
            const allowed = allowedTools ? allowedTools.some(t => t.toLowerCase() === normalizedToolName) : true;
            if (!allowed) {
                const errorMsg = `ERROR: Tool [${toolCall.toolName}] is not in the allowed tools list for this subagent.`;
                if (logCallback) logCallback(`[Blocked Tool Call] ${toolCall.toolName} - not allowed\n`);
                toolResultsStr += `${errorMsg}\n\n`;
                continue;
            }

            // fs.writeFileSync("SUBAGENT-DEBUG.txt", normalizedToolName);
            let label = '';
            if (normalizedToolName === 'web_search' || normalizedToolName === 'websearch') {
                label = `✔ \x1b[95mSearched\x1b[0m`;
            }

            else if (normalizedToolName === 'web_scrape' || normalizedToolName === 'webscrape') {
                label = `✔ \x1b[95mScraped\x1b[0m`;
            }

            else if (normalizedToolName === 'view_file' || normalizedToolName === 'viewfile' || normalizedToolName === 'readfile') {
                const path = parseArgs(toolCall.args).path || '';
                label = `✔ \x1b[95mRead File\x1b[0m: ${path}`;
            }

            else if (normalizedToolName === 'list_files' || normalizedToolName === 'read_folder' || normalizedToolName === 'readfolder') {
                const path = parseArgs(toolCall.args).path || '';
                label = `✔ \x1b[95mBrowsed Folder\x1b[0m: ${path}`;
            }

            else if (normalizedToolName === 'write_file' || normalizedToolName === 'writefile') {
                const path = parseArgs(toolCall.args).path || '';
                label = `✔ \x1b[95mFile Created\x1b[0m: ${path}`;
            }

            else if (normalizedToolName === 'update_file' || normalizedToolName === 'updatefile' || normalizedToolName === 'patchfile' || normalizedToolName === 'patch_file' || normalizedToolName === 'patchfile' || normalizedToolName === 'updatefile') {
                const path = parseArgs(toolCall.args).path || '';
                label = `✔ \x1b[95mFile Edited\x1b[0m: ${path}`;
            }

            else if (normalizedToolName === 'file_map' || normalizedToolName === 'filemap') {
                const path = parseArgs(toolCall.args).path || '';
                label = `✔ \x1b[95mIndexed\x1b[0m: ${path}`;
            }

            else if (normalizedToolName === 'await') {
                const { time } = parseArgs(toolCall.args);
                let sec = parseFloat(time) || 0;
                if (sec < 10) sec = 10;
                if (sec > 180) sec = 180;
                const formatTime = (s) => {
                    if (s >= 60) {
                        const m = Math.floor(s / 60);
                        const rem = s % 60;
                        return `${m}m${rem > 0 ? ` ${rem}s` : ''}`;
                    }
                    return `${s}s`;
                };
                label = `✔ \x1b[95mAwaiting\x1b[0m → ${formatTime(sec)}`;
            } else {
                const displayLabel = TOOL_LABELS[normalizedToolName] || toolCall.toolName;
                const detail = getToolDetail(normalizedToolName, toolCall.args);
                label = `✔ \x1b[95m${displayLabel}\x1b[0m${detail ? `: ${detail}` : ''}`;
            }

            if (settings.onVisualFeedback && label) {
                settings.onVisualFeedback(label);
            }

            if (logCallback) logCallback(`[Executing Tool] ${toolCall.toolName}(${toolCall.args})...`);

            try {
                const result = await dispatchTool(toolCall.toolName, toolCall.args, { ...settings, mode: 'Flux' });
                if (logCallback) logCallback(`[Tool Result]\n${result}\n`);
                toolResultsStr += `[TOOL RESULT for ${toolCall.toolName}]: ${result}\n\n`;
                await incrementUsage('toolSuccess');

                // Track code changes made by the subagent (mirrors the main agent's tracking in app.jsx)
                if (normalizedToolName === 'patchfile' || normalizedToolName === 'update_file' || normalizedToolName === 'updatefile' || normalizedToolName === 'patch_file') {
                    if (result) {
                        const diffLines = result.split('\n');
                        let added = 0, removed = 0, insideDiff = false;
                        for (const line of diffLines) {
                            if (line.includes('[DIFF_START]')) { insideDiff = true; continue; }
                            if (line.includes('[DIFF_END]')) { insideDiff = false; continue; }
                            if (insideDiff) {
                                if (/^\+\d+/.test(line)) added++;
                                else if (/^\-\d+/.test(line)) removed++;
                            }
                        }
                        if (added > 0 || removed > 0) {
                            await addToUsage('linesAdded', added);
                            await addToUsage('linesRemoved', removed);
                        }
                    }
                } else if (normalizedToolName === 'writefile' || normalizedToolName === 'write_file') {
                    if (result) {
                        const statsMatch = result.match(/- Stats: \[(\d+) lines/);
                        const verifiedLinesCount = statsMatch ? parseInt(statsMatch[1]) : 0;
                        let oldLinesCount = 0;
                        if (result.includes('Old File contents:')) {
                            let insideOldFile = false;
                            for (const line of result.split('\n')) {
                                if (line.includes('Old File contents:')) { insideOldFile = true; continue; }
                                if (insideOldFile) {
                                    if (line.trim() === '') { insideOldFile = false; }
                                    else if (/^\d+ \|/.test(line)) oldLinesCount++;
                                }
                            }
                        }
                        if (verifiedLinesCount > 0 || oldLinesCount > 0) {
                            await addToUsage('linesAdded', verifiedLinesCount);
                            await addToUsage('linesRemoved', oldLinesCount);
                        }
                    }
                }
            } catch (e) {
                const errorMsg = `ERROR: Execution failed for [${toolCall.toolName}]: ${e.message}`;
                if (logCallback) logCallback(`[Tool Error] ${errorMsg}\n`);
                toolResultsStr += `${errorMsg}\n\n`;
                await incrementUsage('toolFailure');
            }
        }

        subagentHistory.push({ role: 'user', text: toolResultsStr.trim() });
        turn++;
    }
    // fs.writeFileSync("SUBAGENT_DEBUG.txt", finalAnswer);

    return finalAnswer;
};
