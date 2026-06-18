import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import { PARSER_DIR } from './paths.js';

export const EXTENSION_TO_WASM = {
    'js': 'tree-sitter-javascript.wasm',
    'jsx': 'tree-sitter-javascript.wasm',
    'ts': 'tree-sitter-typescript.wasm',
    'tsx': 'tree-sitter-tsx.wasm',
    'py': 'tree-sitter-python.wasm',
    'c': 'tree-sitter-c.wasm',
    'cpp': 'tree-sitter-cpp.wasm',
    'java': 'tree-sitter-java.wasm',
    'html': 'tree-sitter-html.wasm'
};

export async function downloadWasm(wasmFile, targetUrl = null) {
    const url = targetUrl || `https://unpkg.com/tree-sitter-wasms@0.1.13/out/${wasmFile}`;
    const localPath = path.join(PARSER_DIR, wasmFile);

    // Ensure the parsers directory exists
    await fs.ensureDir(PARSER_DIR);

    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'FluxFlow-Agent'
            }
        };

        https.get(url, options, (response) => {
            // Handle Redirects (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
                let nextUrl = response.headers.location;
                if (!nextUrl.startsWith('http')) {
                    const parsedUrl = new URL(url);
                    nextUrl = `${parsedUrl.protocol}//${parsedUrl.host}${nextUrl}`;
                }
                downloadWasm(wasmFile, nextUrl).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${wasmFile}: HTTP ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(localPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            if (fs.existsSync(localPath)) fs.unlink(localPath, () => { });
            reject(err);
        });
    });
}

export function isParserInstalled(wasmFile) {
    const localPath = path.join(PARSER_DIR, wasmFile);
    return fs.existsSync(localPath);
}

export async function deleteParser(wasmFile) {
    const localPath = path.join(PARSER_DIR, wasmFile);
    if (fs.existsSync(localPath)) {
        await fs.unlink(localPath);
    }
}
