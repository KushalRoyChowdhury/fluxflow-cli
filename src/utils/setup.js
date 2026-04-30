import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Ensures that Puppeteer has its Chromium browser installed.
 * Returns true if already present, false if it needs installation.
 */
export const checkPuppeteerReady = () => {
    try {
        const exePath = puppeteer.executablePath();
        const exists = exePath && fs.existsSync(exePath);
        // console.log(`[DEBUG] Puppeteer checking: ${exePath} | Exists: ${exists}`);
        if (exists) return true;
    } catch (e) {
        return false;
    }
    return false;
};

/**
 * Automates the installation of the required Chromium browser.
 */
export const installPuppeteerBrowser = async (onStatus) => {
    if (onStatus) onStatus('📥 Downloading Chromium engine (Wait a moment)...');
    try {
        // Attempt pnpm exec first, fallback to npx if it fails
        try {
            await execAsync('pnpm exec puppeteer browsers install chrome');
        } catch (pnpmErr) {
            await execAsync('npx -y puppeteer browsers install chrome');
        }
        
        // Brief delay to allow file system to settle
        await new Promise(r => setTimeout(r, 1000));
        
        return { success: true };
    } catch (err) {
        console.error('[SETUP ERROR]', err);
        return { success: false, error: err.message };
    }
};
