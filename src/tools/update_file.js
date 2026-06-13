import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { RevertManager } from '../utils/revert.js';
import { applyPatches, generateHighFidelityDiff, parsePatchPairs } from '../utils/text.js';

/**
 * Update File Tool (Smart Patching)
 * Replaces a specific block of text with new content.
 */
export const update_file = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const targetPath = parsed.path;

    if (!targetPath) return 'ERROR: Missing "path" argument for update_file.';

    // Extract replacement pairs using shared utility
    const { patchPairs, error: parseError } = parsePatchPairs(parsed);
    if (parseError) return `ERROR: ${parseError}`;

    if (patchPairs.length === 0) {
        return 'ERROR: No valid replacement pairs found. Use replaceContent1, newContent1, etc.';
    }

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: File [${targetPath}] does not exist. Use write_file instead.`;
        }

        let diskContent = context.forcedContent || fs.readFileSync(absolutePath, 'utf8');
        if (diskContent.startsWith('\uFEFF')) diskContent = diskContent.slice(1);
        const originalContent = diskContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // --- ATOMIC EXECUTION ---
        const { content: finalContent, results } = applyPatches(originalContent, patchPairs);

        // Check for failures
        const failures = results.filter(r => !r.success);
        const successes = results.filter(r => r.success);

        if (successes.length === 0) {
            return `ERROR: Patch Failed to apply to [${targetPath}].\n${failures.map(f => `  • ${f.error}`).join('\n')}`;
        }

        // Record for Reversion and Write
        await RevertManager.recordFileChange(absolutePath, originalContent);
        fs.writeFileSync(absolutePath, finalContent, 'utf8');

        // --- REPORTING ---
        const diffText = generateHighFidelityDiff(originalContent, finalContent, results, 12);
        if (failures.length > 0) {
            return `SUCCESS: File [${targetPath}] updated with some blocks failed. [${successes.length}/${patchPairs.length}] blocks applied.\n\nFailures:\n${failures.map(f => `  • ${f.error}`).join('\n')}\n\n${diffText}`;
        }
        return `SUCCESS: File [${targetPath}] updated. [${results.length}/${patchPairs.length}] blocks applied.\n\n${diffText}`;

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to update file [${targetPath}]: ${errorMsg}`;
    }
};
