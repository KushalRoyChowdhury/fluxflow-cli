import * as ort from 'onnxruntime-node';
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import os from 'os';

/**
 * Lightweight UI Detection Model Engine (ONNX Runtime)
 * Handles auto-download, image preprocessing (640x640), inference, and NMS box extraction.
 */

let onnxSession = null;
let isModelLoading = false;
let modelLoadFailed = false;

// Default model cache directory: ~/.fluxflow/models/
const MODEL_DIR = path.join(os.homedir(), '.fluxflow', 'models');
const MODEL_NAME = 'ui_detector_nano.onnx';
const MODEL_PATH = path.join(MODEL_DIR, MODEL_NAME);

// GitHub Release CDN download URL (latest release asset)
const MODEL_DOWNLOAD_URL = 'https://github.com/KushalRoyChowdhury/fluxflow-cli/releases/latest/download/yolov8n.onnx';

const INPUT_SIZE = 640;
const CONF_THRESHOLD = 0.02; // Balanced threshold for UI buttons & icons
const IOU_THRESHOLD = 0.30;  // Tight NMS deduplication to prevent double-badges on same icon
const MIN_BOX_WIDTH = 32;    // Discard tiny micro-dots / specks
const MIN_BOX_HEIGHT = 32;

/**
 * Downloads a file with full redirect follow support and proper request headers.
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`Download failed with status: ${res.statusCode}`));
            }
            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
            fileStream.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Downloads or loads the model (checks ~/.fluxflow/models/ first, then local workspace, then downloads).
 */
async function ensureModelExists() {
    // 1. Check cached global models directory (~/.fluxflow/models/ui_detector_nano.onnx)
    if (await fs.pathExists(MODEL_PATH)) {
        return MODEL_PATH;
    }

    // 2. Check local project root (yolov8n.onnx) and cache into global models directory
    const localRepoPath = path.resolve(process.cwd(), 'yolov8n.onnx');
    if (await fs.pathExists(localRepoPath)) {
        try {
            await fs.ensureDir(MODEL_DIR);
            await fs.copy(localRepoPath, MODEL_PATH);
            return MODEL_PATH;
        } catch (e) {
            return localRepoPath;
        }
    }

    // 3. Auto-download from GitHub Release CDN
    await fs.ensureDir(MODEL_DIR);
    const tempPath = `${MODEL_PATH}.tmp`;
    console.log(`[FluxFlow] Downloading UI ONNX model (~80MB) to ${MODEL_PATH}...`);

    try {
        await downloadFile(MODEL_DOWNLOAD_URL, tempPath);
        await fs.move(tempPath, MODEL_PATH, { overwrite: true });
        console.log(`[FluxFlow] UI ONNX model downloaded successfully.`);
        return MODEL_PATH;
    } catch (err) {
        console.warn(`[FluxFlow] UI Model download failed: ${err.message}. Falling back to default.`);
        await fs.remove(tempPath).catch(() => {});
        throw err;
    }
}

/**
 * Initializes and caches ONNX inference session.
 */
export async function getDetectorSession() {
    if (onnxSession) return onnxSession;
    if (modelLoadFailed) return null;
    if (isModelLoading) {
        while (isModelLoading) {
            await new Promise(r => setTimeout(r, 100));
        }
        return onnxSession;
    }

    isModelLoading = true;
    try {
        const modelFilePath = await ensureModelExists();
        onnxSession = await ort.InferenceSession.create(modelFilePath, {
            executionProviders: ['cpu'],
            graphOptimizationLevel: 'all'
        });
        isModelLoading = false;
        return onnxSession;
    } catch (err) {
        console.warn('[FluxFlow] ONNX session creation failed:', err.message);
        modelLoadFailed = true;
        isModelLoading = false;
        return null;
    }
}

/**
 * Preprocesses image into 1x3x640x640 Float32 ONNX Tensor and returns raw greyscale buffer for text-avoidance analysis.
 */
