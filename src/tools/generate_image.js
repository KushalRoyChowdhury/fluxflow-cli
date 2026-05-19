import fs from 'fs-extra';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { loadSettings } from '../utils/settings.js';
import { checkImageQuota, recordImageGeneration } from '../utils/usage.js';

/**
 * Injects custom metadata chunks into a PNG buffer.
 */
const injectPngMetadata = (buffer, metadata = {}) => {
    try {
        if (buffer.length < 8 || buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
            return buffer; // Not a PNG
        }

        const chunksToInject = [];

        // CRC-32 table
        const crcTable = [];
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) {
                if (c & 1) {
                    c = 0xedb88320 ^ (c >>> 1);
                } else {
                    c = c >>> 1;
                }
            }
            crcTable[n] = c;
        }

        const calculateCrc = (buf) => {
            let crc = 0xffffffff;
            for (let i = 0; i < buf.length; i++) {
                crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
            }
            return (crc ^ 0xffffffff) >>> 0;
        };

        const createTextChunk = (keyword, text) => {
            const keywordBuf = Buffer.from(keyword, 'ascii');
            const textBuf = Buffer.from(text, 'utf-8');
            const dataLength = keywordBuf.length + 1 + textBuf.length;
            const chunkBuf = Buffer.alloc(4 + 4 + dataLength + 4);

            chunkBuf.writeUInt32BE(dataLength, 0);
            chunkBuf.write('tEXt', 4, 'ascii');
            keywordBuf.copy(chunkBuf, 8);
            chunkBuf[8 + keywordBuf.length] = 0;
            textBuf.copy(chunkBuf, 8 + keywordBuf.length + 1);

            const crcValue = calculateCrc(chunkBuf.subarray(4, 8 + dataLength));
            chunkBuf.writeUInt32BE(crcValue, 8 + dataLength);

            return chunkBuf;
        };

        for (const [key, val] of Object.entries(metadata)) {
            if (val !== undefined && val !== null) {
                chunksToInject.push(createTextChunk(key, String(val)));
            }
        }

        if (chunksToInject.length === 0) return buffer;

        if (buffer.subarray(12, 16).toString('ascii') === 'IHDR') {
            const headerEnd = 33; // 8 byte sig + 4 length + 4 type + 13 data + 4 CRC
            const before = buffer.subarray(0, headerEnd);
            const after = buffer.subarray(headerEnd);
            return Buffer.concat([before, ...chunksToInject, after]);
        }
        return buffer;
    } catch (e) {
        return buffer; // Safe fallback
    }
};

/**
 * Image Generation Tool using Pollinations API
 * Generates an image based on the provided prompt and active quality/key settings.
 */
export const generate_image = async (args) => {
    const parsed = parseArgs(args);
    const prompt = parsed.prompt || parsed.text;
    const outputPath = parsed.path || parsed.outputPath || parsed.output || 'generated_image.png';
    const ratio = parsed.ratio;

    if (!prompt) {
        return 'ERROR: Missing "prompt" argument for generate_image.';
    }

    try {
        // 1. Load active system settings
        const settings = await loadSettings();

        // 2. Perform image hourly quota check
        const hasQuota = await checkImageQuota(settings);
        if (!hasQuota) {
            return 'ERROR: Insufficient Quota for selected quality. Either reduce quality for wait for next refresh cycle.';
        }

        // 3. Resolve key and strategy
        const imageSettings = settings.imageSettings || { keyType: 'Default', quality: 'Low-High', apiKey: '' };
        const apiKey = imageSettings.keyType === 'Custom' && imageSettings.apiKey
            ? imageSettings.apiKey
            : 'pk_5i7Doib5fATyAN4i'; // Public key fallback

        // Resolve model based on quality settings
        const qualityMap = {
            'Low': 'flux',
            'Low-High': 'zimage',
            'Medium': 'gptimage',
            'Medium-High': 'gptimage',
            'High': 'qwen-image',
            'Ultra': 'gptimage-large',
            'Premium': 'nanobanana-pro'
        };
        const selectedModel = qualityMap[imageSettings.quality] || 'zimage';

        // Determine aspect ratio dimensions
        let width = 1024;
        let height = 1024;
        if (ratio) {
            const cleanRatio = ratio.replace(/\s+/g, '');
            if (cleanRatio === '16:9') {
                width = 1024;
                height = 576;
            } else if (cleanRatio === '9:16') {
                width = 576;
                height = 1024;
            } else if (cleanRatio === '4:3') {
                width = 1024;
                height = 768;
            } else if (cleanRatio === '3:4') {
                width = 768;
                height = 1024;
            } else if (cleanRatio === '1:1') {
                width = 1024;
                height = 1024;
            }
        }

        // 4. Construct URL and send request
        const seed = Math.floor(Math.random() * 10000000);
        const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=${selectedModel}&width=${width}&height=${height}&seed=${seed}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        // 5. Handle response status & errors
        if (!response.ok) {
            const status = response.status;
            let errorText = '';
            try {
                errorText = await response.text();
            } catch (e) { }

            // Check specifically for payment required / insufficient balance
            if (status === 402 || errorText.includes('Insufficient balance') || errorText.includes('PAYMENT_REQUIRED')) {
                return 'ERROR: Image Generation Currently unavailable. Try again later.';
            }

            return `ERROR: Image Generation failed with status [${status}]: ${errorText || 'Unknown API Error'}`;
        }

        // Check if response is JSON (error fallback)
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const json = await response.json();
            if (json.status === 402 || (json.error && json.error.code === 'PAYMENT_REQUIRED')) {
                return 'ERROR: Image Generation Currently unavailable. Try again later.';
            }
            return `ERROR: Image Generation failed: ${json.error?.message || JSON.stringify(json)}`;
        }

        // 6. Save binary image payload to output file with custom PNG metadata
        const buffer = await response.arrayBuffer();
        let finalBuffer = Buffer.from(buffer);

        const metadata = {
            'Title': prompt,
            'Description': 'Generated via FluxFlow CLI',
            'Software': 'FluxFlow CLI',
            'Author': 'FluxFlow',
            'Creation Time': new Date().toISOString(),
            'Prompt': prompt,
            'Model': `Fluxflow:${selectedModel}`,
            'Ratio': ratio || '1:1',
            'Seed': String(seed)
        };
        finalBuffer = injectPngMetadata(finalBuffer, metadata);

        const absolutePath = path.resolve(process.cwd(), outputPath);
        await fs.ensureDir(path.dirname(absolutePath));
        await fs.writeFile(absolutePath, finalBuffer);

        // 7. Update usage logs with successful transaction cost
        await recordImageGeneration(settings);

        return `SUCCESS: Image successfully generated from prompt [${prompt}] and saved to [${outputPath}] with custom embedded metadata.`;
    } catch (err) {
        return `ERROR: Failed during image generation: ${err.message}`;
    }
};
