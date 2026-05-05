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
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            // 3. Jitter Delay
            const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
            await new Promise(r => setTimeout(r, jitter));

            // 4. Navigate and Wait for Hydration
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

            // 5. Deep Hydration Delay: Wait an additional 5s flat before reading data
            await new Promise(r => setTimeout(r, 5000));

            // 6. Deep Semantic Extraction: High-signal HTML
            let htmlContent = await page.evaluate(() => {
                // 1. Remove absolute junk (Keeping buttons for CTAs, but removing images as they are token-heavy)
                const junk = document.querySelectorAll('script, style, nav, footer, header, noscript, svg, canvas, iframe, ad, .ads, link, meta, img');
                junk.forEach(el => el.remove());

                // 2. Strip comments
                const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT);
                let currentNode;
                while (currentNode = iterator.nextNode()) {
                    currentNode.remove();
                }

                // 3. Process all elements
                const allElements = document.querySelectorAll('*');
                allElements.forEach(el => {
                    // Strip all attributes except 'href' and 'src'
                    const attributes = el.attributes;
                    for (let i = attributes.length - 1; i >= 0; i--) {
                        const attrName = attributes[i].name;
                        if (attrName !== 'href' && attrName !== 'src') {
                            el.removeAttribute(attrName);
                        }
                    }

                    // Flatten spans and other non-semantic wrappers that now have no attributes
                    if ((el.tagName === 'SPAN' || el.tagName === 'DIV' || el.tagName === 'SECTION') && el.attributes.length === 0) {
                        // If it's a small wrapper, we can often flatten it
                        if (el.tagName === 'SPAN' || (el.tagName === 'DIV' && el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE)) {
                             el.replaceWith(...el.childNodes);
                        }
                    }
                });

                // 4. Prune empty elements (except br)
                const pruneEmpty = () => {
                    let found = false;
                    document.querySelectorAll('*:not(br)').forEach(el => {
                        if (el.childNodes.length === 0 && !el.innerText.trim()) {
                            el.remove();
                            found = true;
                        }
                    });
                    if (found) pruneEmpty(); // Recursive prune
                };
                pruneEmpty();

                return document.body.innerHTML;
            });

            if (!htmlContent) throw new Error("EMPTY_RENDER_RESULT");

            // 7. Clean and Truncate HTML
            const cleanedHtml = htmlContent
                .replace(/\s+/g, ' ')      // Collapse whitespace
                .replace(/>\s+</g, '><')   // Remove space between tags
                .trim()
                .substring(0, 30000);     // Increased limit for rich HTML context

            // Log for audit
            const toolLogDir = path.join(LOGS_DIR, 'tools');
            if (!fs.existsSync(toolLogDir)) fs.mkdirSync(toolLogDir, { recursive: true });
            fs.appendFileSync(path.join(toolLogDir, 'search-scraped.log'), `PUPPETEER ${new Date().toLocaleString()} - URL: [${url}]. Length: ${cleanedHtml.length}.\n Content:\n${cleanedHtml}${htmlContent.length > 30000 ? '\n\n[TRUNCATED AT 30K CHARS]' : ''}\n\n--------------------------------------------------------\n\n\n`);

            await browser.close();
            // fs.writeFileSync('scraped.html', cleanedHtml);
            return `CLEANED HTML FROM [${url}]:\n\n${cleanedHtml}${htmlContent.length > 30000 ? '\n\n[TRUNCATED AT 30K CHARS]' : ''}`;

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
