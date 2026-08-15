import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';
import { gridToNativeCoordinates, parseGridCodeTo720p } from '../utils/screen_grid.js';
import screenshotDesktop from 'screenshot-desktop';
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

import { mouse, Point } from '@nut-tree-fork/nut-js';

async function saveDebugImage(subDir, fileName, buffer) {
    if (!process.env.SHOW_DEBUG_GRID && !process.env.DEBUG_OCR) return;
    try {
        const dir = path.resolve(process.cwd(), 'screenshots', subDir);
        await fs.ensureDir(dir);
        await fs.writeFile(path.join(dir, fileName), buffer);
    } catch (e) {}
}

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
    if (len <= 4) return 0;
    if (len <= 8) return 1;
    return 2;
}

/**
 * Pre-process an image buffer for OCR: upscale 3×, convert to greyscale, and
 * stretch contrast. This dramatically improves Tesseract accuracy on small UI
 * text (Chrome navbar, taskbar, etc.) which is typically ≤14px at native res.
 */
async function preprocessForOcr(buffer, scale = 3) {
    const meta = await sharp(buffer).metadata();
    return sharp(buffer)
        .resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { kernel: 'lanczos3' })
        .greyscale()
        .normalise()
        .toBuffer();
}

/**
 * Parse Tesseract's TSV output (always available) into words and lines arrays.
 * TSV columns: level, page_num, block_num, par_num, line_num, word_num,
 *              left, top, width, height, conf, text
 * Level 5 = word (the only rows we care about here).
 */
function parseTsvToWordsAndLines(tsv) {
    if (!tsv) return { words: [], lines: [] };

    const wordEntries = [];
    const lineMap = new Map(); // "block_par_line" → { text, bbox, words[] }

    for (const row of tsv.split('\n')) {
        const parts = row.split('\t');
        if (parts.length < 12) continue;
        const lv   = parseInt(parts[0]);
        if (lv !== 5) continue; // word level only
        const blockNum = parts[2], parNum = parts[3], lineNum = parts[4];
        const left  = parseInt(parts[6]);
        const top   = parseInt(parts[7]);
        const w     = parseInt(parts[8]);
        const h     = parseInt(parts[9]);
        const conf  = parseFloat(parts[10]);
        const text  = parts.slice(11).join('\t').trim();
        if (!text || conf < 0) continue; // conf < 0 = non-text element

        const bbox = { x0: left, y0: top, x1: left + w, y1: top + h };
        const word = { text, confidence: conf, bbox };
        wordEntries.push(word);

        const key = `${blockNum}_${parNum}_${lineNum}`;
        if (!lineMap.has(key)) {
            lineMap.set(key, { words: [], bbox: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity } });
        }
        const entry = lineMap.get(key);
        entry.words.push(word);
        entry.bbox.x0 = Math.min(entry.bbox.x0, bbox.x0);
        entry.bbox.y0 = Math.min(entry.bbox.y0, bbox.y0);
        entry.bbox.x1 = Math.max(entry.bbox.x1, bbox.x1);
        entry.bbox.y1 = Math.max(entry.bbox.y1, bbox.y1);
    }

    const lines = [];
    for (const entry of lineMap.values()) {
        if (entry.words.length > 0) {
            lines.push({
                text: entry.words.map(w => w.text).join(' '),
                bbox: entry.bbox,
                words: entry.words,
            });
        }
    }
    return { words: wordEntries, lines };
}

/**
 * Normalise tesseract data: populate flat words/lines from blocks tree or TSV.
 * Tesseract.js sometimes omits structured data in the JS objects but always
 * emits TSV — so TSV parsing is the last-resort fallback.
 */
function normaliseOcrData(data) {
    if (data.words && data.words.length > 0) return; // already good

    // Fallback 1: walk the block tree
    if (data.blocks && data.blocks.length > 0) {
        data.words = [];
        data.lines = [];
        for (const block of data.blocks) {
            for (const para of (block.paragraphs || [])) {
                for (const line of (para.lines || [])) {
                    if (line.bbox) data.lines.push(line);
                    for (const word of (line.words || [])) {
                        if (word.bbox) data.words.push(word);
                    }
                }
            }
        }
        if (data.words.length > 0) return;
    }

    // Fallback 2: parse data.tsv (always emitted by Tesseract regardless of PSM/OEM)
    if (data.tsv) {
        const parsed = parseTsvToWordsAndLines(data.tsv);
        data.words = parsed.words;
        data.lines = parsed.lines;
    }
}

