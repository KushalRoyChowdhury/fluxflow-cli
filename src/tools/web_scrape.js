import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from '../utils/paths.js';

/**
 * Advanced Web Scraping Tool (Puppeteer Powered)
 * Uses a full Chromium instance to handle JS-heavy pages and single-page apps.
 */
export const web_scrape = async (args) => {
    const urlMatch = args.match(/url\s*=\s*["'](.*)["']/);
    const url = urlMatch ? urlMatch[1] : args;

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;
        try {
            // 1. Launch Browser with stealth args
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

            // 2. Set Realistic Identity
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 1600 });

            // 3. Jitter Delay
            const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
            await new Promise(r => setTimeout(r, jitter));

            // 4. Navigate and Wait for Hydration
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            // 5. Deep Hydration Delay: Wait an additional 5s flat before reading data
            await new Promise(r => setTimeout(r, 5000));

            // 6. Extract Rendered Text with Link Preservation
            let text = await page.evaluate(() => {
                // Remove non-content elements
                const junk = document.querySelectorAll('script, style, nav, footer, header, noscript');
                junk.forEach(el => el.remove());

                // Transform links into readable markdown-like format
                const links = document.querySelectorAll('a');
                links.forEach(a => {
                    const href = a.href;
                    const content = a.innerText.trim();
                    // Only transform meaningful, absolute links
                    if (href && content && !href.startsWith('javascript:') && !href.startsWith('#')) {
                        a.innerText = ` [${content}](${href}) `;
                    }
                });

                return document.body.innerText;
            });

            if (!text) throw new Error("EMPTY_RENDER_RESULT");

            // 6. Clean and Truncate
            const cleanedText = text
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 25000); // Increased limit due to higher fidelity

            // Log for audit
            const toolLogDir = path.join(LOGS_DIR, 'tools');
            if (!fs.existsSync(toolLogDir)) fs.mkdirSync(toolLogDir, { recursive: true });
            fs.appendFileSync(path.join(toolLogDir, 'search-scraped.log'), `PUPPETEER ${new Date().toISOString()} - URL: [${url}]. Length: ${cleanedText.length}.\n Content:\n${cleanedText}\n\n--------------------------------------------------------\n\n\n`);

            await browser.close();
            // fs.writeFileSync('scraped.txt', cleanedText);
            return `CONTENT FROM [${url}]:\n\n${cleanedText}${text.length > 25000 ? '\n\n[TRUNCATED AT 25K CHARS]' : ''}`;

        } catch (err) {
            lastError = err;
            if (browser) await browser.close();

            if (attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Scrape failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
};
