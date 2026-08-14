import fs from 'fs-extra';
import path from 'path';
import { LOGS_DIR } from './paths.js';

/**
 * Parses raw agent text into blocks of tool calls and text output
 */
export const parseAgentText = (text) => {
    if (!text) return [];
    const blocks = [];
    const toolRegex = /\[tool:(.*?)\((.*?)\)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const content = text.slice(lastIndex, match.index);
            if (content.trim()) {
                blocks.push({ type: 'output', content });
            }
        }
        blocks.push({
            type: 'tool',
            toolName: match[1],
            args: match[2]
        });
        lastIndex = toolRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        const content = text.slice(lastIndex);
        if (content.trim()) {
            blocks.push({ type: 'output', content });
        }
    }

    return blocks;
};

/**
 * Export current chat messages into a clean formatted text file
 */
export const exportCurrentChat = async (chatId, messages, targetDir = process.cwd()) => {
    const exportFile = `export-fluxflow-${chatId}.txt`;
    const exportPath = path.join(targetDir, exportFile);

    const exportLines = [];
    let insideAgentBlock = false;

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg) continue;

        if (msg.role === 'system' || msg.isMeta || msg.isLogo || String(msg.id).startsWith('welcome')) {
            continue;
        }

        if (msg.role === 'user') {
            let cleanUserText = msg.text || '';
            cleanUserText = cleanUserText.replace(/\s*\[Prompted on:.*?\]/g, '').trim();

            if (exportLines.length > 0) {
                exportLines.push('');
            }
            exportLines.push('[USER]');
            exportLines.push(cleanUserText);
            insideAgentBlock = false;
        } else if (msg.role === 'think') {
            if (!insideAgentBlock) {
                exportLines.push('');
                exportLines.push('[AGENT]');
                insideAgentBlock = true;
            }
            const cleanThinkText = (msg.text || '')
                .replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '')
                .replace(/\[\[END\]\]/gi, '')
                .replace(/\[\[TOOL RESULTS\]\]/gi, '')
                .replace(/\[TOOL RESULTS\]/gi, '')
                .replace(/\[TOOL RESULT\]/gi, '')
                .trim();
            if (cleanThinkText) {
                exportLines.push('[thoughts]');
                exportLines.push(cleanThinkText);
            }
        } else if (msg.role === 'agent') {
            if (!insideAgentBlock) {
                exportLines.push('');
                exportLines.push('[AGENT]');
                insideAgentBlock = true;
            }

            const blocks = parseAgentText(msg.text || '');
            for (const block of blocks) {
                if (block.type === 'output') {
                    const cleanContent = block.content
                        .replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '')
                        .replace(/\[\[END\]\]/gi, '')
                        .replace(/\[\[TOOL RESULTS\]\]/gi, '')
                        .replace(/\[TOOL RESULTS\]/gi, '')
                        .replace(/\[TOOL RESULT\]/gi, '')
                        .trim();
                    if (cleanContent) {
                        exportLines.push('[output]');
                        exportLines.push(cleanContent);
                    }
                } else if (block.type === 'tool') {
                    exportLines.push('[tool]');
                    exportLines.push(`${block.toolName} ${block.args}`);
                }
            }
        }
    }

    const fileContent = exportLines.join('\n');
    await fs.writeFile(exportPath, fileContent, 'utf8');
    return { exportFile, exportPath, totalLines: exportLines.length };
};

/**
 * Parses raw log file content into structured entry objects with source attribution
 */
