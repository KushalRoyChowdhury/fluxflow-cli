import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Post-install health check for the Puppeteer Chrome binary.
 *
 * Catches the two real-world failure modes that surface downstream as an
 * opaque "spawn UNKNOWN" at launch:
 *   1. The pinned Chrome binary is missing entirely  -> Puppeteer says "Could not find Chrome".
 *   2. The binary exists but is a truncated/partial download (tiny file) -> libuv "spawn UNKNOWN".
 *
 * This script NEVER fails the install (always exits 0). It only prints a loud,
 * actionable warning so the problem is visible at `npm install` time instead of
 * during the user's first web search.
 */

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIN_REAL_CHROME_BYTES = 1024 * 1024; // A real Chrome launcher is multi-MB.

function resolvePlatform() {
    const platform = os.platform();
    const arch = os.arch();
    if (platform === 'win32') {
        const pptrPlatform = arch === 'x64' ? 'win64' : 'win32';
        return { pptrPlatform, execName: 'chrome.exe', subDir: `chrome-${pptrPlatform}` };
    }
    if (platform === 'darwin') {
        const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
        return {
            pptrPlatform: arch === 'arm64' ? 'mac_arm' : 'mac',
            execName: 'Google Chrome.app/Contents/MacOS/Google Chrome',
            subDir: `chrome-mac-${archSuffix}`,
        };
    }
    if (platform === 'linux') {
        return { pptrPlatform: 'linux', execName: 'chrome', subDir: 'chrome-linux64' };
    }
    return null;
}

function warn(msg) {
    // eslint-disable-next-line no-console
    console.warn(`\n[fluxflow] \u26A0\uFE0F  Chrome health-check: ${msg}\n`);
}

function main() {
    const plat = resolvePlatform();
    if (!plat) {
        warn(`Unknown platform "${os.platform()}" u2014 skipping browser check.`);
        return;
    }

    let config;
    try {
        config = require(path.join(__dirname, '.puppeteerrc.cjs'));
    } catch {
        warn('Could not read .puppeteerrc.cjs u2014 skipping browser check.');
        return;
    }

    const cacheDir = config.cacheDirectory;
    const version = config.chrome?.version;
    if (!cacheDir || !version) {
        warn('cacheDirectory/version missing in .puppeteerrc.cjs u2014 skipping browser check.');
        return;
    }

    const expectedPath = path.join(
        cacheDir,
        'chrome',
        `${plat.pptrPlatform}-${version}`,
        plat.subDir,
        plat.execName
    );

    let size = 0;
    let exists = false;
    try {
        size = fs.statSync(expectedPath).size;
        exists = true;
    } catch {
        exists = false;
    }

    if (!exists) {
        warn(
            `Expected Chrome ${version} not found at:\n    ${expectedPath}\n` +
            `    Web tools (web_search / web_scrape) will fail until you run:\n` +
            `    \u2192  npx puppeteer browsers install chrome@${version}`
        );
        return;
    }

    if (size < MIN_REAL_CHROME_BYTES) {
        warn(
            `Chrome binary looks TRUNCATED (only ${size} bytes, expected > 1 MB):\n` +
            `    ${expectedPath}\n` +
            `    This causes an opaque "spawn UNKNOWN" at launch. Fix with:\n` +
            `    \u2192  npx puppeteer browsers install chrome@${version}`
        );
        return;
    }

    // eslint-disable-next-line no-console
    console.log(`[fluxflow] \u2705 Chrome ${version} health-check passed (${(size / 1048576).toFixed(1)} MB).`);
}

try {
    main();
} catch (e) {
    // Never break install.
    warn(`Unexpected error during health-check: ${e?.message || e}`);
}
process.exitCode = 0;
