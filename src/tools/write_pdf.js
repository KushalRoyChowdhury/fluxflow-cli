import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs-extra';
import { parseArgs } from '../utils/arg_parser.js';
import { FLUXFLOW_DIR } from '../utils/paths.js';

/**
 * Write PDF Tool (Optimized Single-Launch Version)
 * Uses chrome-launcher to SCOUT the path, then puppeteer-core to DRIVE the render.
 */
export const write_pdf = async (args) => {
    const { path: targetPath, content, orientation = 'portrait', margin = '10px' } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_pdf.';
    if (!content) return 'ERROR: Missing "content" (HTML/CSS) for write_pdf.';

    const absolutePath = path.resolve(process.cwd(), targetPath);
    let browser = null;

    try {
        // Ensure directories exist
        await fs.ensureDir(path.dirname(absolutePath));
        const chromeProfileDir = path.join(FLUXFLOW_DIR, 'chrome-profile');
        await fs.ensureDir(chromeProfileDir);

        // 1. Scout for the system browser path
        const installations = Launcher.getInstallations();
        let chromePath = installations[0];

        // Fallback to Brave if no Chrome/Edge found
        if (!chromePath) {
            const commonBravePaths = [
                'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                'C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
                '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
                '/usr/bin/brave-browser'
            ];
            for (const bPath of commonBravePaths) {
                if (await fs.exists(bPath)) {
                    chromePath = bPath;
                    break;
                }
            }
        }

        // Fallback to Firefox if still nothing
        let isFirefox = false;
        if (!chromePath) {
            const commonFirefoxPaths = [
                'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
                '/Applications/Firefox.app/Contents/MacOS/firefox',
                '/usr/bin/firefox'
            ];
            for (const fPath of commonFirefoxPaths) {
                if (await fs.exists(fPath)) {
                    chromePath = fPath;
                    isFirefox = true;
                    break;
                }
            }
        }

        if (!chromePath) {
            return 'ERROR: No compatible browser (Chrome, Edge, Brave, or Firefox) found on this system. One is required for PDF Generation.';
        }

        // 2. Launch a SINGLE instance via Puppeteer
        browser = await puppeteer.launch({
            executablePath: chromePath,
            product: isFirefox ? 'firefox' : 'chrome',
            userDataDir: chromeProfileDir,
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();

        // Set HTML content
        await page.setContent(content, { waitUntil: 'networkidle0' });

        // Generate PDF
        await page.pdf({
            path: absolutePath,
            format: 'A4',
            landscape: orientation.toLowerCase() === 'landscape',
            margin: {
                top: margin,
                right: margin,
                bottom: margin,
                left: margin
            },
            printBackground: true
        });

        const stats = await fs.stat(absolutePath);
        return `SUCCESS: PDF generated successfully at [${targetPath}] (${(stats.size / 1024).toFixed(2)} KB).`;
    } catch (err) {
        return `ERROR: Failed to generate PDF [${targetPath}]: ${err.message}`;
    } finally {
        // Cleanup
        if (browser) await browser.close();
    }
};
