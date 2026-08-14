import { screen } from '@nut-tree-fork/nut-js';
import screenshotDesktop from 'screenshot-desktop';
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

/**
 * Grid Configuration Defaults:
 * Standard 16:9 normalized canvas resolution: 1280 x 720
 * Columns: 28, Rows: 26
 * Sequential Cell IDs: 1 to (28 * 26 = 728)
 */
export const GRID_CONFIG = {
    TARGET_WIDTH: 1280,
    TARGET_HEIGHT: 720,
    COLS: 40,
    ROWS: 30
};

// Store detected element bounding boxes for dynamic targeting
let detectedUIElements = [];

/**
 * Detects UI element bounding boxes by analyzing pixel luminance variance / edge density in 40x30 fine grid cells.
 */
async function detectActiveGridCells(rawBuffer) {
    try {
        const { data, info } = await sharp(rawBuffer)
            .resize(GRID_CONFIG.TARGET_WIDTH, GRID_CONFIG.TARGET_HEIGHT, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const width = info.width;
        const height = info.height;
        const cols = GRID_CONFIG.COLS;
        const rows = GRID_CONFIG.ROWS;
        const cellW = width / cols;
        const cellH = height / rows;

        const activeCells = [];
        let cellNum = 1;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const startX = Math.floor(c * cellW);
                const startY = Math.floor(r * cellH);
                const endX = Math.floor((c + 1) * cellW);
                const endY = Math.floor((r + 1) * cellH);

                // Calculate vertical 3-band pixel edge variance (top 30%, center 40%, bottom 30%) for text avoidance
                const bandH = Math.floor((endY - startY) / 3);
                let centerSum = 0, centerCount = 0;
                let topSum = 0, topCount = 0;
                let bottomSum = 0, bottomCount = 0;

                for (let y = startY; y < endY; y += 2) {
                    for (let x = startX; x < endX; x += 2) {
                        const px = data[y * width + x];
                        if (y < startY + bandH) {
                            topSum += px; topCount++;
                        } else if (y > endY - bandH) {
                            bottomSum += px; bottomCount++;
                        } else {
                            centerSum += px; centerCount++;
                        }
                    }
                }

                const mean = (topSum + centerSum + bottomSum) / (topCount + centerCount + bottomCount);

                let centerVar = 0, topVar = 0, bottomVar = 0;
                for (let y = startY; y < endY; y += 2) {
                    for (let x = startX; x < endX; x += 2) {
                        const px = data[y * width + x];
                        const diff = px - mean;
                        if (y < startY + bandH) {
                            topVar += diff * diff;
                        } else if (y > endY - bandH) {
                            bottomVar += diff * diff;
                        } else {
                            centerVar += diff * diff;
                        }
                    }
                }

                const centerStdDev = Math.sqrt(centerVar / (centerCount || 1));
                const topStdDev = Math.sqrt(topVar / (topCount || 1));
                const bottomStdDev = Math.sqrt(bottomVar / (bottomCount || 1));
                const overallStdDev = Math.sqrt((topVar + centerVar + bottomVar) / ((topCount + centerCount + bottomCount) || 1));

                // Determine vertical badge y-offset based on text band density:
                let yOffset = 3;
                // If text is definitively at the top (topStdDev is high) and bottom is clearer, shift DOWN (+10px) into empty bottom space!
                if (topStdDev > bottomStdDev + 3) {
                    yOffset = 10;
                }
                // Otherwise (text is at bottom, or perfectly centered), ALWAYS default to shifting UP (-8px) into clear top space!
                else if (bottomStdDev > topStdDev + 3 || centerStdDev > 12) {
                    yOffset = -8;
                }

                // stdDev > 18 indicates visual detail/content (icons, text, buttons) rather than smooth wallpaper gradients
                if (overallStdDev > 18) {
                    activeCells.push({
                        cellNum,
                        cx: Math.floor(startX + cellW / 2),
                        cy: Math.floor(startY + cellH / 2),
                        cellW,
                        cellH,
                        startX,
                        startY,
                        yOffset,
                        mean,
                        stdDev: overallStdDev
                    });
                }
                cellNum++;
            }
        }

        // Step 1: Detect and merge isolated desktop icon / setting button clusters (max 4 cols wide x 4 rows tall) into 1 single unified box
        const gridMatrix = Array.from({ length: rows }, () => Array(cols).fill(null));
        for (const item of activeCells) {
            const r = Math.floor((item.cellNum - 1) / cols);
            const c = (item.cellNum - 1) % cols;
            gridMatrix[r][c] = item;
        }

        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        const finalBoxes = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (gridMatrix[r][c] && !visited[r][c]) {
                    // Check if this cell is part of an isolated icon/menu cluster (e.g. Installed Apps, Sound, Recycle Bin)
                    let minR = r, maxR = r, minC = c, maxC = c;
                    const queue = [[r, c]];
                    const clusterCells = [gridMatrix[r][c]];
                    const compVisited = Array.from({ length: rows }, () => Array(cols).fill(false));
                    compVisited[r][c] = true;

                    while (queue.length > 0) {
                        const [currR, currC] = queue.shift();
                        minR = Math.min(minR, currR);
                        maxR = Math.max(maxR, currR);
                        minC = Math.min(minC, currC);
                        maxC = Math.max(maxC, currC);

                        const neighbors = [
                            [currR - 1, currC], [currR + 1, currC],
                            [currR, currC - 1], [currR, currC + 1],
                            [currR - 1, currC - 1], [currR - 1, currC + 1],
                            [currR + 1, currC - 1], [currR + 1, currC + 1]
                        ];

                        for (const [nr, nc] of neighbors) {
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                                if (gridMatrix[nr][nc] && !compVisited[nr][nc]) {
                                    compVisited[nr][nc] = true;
                                    queue.push([nr, nc]);
                                    clusterCells.push(gridMatrix[nr][nc]);
                                }
                            }
                        }
                    }

                    const clusterH = maxR - minR + 1;
                    const clusterW = maxC - minC + 1;

                    // If it's an isolated UI element / button cluster (e.g. <= 4 rows tall and <= 4 cols wide)
                    if (clusterH <= 4 && clusterW <= 4) {
                        for (const cell of clusterCells) {
                            const cr = Math.floor((cell.cellNum - 1) / cols);
                            const cc = (cell.cellNum - 1) % cols;
                            visited[cr][cc] = true;
                        }

                        const startX = Math.floor(minC * cellW);
                        const startY = Math.floor(minR * cellH);
                        const endX = Math.floor((maxC + 1) * cellW);
                        const endY = Math.floor((maxR + 1) * cellH);
                        const boxW = endX - startX;
                        const boxH = endY - startY;

                        // For large merged clusters, dynamically calculate where the clear space is
                        let clusterYOffset = 3;
                        if (boxH > cellH) {
                            const topHalfCells = clusterCells.filter(c => c.startY < startY + boxH / 2);
                            const bottomHalfCells = clusterCells.filter(c => c.startY >= startY + boxH / 2);
                            const topDensity = topHalfCells.reduce((sum, c) => sum + c.stdDev, 0) / (topHalfCells.length || 1);
                            const bottomDensity = bottomHalfCells.reduce((sum, c) => sum + c.stdDev, 0) / (bottomHalfCells.length || 1);

                            if (bottomDensity > topDensity + 2) {
                                clusterYOffset = -Math.floor(boxH / 4); // Shift UP into clear top half
                            } else if (topDensity > bottomDensity + 2) {
                                clusterYOffset = Math.floor(boxH / 4);  // Shift DOWN into clear bottom half
                            } else {
                                clusterYOffset = -12; // Default shift UP for large boxes
                            }
                        } else {
                            const shiftCell = clusterCells.find(c => c.yOffset !== 3) || clusterCells[0];
                            clusterYOffset = shiftCell.yOffset;
                        }

                        finalBoxes.push({
                            cellNum: clusterCells[0].cellNum,
                            cx: Math.floor(startX + boxW / 2),
                            cy: Math.floor(startY + boxH / 2),
                            cellW: boxW,
                            cellH: boxH,
                            startX,
                            startY,
                            yOffset: clusterYOffset
                        });
                    } else {
                        // Step 2: 2-Cell Vertical Merge: If a vertically adjacent pair exists, merge into 1 box
                        visited[r][c] = true;
                        const topCell = gridMatrix[r][c];
                        const bottomCell = (r + 1 < rows) ? gridMatrix[r + 1][c] : null;

                        if (bottomCell && !visited[r + 1][c]) {
                            visited[r + 1][c] = true;

                            const startX = Math.floor(c * cellW);
                            const startY = Math.floor(r * cellH);
                            const endX = Math.floor((c + 1) * cellW);
                            const endY = Math.floor((r + 2) * cellH);
                            const boxW = endX - startX;
                            const boxH = endY - startY;

                            // Sample seam band (bottom 25% of topCell + top 25% of bottomCell) to detect text right across the center seam
                            const seamHalfH = Math.floor(cellH * 0.25);
                            const seamStartY = Math.floor(startY + cellH - seamHalfH);
                            const seamEndY = Math.floor(startY + cellH + seamHalfH);

                            let seamSum = 0, seamCount = 0;
                            for (let y = seamStartY; y < seamEndY; y += 2) {
                                for (let x = startX; x < endX; x += 2) {
                                    seamSum += data[y * width + x];
                                    seamCount++;
                                }
                            }
                            const seamMean = seamSum / (seamCount || 1);
                            let seamVar = 0;
                            for (let y = seamStartY; y < seamEndY; y += 2) {
                                for (let x = startX; x < endX; x += 2) {
                                    const diff = data[y * width + x] - seamMean;
                                    seamVar += diff * diff;
                                }
                            }
                            const seamStdDev = Math.sqrt(seamVar / (seamCount || 1));

                            let finalTargetY;
                            // If the seam is clean (no text crossing the center line), place directly on center seam!
                            if (seamStdDev < 14) {
                                finalTargetY = Math.floor(startY + cellH) + 4; // Seam center + 4px baseline
                            } else {
                                // If text is right on the seam, shift into whichever cell half has clearer background
                                const topDev = topCell.stdDev || 0;
                                const bottomDev = bottomCell.stdDev || 0;
                                if (topDev < bottomDev) {
                                    // Top cell is clearer: place inside top cell
                                    finalTargetY = Math.floor(startY + cellH / 2) + (topCell.yOffset !== 3 ? topCell.yOffset : -4);
                                } else {
                                    // Bottom cell is clearer: place inside bottom cell
                                    finalTargetY = Math.floor(startY + cellH + cellH / 2) + (bottomCell.yOffset !== 3 ? bottomCell.yOffset : 4);
                                }
                            }

                            // Clamp finalTargetY: outer top and bottom bounds stay strictly clamped (2px padding), while internal seam can overflow
                            finalTargetY = Math.max(startY + 11, Math.min(startY + boxH - 2, finalTargetY));

                            finalBoxes.push({
                                cellNum: topCell.cellNum,
                                cx: Math.floor(startX + boxW / 2),
                                cy: finalTargetY,
                                cellW: boxW,
                                cellH: boxH,
                                startX,
                                startY,
                                yOffset: 0,
                                isCustomY: true
                            });
                        } else {
                            finalBoxes.push(topCell);
                        }
                    }
                }
            }
        }

        detectedUIElements = finalBoxes;
        return finalBoxes;
    } catch (err) {
        console.error('UI Element Detection error:', err);
        return [];
    }
}

