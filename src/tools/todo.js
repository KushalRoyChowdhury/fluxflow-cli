import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { DATA_DIR } from '../utils/paths.js';
import { RevertManager } from '../utils/revert.js';

/**
 * Todo Tool
 * Manages a persistent markdown checkbox list for a specific chat.
 * Location: DATA_DIR/plan/<chat-id>/todo.md
 *
 * [tool:functions.Todo(method="create/append/get", tasks=["task 1", "task 2"], markDone=["task 1"])]
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

    // Helper to apply markDone to tasks/content
    const applyMarkDone = (content, markDone) => {
        if (!markDone) return { content, markedCount: 0 };
        const rawTargets = parseMessyArray(markDone);
        const targets = (Array.isArray(rawTargets) ? rawTargets : [rawTargets])
            .map(t => String(t).replace(/^- \[[xX ]\]\s*/i, '').trim())
            .filter(Boolean);
        const lines = content.split('\n');
        let markedCount = 0;
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

        return {
            content: fileUpdated ? lines.join('\n') : content,
            markedCount
        };
    };

    try {
        // Ensure directory exists
        if (!fs.existsSync(todoDir)) {
            fs.mkdirSync(todoDir, { recursive: true });
        }

        if (method === 'create') {
            if (!tasks) return 'ERROR: Missing "tasks" for create method.';

            let content = getTasksString(tasks);
            let markedCount = 0;
            if (markDone) {
                const result = applyMarkDone(content, markDone);
                content = result.content;
                markedCount = result.markedCount;
            }

            await RevertManager.recordFileChange(todoFile);
            fs.writeFileSync(todoFile, content, 'utf8');

            const total = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('- [ ]') || l.startsWith('- [x]') || l.startsWith('- [X]')).length;
            if (markedCount > 0) {
                const completed = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('- [x]') || l.startsWith('- [X]')).length;
                return `SUCCESS: TASK LIST CREATED (${markedCount} marked done, ${completed} completed, ${total - completed} left)\n${content}`;
            }
            return `SUCCESS: TASK LIST CREATED (${total} total)\n${content}`;
        }

        if (method === 'append') {
            if (!tasks) return 'ERROR: Missing "tasks" for append method.';

            const appendContent = getTasksString(tasks);
            await RevertManager.recordFileChange(todoFile);
            fs.appendFileSync(todoFile, appendContent, 'utf8');

            const fullContent = fs.readFileSync(todoFile, 'utf8');
            const lines = fullContent.split(/\r?\n/).map(l => l.trim());
            const total = lines.filter(l => l.startsWith('- [ ]') || l.startsWith('- [x]') || l.startsWith('- [X]')).length;
            const completed = lines.filter(l => l.startsWith('- [x]') || l.startsWith('- [X]')).length;
            const added = appendContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('- [ ]') || l.startsWith('- [x]') || l.startsWith('- [X]')).length;

            return `SUCCESS: TASK APPENDED (${completed} completed, ${total - completed} left, ${added} added)\n${fullContent}`;
        }

        if (method === 'get') {
            if (!fs.existsSync(todoFile)) {
                return 'TODO GET: No task list found for this session.';
            }

            let content = fs.readFileSync(todoFile, 'utf8');
            let markedCount = 0;

            if (markDone) {
                const result = applyMarkDone(content, markDone);
                if (result.markedCount > 0) {
                    content = result.content;
                    markedCount = result.markedCount;
                    await RevertManager.recordFileChange(todoFile);
                    fs.writeFileSync(todoFile, content, 'utf8');
                }
            }

            const totalLines = content.split(/\r?\n/).map(l => l.trim());
            const total = totalLines.filter(l => l.startsWith('- [ ]') || l.startsWith('- [x]') || l.startsWith('- [X]')).length;
            const completed = totalLines.filter(l => l.startsWith('- [x]') || l.startsWith('- [X]')).length;

            const prefix = markedCount > 0 ? `SUCCESS: ${markedCount} TASK(S) MARKED DONE` : `TODO GET`;
            return `${prefix}: ${completed} Completed, ${total - completed} left\n${content}`;
        }

        return `ERROR: Unknown method "${method}". Use create, append, or get.`;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Todo tool failure: ${errorMsg}`;
    }
};