async function preprocessImage(imageBuffer) {
    const { data } = await sharp(imageBuffer)
        .resize(INPUT_SIZE, INPUT_SIZE, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const totalPixels = INPUT_SIZE * INPUT_SIZE;
    const float32Data = new Float32Array(3 * totalPixels);

    // Planar format [1, 3, 640, 640] normalized to [0, 1]
    for (let i = 0; i < totalPixels; i++) {
        float32Data[i] = data[i * 3] / 255.0;                      // R
        float32Data[totalPixels + i] = data[i * 3 + 1] / 255.0;      // G
        float32Data[2 * totalPixels + i] = data[i * 3 + 2] / 255.0;  // B
    }

    return new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

/**
 * Calculates dynamic vertical Y-shift to avoid text inside the detected bounding box.
 */
function calculateTextAvoidanceOffset(rawGrayBuffer, width, height, startX, startY, cellW, cellH) {
    if (!rawGrayBuffer || cellH < 14) return 3;

    const endX = Math.min(width, startX + cellW);
    const endY = Math.min(height, startY + cellH);
    const bandH = Math.max(2, Math.floor((endY - startY) / 3));

    let topSum = 0, topCount = 0;
    let centerSum = 0, centerCount = 0;
    let bottomSum = 0, bottomCount = 0;

    for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
            const px = rawGrayBuffer[y * width + x];
            if (y < startY + bandH) {
                topSum += px; topCount++;
            } else if (y > endY - bandH) {
                bottomSum += px; bottomCount++;
            } else {
                centerSum += px; centerCount++;
            }
        }
    }

    const mean = (topSum + centerSum + bottomSum) / ((topCount + centerCount + bottomCount) || 1);

    let topVar = 0, centerVar = 0, bottomVar = 0;
    for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
            const px = rawGrayBuffer[y * width + x];
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

    const topStdDev = Math.sqrt(topVar / (topCount || 1));
    const centerStdDev = Math.sqrt(centerVar / (centerCount || 1));
    const bottomStdDev = Math.sqrt(bottomVar / (bottomCount || 1));

    // If text is predominantly at top band, shift DOWN into clear space
    if (topStdDev > bottomStdDev + 3) {
        return Math.min(10, Math.floor(cellH / 3));
    }
    // If text is centered or at bottom, shift UP into top clear space
    if (bottomStdDev > topStdDev + 3 || centerStdDev > 12) {
        return -Math.min(8, Math.floor(cellH / 3));
    }

    return 3;
}

/**
 * Calculates Intersection-over-Union (IoU) between two bounding boxes.
 */
function calculateIoU(boxA, boxB) {
    const xA = Math.max(boxA.x1, boxB.x1);
    const yA = Math.max(boxA.y1, boxB.y1);
    const xB = Math.min(boxA.x2, boxB.x2);
    const yB = Math.min(boxA.y2, boxB.y2);

    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const boxAArea = (boxA.x2 - boxA.x1) * (boxA.y2 - boxA.y1);
    const boxBArea = (boxB.x2 - boxB.x1) * (boxB.y2 - boxB.y1);

    return interArea / (boxAArea + boxBArea - interArea || 1);
}

/**
 * Performs Non-Maximum Suppression (NMS) to eliminate duplicate overlapping boxes.
 */
function applyNMS(boxes, iouThreshold) {
    boxes.sort((a, b) => b.score - a.score);
    const selected = [];

    for (const box of boxes) {
        let keep = true;
        for (const existing of selected) {
            if (calculateIoU(box, existing) > iouThreshold) {
                keep = false;
                break;
            }
        }
        if (keep) selected.push(box);
    }
    return selected;
}

/**
 * Runs ONNX UI element detection on raw image buffer.
 * Returns normalized UI boxes mapped to target canvas (1280x720).
 */