/**
 * Run the three-stage matching pipeline on tesseract data.
 * Returns an array of bboxes (already offset-adjusted if offsetX/Y provided).
 * @param {object} data   - tesseract recognition data (mutated by normaliseOcrData)
 * @param {string} targetLower - lower-cased search phrase
 * @param {number} [offsetX=0] - X offset to add (for tile crops)
 * @param {number} [offsetY=0] - Y offset to add (for tile crops)
 */
function extractOcrMatches(data, targetLower, offsetX = 0, offsetY = 0, scale = 1) {
    normaliseOcrData(data);

    // Convert bbox from preprocessed-image space back to native pixel space, then apply tile offset
    const shift = bbox => ({
        x0: Math.round(bbox.x0 / scale) + offsetX,
        y0: Math.round(bbox.y0 / scale) + offsetY,
        x1: Math.round(bbox.x1 / scale) + offsetX,
        y1: Math.round(bbox.y1 / scale) + offsetY,
    });

    const matches = [];

    // Stage 1A: line-level match → find all matching word spans within the line
    if (data.lines && data.lines.length > 0) {
        for (const line of data.lines) {
            const lText = line.text ? line.text.toLowerCase().trim() : '';
            if (!lText || !line.bbox) continue;

            const isMatch = lText === targetLower ||
                new RegExp(`\\b${escapeRegex(targetLower)}\\b`, 'i').test(lText);
            if (!isMatch) continue;

            const lineWords = line.words || (data.words ? data.words.filter(w =>
                w.bbox &&
                w.bbox.x0 >= line.bbox.x0 - 5 && w.bbox.x1 <= line.bbox.x1 + 5 &&
                w.bbox.y0 >= line.bbox.y0 - 5 && w.bbox.y1 <= line.bbox.y1 + 5
            ) : []);

            const targetTokens = targetLower.split(/\s+/);
            const cleanTarget = targetTokens.map(t => t.replace(/[^a-z0-9]/g, '')).join(' ');
            let foundWordMatch = false;

            if (lineWords.length > 0) {
                for (let wi = 0; wi <= lineWords.length - targetTokens.length; wi++) {
                    const windowWords = lineWords.slice(wi, wi + targetTokens.length);
                    const windowText = windowWords.map(w => (w.text || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')).join(' ');
                    if (windowText === cleanTarget || windowText.includes(cleanTarget)) {
                        const tightBbox = {
                            x0: Math.min(...windowWords.map(w => w.bbox.x0)),
                            y0: Math.min(...windowWords.map(w => w.bbox.y0)),
                            x1: Math.max(...windowWords.map(w => w.bbox.x1)),
                            y1: Math.max(...windowWords.map(w => w.bbox.y1)),
                        };
                        matches.push(shift(tightBbox));
                        foundWordMatch = true;
                    }
                }
            }

            if (!foundWordMatch) {
                matches.push(shift(line.bbox));
            }
        }
    }

    // Stage 1B: exact single-word match
    if (matches.length === 0 && data.words && data.words.length > 0) {
        for (const word of data.words) {
            const wText = word.text ? word.text.toLowerCase().trim().replace(/[^a-z0-9]/g, '') : '';
            const cleanTarget = targetLower.replace(/[^a-z0-9]/g, '');
            if (wText === cleanTarget && word.bbox) {
                matches.push(shift(word.bbox));
            }
        }
    }

    // Stage 2: mild fuzzy matching (OCR typos)
    if (matches.length === 0 && data.words && data.words.length > 0) {
        const maxAllowedDiff = getMaxEditDistance(targetLower.length);
        for (const word of data.words) {
            const wText = word.text ? word.text.toLowerCase().trim() : '';
            if (wText.length >= 3 && Math.abs(wText.length - targetLower.length) <= maxAllowedDiff) {
                const dist = levenshtein(wText, targetLower, maxAllowedDiff);
                if (dist <= maxAllowedDiff && word.bbox) {
                    matches.push(shift(word.bbox));
                }
            }
        }
    }

    return matches;
}

/**
 * Given a set of matched bboxes (full-screen coords), return the one overlapping or nearest to targetCoords.
 */
function pickBestMatch(matches, targetCoords) {
    let bestMatch = null;
    let minDistance = Infinity;

    for (const bbox of matches) {
        const centerX = Math.round((bbox.x0 + bbox.x1) / 2);
        const centerY = Math.round((bbox.y0 + bbox.y1) / 2);

        // Check if the targetCoords point falls directly inside this bbox
        const containsPoint = targetCoords.x >= bbox.x0 && targetCoords.x <= bbox.x1 &&
                              targetCoords.y >= bbox.y0 && targetCoords.y <= bbox.y1;

        const dist = Math.hypot(centerX - targetCoords.x, centerY - targetCoords.y);

        // Direct overlap gets highest priority (effective distance 0)
        const effectiveScore = containsPoint ? 0 : dist;

        if (effectiveScore < minDistance) {
            minDistance = effectiveScore;
            bestMatch = { x: centerX, y: centerY, dist, containsPoint, bbox };
        }
    }
    return bestMatch;
}

/**
 * Generate 8 tile definitions (4 cols × 2 rows) for a screen of (screenW, screenH).
 * Returns tiles sorted by distance of their center from (targetX, targetY),
 * with the tile that contains the target always first.
 */
function getSortedTiles(screenW, screenH, targetX, targetY) {
    const COLS = 4, ROWS = 2;
    const tileW = Math.ceil(screenW / COLS);
    const tileH = Math.ceil(screenH / ROWS);
    const tiles = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const x0 = c * tileW;
            const y0 = r * tileH;
            const w = Math.min(tileW, screenW - x0);
            const h = Math.min(tileH, screenH - y0);
            const cx = x0 + w / 2;
            const cy = y0 + h / 2;
            const containsTarget = targetX >= x0 && targetX < x0 + w && targetY >= y0 && targetY < y0 + h;
            tiles.push({ x0, y0, w, h, cx, cy, containsTarget });
        }
    }

    return tiles.sort((a, b) => {
        if (a.containsTarget) return -1;
        if (b.containsTarget) return 1;
        const da = Math.hypot(a.cx - targetX, a.cy - targetY);
        const db = Math.hypot(b.cx - targetX, b.cy - targetY);
        return da - db;
    });
}