export const parseLogEntries = (content, defaultSource = 'FluxFlow', fileMtime = null) => {
    if (!content || !content.trim()) return [];

    const lines = content.split('\n');
    const rawBlocks = [];
    let currentLines = [];

    const headerRegex = /^\s*(?:CRITICAL\s+ERROR|ERROR|DEBUG|SEARCH|PUPPETEER|WARN|WARNING|INFO)\b/i;
    const separatorRegex = /^\s*-{3,}\s*$/;

    let hasExplicitHeaders = false;
    for (const line of lines) {
        if (headerRegex.test(line)) {
            hasExplicitHeaders = true;
            break;
        }
    }

    if (!hasExplicitHeaders) {
        const cleanMsg = content.trim();
        if (!cleanMsg) return [];
        const dateStr = fileMtime ? new Date(fileMtime).toLocaleString() : 'Unknown Time';
        const source = /\bjanitor\b/i.test(cleanMsg) ? 'Memory' : defaultSource;
        return [{
            timestamp: dateStr,
            level: 'ERROR',
            source,
            message: cleanMsg
        }];
    }

    for (const line of lines) {
        if (separatorRegex.test(line)) {
            if (currentLines.length > 0) {
                rawBlocks.push(currentLines.join('\n').trim());
                currentLines = [];
            }
        } else if (headerRegex.test(line)) {
            if (currentLines.length > 0) {
                rawBlocks.push(currentLines.join('\n').trim());
                currentLines = [];
            }
            currentLines.push(line);
        } else {
            if (currentLines.length > 0 || line.trim()) {
                currentLines.push(line);
            }
        }
    }
    if (currentLines.length > 0) {
        rawBlocks.push(currentLines.join('\n').trim());
    }

    const structuredEntries = [];

    for (const block of rawBlocks) {
        if (!block) continue;
        const blockLines = block.split('\n').map(l => l.trimEnd());
        const firstLine = blockLines[0] || '';

        const isError = /\bERROR\b/i.test(block);
        if (!isError) continue;

        const timeMatch = firstLine.match(/\[(.*?)\]/);
        const timestamp = timeMatch ? timeMatch[1] : null;

        let level = 'ERROR';
        if (/CRITICAL\s+ERROR/i.test(firstLine)) {
            level = 'CRITICAL ERROR';
        }

        let messageText = '';
        if (timeMatch) {
            const headerEnd = firstLine.indexOf(']:');
            if (headerEnd !== -1) {
                messageText = firstLine.substring(headerEnd + 2).trim();
            } else {
                messageText = firstLine.replace(headerRegex, '').replace(/\[.*?\]/, '').replace(/^:\s*/, '').trim();
            }
        } else {
            messageText = firstLine.replace(headerRegex, '').replace(/^:\s*/, '').trim();
        }

        if (blockLines.length > 1) {
            const rest = blockLines.slice(1).join('\n').trim();
            if (rest) {
                messageText = messageText ? `${messageText}\n${rest}` : rest;
            }
        }

        if (messageText) {
            const entrySource = /\bjanitor\b/i.test(block) ? 'Memory' : defaultSource;
            structuredEntries.push({
                timestamp: timestamp || (fileMtime ? new Date(fileMtime).toLocaleString() : 'Unknown Time'),
                level,
                source: entrySource,
                message: messageText
            });
        }
    }

    return structuredEntries;
};

/**
 * Export error logs from LOGS_DIR into a formatted log text file categorizing FluxFlow & Memory errors
 */