export async function detectUIBoxesONNX(imageBuffer, targetWidth = 1280, targetHeight = 720) {
    try {
        const session = await getDetectorSession();
        if (!session) return null;

        const inputTensor = await preprocessImage(imageBuffer);

        // Get greyscale buffer for text-avoidance pixel analysis
        const { data: grayData } = await sharp(imageBuffer)
            .resize(targetWidth, targetHeight, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const inputName = session.inputNames[0] || 'images';
        const results = await session.run({ [inputName]: inputTensor });

        const outputName = session.outputNames[0];
        const output = results[outputName];
        if (!output || !output.data) return null;

        const [batch, channels, numBoxes] = output.dims;
        const data = output.data;
        const candidates = [];

        // YOLOv8 output shape is [1, channels, numBoxes] (e.g. [1, 84, 8400] where 4 are coords + classes)
        const numClasses = channels - 4;
        const scaleX = targetWidth / INPUT_SIZE;
        const scaleY = targetHeight / INPUT_SIZE;

        const gridCols = 40;
        const gridRows = 30;
        const mapCellW = targetWidth / gridCols;
        const mapCellH = targetHeight / gridRows;
        const confidenceMap = Array.from({ length: gridRows }, () => new Float32Array(gridCols));

        for (let i = 0; i < numBoxes; i++) {
            const cx = data[0 * numBoxes + i];
            const cy = data[1 * numBoxes + i];
            const w = data[2 * numBoxes + i];
            const h = data[3 * numBoxes + i];

            // Find maximum class confidence across all class channels
            let maxClassScore = 0;
            for (let c = 0; c < numClasses; c++) {
                const classScore = data[(4 + c) * numBoxes + i];
                if (classScore > maxClassScore) {
                    maxClassScore = classScore;
                }
            }

            // Update spatial confidence map for any prediction with non-zero confidence (> 0.0001)
            if (maxClassScore > 0.0001) {
                const px1 = Math.max(0, (cx - w / 2) * scaleX);
                const py1 = Math.max(0, (cy - h / 2) * scaleY);
                const px2 = Math.min(targetWidth, (cx + w / 2) * scaleX);
                const py2 = Math.min(targetHeight, (cy + h / 2) * scaleY);

                const c1 = Math.max(0, Math.floor(px1 / mapCellW));
                const r1 = Math.max(0, Math.floor(py1 / mapCellH));
                const c2 = Math.min(gridCols - 1, Math.floor(px2 / mapCellW));
                const r2 = Math.min(gridRows - 1, Math.floor(py2 / mapCellH));

                for (let r = r1; r <= r2; r++) {
                    for (let c = c1; c <= c2; c++) {
                        if (maxClassScore > confidenceMap[r][c]) {
                            confidenceMap[r][c] = maxClassScore;
                        }
                    }
                }
            }

            if (maxClassScore >= CONF_THRESHOLD) {
                const rawX1 = Math.max(0, (cx - w / 2) * scaleX);
                const rawY1 = Math.max(0, (cy - h / 2) * scaleY);
                const rawX2 = Math.min(targetWidth, (cx + w / 2) * scaleX);
                const rawY2 = Math.min(targetHeight, (cy + h / 2) * scaleY);

                const rawW = rawX2 - rawX1;
                const rawH = rawY2 - rawY1;

                // Enforce min-width and min-height (like CSS min-width / min-height) instead of discarding
                const finalW = Math.max(rawW, MIN_BOX_WIDTH);
                const finalH = Math.max(rawH, MIN_BOX_HEIGHT);

                const centerNormX = (rawX1 + rawX2) / 2;
                const centerNormY = (rawY1 + rawY2) / 2;

                const adjX1 = Math.max(0, Math.min(targetWidth - finalW, centerNormX - finalW / 2));
                const adjY1 = Math.max(0, Math.min(targetHeight - finalH, centerNormY - finalH / 2));
                const adjX2 = Math.min(targetWidth, adjX1 + finalW);
                const adjY2 = Math.min(targetHeight, adjY1 + finalH);

                const startX = Math.floor(adjX1);
                const startY = Math.floor(adjY1);
                const cellW = Math.floor(adjX2 - adjX1);
                const cellH = Math.floor(adjY2 - adjY1);

                const x1 = adjX1;
                const y1 = adjY1;
                const x2 = adjX2;
                const y2 = adjY2;

                const yOffset = calculateTextAvoidanceOffset(
                    grayData,
                    targetWidth,
                    targetHeight,
                    startX,
                    startY,
                    cellW,
                    cellH
                );

                candidates.push({
                    x1,
                    y1,
                    x2,
                    y2,
                    startX,
                    startY,
                    cellW,
                    cellH,
                    cx: Math.floor(startX + cellW / 2),
                    cy: Math.floor(startY + cellH / 2),
                    score: maxClassScore,
                    yOffset
                });
            }
        }

        const filtered = applyNMS(candidates, IOU_THRESHOLD);
        if (!filtered || filtered.length === 0) return null;

        // Attach confidence map and lookup helper
        filtered.confidenceMap = confidenceMap;
        filtered.getModelConfidence = (x, y, w, h) => {
            const c1 = Math.max(0, Math.floor(x / mapCellW));
            const r1 = Math.max(0, Math.floor(y / mapCellH));
            const c2 = Math.min(gridCols - 1, Math.floor((x + w) / mapCellW));
            const r2 = Math.min(gridRows - 1, Math.floor((y + h) / mapCellH));
            let maxConf = 0;
            for (let r = r1; r <= r2; r++) {
                for (let c = c1; c <= c2; c++) {
                    if (confidenceMap[r][c] > maxConf) maxConf = confidenceMap[r][c];
                }
            }
            return maxConf;
        };

        // Sort top-to-bottom, left-to-right for consistent badge numbering
        filtered.sort((a, b) => {
            if (Math.abs(a.startY - b.startY) > 20) {
                return a.startY - b.startY;
            }
            return a.startX - b.startX;
        });

        filtered.forEach((box, index) => {
            box.badgeId = index + 1;
        });

        return filtered;
    } catch (err) {
        console.error('[FluxFlow] detectUIBoxesONNX Error:', err);
        return null;
    }
}
