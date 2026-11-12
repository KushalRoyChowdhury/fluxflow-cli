import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseArgs } from '../utils/arg_parser.js';
import { RevertManager } from '../utils/revert.js';
import { loadSettings } from '../utils/settings.js';
import { DATA_DIR, resolvePathWithTilde } from '../utils/paths.js';
import { recordCodeChange } from '../utils/usage.js';

/**
 * Write File Tool
 * Creates or overwrites a file with the provided content.
 */
export const write_file = async (args, context = {}) => {
    let { path: targetPath, content } = parseArgs(args, ['path', 'content']);

    if (!targetPath) return 'ERROR: Missing "path" argument for WriteFile.';
    if (content === undefined) return 'ERROR: Missing "content" argument for WriteFile.';

    const { resolvedPath, isTildeResolved } = resolvePathWithTilde(targetPath);
    targetPath = resolvedPath;

    // Strip markdown code blocks if the LLM accidentally included them and normalize to LF
    content = content.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // fs.writeFileSync("got_in_write.txt", content);

    const absolutePath = path.resolve(process.cwd(), targetPath);
    const parentDir = path.dirname(absolutePath);

    try {
        // Record file change for Reversion Time Travel
        await RevertManager.recordFileChange(absolutePath);

        // --- ANCESTRY CAPTURE (For v1.1.x Reliability & Reversal) ---
        const { systemSettings } = await loadSettings();
        const overwriteProtectionOn = systemSettings?.overwriteProtection !== false;

        let ancestry = '';
        let oldLineCount = 0;
        if (fs.existsSync(absolutePath)) {
            try {
                const oldData = fs.readFileSync(absolutePath, 'utf8');
                const lines = oldData.split(/\r?\n/);
                oldLineCount = lines.length;

                if (!overwriteProtectionOn) {
                    ancestry = '';
                } else if (lines.length <= 50) {
                    ancestry = `Old File contents:\n${lines.map((l, i) => `${i + 1} | ${l}`).join('\n')}\n\n`;
                } else {
                    const parsedPath = path.parse(absolutePath);
                    const bakDir = path.join(DATA_DIR, 'OverwriteBackups');
                    if (!fs.existsSync(bakDir)) {
                        fs.mkdirSync(bakDir, { recursive: true });
                    }
                    const timeSuffix = String(Date.now()).slice(-5);
                    const randomHash = crypto.randomBytes(2).toString('hex');
                    const bakName = `${parsedPath.name}-old-${timeSuffix}-${randomHash}${parsedPath.ext}.bak`;
                    const bakPath = path.join(bakDir, bakName);
                    fs.copyFileSync(absolutePath, bakPath);
                    ancestry = `Old File contents:\n- Renamed old file as ${bakPath.replaceAll('\\', '/').replace(os.homedir().replaceAll('\\', '/'), '~')} and written requested content in ${targetPath}. For reversal use Run\n\n`;
                }
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
        if (verifiedLineCount <= 690) {
            snippet = verifiedLines.join('\n');
        } else {
            const head = verifiedLines.slice(0, 300).join('\n');
            const tail = verifiedLines.slice(-300).join('\n');
            snippet = `${head}\n\n... [${verifiedLineCount - 100} lines truncated] ...\n\n${tail}`;
        }

        verifiedContent = null; // Neural Flush: Signal GC that we are done with the massive string

        // Record structured line changes directly from tool execution
        await recordCodeChange({ added: verifiedLineCount, removed: oldLineCount, file: targetPath });

        let resultString = `File [${targetPath}] saved.\n- Stats: [${verifiedLineCount} lines, ${(verifiedSize / 1024).toFixed(1)} KB]\n${ancestry}- Content Preview:\n\n${snippet}`;

        if (systemSettings?.compressToolResults && verifiedLineCount > 6000) {
            const contentLines = finalContent.split(/\r?\n/);
            const headMatches = contentLines.slice(0, 25).join('\n') === verifiedLines.slice(0, 25).join('\n');
            const tailMatches = contentLines.slice(-25).join('\n') === verifiedLines.slice(-25).join('\n');
            if (headMatches && tailMatches) {
                resultString = `[[SAME]]\n${resultString}`;
            }
        }

        if (isTildeResolved) {
            resultString += `\n\n[Note: '~' resolved to user home directory. To target literal '~' in current directory, escape it as '\\~']`;
        }

        return resultString;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to write file [${targetPath}]: ${errorMsg}`;
    }
};
