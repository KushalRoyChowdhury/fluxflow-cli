import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Write PDF Tool (Stable Puppeteer Version)
 * Uses bundled Chromium for 100% consistent rendering across all platforms.
 */
export const write_pdf = async (args) => {
    const { path: targetPath, content, orientation = 'portrait', margin = '10px' } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_pdf.';
    if (!content) return 'ERROR: Missing "content" (HTML/CSS) for write_pdf.';

    const absolutePath = path.resolve(process.cwd(), targetPath);
    let browser = null;

    try {
        // Ensure directory exists
        await fs.ensureDir(path.dirname(absolutePath));

        // Launch the bundled Chromium
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-gpu', 
                '--disable-dev-shm-usage'
            ]
        });

        const page = await browser.newPage();

        // Inject global print styles to ensure multi-page consistency
        const styledContent = `
            <style>
                @page { 
                    margin: ${margin}; 
                }
                body { 
                    margin: 0; 
                    padding: 0;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                * { box-sizing: border-box; }
            </style>
            ${content}
        `;

        // Set HTML content
        await page.setContent(styledContent, { waitUntil: 'networkidle0' });

        // Generate PDF
        await page.pdf({
            path: absolutePath,
            format: 'A4',
            landscape: orientation.toLowerCase() === 'landscape',
            margin: {
                top: margin,
                right: margin,
                bottom: '15mm', // Space for watermark
                left: margin
            },
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate: `
                <div style="font-size: 9px; color: rgba(0,0,0,0.2); width: 100%; text-align: right; padding-right: 15mm; font-family: system-ui, sans-serif; -webkit-print-color-adjust: exact;">
                    FluxFlow CLI
                </div>
            `,
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
