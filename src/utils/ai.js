import { GoogleGenAI, ThinkingLevel, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { getSystemInstruction, getJanitorInstruction, getMemoryPrompt } from './prompts.js';
import { getTruncatedHistory } from './history.js';
import { checkQuota, incrementUsage, addToUsage } from './usage.js';
import { dispatchTool } from './tools.js';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { parseArgs } from './arg_parser.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { emojiSpace } from './terminal.js';
import { applyPatches, generateHighFidelityDiff, parsePatchPairs } from './text.js';

import { LOGS_DIR, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, MEMORIES_FILE, PATHS_FILE, SECRET_DIR } from './paths.js';
import { RevertManager } from './revert.js';
import { openFileInEditor, highlightDiffInEditor, getIDEContext, showDiffInIDE, closeDiffInIDE, isBridgeConnected } from './editor.js';

let client = null;

let TERMINATION_SIGNAL = false;

const MULTIMODAL_MODELS = [
    // OpenRouter models
    'google/gemma-4-31b-it:free',
    'moonshotai/kimi-k2.6:free',
    'google/gemini-3.5-flash',
    'qwen/qwen3.7-plus',
    'minimax/minimax-m3',
    'anthropic/claude-sonnet-4.5',
    'anthropic/claude-opus-4.6',
    'anthropic/claude-opus-4.8',
    'openai/gpt-5.2-codex',
    'openai/gpt-5.2-pro',
    'openai/gpt-5.5-pro',
    'moonshotai/kimi-k2.6',
    // Google models
    'gemma-4-31b-it',
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview'
];

export const isModelMultimodal = (model) => {
    if (!model) return false;
    const lower = model.toLowerCase();
    if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) return true;
    return MULTIMODAL_MODELS.some(m => m.toLowerCase() === lower);
};

const stripAnsi = (str) => {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            if (response.status !== 429 && response.status < 500) return response;
        } catch (e) {
            if (i === retries - 1) throw e;
        }
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
    return fetch(url, options);
};

const getDeepSeekStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal) {
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
        temperature: mode === 'Flux' ? 1.0 : 1.4,
    };

    // DeepSeek Specific Reasoning
    if (thinkingLevel !== 'Fast') {
        const reasoningEffortMap = {
            'Low': 'high',
            'Medium': 'high',
            'High': 'high',
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
            } catch (e) {}
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

const getOpenRouterStream = async function* (apiKey, model, contents, systemInstruction, thinkingLevel, mode, isMultiModal) {
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
        'High': 'high',
        'xHigh': 'high'
    };

    const requestPayload = {
        model: model,
        messages: messages,
        stream: true,
        temperature: mode === 'Flux' ? 1.0 : 1.4,
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
    'ask': 'User Input',
    'write_pdf': 'Creating',
    'write_docx': 'Creating',
    'generate_image': 'Generating',
};

const getToolDetail = (toolName, argsStr) => {
    try {
        const pArgs = parseArgs(argsStr);
        const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
        // Normalize backslashes to forward slashes and strip quotes before extracting basename
        return filePath ? path.basename(filePath.replace(/["']/g, '').replace(/\\/g, '/')) : null;
    } catch (e) {
        return null;
    }
};

export const runJanitorTask = async (settings, agentText, fullAgentTextRaw, history, callbacks = {}) => {
    if (process.stdout.isTTY) {
        process.stdout.write(`\x1b]0;Finalizing...\x07`);
        process.stdout.write(`\x1b]633;P;TerminalTitle=Finalizing...\x07`);
    }

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
                .replace(/\[turn: continue\]/g, '')
                .replace(/\[turn: finish\]/g, '')
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

    let agentRes = `${cleanedFullResponse.replace(/\[tool:functions\..*?\]/g, '').replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/g, '').replace(/\[Prompted on:.*?\]/g, '').replace(/\[turn: continue\]/g, '').replace(/\[turn: finish\]/g, '').replace(/\[TOOL RESULTS\]/g, '').replace(/\[tool results\]/g, '').substring(0, AGENT_CONTEXT_LENGTH)}`;
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

    let finalSynthesis = '';
    let attempts = 0;
    const MAX_JANITOR_RETRIES = isMemoryEnabled ? 12 : -1;

    while (attempts <= MAX_JANITOR_RETRIES) {
        if (process.stdout.isTTY) {
            process.stdout.write(`\x1b]0;Retrying Finalizing... (${attempts + 1})...\x07`);
            process.stdout.write(`\x1b]633;P;TerminalTitle=Retrying Finalizing... (${attempts + 1})...\x07`);
        }
        try {
            if (!(await checkQuota('background', settings))) {
                return;
            }

            let fullContent = '';
            let lastUsage = null;

            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("JANITOR_TIMEOUT")), 60000)
                );

                const streamPromise = (async () => {
                    if (aiProvider === 'OpenRouter') {
                        const janitorOpenRouterModel = 'google/gemma-4-26b-a4b-it:free';
                        const stream = getOpenRouterStream(
                            apiKey,
                            janitorOpenRouterModel,
                            janitorContents,
                            janitorPrompt,
                            'Fast', // Janitor always minimal
                            mode
                        );
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    } else if (aiProvider === 'DeepSeek') {
                        const stream = getDeepSeekStream(
                            apiKey,
                            'deepseek-chat',
                            janitorContents,
                            janitorPrompt,
                            'Fast', // Janitor always minimal
                            mode,
                            false
                        );
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    } else {
                        const stream = await client.models.generateContentStream({
                            model: janitorModel || 'gemma-4-26b-a4b-it',
                            contents: janitorContents,
                            config: {
                                systemInstruction: janitorPrompt,
                                maxOutputTokens: 512,
                                temperature: 0.3,
                                safetySettings: [
                                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                                ],
                                thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL }
                            }
                        });
                        const iterator = stream[Symbol.asyncIterator]();
                        const firstResult = await iterator.next();
                        return { iterator, firstResult };
                    }
                })();

                const { iterator, firstResult } = await Promise.race([streamPromise, timeoutPromise]);
                let { value: firstChunk, done: firstDone } = firstResult;

                if (!firstDone && firstChunk) {
                    const parts = firstChunk.candidates?.[0]?.content?.parts;
                    const chunkText = (parts?.[1]?.text || parts?.[0]?.text || (typeof firstChunk.text === 'function' ? firstChunk.text() : ''));
                    if (chunkText) {
                        fullContent += chunkText;
                    }
                    lastUsage = firstChunk.usageMetadata;

                    for await (const chunk of { [Symbol.asyncIterator]: () => iterator }) {
                        const p = chunk.candidates?.[0]?.content?.parts;
                        const t = (p?.[1]?.text || p?.[0]?.text || (typeof chunk.text === 'function' ? chunk.text() : ''));
                        if (t) fullContent += t;
                        lastUsage = chunk.usageMetadata;
                    }
                }
            } catch (e) {
                throw e;
            }

            if (fullContent) {
                finalSynthesis = fullContent;
                if (lastUsage) await addToUsage('tokens', lastUsage.totalTokenCount || 0);

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
                            mem.score *= 0.9995; // 0.05% decay when no memory is referenced
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
        } catch (janitorErr) {
            attempts++;
            const date = new Date().toLocaleString();
            if (process.stdout.isTTY) {
                process.stdout.write(`\u001b]0;Finalizing Error\u0007`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            const janitorErrDir = path.join(LOGS_DIR, 'janitor');
            if (!fs.existsSync(janitorErrDir)) fs.mkdirSync(janitorErrDir, { recursive: true });
            fs.appendFileSync(path.join(janitorErrDir, 'error.log'), `ERROR [Attempt ${attempts}/${MAX_JANITOR_RETRIES + 1}] [${date}]: ${String(janitorErr)}\n\n`);

            if (attempts > MAX_JANITOR_RETRIES) break;

            const backoff = Math.min(1000 * Math.pow(2, attempts - 1), 8000);
            await new Promise(resolve => setTimeout(resolve, backoff));
        }
    }
    if (attempts) {
        const janitorErrDir = path.join(LOGS_DIR, 'janitor');
        fs.appendFileSync(path.join(janitorErrDir, 'error.log'), `-----------------------------------------------------------------------------\n\n\n`)

        if (attempts >= MAX_JANITOR_RETRIES) {
            if (process.stdout.isTTY) {
                process.stdout.write(`\u001b]0;${isMemoryEnabled ? 'Finalizing Error' : 'Finalizing Skipped'}\u0007`);
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Restore title to Idle when janitor finishes
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b]0;FluxFlow | Idle\x07');
        process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow | Idle\x07');
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

const detectToolCalls = (text) => {
    const results = [];
    const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;

    let match;
    while ((match = toolRegex.exec(text)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1; // Index of '('

        let balance = 0;
        let inString = null;
        let endIdx = -1;
        let closingParenIdx = -1;

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
                        closingParenIdx = i;
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
            const finalArgsText = text.substring(startIdx + 1, closingParenIdx);
            const finalFullMatch = text.substring(match.index, endIdx + 1);
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
export const initAI = (apiKey) => {
    if (!apiKey) return null;
    client = new GoogleGenAI({ apiKey });
    return client;
};

/**
 * Generic helper to generate non-streaming content from any provider
 */
const generateSimpleContent = async (settings, model, contents, systemInstruction, thinkingLevel = 'Fast') => {
    const { aiProvider = 'Google', apiKey, mode } = settings;
    let fullText = '';
    let usageMetadata = null;

    let stream;
    if (aiProvider === 'OpenRouter') {
        stream = getOpenRouterStream(apiKey, model, contents, systemInstruction, thinkingLevel, mode, false);
    } else if (aiProvider === 'DeepSeek') {
        stream = getDeepSeekStream(apiKey, model, contents, systemInstruction, thinkingLevel, mode, false);
    } else {
        const genStream = await client.models.generateContentStream({
            model: model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 2048,
                temperature: 0.3,
                thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL }
            }
        });
        stream = genStream;
    }

    for await (const chunk of stream) {
        if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
                if (part.text && !part.thought) fullText += part.text;
            }
        }
        if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
    }

    return { text: fullText, usageMetadata };
};

/**
 * Detects past chats with substantial turn-level memories, batch-summarizes/merges them

 * into an on-device L2 cache file using stacked tool calls, and purges them from L1.
 */
const consolidatePastMemories = async (currentChatId, settings) => {
    try {
        const { aiProvider = 'Google' } = settings;
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});

        // 1. Calculate total memories across all chats in L1
        const totalMemoriesCount = Object.values(tempStorage).flat().length;
        if (totalMemoriesCount <= 2) return;

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

        let targetModel = 'gemma-4-26b-a4b-it';
        if (aiProvider === 'OpenRouter') targetModel = 'google/gemma-4-26b-a4b-it:free';
        if (aiProvider === 'DeepSeek') targetModel = 'deepseek-v4-flash';

        while (attempts <= maxAttempts && !success) {
            attempts++;
            try {
                const response = await generateSimpleContent(settings, targetModel, prompt, null, 'Fast');

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

                if (response.usageMetadata) {
                    await addToUsage('tokens', response.usageMetadata.totalTokenCount || 0);
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
        const janitorLogDir = path.join(LOGS_DIR, 'janitor');
        if (!fs.existsSync(janitorLogDir)) fs.mkdirSync(janitorLogDir, { recursive: true });
        fs.appendFileSync(
            path.join(janitorLogDir, 'error.log'),
            `[${new Date().toLocaleString()}] Past memory batch consolidation error: ${err.message}\n`
        );
    }
};

/**
 * Executes a streaming request using the new SDK
 */
export const getAIStream = async function* (modelName, history, settings, steeringCallback, versionFluxflow) {
    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats, aiProvider = 'Google', apiTier } = settings;
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

    await RevertManager.startTransaction(chatId, agentText);

    try {
        let modifiedHistory = [...history.slice(0, -1)];

        // Truncation & Condensation Logic (Compression 0.0)
        let contextCompressionCount = 252000;
        let contextTruncationCount = 254000;

        if (aiProvider === 'DeepSeek' || (aiProvider === 'Google' && apiTier === 'Paid')) {
            contextCompressionCount = 396000;
            contextTruncationCount = 400000;
        }

        if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > contextCompressionCount) {
                        yield { type: 'status_history', content: 'Context Limit Reached. Condensing session history...' };

            const flattenContext = (hist) => {
                return hist
                    .filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta)
                    .map(m => {
                        const role = m.text?.startsWith('[TOOL RESULT]') ? 'TOOL' : (m.role === 'agent' ? 'AGENT' : 'USER');
                        return `[${role}]: ${m.text}`;
                    })
                    .join('\n\n');
            };

            const runCondenser = async (flattenedText, oldSummary) => {
                const systemInstruction = `You are an expert context condenser. Summarize the provided chat history (which may include previous summaries, user instructions, agent outputs, and tool results) into a detailed, coherent, and highly technical summary of 1000 to 1500 words. Focus on preserving the architectural decisions made, current system state, task progress, and critical code details. Under no circumstances exceed MAX 2000 words.`;
                const prompt = oldSummary
                    ? `Here is the previous summary:\n${oldSummary}\n\nHere is the new conversation history:\n${flattenedText}\n\nProvide a new consolidated summary of the entire session.`
                    : `Here is the conversation history:\n${flattenedText}\n\nProvide a consolidated summary of the entire session.`;

                let targetModel = 'gemma-4-26b-a4b-it';
                if (aiProvider === 'OpenRouter') targetModel = 'google/gemma-4-26b-a4b-it:free';
                if (aiProvider === 'DeepSeek') targetModel = 'deepseek-v4-flash';

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
                            // Fallback spectrum for Google if all retry attempts fail
                            if (aiProvider === 'Google') {
                                try {
                                    const fallback = await generateSimpleContent(settings, 'gemini-3.1-flash-lite', prompt, systemInstruction, 'Fast');
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

            const flattenedText = flattenContext(modifiedHistory);
            const summaries = readEncryptedJson(summariesFile, {});
            let chatData = summaries[chatId] || { summary: '', historyLength: 0 };
            if (typeof chatData === 'string') {
                chatData = { summary: chatData, historyLength: 0 };
            }
            const currentCleanLen = modifiedHistory.filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta).length;
            if (chatData.historyLength && currentCleanLen < chatData.historyLength) {
                chatData.summary = '';
                chatData.historyLength = 0;
                summaries[chatId] = chatData;
                writeEncryptedJson(summariesFile, summaries);
            }
            const oldSummary = chatData.summary || '';

            const newSummary = await runCondenser(flattenedText, oldSummary);
            if (newSummary) {
                chatData.summary = newSummary;
                summaries[chatId] = chatData;
                writeEncryptedJson(summariesFile, summaries);
                modifiedHistory = [];
                wasCompressedInStream = true;
            }
        }



        // --- PAST CHATS SUMMARIZATION ON NEW CHAT START ---
        if (isFirstPrompt && isMemoryEnabled) {
            yield { type: 'status', content: 'Condensing past chat memories...' };
            await consolidatePastMemories(chatId, settings);
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
            'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache'
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

        yield { type: 'status', content: 'Gathering Context...' };
        // Add a 500ms sleep for something
        await new Promise(resolve => setTimeout(resolve, 500));
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
        if (chatDataObj.historyLength && currentCleanLen < chatDataObj.historyLength) {
            chatDataObj.summary = '';
            chatDataObj.historyLength = 0;
            summaries[chatId] = chatDataObj;
            writeEncryptedJson(summariesFile, summaries);
        }
        const currentSummary = typeof chatDataObj === 'object' ? (chatDataObj.summary || '') : (chatDataObj || '');
        const summaryBlock = currentSummary ? `\n**CONTEXT SUMMARY OF PREVIOUS TURNS (PRIORITY: HIGH)**\n${currentSummary}` : '';

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
                if (ideCtx.selected) ideBlock += `Current Selection: "${ideCtx.selected}"\n`;
                if (ideCtx.manual_edits) {
                    let edits = ideCtx.manual_edits;
                    const CHAR_LIMIT = 4 * 512; // 2048 chars
                    const LINE_LIMIT = 50;

                    const lines = edits.split('\n');
                    if (lines.length > LINE_LIMIT) {
                        edits = lines.slice(0, LINE_LIMIT).join('\n') + `\n... (${lines.length - LINE_LIMIT} more lines truncated)`;
                    }
                    if (edits.length > CHAR_LIMIT) {
                        edits = edits.substring(0, CHAR_LIMIT) + `\n... (Character limit reached, truncated)`;
                    }

                    ideBlock += `Recent Manual Edits:\n${edits}\n`;
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


        const firstUserMsg = `[SYSTEM METADATA (PRIORITY: DYNAMIC), Chat Context >> Metadata] Time: ${dateTimeStr}\nCWD: ${process.cwd()}${cwdMismatch ? ` (WARNING: CWD Mismatch! Previous Path: ${lastCwd})` : ''}\n**DIRECTORY STRUCTURE**\n${dirStructure}${summaryBlock}${memoryPrompt}${ideBlock}\n${thinkingLevel != 'Fast' && aiProvider === 'Google' ? `${modelName.toLowerCase().startsWith('gemma') ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**\n" : ""}` : ''}[USER] ${agentText.replace(/\s*\[Prompted on:.*?\]/g, '').trim()}`.trim();
        modifiedHistory.push({ role: 'user', text: firstUserMsg });

        let lastUsage = null;
        const MAX_LOOPS = mode === 'Flux' ? 70 : 7;
        const MAX_RETRIES = 16;
        yield { type: 'status', content: 'Connecting...' };

        TERMINATION_SIGNAL = false; // Reset at start of new interaction

        let fullAgentResponseChunks = [];
        let wasToolCalledInLastLoop = false;

        // [PRE-LOOP ARCHIVE] Strip thoughts from ALL PREVIOUS turns once before entering the loop.
        // This acts as a security firewall against brain-hijacking (user injecting <think> tags)
        // and ensures steering hints don't carry reasoning glitches.
        // Only Agent Msgs should be stripped.
        modifiedHistory.forEach(msg => {
            if (msg.text && msg.role === 'agent') {
                msg.text = msg.text.replace(/(?:<(think|thought)>|\[(think|thought)\])[\s\S]*?(?:<\/(think|thought)>|\[\/(think|thought)\])/gi, '').trim();
            }
        });

        // 1 extra loop for grace period
        for (let loop = 0; loop <= MAX_LOOPS; loop++) {
            if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > contextTruncationCount) {
                modifiedHistory = getTruncatedHistory(modifiedHistory, 6);
            }
            if (loop > 0) {
                yield { type: 'status', content: 'Processed. Reconnecting...' };
            }
            if (TERMINATION_SIGNAL) {
                yield { type: 'status', content: 'Termination Signal Received.' };
                // wait 1.5s
                await new Promise(resolve => setTimeout(resolve, 1500));
                break;
            }

            // Check for incoming Steering Hints
            if (steeringCallback) {
                const hint = await steeringCallback();
                if (hint) {
                    // Protocol Sync: If last message is 'user', append hint to it to avoid consecutive role errors
                    if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === 'user') {
                        modifiedHistory[modifiedHistory.length - 1].text += `\n\n[STEERING HINT]: ${hint}`;
                    } else {
                        modifiedHistory.push({ role: 'user', text: `${thinkingLevel != 'Fast' && aiProvider === 'Google' ? `${modelName.toLowerCase().startsWith('gemma') ? "[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CRITICAL PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**\n" : ""}` : ''}[STEERING HINT]: ${hint}` });
                    }
                    yield { type: 'status', content: 'Steering Hint Injected.' };
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
            let accumulatedContext = '';
            let dedupeBuffer = '';
            let isDedupeActive = false;

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
                        yield { type: 'spinner', content: true };
                        isInitialAttempt = false;
                        if (inStreamRetryCount === 1) {
                            accumulatedContext = '';
                        }
                    }
                    // Convert current history to GenAI format (Recalculated every retry to pick up recovery turns)
                    const contents = modifiedHistory
                        .filter(msg => (msg.role === 'user' || msg.role === 'agent' || msg.role === 'system') && !String(msg.id).startsWith('welcome') && !msg.isMeta && !msg.isTerminalRecord && !(msg.text && msg.text.startsWith('[TERMINAL_RECORD]')))
                        .map((msg, idx, arr) => {
                            const parts = [{ text: msg.text }];
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
                    // Quota Check
                    if (!(await checkQuota('agent', settings))) {
                        throw new Error("Error: Quota Exausted for Agent");
                    }

                    // [HIGH RELIABILITY FALLBACK SPECTRUM]
                    targetModel = modelName;
                    if (aiProvider === 'DeepSeek' && thinkingLevel === 'Fast') {
                        targetModel = 'deepseek-chat';
                    }
                    if (retryCount === MAX_RETRIES - 1) {
                        targetModel = aiProvider === 'DeepSeek' ? 'deepseek-v4-flash' : 'gemini-3-flash-preview';
                        yield { type: 'model_update', content: 'Trying with fallback model' };
                    } else if (retryCount === MAX_RETRIES) {
                        targetModel = aiProvider === 'DeepSeek' ? 'deepseek-v4-pro' : 'gemini-3.5-flash';
                        yield { type: 'model_update', content: 'Trying with fallback model' };
                    } else if (retryCount > 12 && retryCount < MAX_RETRIES - 2 && settings.apiKey !== "custom") {
                        targetModel = 'gemma-4-31b-it';
                        yield { type: 'model_update', content: 'Trying with fallback Gemma Model' };
                    } else if (retryCount > 0) {
                        yield { type: 'model_update', content: null };
                    }

                    // [DYNAMIC CONTEXT ADAPTATION WITH MEMORIES]
                    // We recalculate instructions every turn so the agent knows when it's hitting context limits
                    currentSystemInstruction = getSystemInstruction(profile, !(targetModel || "gemma").toLowerCase().startsWith('gemma') ? "GEM" : thinkingLevel, mode, systemSettings, isMemoryEnabled, isFirstPrompt, aiProvider, isMultiModal);

                    // [JIT INSTRUCTION INJECTION] - Only for tool results, kept out of persistent history
                    const isGemma = modelName && modelName.toLowerCase().startsWith('gemma');
                    const lastUserMsg = contents[contents.length - 1];

                    if (isGemma) {
                        const jitInstruction = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn${thinkingLevel != 'Fast' && aiProvider === 'Google' ? `. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>}**` : ''}`;
                        if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text?.startsWith('[TOOL RESULT]')) {
                            lastUserMsg.parts[0].text += jitInstruction;
                        }
                    }

                    // [JIT STEP SENTRY] - Only inject step warning if loop is at >= 80% of MAX_LOOPS for Flow and 98% for Flux
                    // Keeps prompts fully cached and static for the vast majority of runs!
                    if (isGemma) {
                        const stepThreshold = Math.floor(MAX_LOOPS * (mode === 'Flux' ? 0.98 : 0.7));
                        const currentStep = loop + 1;
                        if (currentStep >= stepThreshold && lastUserMsg && lastUserMsg.parts?.[0]) {
                            lastUserMsg.parts[0].text += `\n[SYSTEM] WARNING, Turn Limit Impending: Step ${currentStep}/${MAX_LOOPS}. Wrap up quickly/prompt user to continue & use [turn:finish] quickly.`;
                        }
                    }

                    // fs.writeFileSync(`contents_${thinkingLevel}.txt`, `<bos>\n<system>\n${currentSystemInstruction}\n\n<user>\n${firstUserMsg}\n<eos>`);
                    // fs.writeFileSync(`contents_context.json`, `${JSON.stringify({ contents }, null, 2)}`);

                    let activeContents = contents;

                    if (aiProvider === 'OpenRouter') {
                        stream = getOpenRouterStream(
                            settings.apiKey,
                            targetModel,
                            activeContents,
                            currentSystemInstruction,
                            thinkingLevel,
                            mode,
                            isMultiModal
                        );
                    } else if (aiProvider === 'DeepSeek') {
                        stream = getDeepSeekStream(
                            settings.apiKey,
                            targetModel,
                            activeContents,
                            currentSystemInstruction,
                            thinkingLevel,
                            mode,
                            isMultiModal
                        );
                    } else {
                        stream = await client.models.generateContentStream({
                            model: targetModel || "gemma-4-31b-it",
                            contents: activeContents,
                            config: {
                                systemInstruction: currentSystemInstruction,
                                temperature: mode === 'Flux' ? 1.0 : 1.4,
                                maxOutputTokens: 32768,
                                mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
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
                                            return { includeThoughts: false, thinkingLevel: ThinkingLevel.MINIMAL };
                                        }
                                        return {
                                            includeThoughts: true,
                                            thinkingLevel: {
                                                'Fast': modelLower.includes('pro') ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
                                                'Low': ThinkingLevel.LOW,
                                                'Medium': ThinkingLevel.MEDIUM,
                                                'High': ThinkingLevel.HIGH,
                                                'xHigh': ThinkingLevel.HIGH
                                            }[thinkingLevel] || ThinkingLevel.MEDIUM
                                        };
                                    } else {
                                        const budget = {
                                            'Fast': 0,
                                            'Low': 512,
                                            'Medium': 2048,
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
                        });
                    }

                    // Reset turn state for this specific retry attempt
                    turnText = '';
                    lastToolSniffed = null;
                    lastToolEventTime = null;
                    toolResults = [];
                    toolCallPointer = 0;

                    // Success - Reset model name display for final chunks
                    yield { type: 'model_update', content: null };
                                yield { type: 'status', content: 'Working...' };

                    dedupeBuffer = '';
                    isDedupeActive = accumulatedContext.length > 0;

                    let pendingGoogleText = '';
                    let lastGoogleFlushTime = Date.now();

                    for await (const chunk of stream) {
                        if (TERMINATION_SIGNAL) {
                            yield { type: 'status', content: 'Termination Signal Received.' };
                            // wait 3s
                            await new Promise(resolve => setTimeout(resolve, 1500));
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
                                // Wait for a small window to find a reliable overlap
                                if (dedupeBuffer.length >= 30) {
                                    let overlapLen = 0;
                                    const maxPossibleOverlap = Math.min(accumulatedContext.length, dedupeBuffer.length);

                                    // Find the longest overlap between end of context and start of new buffer
                                    for (let len = maxPossibleOverlap; len > 0; len--) {
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
                                                yield { type: 'text', content: dedupeClean };
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
                                    yield { type: 'text', content: chunkText };
                                }
                            }

                            // [SYSTEM SIGNAL FILTER] - Ignore thoughts and unclosed tools for signal detection
                            const signalSafeText = getSanitizedText(turnText);

                            // [LIVE TOOL SNIFFING] - Zero latency feedback & Telemetry start
                            const toolContext = getActiveToolContext(turnText);
                            if (toolContext.inside) {
                                if (!lastToolEventTime) lastToolEventTime = Date.now();
                                const rawToolName = toolContext.toolName;
                                const NORMALIZE_MAP = {
                                    'Ask': 'ask', 'WebSearch': 'web_search', 'WebScrape': 'web_scrape',
                                    'ReadFile': 'view_file', 'ReadFolder': 'read_folder', 'WriteFile': 'write_file',
                                    'PatchFile': 'update_file', 'WritePDF': 'write_pdf', 'WriteDoc': 'write_docx',
                                    'Run': 'exec_command', 'SearchKeyword': 'search_keyword', 'Memory': 'memory',
                                    'Chat': 'chat', 'chat': 'chat',
                                    'GenerateImage': 'generate_image', 'generate_image': 'generate_image'
                                };
                                const potentialTool = NORMALIZE_MAP[rawToolName] || rawToolName;
                                const partialArgs = toolContext.args || '';

                                // [PEEK LOGIC] - Try to extract detail from partial strings (File Tools & Search)
                                let detail = null;
                                if (['write_file', 'update_file', 'view_file', 'read_folder', 'write_pdf', 'write_docx', 'search_keyword', 'generate_image'].includes(potentialTool)) {
                                    const pArgs = parseArgs(partialArgs);
                                    const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
                                    const keyword = pArgs.keyword;

                                    if (keyword) {
                                        detail = keyword.replace(/["']/g, '');
                                    } else if (filePath) {
                                        detail = path.basename(filePath.replace(/["']/g, '').replace(/\\/g, '/'));
                                    } else {
                                        // [FALLBACK] - Super-permissive regex for mid-stream escaped paths/keywords
                                        const m = partialArgs.match(/(?:path|targetFile|TargetFile|directory|keyword)\s*=\s*\\?["']?([^\\"' \),]+)/);
                                        if (m) {
                                            const val = m[1].replace(/["']/g, '');
                                            detail = potentialTool === 'search_keyword' ? val : path.basename(val.replace(/\\/g, '/'));
                                        }
                                    }
                                }

                                // Only update if something changed (to avoid jitter)
                                const currentLabel = `${TOOL_LABELS[potentialTool] || potentialTool}${detail ? ` (${detail})` : ''}`;
                                if (potentialTool !== lastToolSniffed || detail !== lastToolDetail) {
                                    lastToolSniffed = potentialTool;
                                    lastToolDetail = detail;
                                    yield { type: 'status', content: `${currentLabel}...` };

                                    if (process.stdout.isTTY) {
                                        const TOOL_TITLES = {
                                            'web_search': 'Searching',
                                            'web_scrape': 'Reading',
                                            'view_file': 'Reading',
                                            'read_folder': 'Reading',
                                            'list_files': 'Reading',
                                            'write_file': 'Writing',
                                            'update_file': 'Editing',
                                            'write_pdf': 'Creating',
                                            'write_docx': 'Creating',
                                            'search_keyword': 'Searching',
                                            'exec_command': 'Executing',
                                            'ask': 'User Input',
                                            'memory': 'Updating Memory',
                                            'generate_image': 'Generating'
                                        };
                                        const toolTitle = TOOL_TITLES[potentialTool] || 'Working';
                                        process.stdout.write(`\u001b]0;${toolTitle}...\u0007`);
                                    }
                                }
                            }

                            // [LOOP DETECTION] - Catch runaway repetitive reasoning (Monologue-Safe)
                            // Shield loop detection from text inside tool calls (closed or unclosed)
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

                            // [REAL-TIME TOOL EXECUTION]
                            // We use a version that only strips thoughts but preserves full tool arguments
                            const toolActionableText = turnText.replace(/(?:<(think|thought|thoughts)>|\[(think|thought|thoughts)\])[\s\S]*?(?:<\/(think|thought|thoughts)>|\[\/(think|thought|thoughts)\]|$)/gi, '');
                            const allToolsFound = detectToolCalls(toolActionableText);
                            while (allToolsFound.length > toolCallPointer) {
                                const toolCall = allToolsFound[toolCallPointer];
                                const executionStart = Date.now();

                                const NORMALIZE_MAP = {
                                    'Ask': 'ask', 'WebSearch': 'web_search', 'WebScrape': 'web_scrape',
                                    'ReadFile': 'view_file', 'ReadFolder': 'read_folder', 'WriteFile': 'write_file',
                                    'PatchFile': 'update_file', 'WritePDF': 'write_pdf', 'WriteDoc': 'write_docx',
                                    'Run': 'exec_command', 'SearchKeyword': 'search_keyword', 'Memory': 'memory',
                                    'Chat': 'chat', 'chat': 'chat',
                                    'GenerateImage': 'generate_image', 'generate_image': 'generate_image'
                                };
                                const normToolName = NORMALIZE_MAP[toolCall.toolName] || toolCall.toolName;

                                // Status Update
                                const displayLabel = TOOL_LABELS[normToolName] || toolCall.toolName;
                                const detail = getToolDetail(normToolName, toolCall.args);
                                yield { type: 'status', content: `${displayLabel}${detail ? ` (${detail})` : ''}...` };

                                // START VISUAL FEEDBACK FOR TOOLS
                                let label = '';
                                if (normToolName === 'web_search') {
                                    const { query, limit = 10 } = parseArgs(toolCall.args);
                                    label = `🔍 Searched: ${query}`;
                                } else if (normToolName === 'web_scrape') {
                                    const url = parseArgs(toolCall.args).url || '...';
                                    label = `📖 Visited: ${url}`;
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
                                        label = `📄 Viewed: ${targetPath}`;
                                    } else if (isImage) {
                                        label = `📸 Viewed: ${targetPath}`;
                                    } else {
                                        label = `📄 Read: ${targetPath} → Lines ${sLine} - ${actualEndLine} of ${totalLines}`;
                                    }
                                } else if (normToolName === 'list_files' || normToolName === 'read_folder') {
                                    const action = normToolName === 'list_files' ? 'List' : 'Viewed';
                                    const path = parseArgs(toolCall.args).path;
                                    label = `📂 ${action}: ${path === '.' ? './' : path}`;
                                } else if (normToolName === 'write_file' || normToolName === 'update_file') {
                                    const action = normToolName === 'write_file' ? 'Created' : 'Edited';
                                    label = `💾 ${action}: ${parseArgs(toolCall.args).path || '...'}`;
                                } else if (normToolName === 'write_pdf') {
                                    label = `📑 Created: ${parseArgs(toolCall.args).path || '...'}`;
                                } else if (normToolName === 'write_docx') {
                                    label = `📝 Created: ${parseArgs(toolCall.args).path || '...'}`;
                                } else if (normToolName === 'search_keyword') {
                                    label = '';
                                } else if (normToolName === 'generate_image') {
                                    const { path: argPath, outputPath, output } = parseArgs(toolCall.args);
                                    label = `🎨 Generated: ${argPath || outputPath || output || 'generated_image.png'}`;
                                } else if (normToolName === 'exec_command' || normToolName === 'ask') {
                                    label = '';
                                } else {
                                    label = `Executed: ${toolCall.toolName}`;
                                }

                                // END VISUAL FEEDBACK

                                // EXECUTION LOGIC
                                if (normToolName === 'exec_command') {
                                    const { command } = parseArgs(toolCall.args);
                                    if (command && settings.systemSettings && settings.systemSettings.allowExternalAccess === false) {
                                        const riskyPatterns = [/[a-zA-Z]:[\\\/]/i, /^\//, /\.\.[\\\/]/, /\/etc\//, /\/var\//, /\/root\//, /\/bin\//, /\/usr\//];
                                        const currentDrive = path.resolve(process.cwd()).substring(0, 3).toLowerCase();
                                        const isViolating = riskyPatterns.some(pattern => {
                                            if (pattern.source === '[a-zA-Z]:[\\\\\\/]') {
                                                const driveMatch = command.match(/[a-zA-Z]:[\\\/]/i);
                                                return driveMatch && driveMatch[0].toLowerCase() !== currentDrive;
                                            }
                                            return pattern.test(command);
                                        });
                                        if (isViolating) {
                                            const denyMsg = `Access Denied. Terminal is prohibited from accessing system drives (C://) or external directories while "External Workspace Access" is disabled.`;
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
                                            const deniedLabel = `💾 ${action}: ${parsedArgs.path || '...'}`;
                                            const boxWidth = Math.min(deniedLabel.length + 4, 115);
                                            const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                            const boxMid = `│ ${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                            const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                            yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };
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
                                                    const networkCmdRegex = /\b(curl|wget|npm|yarn|pnpm|pip|pip3|ssh|docker|git\s+(clone|push|pull|fetch))\b/i;
                                                    if (networkCmdRegex.test(cmdTrimmed)) {
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
                                                                const failures = patchResults.filter(r => !r.success);
                                                                if (failures.length > 0) {
                                                                    const errorMsg = `[TOOL RESULT]: ERROR: Failed to apply patches to [${path.basename(absPath)}].\\n${failures.map(f => `  • ${f.error}`).join('\\n')}`;

                                                                    // Visual Feedback
                                                                    const errorLabel = `💾 Edited: ${path.basename(absPath)}`.toUpperCase();
                                                                    const boxWidth = Math.min(errorLabel.length + 4, 115);
                                                                    const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                                                    const boxMid = `│ ${errorLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                                                    const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                                                    yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };

                                                                    toolResults.push({ role: 'user', text: errorMsg });
                                                                    yield { type: 'tool_result', content: errorMsg, toolName: normToolName };

                                                                    toolCallPointer++;
                                                                    continue; // Skip approval and execution
                                                                }
                                                            }

                                                            yield { type: 'status', content: `Opening Diff in IDE: ${path.basename(absPath)}...` };
                                                            showDiffInIDE(absPath, originalContent, modifiedContent);
                                                            diffOpened = true;
                                                            await new Promise(r => setTimeout(r, 50)); // Beat delay
                                                        } else if (normToolName === 'write_file') {
                                                            const modifiedContent = toolArgs.content || toolArgs.newContent || '';
                                                            yield { type: 'status', content: `Opening New File Diff in IDE: ${path.basename(absPath)}...` };
                                                            showDiffInIDE(absPath, '', modifiedContent);
                                                            diffOpened = true;
                                                            await new Promise(r => setTimeout(r, 50)); // Beat delay
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Simulation/Diff Error:", e);
                                                }
                                            }

                                            approval = await settings.onToolApproval(normToolName, toolCall.args);

                                            if (normToolName === 'write_file' || normToolName === 'update_file') {
                                                const { path: filePath } = parseArgs(toolCall.args);
                                                if (filePath) {
                                                    const absPath = path.resolve(process.cwd(), filePath);
                                                    closeDiffInIDE(absPath, approval);
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

                                                result = `SUCCESS: File [${filePath}] saved via IDE Companion (May have user edits).\n\n- Stats: [${verifiedLineCount} lines, ${(verifiedSize/1024).toFixed(1)} KB]\n${ancestry}- Content Preview:\n${snippet}\n\nCheck if Starting and Ending matches your write.`;
                                            }

                                            // Restore UI feedback
                                            const action = normToolName === 'write_file' ? 'Written' : 'Edited';
                                            const feedbackLabel = `💾 ${action}: ${filePath || '...'}`;
                                            const boxWidth = Math.min(feedbackLabel.length + 4, 115);
                                            const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                            const boxMid = `│ ${feedbackLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                            const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                            yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };

                                            const toolEnd = Date.now();
                                            lastToolFinishedAt = toolEnd;
                                            yield { type: 'tool_time', content: toolEnd - executionStart };

                                            const aiContent = `[TOOL RESULT]: ${result}`;
                                            toolResults.push({ role: 'user', text: aiContent });
                                            anyToolExecutedInThisTurn = true;
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
                                                denyMsg = 'Permission Denied: Prohibited Command';
                                            }

                                            if (normToolName === 'write_file' || normToolName === 'update_file') {
                                                const action = normToolName === 'write_file' ? 'WRITE DENIED' : 'UPDATE DENIED';
                                                const deniedLabel = `💾 ${action}: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                                                const boxWidth = Math.min(deniedLabel.length + 4, 115);
                                                const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                                const boxMid = `│ ${deniedLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                                const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                                yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };
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
                                    const boxWidth = Math.min(label.length + 4, 115);
                                    const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                    const boxMid = `│ ${label.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                    const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                    yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };
                                }

                                // [ARTIFICIAL TOOL DELAY] - Ensure a minimum 1s gap between tool executions
                                if (lastToolFinishedAt > 0) {
                                    const timeSinceLastTool = Date.now() - lastToolFinishedAt;
                                    if (timeSinceLastTool < 1000) {
                                        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastTool));
                                    }
                                }

                                yield { type: 'spinner', content: false };

                                // CRITICAL: Sync with IDE buffer one last time before execution if approved
                                let execToolContext = {
                                    chatId, history, onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null, onAskUser: settings.onAskUser,
                                    systemSettings: settings.systemSettings,
                                    mode,
                                    isMultiModal: isModelMultimodal(targetModel)
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
                                    } catch (e) {}
                                }

                                let result = await dispatchTool(normToolName, toolCall.args, execToolContext);
                                yield { type: 'spinner', content: true };

                                if (normToolName === 'write_file' && result.startsWith('SUCCESS')) {
                                    const { path: filePath } = parseArgs(toolCall.args);
                                    if (filePath) openFileInEditor(filePath);
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
                                        const m = result.match(/Found (\d+) matches/i);
                                        if (m) {
                                            matchCount = parseInt(m[1]);
                                        }
                                    }
                                    const postLabel = `🔎 Searched: "${keyword}" in ${file ? `"${file}"` : './'} → ${matchCount} Match${matchCount === 1 ? '' : 'es'}`;
                                    const boxWidth = Math.min(postLabel.length + 4, 115);
                                    const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                    const boxMid = `│ ${postLabel.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                    const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                    yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };
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

                                const aiContent = `[TOOL RESULT]: ${(result || '').toString().split(/\r?\n/).filter(line => !line.includes('[UI_CONTEXT]')).join('\n')}`;
                                toolResults.push({ role: 'user', text: aiContent, binaryPart });
                                anyToolExecutedInThisTurn = true;

                                let uiContent = `[TOOL RESULT]: ${result || ''}`;
                                if (normToolName === 'view_file' || normToolName === 'web_scrape') {
                                    uiContent = `[TOOL RESULT]: ${label} (Context Locked for UI Clarity)`;
                                }

                                yield { type: 'tool_result', content: uiContent, aiContent: aiContent, binaryPart, toolName: normToolName };
                                if (normToolName === 'memory' && result.includes('SUCCESS')) yield { type: 'memory_updated' };

                                toolCallPointer++;
                            }
                            if (aiProvider === 'Google' && pendingGoogleText && (Date.now() - lastGoogleFlushTime >= 150)) {
                                yield { type: 'text', content: pendingGoogleText };
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
                                    yield { type: 'text', content: dedupeClean };
                                }
                            }
                        }
                        isDedupeActive = false;
                        dedupeBuffer = '';
                    }

                    if (aiProvider === 'Google' && pendingGoogleText) {
                        yield { type: 'text', content: pendingGoogleText };
                        pendingGoogleText = '';
                    }

                    if (TERMINATION_SIGNAL) break;

                    // [SILENT CUTOFF WATCHDOG]
                    // If stream closed cleanly but we don't have finish/continue signals or tool executions,
                    // it is highly likely that a silent cutoff occurred. Trigger the recovery engine!
                    // Exception: If the text ends normally with punctuation (., !, ?, quotes, code fences),
                    // we assume the model finished its response but forgot the command tags. We bypass recovery
                    // and let the outer loop's loop-reset safety valve handle the continue/finish prompts!
                    const signalSafeText = (turnText || '').trim();
                    const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase());
                    const hasContinue = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText.toLowerCase());
                    const didCallTool = toolResults.length > 0 || lastToolSniffed !== null;

                    const pureOutputText = signalSafeText.replace(/(?:<think>|\[think\])[\s\S]*?(?:<\/think>|\[\/think\])/gi, '').trim();
                    const endsNormally = /[.!?}"'`’“”]$|```$/s.test(pureOutputText);

                    if (!hasFinish && !hasContinue && !didCallTool && signalSafeText.length > 0 && !endsNormally && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop) {
                        throw new Error("Silent stream cutoff (500): Model stream closed cleanly but cut off mid-sentence without signals.");
                    }

                    success = true;
                    // Count the successful call
                    await incrementUsage('agent');
                } catch (err) {
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
                        await incrementUsage('agent');
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

                    const errMsg = err.status || (err.error && err.error.message) || String(err);
                    const errLog = String(err);
                    // Log error in /logs/agent/error.log
                    const date = new Date().toLocaleString();
                    const agentErrDir = path.join(LOGS_DIR, 'agent');
                    if (!fs.existsSync(agentErrDir)) fs.mkdirSync(agentErrDir, { recursive: true });
                    fs.appendFileSync(path.join(agentErrDir, 'error.log'), `ERROR [${date}]: ${errLog}\n\n----------------------------------------------------------------------\n\n`);

                    // RETRY ONLY ON 500-LEVEL (500, 503, ETC.) AND 408 TIMEOUT ERRORS
                    const status = err.status || err.statusCode || err.code;
                    const isRetryable = (
                        (status && ((status >= 500 && status < 600) || status === 408)) ||
                        (!status && (
                            /status[ :]+(5\d\d|408)/i.test(String(err)) ||
                            /code[ :]+(5\d\d|408)/i.test(String(err)) ||
                            /(500|503|408)/.test(String(err))
                        ))
                    );

                    if (!isRetryable) {
                        if (retryCount < MAX_RETRIES - 3) {
                            throw err;
                        }
                    }

                    if (turnText.trim().length > 0 || inStreamRetryCount > 1) {
                        // IN-STREAM RECOVERY
                        if (inStreamRetryCount <= MAX_RETRIES) {
                            inStreamRetryCount++;
                            const waitTime = Math.min(1000 * Math.pow(2, inStreamRetryCount - 1), 24000);

                            if (turnText.trim().length > 0) {
                                modifiedHistory.push({ role: 'agent', text: turnText });

                                const recoveryText = "[SYSTEM]\n- SEAMLESS CONTINUATION: Resume immediately. Pick up from last words with zero gap/disruption\n- NO REPETITION: Do not repeat any text already written\n- NO RE-THINK: Do not restart or open <think> if reasoning already started. Continue the thinking and close thinking block with </think> if opened\n- MID-TOOL SAFETY: If cutoff was mid-tool call, restart that tool call from start\n- STEALTH: Do not mention/apologize for cutoff";

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
                            yield { type: 'status', content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${(waitTime / 1000).toFixed(0)}s]...` };
                            // show live decremental countdown
                            for (let i = waitTime / 1000; i > 0; i--) {
                                yield { type: 'status', content: `Trying to reach ${modelName} (${retryCount}/${MAX_RETRIES}) [Retrying in ${i}s]...` };
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            yield { type: 'status', content: `Trying to reach ${modelName}...` };
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

                await addToUsage('tokens', total);
                if (cached > 0) {
                    await addToUsage('cachedTokens', cached);
                }
                if (candidates > 0) {
                    await addToUsage('candidateTokens', candidates);
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
            const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase());
            const hasContinue = /\[\s*(turn\s*:)?\s*continue\s*\]/i.test(signalSafeText.toLowerCase());
            const shouldContinue = toolCallPointer > 0;

                        yield { type: 'status', content: 'Working...' };

            const cleanedTurnText = contextSafeReplace(turnText, /\[\s*(turn\s*:)?\s*(continue|finish)\s*\]/gi, '')
                .trim();

            // [STRICT PROTOCOL ENFORCEMENT]
            // If the model explicitly finished or if there are no pending tool results to execute and send back,
            // we finish the agent loop immediately.
            // We MUST NOT finish if a tool was executed (toolResults.length > 0) or if a continue signal is present.
            // [BUGFIX] - We also MUST NOT finish if we are in a recovery state (loop detection triggered).
            let isActuallyFinished = !hasContinue && (hasFinish || !shouldContinue) && toolResults.length === 0 && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop;


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

                // Update History Length Baseline in chat-summaries.json
                try {
                    const summaries = readEncryptedJson(summariesFile, {});
                    let existing = summaries[chatId] || { summary: '', historyLength: 0 };
                    if (typeof existing === 'string') {
                        existing = { summary: existing, historyLength: 0 };
                    }
                    const cleanLen = modifiedHistory.filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta).length;
                    if (wasCompressedInStream) {
                        existing.historyLength = (existing.historyLength || 0) + cleanLen;
                    } else {
                        existing.historyLength = cleanLen;
                    }
                    summaries[chatId] = existing;
                    writeEncryptedJson(summariesFile, summaries);
                } catch (e) {
                    // Silently ignore storage errors to avoid breaking stream
                }
            }

                if (isActuallyFinished) break;
            // SDK PROTECTION: Ensure agent response is never empty before next turn
            const nextAgentMsg = cleanedTurnText.trim() || '*Working...*';
            modifiedHistory.push({ role: 'agent', text: nextAgentMsg });

            // If the model hasn't finished, we must provide a user turn to keep the loop going.
            // If there are no tool results, we send a 'continue' signal to prompt the model.
            if (toolResults.length > 0 || anyToolExecutedInThisTurn) {
                if (toolResults.length > 0) {
                    const combinedText = toolResults.map(tr => tr.text).join('\n\n');
                    const binaryPart = toolResults.find(tr => tr.binaryPart)?.binaryPart || null;
                    modifiedHistory.push({ role: 'user', text: combinedText, binaryPart });
                }
            } else {
                if (wasToolCalledInLastLoop) {
                    modifiedHistory.push({ role: 'user', text: `[SYSTEM] Failed to verify tool execution, Verify tool syntax, proper escaping or ask user if tool worked if unsure` });
                } else {
                    modifiedHistory.push({ role: 'user', text: `[SYSTEM] ${isStutteringLoop && !isThinkingLoop ? `STUTTERING DETECTED by Internal System. Re-calibrate your response & proceed.` : `${isThinkingLoop ? ' OVER-THINKING' : ' LOOP'} DETECTED by Internal System${isThinkingLoop ? ' for current EFFORT_LEVEL' : ''}. ${isThinkingLoop ? 'If you have planned the task, prioritize the execution/output' : 'If you have finished your task use [turn: finish] else continue'}`}` });
                }
                isThinkingLoop = false;
                isStutteringLoop = false;
                isGeneralLoop = false;
            }
            wasToolCalledInLastLoop = toolCallPointer > 0 || anyToolExecutedInThisTurn;
        }

        // [JIT CLEANUP] - Clean up JIT instruction injection markers from the persistent history
        if (modelName && modelName.toLowerCase().startsWith('gemma')) {
            modifiedHistory.forEach(msg => {
                if (msg.role === 'user' && msg.text && msg.text.startsWith('[TOOL RESULT]')) {
                    const jitInstructionFast = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn`;
                    const jitInstructionThinking = `\n[SYSTEM] Tool result received. Analyze output and proceed with your turn. **STRICTLY MAINTAIN THINKING POLICY. DO NOT START A RESPONSE WITHOUT <think> ... </think>}**`;
                    msg.text = msg.text.replace(jitInstructionThinking, '').replace(jitInstructionFast, '').trim();
                }
            });
        }

    } finally {
        await RevertManager.commitTransaction();
    }
    yield { type: 'status', content: null };
};
