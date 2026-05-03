import { GoogleGenAI, ThinkingLevel } from '@google/genai';
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

const detectToolCalls = (text) => {
    const results = [];
    const toolRegex = /(?:\[?\s*tool:functions\.)([a-z0-9_]+)\s*\(/gi;

    let match;
    while ((match = toolRegex.exec(text)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1; // Index of '('

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
                    endIdx = i;
                    break;
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
            const finalArgs = text.substring(startIdx + 1, endIdx);
            const finalFullMatch = text.substring(match.index, endIdx + 1);
            results.push({
                fullMatch: finalFullMatch,
                toolName: toolName.trim(),
                args: finalArgs.trim()
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
        modifiedHistory = getTruncatedHistory(modifiedHistory, 4);
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
    const janitorUserMemories = persistentStorage.map(m => `- [${m.id}]: ${m.memory}`).join('\n');

    // [CONTEXT-AWARE THROTTLE]
    const isContext50 = (sessionStats.tokens || 0) >= 54000;

    const systemInstruction = getSystemInstruction(profile, thinkingLevel, mode, systemSettings, otherMemories, mainUserMemories, isMemoryEnabled, isContext50);

    const firstUserMsg = `${systemInstruction}\n\nUSER_PROMPT: ${agentText}`.trim();
    modifiedHistory.push({ role: 'user', text: firstUserMsg });

    let lastUsage = null;
    const MAX_LOOPS = mode === 'Flux' ? 50 : 7;
    const MAX_RETRIES = 7;
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

    for (let loop = 0; loop < MAX_LOOPS; loop++) {
        if (loop > 0) {
            yield { type: 'status', content: 'Processed. Reconnecting...' };
        }
        if (TERMINATION_SIGNAL) {
            yield { type: 'status', content: 'Termination Signal Received.' };
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
                    modifiedHistory.push({ role: 'user', text: `[STEERING HINT]: ${hint}` });
                }
                yield { type: 'status', content: 'Steering Hint Injected.' };
            }
        }

        yield { type: 'turn_reset', content: true };
        // Convert current history to GenAI format
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

        let stream;
        let success = false;
        let retryCount = 0;

        while (retryCount <= MAX_RETRIES && !success) {
            try {
                // Quota Check
                if (!(await checkQuota('agent', settings))) {
                    throw new Error("Error: Daily Quota Exausted for Agent");
                }

                // [HIGH RELIABILITY FALLBACK SPECTRUM]
                let targetModel = modelName;
                if (retryCount === 5) {
                    targetModel = 'gemini-3-flash-preview';
                    yield { type: 'model_update', content: 'Trying with fallback model (v3)' };
                } else if (retryCount >= 6) {
                    targetModel = 'gemini-3.1-flash-lite-preview';
                    yield { type: 'model_update', content: 'Trying with fallback model (v3.1)' };
                } else if (retryCount > 0) {
                    yield { type: 'model_update', content: null };
                }

                // fs.writeFileSync('contents.json', JSON.stringify(contents));
                stream = await client.models.generateContentStream({
                    model: targetModel || "gemma-4-31b-it",
                    contents,
                    config: {
                        thinkingConfig: {
                            includeThoughts: false,
                            thinkingLevel: ThinkingLevel.MINIMAL
                        },
                    },
                });
                success = true;
                // Success - Reset model name display for final chunks
                yield { type: 'model_update', content: null };
                yield { type: 'status', content: 'Working...' };
            } catch (err) {
                const errMsg = err.status || (err.error && err.error.message) || String(err);
                // Log error in /logs/agent/error.log
                const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const agentErrDir = path.join(LOGS_DIR, 'agent');
                if (!fs.existsSync(agentErrDir)) fs.mkdirSync(agentErrDir, { recursive: true });
                fs.appendFileSync(path.join(agentErrDir, 'error.log'), `ERROR [${date}]: ${errMsg}\n`);

                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    const waitTime = Math.floor(Math.random() * (2000 - 800 + 1)) + 800;
                    yield { type: 'status', content: `Retrying (${retryCount}/${MAX_RETRIES + 1})...` };
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    throw new Error(`Model cannot be reached: ${errMsg}. (Failed ${MAX_RETRIES + 1} times)`);
                }
            }
        }

        let turnText = '';
        let lastToolSniffed = null;
        let lastToolEventTime = null;
        let toolResults = [];
        let toolCallPointer = 0;

        for await (const chunk of stream) {
            if (TERMINATION_SIGNAL) break;
            if (chunk.text) {
                turnText += chunk.text;
                yield { type: 'text', content: chunk.text };

                // [LIVE TOOL SNIFFING] - Zero latency feedback & Telemetry start
                if (turnText.includes('tool:functions.')) {
                    if (!lastToolEventTime) lastToolEventTime = Date.now();

                    const parts = turnText.split('tool:functions.');
                    const potentialTool = parts[parts.length - 1].split('(')[0].trim();
                    // Regex validation to ensure it's a valid-looking tool name and not stray text
                    if (potentialTool && /^[a-z_]+$/.test(potentialTool) && potentialTool !== lastToolSniffed) {
                        lastToolSniffed = potentialTool;
                        yield { type: 'status', content: `Working (${potentialTool})...` };
                    }
                }

                // [LOOP DETECTION] - Catch runaway repetitive reasoning (Only inside <think> blocks)
                const thinkBlocks = turnText.match(/<think>([\s\S]*?)(?:<\/think>|$)/gi) || [];
                const thinkContent = thinkBlocks.join('');
                const headingsCount = (thinkContent.match(/\*\*.*?\*\*/g) || []).length;
                if (headingsCount > 20) {
                    yield { type: 'status', content: 'Loop Detected. Restarting internal loop.' };
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    break; // Force close this turn's stream and proceed to next loop
                }

                // [REAL-TIME TOOL EXECUTION]
                const allToolsFound = detectToolCalls(turnText);
                while (allToolsFound.length > toolCallPointer) {
                    const toolCall = allToolsFound[toolCallPointer];
                    
                    // Status Update
                    yield { type: 'status', content: `Working (${toolCall.toolName})...` };

                    // START VISUAL FEEDBACK FOR TOOLS
                    let label = '';
                    if (toolCall.toolName === 'web_search') {
                        const { query, limit = 10 } = parseArgs(toolCall.args);
                        label = `🔍 SEARCHING: "${query}" (${limit})`.toUpperCase();
                    } else if (toolCall.toolName === 'web_scrape') {
                        const url = parseArgs(toolCall.args).url || '...';
                        label = `📖 READING SITE: ${url}`.toUpperCase();
                    } else if (toolCall.toolName === 'view_file') {
                        const { path: targetPath, start_line = 1, end_line = 500 } = parseArgs(toolCall.args);
                        let totalLines = '...';
                        let actualEndLine = end_line;
                        try {
                            const absPath = path.resolve(process.cwd(), targetPath);
                            if (fs.existsSync(absPath)) {
                                const content = fs.readFileSync(absPath, 'utf8');
                                const lines = content.split('\n').length;
                                totalLines = lines;
                                actualEndLine = Math.min(end_line, lines);
                            }
                        } catch (e) {}
                        const pathLower = targetPath.toLowerCase();
                        const isPdf = pathLower.endsWith('.pdf');
                        const isImage = /\.(png|jpg|jpeg|webp|gif|bmp)$/.test(pathLower);
                        if (isPdf) {
                            label = `📄 ANALYZING PDF: ${targetPath}`.toUpperCase();
                        } else if (isImage) {
                            label = `📸 ANALYZING IMAGE: ${targetPath}`.toUpperCase();
                        } else {
                            label = `📄 READING FILE: ${targetPath}. LINES ${start_line} - ${actualEndLine} FROM ${totalLines}`.toUpperCase();
                        }
                    } else if (toolCall.toolName === 'list_files' || toolCall.toolName === 'read_folder') {
                        const action = toolCall.toolName === 'list_files' ? 'LISTING' : 'DISCOVERING';
                        label = `📂 ${action} DIRECTORY: ${parseArgs(toolCall.args).path || '.'}`.toUpperCase();
                    } else if (toolCall.toolName === 'write_file' || toolCall.toolName === 'update_file') {
                        const action = toolCall.toolName === 'write_file' ? 'WRITING' : 'PATCHING';
                        label = `💾 ${action} FILE: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                    } else if (toolCall.toolName === 'write_pdf') {
                        label = `📑 GENERATING PDF: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                    } else if (toolCall.toolName === 'write_docx') {
                        label = `📝 GENERATING DOCX: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                    } else if (toolCall.toolName === 'write_pptx') {
                        label = `📊 GENERATING PPTX: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                    } else if (toolCall.toolName === 'exec_command' || toolCall.toolName === 'ask') {
                        label = ''; 
                    } else {
                        label = `EXECUTING ${toolCall.toolName}`.toUpperCase();
                    }

                    if (label) {
                        const boxWidth = Math.min(label.length + 4, 115);
                        const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                        const boxMid = `│ ${label.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                        const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                        yield { type: 'visual_feedback', content: `\n\n${boxTop}\n${boxMid}\n${boxBottom}\n` };
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
                            toolResults.push({ role: 'user', text: `[TOOL_RESULT]: ERROR: ${denyMsg}` });
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
                                toolResults.push({ role: 'user', text: `[TOOL_RESULT]: ERROR: ${denyMsg}` });
                                yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
                                toolCallPointer++;
                                continue;
                            }
                        }
                    }

                    const effectiveStart = lastToolEventTime || Date.now();
                    let result = await dispatchTool(toolCall.toolName, toolCall.args, {
                        chatId, history, onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null, onAskUser: settings.onAskUser
                    });

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

                    const isSuccess = result && !result.startsWith('ERROR:');
                    if (isSuccess) {
                        await incrementUsage('toolSuccess');
                        if (settings.onToolResult) settings.onToolResult('success');
                    } else {
                        await incrementUsage('toolFailure');
                        if (settings.onToolResult) settings.onToolResult('failure');
                    }

                    const aiContent = `[TOOL_RESULT]: ${result.split(/\r?\n/).filter(line => !line.includes('[UI_CONTEXT]')).join('\n')}`;
                    toolResults.push({ role: 'user', text: aiContent, binaryPart });

                    let uiContent = `[TOOL_RESULT]: ${result}`;
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

        // Count the successful call
        await incrementUsage('agent');
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

        const hasFinish = /\[\s*(turn\s*:)?\s*finish\s*\]/i.test(turnText.toLowerCase());
        const shouldContinue = toolCallPointer > 0;

        yield { type: 'status', content: 'Working...' };

        const cleanedTurnText = turnText
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/\[\s*(turn\s*:)?\s*(continue|finish)\s*\]/gi, '')
            .trim();

        // [STRICT PROTOCOL ENFORCEMENT]
        // The loop now breaks ONLY if the model explicitly emits the [turn: finish] signal.
        // This ensures the agent never "gives up" or stops prematurely if the model forgets
        // to signal the end of its work or is interrupted.
        let isActuallyFinished = hasFinish && !shouldContinue;


        if (isActuallyFinished) {
            yield { type: 'status', content: 'Finalizing...' };


            const janitorContents = history.slice(-3)
                .filter(msg => msg.text && !msg.text.includes('[TOOL_RESULT]') && !msg.text.includes('OBSERVATION:'))
                .map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }]
                }));

            const fullAgentTextRaw = fullAgentResponseChunks.join('\n');
            const cleanedFullResponse = fullAgentTextRaw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            const janitorPrompt = getJanitorInstruction(
                agentText,
                cleanedFullResponse,
                janitorUserMemories,
                isMemoryEnabled,
                needTitle
            );
            janitorContents.push({ role: 'user', parts: [{ text: janitorPrompt }] });

            let finalSynthesis = '';
            // fs.writeFileSync('janitor-prompt.txt', janitorPrompt);
            try {
                // Quota Check for Background
                if (!(await checkQuota('background', settings))) {
                    console.warn("Quota Exhausted for Background Model. Skipping refinement.");
                    throw new Error("QUOTA_BLOCKED");
                }

                const janitorResult = await client.models.generateContent({
                    model: janitorModel || 'gemma-4-26b-a4b-it',
                    contents: janitorContents,
                    config: {
                        thinkingConfig: {
                            includeThoughts: false,
                            thinkingLevel: ThinkingLevel.MINIMAL
                        }
                    }
                });

                const parts = janitorResult.candidates?.[0]?.content?.parts;
                if (parts && parts[1]?.text) {
                    finalSynthesis = parts[1].text;
                    // Append /logs/janitor/debug.log. Get date in YYYY-MM-DD HH:MM:SS format. If file/folder doesn't exist create a new one
                    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                    // Create folder if it doesn't exist
                    if (!fs.existsSync(janitorLogDir)) {
                        fs.mkdirSync(janitorLogDir, { recursive: true });
                    }
                    fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `DEBUG [${date}]: ${finalSynthesis}\n`);
                }
                else if (parts && parts[0]?.text) finalSynthesis = parts[0].text;
                else if (janitorResult.response && janitorResult.response.text) finalSynthesis = janitorResult.response.text();
                else throw new Error("No synthesis generated by Janitor.");

                await incrementUsage('background');
                if (janitorResult.usageMetadata) {
                    await addToUsage('tokens', janitorResult.usageMetadata.totalTokenCount || 0);
                }
                yield { type: 'background_increment' };

                const janitorToolCalls = detectToolCalls(finalSynthesis);

                // Execute background tools only
                for (const janitorToolCall of janitorToolCalls) {
                    // EXPLICIT CONTEXT SYNC: Force chatId into the tool context and arguments for absolute persistence
                    const toolContext = { chatId: chatId, sessionId: chatId, history };
                    const result = await dispatchTool(janitorToolCall.toolName, janitorToolCall.args, toolContext);

                    // Log the tool result for high-fidelity debugging
                    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const janitorLogDir = path.join(LOGS_DIR, 'janitor');
                    fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `DEBUG [${date}]: RESULT [${janitorToolCall.toolName}]: ${result}\n`);

                    // Only signal UI if it's a permanent memory change (not temp context)
                    if (janitorToolCall.toolName === 'memory' && !janitorToolCall.args.includes("action='temp'")) {
                        yield { type: 'memory_updated' };
                    }
                }
            } catch (janitorErr) {
                // Append /logs/janitor/error.log. Get date in YYYY-MM-DD HH:MM:SS format. If file/folder doesn't exist create a new one
                const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const janitorErrDir = path.join(LOGS_DIR, 'janitor');
                // Create folder if it doesn't exist
                if (!fs.existsSync(janitorErrDir)) {
                    fs.mkdirSync(janitorErrDir, { recursive: true });
                }
                fs.appendFileSync(path.join(janitorErrDir, 'error.log'), `ERROR [${date}]: ${janitorErr.message}\n`);
                console.error("Janitor Background Tasks Failed:", janitorErr.message);
            }

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
            modifiedHistory.push({ role: 'user', text: '[SYSTEM]: LOOP DETECTED by Internal System. If you have finished your task use [turn: finish] else continue.' });
        }
    }
    yield { type: 'status', content: null };
};
