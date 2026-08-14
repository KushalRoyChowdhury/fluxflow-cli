import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';
import { gridToNativeCoordinates, parseGridCodeTo720p } from '../utils/screen_grid.js';
import screenshotDesktop from 'screenshot-desktop';
import sharp from 'sharp';

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
            const rawBuffer = await screenshotDesktop({ format: 'png' });
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

                // 1. Collect all matching lines (for multi-word phrases)
                if (data.lines && data.lines.length > 0) {
                    for (const line of data.lines) {
                        if (line.text && line.text.toLowerCase().includes(targetLower) && line.bbox) {
                            matches.push(line.bbox);
                        }
                    }
                }

                // 2. Collect all matching words (for single word targets)
                if (matches.length === 0 && data.words && data.words.length > 0) {
                    for (const word of data.words) {
                        const wText = word.text ? word.text.toLowerCase() : '';
                        if (wText && (wText.includes(targetLower) || targetLower.includes(wText)) && word.bbox) {
                            matches.push(word.bbox);
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
                        // Perform direct click at nearest OCR match native screen coordinates
                        const mouseRes = await executeMouseAction('click', {
                            x: Math.round(bestMatch.x * (1280 / screenW)),
                            y: Math.round(bestMatch.y * (720 / screenH))
                        }, {
                            button,
                            clickType: type
                        });

                        // Reset cursor to center of screen after successful click
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

    const clickRes = await executeMouseAction('click', finalTarget, {
        button,
        clickType: type
    });

    // Reset cursor to center of screen after successful click
    try {
        await executeMouseAction('move', { x: 640, y: 360 });
    } catch (e) {}

    return clickRes;
};
