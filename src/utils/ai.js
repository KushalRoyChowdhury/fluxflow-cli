import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getSystemInstruction, getJanitorInstruction } from './prompts.js';
import { getTruncatedHistory } from './history.js';
import { checkQuota, incrementUsage } from './usage.js';
import { dispatchTool } from './tools.js';
import { readEncryptedJson } from './crypto.js';
import { parseArgs } from './arg_parser.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_ROOT = path.join(__dirname, '../../');

let client = null;
const TEMP_MEM_PATH = path.join(AGENT_ROOT, 'secret', 'memory-temp.json');
const PERSISTENT_MEM_PATH = path.join(AGENT_ROOT, 'secret', 'memories.json');

let TERMINATION_SIGNAL = false;

export const signalTermination = () => {
    TERMINATION_SIGNAL = true;
};

const detectToolCalls = (text) => {
    const results = [];
    const trigger = 'tool:functions.';
    let searchIdx = 0;

    while (true) {
        const startIdx = text.indexOf(trigger, searchIdx);
        if (startIdx === -1) break;

        // Find the opening parenthesis
        const openParenIdx = text.indexOf('(', startIdx + trigger.length);
        if (openParenIdx === -1) {
            searchIdx = startIdx + trigger.length;
            continue;
        }

        const toolName = text.substring(startIdx + trigger.length, openParenIdx).trim();

        // Balanced bracket search
        let balance = 1;
        let endIdx = -1;
        for (let i = openParenIdx + 1; i < text.length; i++) {
            if (text[i] === '(') balance++;
            if (text[i] === ')') balance--;
            if (balance === 0) {
                endIdx = i;
                break;
            }
        }

        if (endIdx === -1) {
            searchIdx = openParenIdx + 1;
            continue;
        }

        const fullMatch = text.substring(startIdx, endIdx + 1);
        const args = text.substring(openParenIdx + 1, endIdx);

        results.push({ fullMatch, toolName, args });
        searchIdx = endIdx + 1;
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
    if (systemSettings?.compression === 0.0 && (sessionStats?.tokens || 0) > 128000) {
        modifiedHistory = getTruncatedHistory(modifiedHistory, 4);
    }

    // Harvest temporary memories from different sessions only
    const tempStorage = readEncryptedJson(TEMP_MEM_PATH, {});
    const otherMemories = Object.entries(tempStorage)
        .filter(([id]) => id !== chatId)
        .flatMap(([_, mems]) => mems)
        .map(mem => `- ${mem}`)
        .join('\n');

    // Harvest persistent user memories
    const persistentStorage = readEncryptedJson(PERSISTENT_MEM_PATH, []);
    const mainUserMemories = persistentStorage.map(m => `- ${m.memory}`).join('\n');
    const janitorUserMemories = persistentStorage.map(m => `- [${m.id}]: ${m.memory}`).join('\n');

    const systemInstruction = getSystemInstruction(profile, thinkingLevel, mode, systemSettings, otherMemories, mainUserMemories, isMemoryEnabled);

    const firstUserMsg = `${systemInstruction}\n\nUSER_PROMPT: ${agentText}`.trim();
    modifiedHistory.push({ role: 'user', text: firstUserMsg });

    let lastUsage = null;
    const MAX_LOOPS = mode === 'Flux' ? 50 : 5;
    const MAX_RETRIES = 3;
    yield { type: 'status', content: 'Working...' };

    TERMINATION_SIGNAL = false; // Reset at start of new interaction

    let fullAgentResponse = '';

    for (let loop = 0; loop < MAX_LOOPS; loop++) {
        if (TERMINATION_SIGNAL) {
            yield { type: 'status', content: 'Termination Signal Received.' };
            break;
        }

        // Check for incoming Steering Hints
        if (steeringCallback) {
            const hint = await steeringCallback();
            if (hint) {
                modifiedHistory.push({ role: 'user', text: `[STEERING HINT]: ${hint}` });
                yield { type: 'status', content: 'Steering Hint Injected.' };
            }
        }

        yield { type: 'turn_reset', content: true };
        // Convert current history to GenAI format
        const contents = modifiedHistory
            .filter(msg => (msg.role === 'user' || msg.role === 'agent' || msg.role === 'system') && !String(msg.id).startsWith('welcome'))
            .map(msg => ({
                role: (msg.role === 'user' || msg.role === 'system') ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));

        let stream;
        let success = false;
        let retryCount = 0;

        while (retryCount <= MAX_RETRIES && !success) {
            try {
                // Quota Check
                if (!(await checkQuota('agent', settings))) {
                    throw new Error("Error: Daily Quota Exausted for Agent");
                }

                // fs.writeFileSync('test-content.txt', JSON.stringify(contents));
                stream = await client.models.generateContentStream({
                    model: modelName,
                    contents,
                    config: {
                        temperature: mode === "Flux" ? 0.9 : 1.3,
                        thinkingConfig: {
                            includeThoughts: false,
                            thinkingLevel: ThinkingLevel.MINIMAL
                        },
                    },
                });
                success = true;
            } catch (err) {
                const errMsg = err.message || String(err);
                // Log error in /logs/agent/error.log. Append it. Get date in YYYY-MM-DD HH:MM:SS format. If file/folder doesn't exist create a new one
                const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                // Create folder if it doesn't exist
                const agentErrDir = path.join(AGENT_ROOT, 'logs', 'agent');
                if (!fs.existsSync(agentErrDir)) {
                    fs.mkdirSync(agentErrDir, { recursive: true });
                }
                fs.appendFileSync(path.join(agentErrDir, 'error.log'), `ERROR [${date}]: ${errMsg}\n`);
                const isRetryable = errMsg.includes('429') || errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('deadline');

                if (isRetryable && retryCount < MAX_RETRIES) {
                    retryCount++;
                    yield { type: 'status', content: `Retrying (${retryCount}/${MAX_RETRIES})...` };
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                } else {
                    throw new Error(`Model cannot be reached: ${errMsg}`);
                }
            }
        }

        let turnText = '';
        for await (const chunk of stream) {
            if (TERMINATION_SIGNAL) break;
            if (chunk.text) {
                turnText += chunk.text;
                yield { type: 'text', content: chunk.text };
            }
            if (chunk.usageMetadata) {
                lastUsage = chunk.usageMetadata;
            }
        }

        // Count the successful call
        await incrementUsage('agent');
        if (lastUsage) {
            yield { type: 'usage', content: lastUsage };
        }

        fullAgentResponse += turnText + '\n';
        const turnTextLower = turnText.toLowerCase();
        const hasFinish = /\[?\s*(turn\s*:)?\s*finish\s*\]?/i.test(turnTextLower);
        const hasContinue = /\[?\s*(turn\s*:)?\s*continue\s*\]?/i.test(turnTextLower);
        const toolCalls = detectToolCalls(turnText);
        let toolResults = [];

        // Resilience: If tool calls are present, we must continue, even if the model forgot the signal.
        const shouldContinue = hasContinue || toolCalls.length > 0;

        if (toolCalls.length > 0) {
            for (const toolCall of toolCalls) {
                yield { type: 'turn_reset', content: true };
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
                    label = `📄 READING FILE: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                } else if (toolCall.toolName === 'list_files' || toolCall.toolName === 'read_folder') {
                    const action = toolCall.toolName === 'list_files' ? 'LISTING' : 'DISCOVERING';
                    label = `📂 ${action} DIRECTORY: ${parseArgs(toolCall.args).path || '.'}`.toUpperCase();
                } else if (toolCall.toolName === 'write_file' || toolCall.toolName === 'update_file') {
                    const action = toolCall.toolName === 'write_file' ? 'WRITING' : 'PATCHING';
                    label = `💾 ${action} FILE: ${parseArgs(toolCall.args).path || '...'}`.toUpperCase();
                } else if (toolCall.toolName === 'exec_command') {
                    label = ''; // handled by the high-fidelity TerminalBox component
                } else {
                    label = `EXECUTING ${toolCall.toolName}`.toUpperCase();
                }

                if (label) {
                    const boxWidth = Math.min(label.length + 4, 85);
                    const boxTop = `╭${'─'.repeat(boxWidth)}╮`;
                    const boxMid = `│ ${label.padEnd(boxWidth - 2).substring(0, boxWidth - 2)} │`;
                    const boxBottom = `╰${'─'.repeat(boxWidth)}╯`;
                    yield { type: 'text', content: `\n\n${boxTop}\n${boxMid}\n${boxBottom}\n` };
                }
                // END VISUAL FEEDBACK FOR TOOLS


                // REAL-TIME TERMINAL STREAMING SYNC
                if (toolCall.toolName === 'exec_command') {
                    const { command } = parseArgs(toolCall.args);

                    // SYSTEM DRIVE & EXTERNAL PATH SHIELD (Security Governance)
                    if (command && settings.systemSettings && settings.systemSettings.allowExternalAccess === false) {
                        const riskyPatterns = [
                            /[a-zA-Z]:[\\\/]/i, // Any drive letter path (C:\, D:/, etc)
                            /^\//,               // Root path on Unix
                            /\.\.[\\\/]/,       // Parent directory traversal
                            /\/etc\//, /\/var\//, /\/root\//, /\/bin\//, /\/usr\// // Sensitive Linux paths
                        ];
                        
                        const currentDrive = path.resolve(process.cwd()).substring(0, 3).toLowerCase(); // e.g. "d:\"
                        const isViolating = riskyPatterns.some(pattern => {
                            if (pattern.source === '[a-zA-Z]:[\\\\\\/]') {
                                // Specialized check for Windows: allow current drive, block others
                                const driveMatch = command.match(/[a-zA-Z]:[\\\/]/i);
                                return driveMatch && driveMatch[0].toLowerCase() !== currentDrive;
                            }
                            return pattern.test(command);
                        });

                        if (isViolating) {
                            const denyMsg = `Access Denied. Terminal is prohibited from accessing system drives (C://) or external directories while "External Workspace Access" is disabled.`;
                            toolResults.push(`[TOOL_RESULT]: ERROR: ${denyMsg}`);
                            yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
                            continue; // Block execution
                        }
                    }

                    if (settings.onExecStart) settings.onExecStart(command || 'Unknown');
                    yield { type: 'exec_start' }; // Force UI flush
                }

                // TOOL APPROVAL GATE (Security Governance)
                const parsedArgs = parseArgs(toolCall.args);
                const targetPath = parsedArgs.path || parsedArgs.targetPath || null;

                if (targetPath) {
                    const isExternalOff = settings.systemSettings && settings.systemSettings.allowExternalAccess === false;
                    const absoluteTarget = path.resolve(targetPath);
                    const absoluteCwd = path.resolve(process.cwd());

                    if (isExternalOff && !absoluteTarget.startsWith(absoluteCwd)) {
                        const denyMsg = `Access Denied. You are not allowed to access files outside the current workspace. To enable this, ask the user to turn on "External Workspace Access" in /settings.`;
                        toolResults.push(`[TOOL_RESULT]: ERROR: ${denyMsg}`);
                        yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
                        continue; // Block execution
                    }
                }

                if (settings.onToolApproval) {
                    let shouldPrompt = false;
                    if (toolCall.toolName === 'write_file' || toolCall.toolName === 'update_file') {
                        shouldPrompt = true;
                    } else if (toolCall.toolName === 'exec_command') {
                        shouldPrompt = true; // Handled internally by app.jsx whitelist
                    }

                    if (shouldPrompt) {
                        const approval = await settings.onToolApproval(toolCall.toolName, toolCall.args);
                        if (approval === 'deny') {
                            if (toolCall.toolName === 'exec_command' && settings.onExecEnd) settings.onExecEnd();
                            const denyMsg = `Permission Denied: User rejected the ${toolCall.toolName === 'exec_command' ? 'terminal execution' : 'file edit'}.`;
                            toolResults.push(`[TOOL_RESULT]: ERROR: ${denyMsg}`);
                            yield { type: 'tool_result', content: `[TOOL_RESULT]: ERROR: ${denyMsg}` };
                            continue; // Skip execution
                        }
                    }
                }

                const result = await dispatchTool(toolCall.toolName, toolCall.args, { 
                    chatId, 
                    history,
                    onChunk: (chunk) => settings.onExecChunk ? settings.onExecChunk(chunk) : null
                });

                if (toolCall.toolName === 'exec_command' && settings.onExecEnd) {
                    await new Promise(resolve => setTimeout(resolve, 800)); // Artificial pause for visual persistence
                    settings.onExecEnd();
                }

                // TOOL HISTORY LOGGING
                try {
                    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const isErr = result.startsWith('ERROR:');
                    const logStatus = isErr ? result.trim() : 'SUCCESS';

                    const toolHistDir = path.join(AGENT_ROOT, 'logs', 'tools');
                    if (!fs.existsSync(toolHistDir)) {
                        fs.mkdirSync(toolHistDir, { recursive: true });
                    }
                    fs.appendFileSync(path.join(toolHistDir, 'history.log'), `HISTORY [${timestamp}]: ${toolCall.toolName} [${logStatus}]\n`);
                } catch (logErr) {
                    // Fail silently to keep the agent running
                }

                const cleanResultForAI = result
                    .split(/\r?\n/)
                    .filter(line => !line.includes('[UI_CONTEXT]'))
                    .join('\n');

                toolResults.push(`[TOOL_RESULT]: ${cleanResultForAI}`);

                // Yield result for UI preservation (WITH context for the user)
                yield { type: 'tool_result', content: `[TOOL_RESULT]: ${result}` };

                if (toolCall.toolName === 'memory' && result.includes('SUCCESS')) {
                    yield { type: 'memory_updated' };
                }
            }
        }

        const cleanedTurnText = turnText
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/\[?\s*(turn\s*:)?\s*(continue|finish)\s*\]?/gi, '')
            .trim();

        // Break if we have a finish signal or if there was no reason to continue
        if (hasFinish || (!shouldContinue && toolResults.length === 0)) {
            // RACE CONDITION PROTECTION: Check for late-arrival steering hints one last time
            const lateHint = await steeringCallback();
            if (lateHint) {
                // Rescue the turn!
                toolResults.push(`[USER STEERING HINT]: ${lateHint}`);
                yield { type: 'status', content: 'Steering detected... resuming!' };
                continue;
            }

            yield { type: 'status', content: 'Finalizing...' };


            const janitorContents = history.slice(-3)
                .filter(msg => msg.text && !msg.text.includes('[TOOL_RESULT]') && !msg.text.includes('OBSERVATION:'))
                .map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() }]
                }));

            const cleanedFullResponse = fullAgentResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
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
                    const janitorLogDir = path.join(AGENT_ROOT, 'logs', 'janitor');
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
                yield { type: 'background_increment' };

                const janitorToolCalls = detectToolCalls(finalSynthesis);

                // Execute background tools only
                for (const janitorToolCall of janitorToolCalls) {
                    // EXPLICIT CONTEXT SYNC: Force chatId into the tool context and arguments for absolute persistence
                    const toolContext = { chatId: chatId, sessionId: chatId, history };
                    const result = await dispatchTool(janitorToolCall.toolName, janitorToolCall.args, toolContext);
                    
                    // Log the tool result for high-fidelity debugging
                    const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const janitorLogDir = path.join(AGENT_ROOT, 'logs', 'janitor');
                    fs.appendFileSync(path.join(janitorLogDir, 'debug.log'), `DEBUG [${date}]: RESULT [${janitorToolCall.toolName}]: ${result}\n`);

                    // Only signal UI if it's a permanent memory change (not temp context)
                    if (janitorToolCall.toolName === 'memory' && !janitorToolCall.args.includes("action='temp'")) {
                        yield { type: 'memory_updated' };
                    }
                }
            } catch (janitorErr) {
                // Append /logs/janitor/error.log. Get date in YYYY-MM-DD HH:MM:SS format. If file/folder doesn't exist create a new one
                const date = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const janitorErrDir = path.join(AGENT_ROOT, 'logs', 'janitor');
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
            break;
        }

        if (!shouldContinue && toolResults.length === 0) break;

        // SDK PROTECTION: Ensure agent response is never empty before next turn
        const nextAgentMsg = cleanedTurnText.trim() || '*Working...*';
        modifiedHistory.push({ role: 'agent', text: nextAgentMsg });

        const nextUserMsg = toolResults.length > 0 ? `${toolResults.join('\n')}` : '';
        if (nextUserMsg) {
            modifiedHistory.push({ role: 'user', text: nextUserMsg });
        }
    }
    yield { type: 'status', content: null };
};
