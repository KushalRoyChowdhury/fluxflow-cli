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

import { LOGS_DIR, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, MEMORIES_FILE } from './paths.js';
import { RevertManager } from './revert.js';

let client = null;

let TERMINATION_SIGNAL = false;

export const signalTermination = () => {
    TERMINATION_SIGNAL = true;
};

const TOOL_LABELS = {
    'write_file': 'Writing File',
    'update_file': 'Updating File',
    'read_folder': 'Listing Directory',
    'view_file': 'Reading File',
    'exec_command': 'Running Command',
    'web_search': 'Searching Web',
    'web_scrape': 'Reading Site',
    'memory': 'Updating Memory',
    'search_keyword': 'Finding Files',
    'ask': 'Asking User',
    'write_pdf': 'Creating PDF',
    'write_docx': 'Creating Document',
    'generate_image': 'Generating Image',
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
        process.stdout.write(`\u001b]0;Finalizing...\u0007`);
    }

    const USER_CONTEXT_LENGTH = 4 * (1024 * 2);
    const AGENT_CONTEXT_LENGTH = 4 * (1024 * 8);

    const { onStatus, onMemoryUpdated, onBackgroundIncrement } = callbacks;
    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats } = settings;
    const isMemoryEnabled = systemSettings?.memory !== false;

    // Harvest persistent user memories (Duplicate of logic in getAIStream for background context)
    const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
    const janitorUserMemories = persistentStorage.map(m => `- [${m.id}]: ${m.memory}`).join('\n');

    const janitorContents = history.slice(0, -1)
        .filter(msg => msg.text && !msg.text.includes('[TOOL RESULT]') && !msg.text.includes('OBSERVATION:') && !msg.isMeta && !msg.isLogo && !String(msg.id).startsWith('welcome') && !String(msg.id).startsWith('logo'))
        .slice(-14)
        .map(msg => {
            let processedText = msg.text
                .replace(/\[tool:functions\..*?\]/g, '')
                .replace(/<think>[\s\S]*?<\/think>/g, '')
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

    const cleanedFullResponse = fullAgentTextRaw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const janitorPrompt = getJanitorInstruction(
        janitorUserMemories,
        isMemoryEnabled,
        needTitle
    );

    let agentRes = `${cleanedFullResponse.replace(/\[tool:functions\..*?\]/g, '').replace(/<think>.*<\/think>/g, '').replace(/\[Prompted on:.*?\]/g, '').replace(/\[turn: continue\]/g, '').replace(/\[turn: finish\]/g, '').replace(/\[TOOL RESULTS\]/g, '').replace(/\[tool results\]/g, '').substring(0, AGENT_CONTEXT_LENGTH)}`;
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
    const MAX_JANITOR_RETRIES = 12; // Total Retries = 13

    while (attempts <= MAX_JANITOR_RETRIES) {
        if (process.stdout.isTTY) {
            process.stdout.write(`\u001b]0;Retrying Finalizing... (${attempts + 1})...\u0007`);
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
                            process.stdout.write(`\u001b]0;Memory Updated\u0007`);
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
                process.stdout.write(`\u001b]0;Finalizing Error\u0007`);
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Restore title to Idle when janitor finishes
    if (process.stdout.isTTY) {
        process.stdout.write(`\u001b]0;FluxFlow | Idle\u0007`);
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
        result += stripThoughts ? before.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '') : before;

        const startIdx = match.index + match[0].length - 1;
        let balance = 0;
        let inString = null;
        let isEscaped = false;
        let endIdx = -1;

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
                    let j = i + 1;
                    while (j < text.length && /\s/.test(text[j])) j++;
                    if (j < text.length && text[j] === ']') {
                        endIdx = j;
                        break;
                    }
                }
            }
            if (char === '\\') isEscaped = !isEscaped;
            else isEscaped = false;
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
        result += stripThoughts ? text.substring(lastIdx).replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '') : text.substring(lastIdx);
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
        let isEscaped = false;
        let endIdx = -1;

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
                    let j = i + 1;
                    while (j < text.length && /\s/.test(text[j])) j++;
                    if (j < text.length && text[j] === ']') {
                        endIdx = j;
                        break;
                    }
                }
            }
            if (char === '\\') isEscaped = !isEscaped;
            else isEscaped = false;
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
        let isEscaped = false;
        let endIdx = -1;
        let closingParenIdx = -1;

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
                    closingParenIdx = i;
                    let j = i + 1;
                    while (j < text.length && /\s/.test(text[j])) j++;
                    if (j < text.length && text[j] === ']') {
                        endIdx = j;
                        break;
                    }
                }
            }

            // Toggle escape state
            if (char === '\\') {
                isEscaped = !isEscaped;
            } else {
                isEscaped = false;
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
 * Detects past chats with substantial turn-level memories, batch-summarizes/merges them
 * into an on-device L2 cache file using stacked tool calls, and purges them from L1.
 */
const consolidatePastMemories = async (currentChatId, settings) => {
    try {
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

        // 4. Send the batch request to Gemini 3.1 Flash Lite with a programmatic retry loop (max 3 attempts)
        let attempts = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempts < maxAttempts && !success) {
            attempts++;
            try {
                const response = await client.models.generateContent({
                    model: 'gemini-3.1-flash-lite',
                    contents: prompt,
                    config: {
                        temperature: 0.3,
                        safetySettings: [
                            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        ],
                        thinkingConfig: { includeThoughts: false, thinkingLevel: ThinkingLevel.LOW }
                    }
                });

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
    if (!client) throw new Error('AI not initialized');

    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats } = settings;
    const isMemoryEnabled = systemSettings?.memory !== false;
    const originalText = history[history.length - 1].text;

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

    // Truncation Logic (Compression 0.0)
    if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > 254000) {
        modifiedHistory = getTruncatedHistory(modifiedHistory, 6);
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

    const isContext32k = (sessionStats?.tokens || 0) >= 32000;
    const memoryPrompt = getMemoryPrompt(otherMemories, mainUserMemories, isMemoryEnabled, isContext32k);
    const dateTimeStr = new Date().toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    const firstUserMsg = `${memoryPrompt}\n[METADATA (PRIORITY: DYNAMIC)] Time: ${dateTimeStr} | v${versionFluxflow}\n${thinkingLevel != 'Fast' ? '[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS CORE PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**\n' : ''}[USER] ${agentText.replace(/\s*\[Prompted on:.*?\]/g, '').trim()}`.trim();
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
            msg.text = msg.text.replace(/<(think|thought)>[\s\S]*?<\/(think|thought)>/gi, '').trim();
        }
    });

    // 1 extra loop for grace period
    for (let loop = 0; loop <= MAX_LOOPS; loop++) {
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
                    modifiedHistory.push({ role: 'user', text: `${thinkingLevel != 'Fast' ? '[SYSTEM] **STRICTLY FOLLOW THINKING POLICY AS STRICT PRIORITY. DO NOT START A RESPONSE WITHOUT <think> ... </think>**\n' : ''}[STEERING HINT]: ${hint}` });
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

        while (retryCount <= MAX_RETRIES && inStreamRetryCount <= MAX_RETRIES && !success && !TERMINATION_SIGNAL) {
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
                    .filter(msg => (msg.role === 'user' || msg.role === 'agent' || msg.role === 'system') && !String(msg.id).startsWith('welcome') && !msg.isMeta)
                    .map(msg => {
                        const parts = [{ text: msg.text }];
                        if (msg.binaryPart) {
                            parts.push(msg.binaryPart);
                        }
                        return {
                            role: (msg.role === 'user' || msg.role === 'system') ? 'user' : 'model',
                            parts
                        };
                    });
                // Quota Check
                if (!(await checkQuota('agent', settings))) {
                    throw new Error("Error: Daily Quota Exausted for Agent");
                }

                // [HIGH RELIABILITY FALLBACK SPECTRUM]
                let targetModel = modelName;
                if (retryCount === MAX_RETRIES - 1) {
                    targetModel = 'gemini-3-flash-preview';
                    yield { type: 'model_update', content: 'Trying with fallback model' };
                } else if (retryCount === MAX_RETRIES) {
                    targetModel = 'gemini-3.5-flash';
                    yield { type: 'model_update', content: 'Trying with fallback model' };
                } else if (retryCount > 12 && retryCount < MAX_RETRIES - 2 && settings.apiKey !== "custom") {
                    targetModel = 'gemma-4-31b-it';
                    yield { type: 'model_update', content: 'Trying with fallback Gemma Model' };
                } else if (retryCount > 0) {
                    yield { type: 'model_update', content: null };
                }

                // [DYNAMIC CONTEXT ADAPTATION WITH MEMORIES]
                // We recalculate instructions every turn so the agent knows when it's hitting context limits
                const currentSystemInstruction = getSystemInstruction(profile, thinkingLevel, mode, systemSettings, isMemoryEnabled, MAX_LOOPS, loop + 1);

                // [JIT INSTRUCTION INJECTION] - Only for tool results, kept out of persistent history
                const jitInstruction = `\n\n[SYSTEM] Tool result received. Analyze output and proceed with your turn.${thinkingLevel != 'Fast' ? '**STRICTLY MAINTAIN THINKING PROTOCOL. DO NOT START A RESPONSE WITHOUT <think> ... </think>**' : ''}`;
                const lastUserMsg = contents[contents.length - 1];
                let addedMarker = false;
                if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text?.startsWith('[TOOL RESULT]')) {
                    lastUserMsg.parts[0].text += jitInstruction;
                    addedMarker = true;
                }

                // [JIT STEP SENTRY] - Only inject step warning if loop is at >= 80% of MAX_LOOPS for Flow and 95% for Flux
                // Keeps prompts fully cached and static for the vast majority of runs!
                const stepThreshold = Math.floor(MAX_LOOPS * (mode === 'Flux' ? 0.98 : 0.7));
                const currentStep = loop + 1;
                if (currentStep >= stepThreshold && lastUserMsg && lastUserMsg.parts?.[0]) {
                    lastUserMsg.parts[0].text += `\n[SYSTEM] WARNING, Turn Limit Impending: Step ${currentStep}/${MAX_LOOPS}. Wrap up quickly/prompt user to continue & use [turn:finish] quickly.`;
                }

                // fs.writeFileSync("contents.txt", currentSystemInstruction + `\n\n` + firstUserMsg);

                stream = await client.models.generateContentStream({
                    model: targetModel || "gemma-4-31b-it",
                    contents,
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
                        thinkingConfig: { includeThoughts: false, thinkingLevel: targetModel.includes('pro') ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL },
                    },
                });

                // [JIT CLEANUP] - Remove the marker from the local contents object after sending
                if (addedMarker && contents[contents.length - 1]?.parts?.[0]) {
                    contents[contents.length - 1].parts[0].text = contents[contents.length - 1].parts[0].text.replace(jitInstruction, '').trim();
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

                for await (const chunk of stream) {
                    if (TERMINATION_SIGNAL) {
                        yield { type: 'status', content: 'Termination Signal Received.' };
                        // wait 3s
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        break;
                    }
                    if (chunk.text) {
                        if (isDedupeActive) {
                            dedupeBuffer += chunk.text;
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
                                    const hasOpenThink = /<(think|thought)>(?:(?!<\/(?:think|thought)>)[\s\S])*$/i.test(accumulatedContext);
                                    const dedupeClean = hasOpenThink
                                        ? cleanText.replace(/^\s*<(think|thought)>\s*/gi, '')
                                        : cleanText.replace(/^\s*<(think|thought)>[\s\S]*?<\/(think|thought)>\s*/gi, '').replace(/^\s*<(think|thought)>\s*/gi, '');
                                    if (dedupeClean) {
                                        turnText += dedupeClean;
                                        yield { type: 'text', content: dedupeClean };
                                    }
                                }
                                isDedupeActive = false;
                                dedupeBuffer = '';
                            }
                            continue;
                        }
                        else {
                            turnText += chunk.text;
                            yield { type: 'text', content: chunk.text };
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
                                        'web_search': 'Searching Web',
                                        'web_scrape': 'Reading Website',
                                        'view_file': 'Reading File',
                                        'read_folder': 'Listing Folder',
                                        'list_files': 'Listing Folder',
                                        'write_file': 'Writing File',
                                        'update_file': 'Updating File',
                                        'write_pdf': 'Creating PDF',
                                        'write_docx': 'Creating Word Doc',
                                        'search_keyword': 'Searching Keywords',
                                        'exec_command': 'Running Command',
                                        'ask': 'Asking User',
                                        'memory': 'Updating Memory',
                                        'generate_image': 'Generating Image'
                                    };
                                    const toolTitle = TOOL_TITLES[potentialTool] || 'Working';
                                    process.stdout.write(`\u001b]0;${toolTitle}...\u0007`);
                                }
                            }
                        }

                        // [LOOP DETECTION] - Catch runaway repetitive reasoning (Monologue-Safe)
                        // Shield loop detection from text inside tool calls (closed or unclosed)
                        const contextSafeText = getContextSafeText(turnText, false);
                        const thinkBlocks = contextSafeText.match(/<think>([\s\S]*?)(?:<\/think>|$)/gi) || [];
                        const thinkContent = thinkBlocks.join('').trim();

                        // 1. Repetitive Sentence Check (The most common loop symptom)
                        const sentences = thinkContent.split(/[.!?]\s+/);
                        const uniqueSentences = new Set(sentences);
                        const repetitionRatio = sentences.length > 10 ? (sentences.length - uniqueSentences.size) / sentences.length : 0;

                        // 2. Verbosity Check (Global rambling detection)
                        const wordCount = thinkContent.split(/\s+/).filter(w => w.length > 0).length;

                        let repetitionThresholdThinking = 0.4;
                        let repetitionThresholdResponse = 0.6;

                        // Dynamic Thinking Cap based on tier
                        const thinkingCaps = {
                            'low': 200,
                            'medium': 500,
                            'high': 2000,
                            'max': 3500,
                            'xhigh': 3500,
                        };
                        const cap = thinkingCaps[thinkingLevel?.toLowerCase()] || 2500;
                        let isOverVerboseThinking = wordCount > cap;

                        if (repetitionRatio > repetitionThresholdThinking || isOverVerboseThinking) {
                            const reason = repetitionRatio > repetitionThresholdThinking ? 'Thinking Loop Detected' : 'Thinking Budget Exceeded';
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
                        const toolActionableText = turnText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
                        const allToolsFound = detectToolCalls(toolActionableText);
                        while (allToolsFound.length > toolCallPointer) {
                            const toolCall = allToolsFound[toolCallPointer];

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
                                label = `🔍 SEARCHED: "${query}" (${limit})`.toUpperCase();
                            } else if (normToolName === 'web_scrape') {
                                const url = parseArgs(toolCall.args).url || '...';
                                label = `📖 READ SITE: ${url}`.toUpperCase();
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
                                const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                                if (isPdf) {
                                    label = `📄 ANALYZED PDF: ${targetPath}`.toUpperCase();
                                } else if (isImage) {
                                    label = `📸 ANALYZED IMAGE: ${targetPath}`.toUpperCase();
                                } else {
                                    label = `📄 ANALYZED FILE: ${targetPath} | LINES: ${sLine}-${actualEndLine} OF ${totalLines}`.toUpperCase();
                                }
                            } else if (normToolName === 'list_files' || normToolName === 'read_folder') {
                                const action = normToolName === 'list_files' ? 'LIST' : 'ANALYSED';
                                label = `📂 ${action} FOLDER: ${parseArgs(toolCall.args).path || '.'}`.toUpperCase();
                            } else if (normToolName === 'write_file' || normToolName === 'update_file') {
                                const action = normToolName === 'write_file' ? 'WRITTEN' : 'UPDATED FILE';
                                label = `💾 ${action}: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (normToolName === 'write_pdf') {
                                label = `📑 PDF CREATED: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (normToolName === 'write_docx') {
                                label = `📝 DOCX CREATED: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (normToolName === 'search_keyword') {
                                const { keyword } = parseArgs(toolCall.args);
                                label = `🔎 KEYWORD SEARCHED: "${keyword}"`.toUpperCase();
                            } else if (normToolName === 'generate_image') {
                                const { path: argPath, outputPath, output } = parseArgs(toolCall.args);
                                label = `🎨 IMAGE GENERATED: ${argPath || outputPath || output || 'generated_image.png'}`.toUpperCase();
                            } else if (normToolName === 'exec_command' || normToolName === 'ask') {
                                label = '';
                            } else {
                                label = `EXECUTED: ${toolCall.toolName}`.toUpperCase();
                            }

                            if (label) {
                                const boxWidth = Math.min(label.length + 4, 115);
                                const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                                const boxMid = `│ ${label.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                                const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                                yield { type: 'visual_feedback', content: `${boxTop}\n${boxMid}\n${boxBottom}` };
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
                                    const denyMsg = `Access Denied. You are not allowed to access files outside the current workspace. To enable this, ask the user to turn on "External Workspace Access" in /settings.`;
                                    toolResults.push({ role: 'user', text: `[TOOL RESULT]: ERROR: ${denyMsg}` });
                                    yield { type: 'tool_result', content: `[TOOL RESULT]: ERROR: ${denyMsg}` };
                                    toolCallPointer++;
                                    continue;
                                }
                            }

                            if (settings.onToolApproval) {
                                let shouldPrompt = (normToolName === 'write_file' || normToolName === 'update_file' || normToolName === 'exec_command');
                                if (shouldPrompt) {
                                    const approval = await settings.onToolApproval(normToolName, toolCall.args);
                                    if (approval === 'deny') {
                                        if (normToolName === 'exec_command' && settings.onExecEnd) settings.onExecEnd();
                                        const denyMsg = `Permission Denied: User rejected the ${normToolName === 'exec_command' ? 'terminal execution' : 'file edit'}.`;
                                        toolResults.push({ role: 'user', text: `[TOOL RESULT]: DENIED: ${denyMsg}` });
                                        yield { type: 'tool_result', content: `[TOOL RESULT]: DENIED: ${denyMsg}` };
                                        await incrementUsage('toolDenied');
                                        if (settings.onToolResult) settings.onToolResult('denied', normToolName);
                                        toolCallPointer++;
                                        continue;
                                    }
                                }
                            }

                            // [ARTIFICIAL TOOL DELAY] - Ensure a minimum 1s gap between tool executions
                            if (lastToolFinishedAt > 0) {
                                const timeSinceLastTool = Date.now() - lastToolFinishedAt;
                                if (timeSinceLastTool < 1000) {
                                    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastTool));
                                }
                            }

                            const effectiveStart = lastToolEventTime || Date.now();
                            yield { type: 'spinner', content: false };
                            let result = await dispatchTool(normToolName, toolCall.args, {
                                chatId, history, onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null, onAskUser: settings.onAskUser
                            });
                            yield { type: 'spinner', content: true };

                            // Restore title back to "Working..." after tool is complete
                            if (process.stdout.isTTY) {
                                process.stdout.write(`\u001b]0;Working...\u0007`);
                            }

                            const toolEnd = Date.now();
                            lastToolFinishedAt = toolEnd;
                            yield { type: 'tool_time', content: toolEnd - effectiveStart };
                            lastToolEventTime = toolEnd;

                            let binaryPart = null;
                            if (typeof result === 'object' && result.binaryPart) {
                                binaryPart = result.binaryPart;
                                result = result.text;
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
                    }
                    lastUsage = chunk.usageMetadata;
                    if (lastUsage) {
                        yield { type: 'liveTokens', content: lastUsage.totalTokenCount };
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
                        const hasOpenThink = /<(think|thought)>(?:(?!<\/(?:think|thought)>)[\s\S])*$/i.test(accumulatedContext);
                        const dedupeClean = hasOpenThink
                            ? cleanText.replace(/^\s*<(think|thought)>\s*/gi, '')
                            : cleanText.replace(/^\s*<(think|thought)>[\s\S]*?<\/(think|thought)>\s*/gi, '').replace(/^\s*<(think|thought)>\s*/gi, '');
                        if (dedupeClean) {
                            turnText += dedupeClean;
                            yield { type: 'text', content: dedupeClean };
                        }
                    }
                    isDedupeActive = false;
                    dedupeBuffer = '';
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

                const pureOutputText = signalSafeText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
                const endsNormally = /[.!?}"'`’“”]$|```$/s.test(pureOutputText);

                if (!hasFinish && !hasContinue && !didCallTool && signalSafeText.length > 0 && !endsNormally && !isThinkingLoop && !isStutteringLoop && !isGeneralLoop) {
                    throw new Error("Silent stream cutoff (500): Model stream closed cleanly but cut off mid-sentence without signals.");
                }

                success = true;
                // Count the successful call
                await incrementUsage('agent');
            } catch (err) {
                if (String(err).includes('Incomplete JSON segment at the end')) {
                    // Swallow/suppress SDK stream-end JSON chunk parsing bug
                    success = true;
                    await incrementUsage('agent');
                    break;
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
                        const hasOpenThink = /<(think|thought)>(?:(?!<\/(?:think|thought)>)[\s\S])*$/i.test(accumulatedContext);
                        const dedupeClean = hasOpenThink
                            ? cleanText.replace(/^\s*<(think|thought)>\s*/gi, '')
                            : cleanText.replace(/^\s*<(think|thought)>[\s\S]*?<\/(think|thought)>\s*/gi, '').replace(/^\s*<(think|thought)>\s*/gi, '');
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

                            const recoveryText = "[SYSTEM: STREAM RECOVERY]\n- SEAMLESS CONTINUATION: Resume immediately. Pick up from last words with zero gap/disruption.\n- NO REPETITION: Do not repeat any text already written.\n- NO RE-THINK: Do not restart or open <think> if reasoning already started.\n- MID-TOOL SAFETY: If cutoff was mid-tool call, restart that tool call from start.\n- STEALTH: Do not mention/apologize for cutoff.\n- KEEP LENGTH: Maintain standard depth/length.";

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
                            yield { type: 'status', content: `Error Occured. Recovering Stream (${inStreamRetryCount}/${MAX_RETRIES}) [${i}s]...` };
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
                        yield { type: 'status', content: `Retrying Connection (${retryCount}/${MAX_RETRIES}) [${(waitTime / 1000).toFixed(0)}s]...` };
                        // show live decremental countdown
                        for (let i = waitTime / 1000; i > 0; i--) {
                            yield { type: 'status', content: `Retrying Connection (${retryCount}/${MAX_RETRIES}) [${i}s]...` };
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        yield { type: 'status', content: `Retrying Connection...` };
                    } else {
                        throw new Error(`Model cannot be reached. (Failed ${MAX_RETRIES} times)\nError Log can be found in ${path.join(LOGS_DIR, 'agent', 'error.log')}`);
                    }
                }
            }
        }

        if (lastUsage) {
            await addToUsage('tokens', lastUsage.totalTokenCount || 0);
            yield { type: 'usage', content: lastUsage };
        }

        fullAgentResponseChunks.push(turnText);

        // [SAFETY] Surgical extraction of top-level thinking blocks only.
        // We avoid global stripping to protect documentation or code that might mention <think> tags.
        let textToProcess = turnText;
        const thinkMatch = turnText.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
            // Only strip if it's at the very beginning or followed by significant output
            textToProcess = turnText.replace(/<think>[\s\S]*?<\/think>/i, '');
        }

        const signalSafeText = getSanitizedText(turnText);
        const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(signalSafeText.toLowerCase());
        const shouldContinue = toolCallPointer > 0;

        yield { type: 'status', content: 'Working...' };

        const cleanedTurnText = contextSafeReplace(turnText, /\[\s*(turn\s*:)?\s*(continue|finish)\s*\]/gi, '')
            .trim();

        // [STRICT PROTOCOL ENFORCEMENT]
        // The loop now breaks ONLY if the model explicitly emits the [turn: finish] signal.
        // This ensures the agent never "gives up" or stops prematurely if the model forgets
        // to signal the end of its work or is interrupted.
        let isActuallyFinished = hasFinish && !shouldContinue;


        if (isActuallyFinished) {
            const fullAgentTextRaw = fullAgentResponseChunks.join('\n');
            const cleanedFullResponse = fullAgentTextRaw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

            yield {
                type: 'interactive_turn_finished',
                data: {
                    agentText,
                    fullAgentTextRaw,
                    history: [...modifiedHistory],
                    needTitle
                }
            };

            const timestamp = `Responded on ${new Date().toLocaleString()}`;
            const finalWithTime = `${cleanedFullResponse}\n\n${timestamp}`;

            // Replace the last (potentially messy) agent message with the final response
            if (modifiedHistory.length > 0 && modifiedHistory[modifiedHistory.length - 1].role === 'agent') {
                modifiedHistory[modifiedHistory.length - 1].text = finalWithTime;
            } else {
                modifiedHistory.push({ role: 'agent', text: finalWithTime });
            }
        }

        if (isActuallyFinished) break;

        // SDK PROTECTION: Ensure agent response is never empty before next turn
        const nextAgentMsg = cleanedTurnText.trim() || '*Working...*';
        modifiedHistory.push({ role: 'agent', text: nextAgentMsg });

        // If the model hasn't finished, we must provide a user turn to keep the loop going.
        // If there are no tool results, we send a 'continue' signal to prompt the model.
        if (toolResults.length > 0 || anyToolExecutedInThisTurn) {
            toolResults.forEach(tr => modifiedHistory.push(tr));
        } else {
            if (wasToolCalledInLastLoop) {
                modifiedHistory.push({ role: 'user', text: `[SYSTEM] System executed the tool with no explicit result, continue with your task or use  [turn: finish] if completed.` });
            } else {
                modifiedHistory.push({ role: 'user', text: `[SYSTEM] ${isStutteringLoop && !isThinkingLoop ? `STUTTERING DETECTED by Internal System. Re-calibrate your response & proceed.` : `${isThinkingLoop ? ' OVER-THINKING' : ' LOOP'} DETECTED by Internal System${isThinkingLoop ? ' for current EFFORT_LEVEL' : ''}. ${isThinkingLoop ? 'If you have planned the task, prioritize the execution/output. ' : 'If you have finished your task use [turn: finish] else continue.'}`}` });
            }
            isThinkingLoop = false;
            isStutteringLoop = false;
            isGeneralLoop = false;
        }
        wasToolCalledInLastLoop = toolCallPointer > 0 || anyToolExecutedInThisTurn;
    }
    } finally {
        await RevertManager.commitTransaction();
    }
    yield { type: 'status', content: null };
};
