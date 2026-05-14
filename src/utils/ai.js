import { GoogleGenAI, ThinkingLevel, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { getSystemInstruction, getJanitorInstruction } from './prompts.js';
import { getTruncatedHistory } from './history.js';
import { checkQuota, incrementUsage, addToUsage } from './usage.js';
import { dispatchTool } from './tools.js';
import { readEncryptedJson } from './crypto.js';
import { parseArgs } from './arg_parser.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { emojiSpace } from './terminal.js';

import { LOGS_DIR, TEMP_MEM_FILE, MEMORIES_FILE } from './paths.js';

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
    'write_pptx': 'Creating Presentation',
    'write_docx': 'Creating Document',
};

const getToolDetail = (toolName, argsStr) => {
    try {
        const pArgs = parseArgs(argsStr);
        const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
        // Strip quotes and backslashes that might be part of an escaped string
        return filePath ? path.basename(filePath.replace(/[\\"]/g, '')) : null;
    } catch (e) {
        return null;
    }
};

export const runJanitorTask = async (settings, agentText, fullAgentTextRaw, history, callbacks = {}) => {
    const { onStatus, onMemoryUpdated, onBackgroundIncrement } = callbacks;
    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats } = settings;
    const isMemoryEnabled = systemSettings?.memory !== false;

    // Harvest persistent user memories (Duplicate of logic in getAIStream for background context)
    const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
    const janitorUserMemories = persistentStorage.map(m => `- [${m.id}]: ${m.memory}`).join('\n');

    const janitorContents = history.slice(-12)
        .filter(msg => msg.text && !msg.text.includes('[TOOL_RESULT]') && !msg.text.includes('OBSERVATION:'))
        .map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }]
        }));

    const cleanedFullResponse = fullAgentTextRaw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const janitorPrompt = getJanitorInstruction(
        agentText,
        cleanedFullResponse,
        janitorUserMemories,
        isMemoryEnabled,
        true
    );

    // fs.writeFileSync('janitorPrompt.txt', janitorPrompt);

    janitorContents.push({ role: 'system', parts: [{ text: janitorPrompt }] });

    let finalSynthesis = '';
    let attempts = 0;
    const MAX_JANITOR_RETRIES = 5; // Total Retries = 6

    while (attempts <= MAX_JANITOR_RETRIES) {
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
                            maxOutputTokens: 384,
                            temperature: 0.69,
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

                const date = new Date().toLocaleString();
                const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                if (!fs.existsSync(janitorLogDir)) fs.mkdirSync(janitorLogDir, { recursive: true });
                fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `\n\n---------------------------------------------------\n\n\nDEBUG [${date}]: ${finalSynthesis}\n\n`);
            } else {
                throw new Error("No synthesis generated by Janitor.");
            }

            if (onBackgroundIncrement) {
                onBackgroundIncrement();
                await incrementUsage('background');
            }

            const janitorToolCalls = detectToolCalls(finalSynthesis);
            for (const janitorToolCall of janitorToolCalls) {
                const toolContext = { chatId: chatId, sessionId: chatId, history };
                const result = await dispatchTool(janitorToolCall.toolName, janitorToolCall.args, toolContext);

                const date = new Date().toLocaleString();
                const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `DEBUG [${date}]: RESULT [${janitorToolCall.toolName}]: ${result}\n`);

                if (janitorToolCall.toolName === 'memory' && !janitorToolCall.args.includes("action='temp'")) {
                    if (onMemoryUpdated) onMemoryUpdated();
                }
            }

            break; // Success! Break retry loop.
        } catch (janitorErr) {
            attempts++;
            const date = new Date().toLocaleString();
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
 * Executes a streaming request using the new SDK
 */
export const getAIStream = async function* (modelName, history, settings, steeringCallback) {
    if (!client) throw new Error('AI not initialized');

    const { profile, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats } = settings;
    const isMemoryEnabled = systemSettings?.memory !== false;
    const originalText = history[history.length - 1].text;

    // Detection for Chat Title generation
    const isFirstPrompt = history.filter(m => m.role === 'user').length === 1;
    const hasTitleSignal = originalText.includes('[TITLE-UPDATE]');
    const needTitle = isFirstPrompt || hasTitleSignal;

    // Strip [TITLE-UPDATE] signal from the text before model processing
    const agentText = originalText.replace(/\[TITLE-UPDATE\]/g, '').trim();

    let modifiedHistory = [...history.slice(0, -1)];

    // Truncation Logic (Compression 0.0)
    if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > 254000) {
        modifiedHistory = getTruncatedHistory(modifiedHistory, 6);
    }

    // Harvest temporary memories from different sessions only
    const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
    const otherMemories = Object.entries(tempStorage)
        .filter(([id]) => id !== chatId)
        .flatMap(([_, mems]) => mems)
        .map(mem => `- ${mem}`)
        .join('\n');

    // Harvest persistent user memories
    const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
    const mainUserMemories = persistentStorage.map(m => `- ${m.memory}`).join('\n');

    const firstUserMsg = `[SYSTEM] **STRICTLY FOLLOW THINKING${mode === "Flux" ? ', NEWLINE (press ENTER for structural new lines, write [/n] for literal new lines inside STRINGS ONLY), ESCAPE STRING QUOTES IN CODE PROPERLY WITH \\"' : ""} POLICY AS HIGHEST PRIORITY. NEVER START A RESPONSE WITHOUT THINKING*.\n\nUSER_PROMPT: "${agentText}"`.trim();
    modifiedHistory.push({ role: 'user', text: firstUserMsg });

    let lastUsage = null;
    const MAX_LOOPS = mode === 'Flux' ? 70 : 7;
    const MAX_RETRIES = 16;
    yield { type: 'status', content: 'Connecting...' };

    TERMINATION_SIGNAL = false; // Reset at start of new interaction

    let fullAgentResponseChunks = [];

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
                    modifiedHistory.push({ role: 'user', text: `[SYSTEM] **STRICTLY FOLLOW THINKING${mode === "Flux" ? ', NEWLINE  (press ENTER for structural new lines, write [/n] for literal new lines inside STRINGS ONLY), ESCAPE STRING QUOTES IN CODE PROPERLY WITH \\"' : ""} POLICY AS HIGHEST PRIORITY. NEVER START A RESPONSE WITHOUT THINKING*.\n\n[STEERING HINT]: ${hint}` });
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
        let toolResults = [];
        let toolCallPointer = 0;
        let isThinkingLoop = false;
        let isStutteringLoop = false;
        let isInitialAttempt = true;
        let accumulatedContext = '';

        while (retryCount <= MAX_RETRIES && inStreamRetryCount <= MAX_RETRIES && !success && !TERMINATION_SIGNAL) {
            try {
                if (isInitialAttempt) {
                    yield { type: 'turn_reset', content: true };
                    yield { type: 'spinner', content: true };
                    isInitialAttempt = false;
                    accumulatedContext = '';
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
                    targetModel = 'gemini-3.1-flash-lite-preview';
                    yield { type: 'model_update', content: 'Trying with fallback model lite' };
                } else if (retryCount > 0) {
                    yield { type: 'model_update', content: null };
                }

                // [DYNAMIC CONTEXT ADAPTATION WITH MEMORIES]
                // We recalculate instructions every turn so the agent knows when it's hitting context limits
                const isContext32k = (sessionStats.tokens || 0) >= 32000;
                const currentSystemInstruction = getSystemInstruction(profile, thinkingLevel, mode, systemSettings, otherMemories, mainUserMemories, isMemoryEnabled, isContext32k, MAX_LOOPS, loop + 1);

                // [JIT INSTRUCTION INJECTION] - Only for tool results, kept out of persistent history
                const jitInstruction = `\n\n[SYSTEM] Tool result received. Analyze output and proceed with your turn. **STRICTLY MAINTAIN THINKING${mode === "Flux" ? ', NEWLINE  (press ENTER for structural new lines, write [/n] for literal new lines inside STRINGS ONLY), ESCAPE STRING QUOTES IN CODE PROPERLY WITH \\"' : ""} PROTOCOL. NEVER START A RESPONSE WITHOUT THINKING**.`;
                const lastUserMsg = contents[contents.length - 1];
                let addedMarker = false;
                if (lastUserMsg && lastUserMsg.role === 'user' && lastUserMsg.parts?.[0]?.text?.startsWith('[TOOL_RESULT]')) {
                    lastUserMsg.parts[0].text += jitInstruction;
                    addedMarker = true;
                }

                // fs.writeFileSync("contents.txt", currentSystemInstruction);

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

                let dedupeBuffer = '';
                let isDedupeActive = accumulatedContext.length > 0;

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
                            if (dedupeBuffer.length >= 100) {
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
                                    const dedupeClean = cleanText.replace(/^\s*<(think|thought)>[\s\S]*?<\/(think|thought)>\s*/gi, '').replace(/^\s*<(think|thought)>\s*/gi, '');
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
                            const potentialTool = toolContext.toolName;
                            const partialArgs = toolContext.args || '';

                            // [PEEK LOGIC] - Try to extract detail from partial strings (File Tools & Search)
                            let detail = null;
                            if (['write_file', 'update_file', 'view_file', 'read_folder', 'write_pdf', 'write_pptx', 'write_docx', 'search_keyword'].includes(potentialTool)) {
                                const pArgs = parseArgs(partialArgs);
                                const filePath = pArgs.path || pArgs.targetFile || pArgs.TargetFile || pArgs.directory;
                                const keyword = pArgs.keyword;

                                if (keyword) {
                                    detail = keyword.replace(/[\\"]/g, '');
                                } else if (filePath) {
                                    detail = path.basename(filePath.replace(/[\\"]/g, ''));
                                } else {
                                    // [FALLBACK] - Super-permissive regex for mid-stream escaped paths/keywords
                                    const m = partialArgs.match(/(?:path|targetFile|TargetFile|directory|keyword)\s*=\s*\\?["']?([^\\"' \),]+)/);
                                    if (m) {
                                        const val = m[1].replace(/[\\"]/g, '');
                                        detail = potentialTool === 'search_keyword' ? val : path.basename(val);
                                    }
                                }
                            }

                            // Only update if something changed (to avoid jitter)
                            const currentLabel = `${TOOL_LABELS[potentialTool] || potentialTool}${detail ? ` (${detail})` : ''}`;
                            if (potentialTool !== lastToolSniffed || detail !== lastToolDetail) {
                                lastToolSniffed = potentialTool;
                                lastToolDetail = detail;
                                yield { type: 'status', content: `${currentLabel}...` };
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
                            'max': 3500
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
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            break;
                        }

                        // 4. Stutter / Word Loop Check (Global)
                        const allWords = contextSafeText.split(/\s+/).filter(w => w.length > 0);
                        if (allWords.length > 12) {
                            let stutterDetected = false;
                            for (let i = 0; i < allWords.length - 10; i++) {
                                const sub = allWords.slice(i, i + 5).join(' ');
                                const next = allWords.slice(i + 5, i + 10).join(' ');
                                if (sub === next) {
                                    stutterDetected = true;
                                    break;
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
                        const toolActionableText = turnText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
                        const allToolsFound = detectToolCalls(toolActionableText);
                        while (allToolsFound.length > toolCallPointer) {
                            const toolCall = allToolsFound[toolCallPointer];

                            // Status Update
                            const displayLabel = TOOL_LABELS[toolCall.toolName] || toolCall.toolName;
                            const detail = getToolDetail(toolCall.toolName, toolCall.args);
                            yield { type: 'status', content: `${displayLabel}${detail ? ` (${detail})` : ''}...` };

                            // START VISUAL FEEDBACK FOR TOOLS
                            let label = '';
                            if (toolCall.toolName === 'web_search') {
                                const { query, limit = 10 } = parseArgs(toolCall.args);
                                label = `🔍 SEARCHED: "${query}" (${limit})`.toUpperCase();
                            } else if (toolCall.toolName === 'web_scrape') {
                                const url = parseArgs(toolCall.args).url || '...';
                                label = `📖 READ SITE: ${url}`.toUpperCase();
                            } else if (toolCall.toolName === 'view_file') {
                                const { path: targetPath, StartLine, EndLine, start_line, end_line } = parseArgs(toolCall.args);

                                const rawStart = StartLine || start_line;
                                const rawEnd = EndLine || end_line;

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
                            } else if (toolCall.toolName === 'list_files' || toolCall.toolName === 'read_folder') {
                                const action = toolCall.toolName === 'list_files' ? 'LIST' : 'ANALYSED';
                                label = `📂 ${action} FOLDER: ${parseArgs(toolCall.args).path || '.'}`.toUpperCase();
                            } else if (toolCall.toolName === 'write_file' || toolCall.toolName === 'update_file') {
                                const action = toolCall.toolName === 'write_file' ? 'WROTE' : 'UPDATED';
                                label = `💾 ${action} FILE: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (toolCall.toolName === 'write_pdf') {
                                label = `📑 PDF CREATED: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (toolCall.toolName === 'write_docx') {
                                label = `📝 DOCX CREATED: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (toolCall.toolName === 'write_pptx') {
                                label = `📊 PPTX CREATED: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                            } else if (toolCall.toolName === 'search_keyword') {
                                const { keyword } = parseArgs(toolCall.args);
                                label = `🔎 KEYWORD SEARCHED: "${keyword}"`.toUpperCase();
                            } else if (toolCall.toolName === 'exec_command' || toolCall.toolName === 'ask') {
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
                            if (toolCall.toolName === 'exec_command') {
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
                                        toolResults.push({ role: 'user', text: `[TOOL_RESULT]: ERROR: ${denyMsg}` });
                                        yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
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
                                    toolResults.push({ role: 'user', text: `[TOOL_RESULT]: ERROR: ${denyMsg}\n\n[SYSTEM] **MUST FOLLOW THINKING${mode === "Flux" ? ", NEWLINE, QUOTE ESCAPE" : ""} POLICY AS HIGHEST PRIORITY**.` });
                                    yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
                                    toolCallPointer++;
                                    continue;
                                }
                            }

                            if (settings.onToolApproval) {
                                let shouldPrompt = (toolCall.toolName === 'write_file' || toolCall.toolName === 'update_file' || toolCall.toolName === 'exec_command');
                                if (shouldPrompt) {
                                    const approval = await settings.onToolApproval(toolCall.toolName, toolCall.args);
                                    if (approval === 'deny') {
                                        if (toolCall.toolName === 'exec_command' && settings.onExecEnd) settings.onExecEnd();
                                        const denyMsg = `Permission Denied: User rejected the ${toolCall.toolName === 'exec_command' ? 'terminal execution' : 'file edit'}.`;
                                        toolResults.push({ role: 'user', text: `[TOOL_RESULT]: DENIED: ${denyMsg}\n\n[SYSTEM] **MUST FOLLOW THINKING${mode === "Flux" ? ", NEWLINE, QUOTE ESCAPE" : ""} POLICY AS HIGHEST PRIORITY**.` });
                                        yield { type: 'tool_result', content: `[TOOL_RESULT]: DENIED: ${denyMsg}` };
                                        await incrementUsage('toolDenied');
                                        if (settings.onToolResult) settings.onToolResult('denied');
                                        toolCallPointer++;
                                        continue;
                                    }
                                }
                            }

                            const effectiveStart = lastToolEventTime || Date.now();
                            yield { type: 'spinner', content: false };
                            let result = await dispatchTool(toolCall.toolName, toolCall.args, {
                                chatId, history, onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null, onAskUser: settings.onAskUser
                            });
                            yield { type: 'spinner', content: true };

                            const toolEnd = Date.now();
                            yield { type: 'tool_time', content: toolEnd - effectiveStart };
                            lastToolEventTime = toolEnd;

                            let binaryPart = null;
                            if (typeof result === 'object' && result.binaryPart) {
                                binaryPart = result.binaryPart;
                                result = result.text;
                            }

                            if (toolCall.toolName === 'exec_command' && settings.onExecEnd) {
                                await new Promise(resolve => setTimeout(resolve, 800));
                                settings.onExecEnd();
                            }

                            const isDenied = result && result.startsWith('DENIED:');
                            const isSuccess = result && !result.startsWith('ERROR:') && !isDenied;

                            if (isSuccess) {
                                await incrementUsage('toolSuccess');
                                if (settings.onToolResult) settings.onToolResult('success');
                            } else if (isDenied) {
                                // Already incremented above in the direct deny block, but let's be safe for other tools
                                // actually, direct deny block handles it.
                                // But if a tool itself returns DENIED:, we should handle it here.
                                // Let's check if we already handled it.
                            } else {
                                await incrementUsage('toolFailure');
                                if (settings.onToolResult) settings.onToolResult('failure');
                            }

                            const aiContent = `[TOOL_RESULT]: ${(result || '').toString().split(/\r?\n/).filter(line => !line.includes('[UI_CONTEXT]')).join('\n')}`;
                            toolResults.push({ role: 'user', text: aiContent, binaryPart });

                            let uiContent = `[TOOL_RESULT]: ${result || ''}`;
                            if (toolCall.toolName === 'view_file' || toolCall.toolName === 'web_scrape') {
                                uiContent = `[TOOL_RESULT]: ${label} (Context Locked for UI Clarity)`;
                            }

                            yield { type: 'tool_result', content: uiContent, aiContent: aiContent, binaryPart, toolName: toolCall.toolName };
                            if (toolCall.toolName === 'memory' && result.includes('SUCCESS')) yield { type: 'memory_updated' };

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
                        const dedupeClean = cleanText.replace(/^\s*<(think|thought)>[\s\S]*?<\/(think|thought)>\s*/gi, '').replace(/^\s*<(think|thought)>\s*/gi, '');
                        if (dedupeClean) {
                            turnText += dedupeClean;
                            yield { type: 'text', content: dedupeClean };
                        }
                    }
                    isDedupeActive = false;
                    dedupeBuffer = '';
                }

                if (TERMINATION_SIGNAL) break;
                success = true;
                // Count the successful call
                await incrementUsage('agent');
            } catch (err) {
                const errMsg = err.status || (err.error && err.error.message) || String(err);
                const errLog = String(err);
                // Log error in /logs/agent/error.log
                const date = new Date().toLocaleString();
                const agentErrDir = path.join(LOGS_DIR, 'agent');
                if (!fs.existsSync(agentErrDir)) fs.mkdirSync(agentErrDir, { recursive: true });
                fs.appendFileSync(path.join(agentErrDir, 'error.log'), `ERROR [${date}]: ${errLog}\n\n----------------------------------------------------------------------\n\n`);

                if (turnText.trim().length > 0) {
                    // IN-STREAM RECOVERY
                    if (inStreamRetryCount <= MAX_RETRIES) {
                        inStreamRetryCount++;
                        const waitTime = Math.min(1000 * Math.pow(2, inStreamRetryCount - 1), 24000);
                        modifiedHistory.push({ role: 'agent', text: turnText });
                        if (toolResults.length > 0) {
                            toolResults.forEach(tr => modifiedHistory.push(tr));
                        }
                        modifiedHistory.push({ role: 'user', text: "[SYSTEM] Response got cut for internal error, continue from checkpoint seamlessly after the EXACT word it cut off and DON'T repeat what you already said! PICK UP FROM THE WORD IN A WAY THAT USER SHOULD NOT NOTICE ANY CUTOFF. Rules:\n- Do not reuse <think> if the thinking already started just continue from the word and end it properly.\n- If the cutoff was in middle of a tool call, start the tool call from start as the system won't pick half tool formats.\n- Visually the new pickup and continuation should look natual sentence flow.\n- DON'T try to think shorter, keep length standard." });
                        accumulatedContext += turnText;
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
        if (toolResults.length > 0) {
            toolResults.forEach(tr => modifiedHistory.push(tr));
        } else {
            modifiedHistory.push({ role: 'user', text: `[SYSTEM] ${isStutteringLoop && !isThinkingLoop ? `STUTTERING DETECTED by Internal System. Re-calibrate your response & proceed.` : `${isThinkingLoop ? ' OVER-THINKING' : ' LOOP'} DETECTED by Internal System${isThinkingLoop ? ' for current EFFORT_LEVEL' : ''}. ${isThinkingLoop ? 'If you have planned the task, prioritize the execution/output. ' : 'If you have finished your task use [turn: finish] else continue.'}`}` });
            isThinkingLoop = false;
            isStutteringLoop = false;
        }
    }
    yield { type: 'status', content: null };
};
