import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';
import { gridToNativeCoordinates, parseGridCodeTo720p } from '../utils/screen_grid.js';
import screenshotDesktop from 'screenshot-desktop';
import sharp from 'sharp';

import { mouse, Point } from '@nut-tree-fork/nut-js';

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Early-capped Levenshtein distance between two strings (battle-tested from search_keyword.js).
 */
function levenshtein(a, b, cap = Infinity) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;

    let row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let nextRow = [i];
        let minInRow = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const dist = Math.min(
                nextRow[j - 1] + 1, // insertion
                row[j] + 1,        // deletion
                row[j - 1] + cost  // substitution
            );
            nextRow.push(dist);
            if (dist < minInRow) minInRow = dist;
        }
        row = nextRow;
        if (minInRow > cap) return cap + 1;
    }
    return row[b.length];
}

/**
 * Dynamic proportional threshold for allowed edit distance.
 */
function getMaxEditDistance(len) {
    if (len <= 2) return 0;
    if (len <= 5) return 1;
    if (len <= 10) return 2;
    return Math.min(3, Math.floor(len * 0.25));
}

/**
 * Click Tool for GUI Automation
 * Accepts gridId, click type, mouse button, and optional intendedClickText for OCR verification.
 */
export const click = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const gridId = parsed.gridId || parsed.grid || parsed.coordinate || parsed.target || parsed.id;
    const type = (parsed.type || parsed.clickType || 'single').toLowerCase();
    const button = (parsed.button || 'left').toLowerCase();
    const intendedClickText = parsed.intendedClickText || parsed.text || '';

    if (!gridId && !intendedClickText) {
        return 'ERROR: Missing required "gridId" parameter for Click tool.';
    }

    let finalTarget = gridId;

    // Full-Screen Nearest-Neighbor OCR Auto-Correction if intendedClickText is provided
    if (intendedClickText) {
        try {
            const { createWorker } = await import('tesseract.js');
            const targetPoint = gridId ? parseGridCodeTo720p(gridId) : null;
            const { getActiveDisplay } = await import('../utils/screen_grid.js');
            const displayIndex = await getActiveDisplay();
            let snapOpts = { format: 'png' };
            try {
                const displays = await screenshotDesktop.listDisplays();
                if (displays && displays.length > 0) {
                    const targetDisplay = displays[displayIndex] || displays[0];
                    snapOpts = { format: 'png', screen: targetDisplay.id };
                }
            } catch (e) {}

            const rawBuffer = await screenshotDesktop(snapOpts);
            const meta = await sharp(rawBuffer).metadata();
            const screenW = meta.width || 1920;
            const screenH = meta.height || 1080;

            const targetCoords = targetPoint
                ? await gridToNativeCoordinates(targetPoint, screenW, screenH)
                : { x: screenW / 2, y: screenH / 2 };

            const fs = await import('fs-extra');
            const { CU_CACHE_DIR } = await import('../utils/paths.js');
            fs.ensureDirSync(CU_CACHE_DIR);
            const worker = await createWorker('eng', 1, {
                cachePath: CU_CACHE_DIR
            });
            const { data } = await worker.recognize(rawBuffer);
            await worker.terminate();

            if (data && data.text) {
                const targetLower = intendedClickText.toLowerCase().trim();
                const matches = [];

                // Stage 1: STRICT MATCHING (Exact whole lines, exact whole words, exact token boundaries)
                // 1A. Exact line match or whole-word phrase containment
                if (data.lines && data.lines.length > 0) {
                    for (const line of data.lines) {
                        const lText = line.text ? line.text.toLowerCase().trim() : '';
                        if (lText && (lText === targetLower || new RegExp(`\\b${escapeRegex(targetLower)}\\b`, 'i').test(lText)) && line.bbox) {
                            matches.push(line.bbox);
                        }
                    }
                }

                // 1B. Exact word match
                if (matches.length === 0 && data.words && data.words.length > 0) {
                    for (const word of data.words) {
                        const wText = word.text ? word.text.toLowerCase().trim() : '';
                        if (wText === targetLower && word.bbox) {
                            matches.push(word.bbox);
                        }
                    }
                }

                // Stage 2: MILD FUZZY MATCHING (Only if Strict returned 0 matches; allows small 1-2 char OCR typos)
                if (matches.length === 0 && data.words && data.words.length > 0) {
                    const maxAllowedDiff = getMaxEditDistance(targetLower.length);
                    for (const word of data.words) {
                        const wText = word.text ? word.text.toLowerCase().trim() : '';
                        if (wText.length >= 3 && Math.abs(wText.length - targetLower.length) <= maxAllowedDiff) {
                            const dist = levenshtein(wText, targetLower, maxAllowedDiff);
                            if (dist <= maxAllowedDiff && word.bbox) {
                                matches.push(word.bbox);
                            }
                        }
                    }
                }

                if (matches.length > 0) {
                    // 3. Find nearest match using Euclidean distance to targetCoords
                    let bestMatch = null;
                    let minDistance = Infinity;

                    for (const bbox of matches) {
                        const centerX = Math.round((bbox.x0 + bbox.x1) / 2);
                        const centerY = Math.round((bbox.y0 + bbox.y1) / 2);
                        const dist = Math.hypot(centerX - targetCoords.x, centerY - targetCoords.y);

                        if (dist < minDistance) {
                            minDistance = dist;
                            bestMatch = { x: centerX, y: centerY };
                        }
                    }

                    if (bestMatch) {
                        // Convert OCR raw pixel coordinates (screenW x screenH) to 720p space for executeMouseAction
                        const target720p = {
                            x: Math.round(bestMatch.x * (1280 / screenW)),
                            y: Math.round(bestMatch.y * (720 / screenH))
                        };

                        const mouseRes = await executeMouseAction('click', target720p, {
                            button,
                            clickType: type
                        });

                        // Small delay to ensure click release registers before moving cursor
                        await new Promise(r => setTimeout(r, 60));

                        // Reset cursor to center of screen after successful click (just moves cursor, no click)
                        try {
                            await executeMouseAction('move', { x: 640, y: 360 });
                        } catch (e) {}

                        return `${mouseRes} (Full-screen OCR nearest match for "${intendedClickText}" at ${Math.round(minDistance)}px distance)`;
                    }
                }
            }
        } catch (ocrErr) {
            // Fall back to gridId if OCR fails or tesseract is unavailable
        }
    }

    // Capture cursor position before click to restore it after action completes
    let prevPosition = null;
    try {
        prevPosition = await mouse.getPosition();
    } catch (e) {}

    const clickRes = await executeMouseAction('click', finalTarget, {
        button,
        clickType: type
    });

    // Small delay to ensure click release registers before restoring cursor
    await new Promise(r => setTimeout(r, 50));

    // Restore cursor to previous position (or fallback to center if unavailable)
    try {
        if (prevPosition && typeof prevPosition.x === 'number' && typeof prevPosition.y === 'number') {
            await mouse.setPosition(new Point(prevPosition.x, prevPosition.y));
        } else {
            await executeMouseAction('move', { x: 640, y: 360 });
        }
    } catch (e) {}

    return clickRes;
};
