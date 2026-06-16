import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { DATA_DIR } from '../utils/paths.js';

/**
 * Todo Tool
 * Manages a persistent markdown checkbox list for a specific chat.
 * Location: DATA_DIR/plan/<chat-id>/todo.md
 * 
 * [[tool:functions.Todo(method="create/append/get", tasks=["task 1", "task 2"], markDone=["task 1"])]]
 */
export const todo = async (args, context = {}) => {
    const { method, tasks, markDone } = parseArgs(args);
    const chatId = context.chatId || 'default';

    if (!method) return 'ERROR: Missing "method" argument for todo tool (create/append/get).';

    const todoDir = path.join(DATA_DIR, 'plan', chatId);
    const todoFile = path.join(todoDir, 'todo.md');

    // Helper to extract items from messy stringified arrays (Hiccup Handler)
    const parseMessyArray = (input) => {
        if (!input || Array.isArray(input)) return input;
        const trimmed = String(input).trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const matches = trimmed.match(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'/g);
            if (matches) {
                return matches.map(m => m.slice(1, -1).replace(/\\(.)/g, '$1'));
            }
            // Fallback for unquoted/messy comma lists inside brackets
            return trimmed.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
        }
        return input;
    };

    // Helper to normalize tasks to string
    const getTasksString = (input) => {
        const rawItems = parseMessyArray(input);
        if (!rawItems) return '';
        
        const items = Array.isArray(rawItems) ? rawItems : String(rawItems).split('\n');
        return items
            .map(item => {
                const trimmed = String(item).trim();
                if (!trimmed) return null;
                if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) return trimmed;
                return `- [ ] ${trimmed}`;
            })
            .filter(Boolean)
            .join('\n') + '\n';
    };

    try {
        // Ensure directory exists
        if (!fs.existsSync(todoDir)) {
            fs.mkdirSync(todoDir, { recursive: true });
        }

        if (method === 'create') {
            if (!tasks) return 'ERROR: Missing "tasks" for create method.';
            
            const content = getTasksString(tasks);
            fs.writeFileSync(todoFile, content, 'utf8');

            const total = (content.match(/^- \[ [xX ]\]/gm) || []).length;
            return `SUCCESS: TASK LIST CREATED (${total} total)\n${content}`;
        }

        if (method === 'append') {
            if (!tasks) return 'ERROR: Missing "tasks" for append method.';
            
            const appendContent = getTasksString(tasks);
            fs.appendFileSync(todoFile, appendContent, 'utf8');

            // Read the whole file back to calculate stats
            const fullContent = fs.readFileSync(todoFile, 'utf8');
            const total = (fullContent.match(/^- \[ [xX ]\]/gm) || []).length;
            const completed = (fullContent.match(/^- \[x\]/gim) || []).length;
            const added = (appendContent.match(/^- \[ [xX ]\]/gm) || []).length;
            
            return `SUCCESS: TASK APPENDED (${completed} completed, ${total - completed} left, ${added} added)\n${fullContent}`;
        }

        if (method === 'get') {
            if (!fs.existsSync(todoFile)) {
                return 'TODO GET: No task list found for this session.';
            }

            let content = fs.readFileSync(todoFile, 'utf8');
            let markedCount = 0;

            if (markDone) {
                const rawTargets = parseMessyArray(markDone);
                const targets = (Array.isArray(rawTargets) ? rawTargets : [rawTargets])
                    .map(t => String(t).replace(/^- \[[xX ]\]\s*/i, '').trim())
                    .filter(Boolean);
                const lines = content.split('\n');
                let fileUpdated = false;

                for (const searchStr of targets) {
                    let updatedThisTarget = false;

                    // First pass: Case-sensitive exact match
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes(searchStr) && /^- \[\s\]/.test(lines[i].trim())) {
                            lines[i] = lines[i].replace('- [ ]', '- [x]');
                            updatedThisTarget = true;
                            fileUpdated = true;
                            markedCount++;
                            break;
                        }
                    }
                    
                    // Second pass: Case-insensitive fallback
                    if (!updatedThisTarget) {
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].toLowerCase().includes(searchStr.toLowerCase()) && /^- \[\s\]/.test(lines[i].trim())) {
                                lines[i] = lines[i].replace('- [ ]', '- [x]');
                                updatedThisTarget = true;
                                fileUpdated = true;
                                markedCount++;
                                break;
                            }
                        }
                    }
                }

                if (fileUpdated) {
                    content = lines.join('\n');
                    fs.writeFileSync(todoFile, content, 'utf8');
                }
            }

            const total = (content.match(/^- \[ [xX ]\]/gm) || []).length;
            const completed = (content.match(/^- \[x\]/gim) || []).length;
            
            const prefix = markedCount > 0 ? `SUCCESS: ${markedCount} TASK(S) MARKED DONE` : `TODO GET`;
            return `${prefix}: ${completed} Completed, ${total - completed} left\n${content}`;
        }

        return `ERROR: Unknown method "${method}". Use create, append, or get.`;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Todo tool failure: ${errorMsg}`;
    }
};
