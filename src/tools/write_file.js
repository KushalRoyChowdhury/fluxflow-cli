import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { RevertManager } from '../utils/revert.js';
import { loadSettings } from '../utils/settings.js';

/**
 * Write File Tool
 * Creates or overwrites a file with the provided content.
 */
export const write_file = async (args, context = {}) => {
    let { path: targetPath, content } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_file.';
    if (content === undefined) return 'ERROR: Missing "content" argument for write_file.';

    // Strip markdown code blocks if the LLM accidentally included them and normalize to LF
    content = content.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // fs.writeFileSync("got_in_write.txt", content);

    const absolutePath = path.resolve(process.cwd(), targetPath);
    const parentDir = path.dirname(absolutePath);

    try {
        // Record file change for Reversion Time Travel
        await RevertManager.recordFileChange(absolutePath);

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

        // Sanitization: Strip unintended markdown code blocks and normalize to LF
        const strip = (t) => t.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // --- THE FINAL HARMONY ---
        // 1. \n (2 chars) becomes a real newline (LF)
        // 2. [/n] becomes a literal \n in the file
        const processedContent = strip(content);

        // Ensure exactly one trailing newline (the "sacred \n") — add if missing, keep if present
        const finalContent = processedContent.endsWith('\n') ? processedContent : processedContent + '\n';

        const lineCount = finalContent.split(/\r?\n/).length;
        const originalSize = Buffer.byteLength(finalContent, 'utf8');
        fs.writeFileSync(absolutePath, finalContent, 'utf8');

        // --- HIGH-FIDELITY VERIFICATION ---
        let verifiedContent = fs.readFileSync(absolutePath, 'utf8');
        const verifiedSize = Buffer.byteLength(verifiedContent, 'utf8');
        const verifiedLines = verifiedContent.split(/\r?\n/);
        const verifiedLineCount = verifiedLines.length;

        // Explicit check for silent failures
        if (verifiedSize === 0 && originalSize > 0) {
            verifiedContent = null; // Flush
            return `ERROR: CRITICAL FAILURE: Verification failed. File [${targetPath}] is empty on disk!`;
        }

        // Prepare a snippet for the UI/History (Top 50 / Bottom 50)
        let snippet = '';
        if (verifiedLineCount <= 100) {
            snippet = verifiedLines.join('\n');
        } else {
            const head = verifiedLines.slice(0, 50).join('\n');
            const tail = verifiedLines.slice(-50).join('\n');
            snippet = `${head}\n\n... [${verifiedLineCount - 100} lines truncated] ...\n\n${tail}`;
        }

        verifiedContent = null; // Neural Flush: Signal GC that we are done with the massive string

        const { systemSettings } = await loadSettings();
        let resultString = `SUCCESS: File [${targetPath}] saved.\n- Stats: [${verifiedLineCount} lines, ${(verifiedSize / 1024).toFixed(1)} KB]\n${ancestry}- Content Preview:\n\n${snippet}`;

        if (systemSettings?.compressToolResults && verifiedLineCount > 60) {
            const contentLines = finalContent.split(/\r?\n/);
            const headMatches = contentLines.slice(0, 25).join('\n') === verifiedLines.slice(0, 25).join('\n');
            const tailMatches = contentLines.slice(-25).join('\n') === verifiedLines.slice(-25).join('\n');
            if (headMatches && tailMatches) {
                resultString = `[[SAME]]\n${resultString}`;
            }
        }

        return resultString;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to write file [${targetPath}]: ${errorMsg}`;
    }
};