let _ocrWorkerPromise = null;

async function getOcrWorker() {
    if (!_ocrWorkerPromise) {
        _ocrWorkerPromise = (async () => {
            const { createWorker } = await import('tesseract.js');
            const fs = await import('fs-extra');
            const { CU_CACHE_DIR } = await import('../utils/paths.js');
            fs.ensureDirSync(CU_CACHE_DIR);
            return createWorker('eng', 1, { cachePath: CU_CACHE_DIR, logger: () => {} });
        })().catch(err => {
            _ocrWorkerPromise = null;
            throw err;
        });
    }
    return _ocrWorkerPromise;
}

let _cachedSnapOpts = null;
let _cachedDisplayIndex = null;

async function getCachedSnapOpts() {
    const { getActiveDisplay } = await import('../utils/screen_grid.js');
    const displayIndex = await getActiveDisplay();
    if (_cachedSnapOpts && _cachedDisplayIndex === displayIndex) {
        return _cachedSnapOpts;
    }
    _cachedDisplayIndex = displayIndex;
    _cachedSnapOpts = { format: 'png' };
    try {
        const displays = await screenshotDesktop.listDisplays();
        if (displays && displays.length > 0) {
            const targetDisplay = displays[displayIndex] || displays[0];
            _cachedSnapOpts = { format: 'png', screen: targetDisplay.id };
        }
    } catch (e) {}
    return _cachedSnapOpts;
}

/**
 * Click Tool for GUI Automation
 * Accepts gridId, click type, mouse button, and optional intendedClickText for OCR verification.
 */
