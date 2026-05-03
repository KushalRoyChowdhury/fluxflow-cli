import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Write File Tool
 * Creates or overwrites a file with the provided content.
 */
export const write_file = async (args) => {
    let { path: targetPath, content } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_file.';
    if (content === undefined) return 'ERROR: Missing "content" argument for write_file.';

    // Strip markdown code blocks if the LLM accidentally included them and normalize to LF
    content = content.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const absolutePath = path.resolve(process.cwd(), targetPath);
    const parentDir = path.dirname(absolutePath);

    try {
        // --- ANCESTRY CAPTURE (For v1.1.x Reliability & Reversal) ---
        let ancestry = '';
        if (fs.existsSync(absolutePath)) {
            try {
                const oldData = fs.readFileSync(absolutePath, 'utf8');
                const lines = oldData.split(/\r?\n/);
                ancestry = `Old File contents:\n${lines.map((l, i) => `${i + 1} | ${l}`).join('\n')}\n\n`;
            } catch (e) {
                ancestry = `[Note: Could not read existing file for reversal reference]\n\n`;
            }
        }

        // Ensure directory exists
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // --- CONTEXT-AWARE NEURAL UNESCAPE ---
        // Programmatically unescape \n only if it's NOT within a string literal
        let processedContent = "";
        let inString = null; // Track if we are inside ", ', or `
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next2 = content.substring(i, i + 2);

            if (!inString) {
                // Not in a string: Look for string starts or unescape targets
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                    processedContent += char;
                } else if (next2 === '\\\\n') {
                    processedContent += '\\n';
                    i++; // skip next char
                } else if (next2 === '\\n') {
                    processedContent += '\n';
                    i++; // skip next char
                } else {
                    processedContent += char;
                }
            } else {
                // Inside a string: Preserve everything exactly as the AI sent it
                // Handle escaped quotes within the string (e.g. \" or \')
                if (char === inString && content[i - 1] !== '\\') {
                    inString = null;
                }
                processedContent += char;
            }
        }

        const lineCount = processedContent.split(/\r?\n/).length;
        const originalSize = Buffer.byteLength(processedContent, 'utf8');
        fs.writeFileSync(absolutePath, processedContent, 'utf8');

        // --- HIGH-FIDELITY VERIFICATION ---
        let verifiedContent = fs.readFileSync(absolutePath, 'utf8');
        const verifiedSize = Buffer.byteLength(verifiedContent, 'utf8');
        const verifiedLines = verifiedContent.split(/\r?\n/);
        const verifiedLineCount = verifiedLines.length;

        // Explicit check for silent failures
        if (verifiedSize === 0 && originalSize > 0) {
            verifiedContent = null; // Flush
            return `CRITICAL FAILURE: Verification failed. File [${targetPath}] is empty on disk despite success report!`;
        }

        // Prepare a snippet for the UI/History (Top 15 / Bottom 15)
        let snippet = '';
        if (verifiedLineCount <= 200) {
            snippet = verifiedLines.join('\n');
        } else {
            const head = verifiedLines.slice(0, 100).join('\n');
            const tail = verifiedLines.slice(-100).join('\n');
            snippet = `${head}\n\n... [${verifiedLineCount - 200} lines truncated for history stability] ...\n\n${tail}`;
        }

        verifiedContent = null; // Neural Flush: Signal GC that we are done with the massive string

        return `SUCCESS: File [${targetPath}] saved.\n\n- Stats: [${verifiedLineCount} lines, ${ (verifiedSize/1024).toFixed(1) } KB]\n${ancestry}- Content Preview:\n${snippet}\n\nCheck if Starting and Ending matches your write.`;
    } catch (err) {
        return `ERROR: Failed to write file [${targetPath}]: ${err.message}`;
    }
};
