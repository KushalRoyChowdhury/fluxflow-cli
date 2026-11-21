import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { getPuppeteerConfig } from './puppeteer_helper.js';

const execAsync = promisify(exec);

/**
 * Ensures that Puppeteer has its Chromium browser installed.
 * Returns true if already present, false if it needs installation.
 */
export const checkPuppeteerReady = async () => {
    try {
        const pptrConfig = getPuppeteerConfig();
        if (pptrConfig.executablePath && fs.existsSync(pptrConfig.executablePath)) {
            return true;
        }
        // Lazy-load puppeteer only when the config-based lookup cannot resolve a path.
        const { default: puppeteer } = await import('puppeteer');
        const exePath = await puppeteer.executablePath();
        const exists = exePath && fs.existsSync(exePath);
        // console.log(`[DEBUG] Puppeteer checking: ${exePath} | Exists: ${exists}`);
        if (exists) return true;
    } catch (e) {
        return false;
    }
    return false;
};

export const CHROME_PINNED_VERSION = '158.0.8127.36';

/**
 * Automates the installation of the required Chromium browser (Version 148.0.7778.178).
 */
export const installPuppeteerBrowser = async (onStatus) => {
    if (onStatus) onStatus(`📥 Downloading Chromium engine (chrome@${CHROME_PINNED_VERSION})...`);
    try {
        // Attempt pnpm exec first, fallback to npx if it fails
        try {
            await execAsync(`pnpm exec puppeteer browsers install chrome@${CHROME_PINNED_VERSION}`);
        } catch (pnpmErr) {
            await execAsync(`npx -y puppeteer browsers install chrome@${CHROME_PINNED_VERSION}`);
        }

        // Brief delay to allow file system to settle
        await new Promise(r => setTimeout(r, 1000));

        return { success: true };
    } catch (err) {
        console.error('[SETUP ERROR]', err);
        return { success: false, error: err.message };
    }
};