export const exportErrorLogs = async (targetDir = process.cwd()) => {
    const exportFile = `fluxflow-error-${Date.now()}.txt`;
    const exportPath = path.join(targetDir, exportFile);

    const collectLogFiles = async (dir) => {
        if (!await fs.pathExists(dir)) return [];
        const items = await fs.readdir(dir);
        let files = [];
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                const subFiles = await collectLogFiles(fullPath);
                files = files.concat(subFiles);
            } else if (item.endsWith('.log') || item.endsWith('.txt')) {
                files.push({ path: fullPath, mtime: stat.mtimeMs });
            }
        }
        return files;
    };

    const logFiles = await collectLogFiles(LOGS_DIR);
    let allEntries = [];

    for (const fileObj of logFiles) {
        try {
            const content = await fs.readFile(fileObj.path, 'utf8');
            if (content.trim()) {
                const normPath = fileObj.path.replace(/\\/g, '/').toLowerCase();
                let defaultSource = 'FluxFlow';
                if (normPath.includes('/janitor') || normPath.includes('janitor')) {
                    defaultSource = 'Memory';
                } else if (!normPath.includes('/agent') && !normPath.includes('agent')) {
                    defaultSource = 'Other';
                }

                const parsed = parseLogEntries(content, defaultSource, fileObj.mtime);
                allEntries = allEntries.concat(parsed);
            }
        } catch (e) {}
    }

    // Deduplicate identical error messages with same timestamp and source
    const uniqueEntries = [];
    const seenKeys = new Set();
    for (const entry of allEntries) {
        const key = `${entry.source}::${entry.timestamp}::${entry.message.trim()}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueEntries.push(entry);
        }
    }

    const fluxflowEntries = uniqueEntries.filter(e => e.source === 'FluxFlow');
    const memoryEntries = uniqueEntries.filter(e => e.source === 'Memory');
    const otherEntries = uniqueEntries.filter(e => e.source !== 'FluxFlow' && e.source !== 'Memory');

    const renderSection = (title, entries, categoryName) => {
        const sectionHeader = [
            '================================================================================',
            `${title} (${entries.length})`,
            '================================================================================'
        ].join('\n');

        if (entries.length === 0) {
            return `${sectionHeader}\nNo ${categoryName} error entries found.`;
        }

        const blocks = entries.map((entry, idx) => {
            const header = `[${categoryName} #${idx + 1}] ${entry.timestamp} (${entry.level})`;
            const indentedMsg = entry.message.split('\n').map(line => `    ${line}`).join('\n');
            return `${header}\n${indentedMsg}`;
        });

        return `${sectionHeader}\n\n` + blocks.join('\n\n--------------------------------------------------------------------------------\n\n');
    };

    const exportHeader = [
        '================================================================================',
        'FLUXFLOW ERROR LOGS EXPORT',
        `Exported At : ${new Date().toLocaleString()}`,
        `Total Errors: ${uniqueEntries.length} (FluxFlow: ${fluxflowEntries.length} | Memory: ${memoryEntries.length}${otherEntries.length > 0 ? ` | Other: ${otherEntries.length}` : ''})`,
        '================================================================================',
        ''
    ].join('\n');

    const sections = [
        renderSection('SECTION 1: FLUXFLOW ERRORS', fluxflowEntries, 'FluxFlow'),
        renderSection('SECTION 2: MEMORY ERRORS', memoryEntries, 'Memory')
    ];

    if (otherEntries.length > 0) {
        sections.push(renderSection('SECTION 3: OTHER SYSTEM ERRORS', otherEntries, 'Other'));
    }

    const fileContent = exportHeader + sections.join('\n\n\n') + '\n';

    await fs.writeFile(exportPath, fileContent, 'utf8');
    return {
        exportFile,
        exportPath,
        entryCount: uniqueEntries.length,
        fluxflowCount: fluxflowEntries.length,
        memoryCount: memoryEntries.length
    };
};

/**
 * Central handler for slash export command:
 * /export
 * /export chat [current]
 * /export logs [error]
 */
export const handleExport = async (parts, { chatId, messages }) => {
    const subCategory = (parts[1] || 'chat').toLowerCase();

    if (subCategory === 'chat') {
        const result = await exportCurrentChat(chatId, messages);
        return {
            success: true,
            type: 'chat',
            message: `✦ Chat Exported\n⠀⠀└─ ${result.exportFile}\n⠀`
        };
    } else if (subCategory === 'logs') {
        const result = await exportErrorLogs();
        return {
            success: true,
            type: 'logs',
            message: `✦ Error Logs Exported\n⠀⠀└─ ${result.exportFile}\n⠀`
        };
    } else {
        return {
            success: false,
            message: `[EXPORT USAGE] Unknown subcommand "${subCategory}". Options:\n • /export chat current\n • /export logs error`
        };
    }
};
