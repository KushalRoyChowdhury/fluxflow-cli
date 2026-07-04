import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';

export const getProgress = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;

    if (!id) {
        return 'ERROR: Missing "id" argument for getProgress.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    let output = `Subagent Task Status: ${task.status.toUpperCase()}\n`;
    output += `Title: ${task.title}\n`;
    output += `Task: ${task.task}\n\n`;
    output += `Progress Log:\n`;

    task.progress.forEach((turnLogs, index) => {
        output += `--- Turn ${index + 1} ---\n`;
        const processedLogs = turnLogs.map(log => {
            if (log.startsWith('[Subagent Response]')) {
                const header = '[Subagent Response]';
                const body = log.substring(header.length);
                let result = body;
                const trigger = 'tool:functions.';
                while (true) {
                    const lowerResult = result.toLowerCase();
                    const triggerIdx = lowerResult.indexOf(trigger);
                    if (triggerIdx === -1) break;

                    let startIdx = triggerIdx;
                    let hasOuterBracket = false;

                    let k = triggerIdx - 1;
                    while (k >= 0 && /\s/.test(result[k])) k--;
                    if (k >= 0 && result[k] === '[') {
                        startIdx = k;
                        hasOuterBracket = true;
                    }

                    let balance = 0;
                    let foundStart = false;
                    let inString = null;
                    let j = triggerIdx;
                    while (j < result.length) {
                        const char = result[j];
                        if (!inString && (char === "'" || char === '"' || char === '`')) {
                            inString = char;
                        } else if (inString && char === inString && result[j - 1] !== '\\') {
                            inString = null;
                        }
                        if (!inString) {
                            if (char === '(') {
                                balance++;
                                foundStart = true;
                            } else if (char === ')') {
                                balance--;
                            }
                        }
                        if (foundStart && balance === 0 && !inString) {
                            let endIdx = j;
                            if (hasOuterBracket) {
                                let m = j + 1;
                                while (m < result.length && /\s/.test(result[m])) m++;
                                if (m < result.length && result[m] === ']') {
                                    endIdx = m;
                                }
                            }
                            result = result.substring(0, startIdx) + result.substring(endIdx + 1);
                            break;
                        }
                        j++;
                        if (j === result.length) {
                            result = result.substring(0, startIdx);
                            break;
                        }
                    }
                }
                return header + '\n' + result.trim();
            }
            if (log.startsWith('[Executing Tool]')) {
                if (log.length > 256) {
                    return log.substring(0, 256) + '...[truncated from logs]';
                }
            }
            return log;
        });
        output += processedLogs.join('\n') + '\n\n';
    });

    if (task.status === 'completed' && task.finalAnswer) {
        output += `Final Answer:\n${task.finalAnswer}\n`;
    } else if (task.status === 'failed' && task.error) {
        output += `Failure Error: ${task.error}\n`;
    }

    // fs.writeFileSync("progress.txt", output.trim());
    return output.trim();
};