/**
 * Generates an SVG overlay displaying high-contrast Set-of-Marks (SoM) badges ONLY on active UI elements, with a very subtle background grid.
 */
function generateSmartGridSvgOverlay(width, height, cols, rows, activeCells = []) {
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    let gridContent = '';

    // Draw ultra-subtle low-opacity background grid lines
    // for (let c = 0; c <= cols; c++) {
    //     const x = c * cellWidth;
    //     gridContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>`;
    // }
    // for (let r = 0; r <= rows; r++) {
    //     const y = r * cellHeight;
    //     gridContent += `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>`;
    // }

    // Render clean Set-of-Marks (SoM) cell badges ONLY on active UI element cells
    for (const cell of activeCells) {
        const { cellNum, startX, startY, cellW, cellH, cx, cy } = cell;

        // Thin subtle cyan bounding rectangle around detected active cell
        gridContent += `
            <rect x="${startX + 1}" y="${startY + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="rgba(0, 255, 255, 0.015)" stroke="rgba(255, 255, 0, 0.3)" stroke-width="1.1" rx="2"/>
        `;

        let textY;
        if (cell.isCustomY) {
            textY = cy;
        } else {
            const rawTextY = cy + (cell.yOffset !== undefined ? cell.yOffset : 3);
            // Clamp textY so the SVG text stays inside box boundaries while allowing lower placement
            textY = Math.max(startY + 11, Math.min(startY + cellH + 3, rawTextY));
        }

        // Centered number text per cell with dynamic text-avoidance Y-shift
        gridContent += `
            <text x="${cx}" y="${textY}" font-family="'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="#FFFF00" stroke="#000000" stroke-width="2" paint-order="stroke fill" stroke-linejoin="round" opacity="0.8" text-anchor="middle">${cellNum}</text>
        `;
    }

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${gridContent}</svg>`;
}

let screenshotCounter = 1;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Captures a stable desktop screenshot by verifying viewport stillness (500ms stability check with 3s backoff, max 2 retry loops).
 */
async function captureStableScreenshot() {
    let attempts = 0;
    while (attempts < 2) {
        const first = await screenshotDesktop({ format: 'png' });
        await sleep(500);
        const second = await screenshotDesktop({ format: 'png' });

        // If viewport is completely stable between 500ms intervals
        if (first.equals(second)) {
            return second;
        }

        // Viewport is still animating/loading, wait 3 seconds before next cycle
        attempts++;
        if (attempts < 2) {
            await sleep(3000);
        }
    }

    // Final fallback after 2 cycles
    await sleep(3000);
    return await screenshotDesktop({ format: 'png' });
}

/**
 * Captures desktop screenshot, detects active UI elements, composites Set-of-Marks overlay, saves debug preview, and returns base64 PNG payload.
 */
export async function captureGriddedScreenshot() {
    try {
        const rawBuffer = await captureStableScreenshot();
        const activeCells = await detectActiveGridCells(rawBuffer);

        const svgOverlay = generateSmartGridSvgOverlay(
            GRID_CONFIG.TARGET_WIDTH,
            GRID_CONFIG.TARGET_HEIGHT,
            GRID_CONFIG.COLS,
            GRID_CONFIG.ROWS,
            activeCells
        );

        const processedBuffer = await sharp(rawBuffer)
            .resize(GRID_CONFIG.TARGET_WIDTH, GRID_CONFIG.TARGET_HEIGHT, { fit: 'fill' })
            .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
            .png({ quality: 100 })
            .toBuffer();

        // Save screenshot preview to screenshots/ directory for debugging
        if (!!process.env.SHOW_DEBUG_GRID) {
            try {
                const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
                await fs.ensureDir(screenshotsDir);
                const screenshotPath = path.join(screenshotsDir, `${screenshotCounter}.png`);
                await fs.writeFile(screenshotPath, processedBuffer);
                screenshotCounter++;
            } catch (e) {
                // Ignore debug file write error
            }
        }

        const base64 = processedBuffer.toString('base64');
        const detectedCount = activeCells.length;

        // Nullify raw and processed Buffer references immediately for V8 Garbage Collection
        let _raw = rawBuffer;
        let _proc = processedBuffer;
        _raw = null;
        _proc = null;

        return {
            base64,
            mimeType: 'image/png',
            width: GRID_CONFIG.TARGET_WIDTH,
            height: GRID_CONFIG.TARGET_HEIGHT,
            detectedCount
        };
    } catch (err) {
        console.error('Failed to capture gridded screenshot:', err);
        return null;
    }
}

/**
 * Parses sequential grid number (e.g. 15, "42", 500) into center pixel coordinates (x, y) on a 1280x720 canvas.
 */
export function parseGridCodeTo720p(gridInput) {
    if (gridInput === undefined || gridInput === null) return null;

    let cellNum = null;

    if (typeof gridInput === 'number') {
        cellNum = gridInput;
    } else if (typeof gridInput === 'string') {
        const clean = gridInput.trim();
        if (/^\d+$/.test(clean)) {
            cellNum = parseInt(clean, 10);
        } else {
            // Fallback for legacy format like "C14"
            const match = clean.match(/^([A-Z])([0-9]{1,2})$/i);
            if (match) {
                const r = match[1].toUpperCase().charCodeAt(0) - 65;
                const c = parseInt(match[2], 10) - 1;
                cellNum = r * GRID_CONFIG.COLS + c + 1;
            }
        }
    }

    if (cellNum === null || isNaN(cellNum)) return null;

    // Check if cellNum matches a detected merged UI element box
    if (detectedUIElements && detectedUIElements.length > 0) {
        const mergedMatch = detectedUIElements.find(box => box.cellNum === cellNum);
        if (mergedMatch) {
            return {
                x: mergedMatch.cx,
                y: mergedMatch.cy,
                colIdx: Math.floor((cellNum - 1) % GRID_CONFIG.COLS),
                rowIdx: Math.floor((cellNum - 1) / GRID_CONFIG.COLS),
                cellNum
            };
        }
    }

    const maxCells = GRID_CONFIG.COLS * GRID_CONFIG.ROWS;
    if (cellNum < 1 || cellNum > maxCells) return null;

    const zeroIndex = cellNum - 1;
    const rowIdx = Math.floor(zeroIndex / GRID_CONFIG.COLS);
    const colIdx = zeroIndex % GRID_CONFIG.COLS;

    const cellWidth = GRID_CONFIG.TARGET_WIDTH / GRID_CONFIG.COLS;
    const cellHeight = GRID_CONFIG.TARGET_HEIGHT / GRID_CONFIG.ROWS;

    const centerX = Math.floor(colIdx * cellWidth + cellWidth / 2);
    const centerY = Math.floor(rowIdx * cellHeight + cellHeight / 2);

    return { x: centerX, y: centerY, colIdx, rowIdx, cellNum };
}

/**
 * Converts 1280x720 normalized (x,y) coordinates or numeric grid number to actual Native Desktop Screen Pixel Coordinates (x,y).
 */
export async function gridToNativeCoordinates(target, actualScreenWidth, actualScreenHeight) {
    let point720 = null;
    if (typeof target === 'number' || typeof target === 'string') {
        point720 = parseGridCodeTo720p(target);
    } else if (target && typeof target.x === 'number' && typeof target.y === 'number') {
        point720 = target;
    }

    if (!point720) return null;

    let screenW = actualScreenWidth;
    let screenH = actualScreenHeight;
    if (!screenW || !screenH) {
        try {
            screenW = await screen.width();
            screenH = await screen.height();
        } catch (e) {
            screenW = 1920;
            screenH = 1080;
        }
    }

    const scaleX = screenW / GRID_CONFIG.TARGET_WIDTH;
    const scaleY = screenH / GRID_CONFIG.TARGET_HEIGHT;

    const nativeX = Math.round(point720.x * scaleX);
    const nativeY = Math.round(point720.y * scaleY);

    return {
        x: Math.max(0, Math.min(screenW - 1, nativeX)),
        y: Math.max(0, Math.min(screenH - 1, nativeY)),
        screenW,
        screenH
    };
}