export const click = async (args, context = {}) => {
    const isDebug = !!(process.env.SHOW_DEBUG_GRID || process.env.DEBUG_OCR || process.env.VERBOSE);
    const t0 = performance.now();
    let lastT = t0;
    const logStep = (label) => {
        if (!isDebug) return;
        const now = performance.now();
        const stepMs = (now - lastT).toFixed(0);
        const totalMs = (now - t0).toFixed(0);
        console.log(`[Click Perf] +${stepMs}ms (${totalMs}ms total) -> ${label}`);
        lastT = now;
    };

    logStep('Starting click()');
    const parsed = parseArgs(args);
    const gridId = parsed.gridId || parsed.grid || parsed.coordinate || parsed.target || parsed.id;
    const type = (parsed.type || parsed.clickType || 'single').toLowerCase();
    const button = (parsed.button || 'left').toLowerCase();
    const intendedClickText = parsed.intendedClickText || parsed.text || '';

    if (!gridId && !intendedClickText) {
        return 'ERROR: Missing required "gridId" parameter for Click tool.';
    }

    let finalTarget = gridId;

    // OCR Auto-Correction if intendedClickText is provided
    if (intendedClickText) {
        try {
            logStep('Parsing grid code');
            const targetPoint = gridId ? parseGridCodeTo720p(gridId) : null;

            logStep('Getting display options');
            const snapOpts = await getCachedSnapOpts();

            logStep('Taking desktop screenshot');
            const rawBuffer = await screenshotDesktop(snapOpts);

            logStep('Getting image metadata');
            const meta = await sharp(rawBuffer).metadata();
            const screenW = meta.width || 1920;
            const screenH = meta.height || 1080;

            const targetCoords = targetPoint
                ? {
                    x: Math.round(targetPoint.x * (screenW / 1280)),
                    y: Math.round(targetPoint.y * (screenH / 720))
                }
                : { x: screenW / 2, y: screenH / 2 };

            const targetLower = intendedClickText.toLowerCase().trim();

            logStep('Acquiring OCR worker');
            const worker = await getOcrWorker();
            let bestMatch = null;
            let matchSource = '';

            const MAX_TRUST_RADIUS_PX = targetPoint ? 220 : 500;

            // ─── PASS 1: Centered Target Crop (3x Zoom Window, 2x Upscale) ────
            if (targetPoint) {
                logStep('Pass 1: Cropping target crop (3x zoom window, 2x upscale)');
                const cropW = Math.min(Math.round(screenW / 3), screenW);
                const cropH = Math.min(Math.round(screenH / 3), screenH);
                const cropLeft = Math.max(0, Math.min(screenW - cropW, targetCoords.x - Math.floor(cropW / 2)));
                const cropTop = Math.max(0, Math.min(screenH - cropH, targetCoords.y - Math.floor(cropH / 2)));

                const cropRaw = await sharp(rawBuffer)
                    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
                    .toBuffer();
                // 2x upscale gives crisp definition without over-enlarging
                const cropScale = 2;
                const cropBuffer = await preprocessForOcr(cropRaw, cropScale);

                const cleanTag = targetLower.replace(/[^a-z0-9]/g, '_');
                await saveDebugImage('cropped', `crop_${Date.now()}_${cleanTag}.png`, cropBuffer);

                logStep('Pass 1: Running Tesseract OCR recognize on crop (PSM 11 - Sparse Text)');
                await worker.setParameters({ tessedit_pageseg_mode: '11' });
                const { data: cropData } = await worker.recognize(cropBuffer, {}, { tsv: true, blocks: true });
                logStep('Pass 1: OCR recognition finished, extracting matches');

                if (cropData && cropData.text) {
                    if (isDebug) {
                        console.log(`[Pass 1 OCR Read]: "${cropData.text.trim().replace(/\s+/g, ' ')}"`);
                    }
                    const cropMatches = extractOcrMatches(cropData, targetLower, cropLeft, cropTop, cropScale);
                    if (cropMatches.length > 0) {
                        const candidate = pickBestMatch(cropMatches, targetCoords);
                        if (candidate && (candidate.containsPoint || candidate.dist <= MAX_TRUST_RADIUS_PX)) {
                            bestMatch = candidate;
                            matchSource = `centered target crop OCR`;
                        }
                    }
                }
            }

            // ─── PASS 2: Full-screen OCR (Single-pass broad scan) ────────────────
            if (!bestMatch) {
                logStep('Pass 2: Entering Full-Screen OCR (broad scan, PSM 3 - Auto)');
                const fullProcessed = await preprocessForOcr(rawBuffer, 2);
                const cleanTag = targetLower.replace(/[^a-z0-9]/g, '_');
                await saveDebugImage('fullscreen', `full_${Date.now()}_${cleanTag}.png`, fullProcessed);

                logStep('Pass 2: Running Tesseract on full screen');
                await worker.setParameters({ tessedit_pageseg_mode: '3' });
                const { data: fullData } = await worker.recognize(fullProcessed, {}, { tsv: true, blocks: true });
                logStep('Pass 2: Full-screen OCR finished');

                if (fullData && fullData.text) {
                    const fullMatches = extractOcrMatches(fullData, targetLower, 0, 0, 2);

                    if (fullMatches.length > 0) {
                        const candidate = pickBestMatch(fullMatches, targetCoords);
                        if (candidate) {
                            bestMatch = candidate;
                            matchSource = `full-screen OCR`;
                        }
                    }
                }
            }

            // ─── PASS 3: Tiled OCR (8 tiles at 3x upscale for microscopic text) ───
            if (!bestMatch) {
                logStep('Pass 3: Entering Tiled OCR fallback (high-res 3x)');
                const tiles = getSortedTiles(screenW, screenH, targetCoords.x, targetCoords.y);
                const cleanTag = targetLower.replace(/[^a-z0-9]/g, '_');

                await worker.setParameters({ tessedit_pageseg_mode: '11' });
                for (let ti = 0; ti < tiles.length; ti++) {
                    const tile = tiles[ti];
                    logStep(`Pass 3: Preprocessing tile ${ti + 1}/${tiles.length}`);
                    const tileRaw = await sharp(rawBuffer)
                        .extract({ left: tile.x0, top: tile.y0, width: tile.w, height: tile.h })
                        .toBuffer();
                    const tileBuffer = await preprocessForOcr(tileRaw, 3);
                    await saveDebugImage('tiles', `tile_${ti + 1}_${Date.now()}_${cleanTag}.png`, tileBuffer);

                    logStep(`Pass 3: Running Tesseract on tile ${ti + 1}`);
                    const { data: tileData } = await worker.recognize(tileBuffer, {}, { tsv: true, blocks: true });
                    if (!tileData || !tileData.text) continue;

                    const tileMatches = extractOcrMatches(tileData, targetLower, tile.x0, tile.y0, 3);

                    if (tileMatches.length > 0) {
                        const candidate = pickBestMatch(tileMatches, targetCoords);
                        if (candidate) {
                            bestMatch = candidate;
                            matchSource = `tile ${ti + 1} OCR (${tile.containsTarget ? 'target tile' : `offset ${tile.x0},${tile.y0}`})`;
                            break;
                        }
                    }
                }
            }

            if (bestMatch) {
                const target720p = {
                    x: Math.round(bestMatch.x * (1280 / screenW)),
                    y: Math.round(bestMatch.y * (720 / screenH))
                };

                logStep(`Executing mouse click on matched target (${matchSource})`);
                const mouseRes = await executeMouseAction('click', target720p, { button, clickType: type });
                logStep('Click completed successfully');
                return `${mouseRes} (${matchSource} for "${intendedClickText}" at ${Math.round(bestMatch.dist)}px distance)`;
            } else if (isDebug) {
                console.log(`[OCR] No match found for "${intendedClickText}". Falling back to gridId.`);
            }

        } catch (ocrErr) {
            if (isDebug) console.error('[OCR Error]', ocrErr);
        }
    }

    logStep(`Executing mouse click on fallback gridId: ${finalTarget}`);
    const clickRes = await executeMouseAction('click', finalTarget, {
        button,
        clickType: type
    });
    logStep('Fallback click completed');

    return clickRes;
};
