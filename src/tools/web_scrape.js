import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import TurndownService from 'turndown';
import { LOGS_DIR } from '../utils/paths.js';
import { getPuppeteerConfig } from '../utils/puppeteer_helper.js';

/**
 * Advanced Web Scraping Tool (Puppeteer Powered)
 * Uses a full Chromium instance to handle JS-heavy pages and single-page apps.
 */
export const web_scrape = async (args) => {
    let rawUrl = args;
    if (typeof args === 'object' && args !== null) {
        rawUrl = args.url || args.targetUrl || args.href || '';
    } else if (typeof args === 'string') {
        const urlMatch = args.match(/url\s*=\s*["'](.*)["']/);
        rawUrl = urlMatch ? urlMatch[1] : args;
    }

    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!url) {
        return "ERROR: No target URL provided.";
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;
        try {
            // 1. Launch Browser with stealth args and custom/resolved executablePath
            const pptrConfig = getPuppeteerConfig();
            browser = await puppeteer.launch({
                headless: true,
                executablePath: pptrConfig.executablePath || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-gpu',
                    '--disable-dev-shm-usage'
                ]
            });

            const page = await browser.newPage();

            // 2. Set Realistic Identity
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.178 Safari/537.36');
            await page.setViewport({ width: 1366, height: 768 });

            // 3. Jitter Delay
            const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
            await new Promise(r => setTimeout(r, jitter));

            // 4. Navigate and Wait for Hydration
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 180000 });

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
                });

                // Unwrap all <div> and <span> tags entirely
                while (document.querySelector('div, span')) {
                    document.querySelectorAll('div, span').forEach(el => {
                        if (el.parentNode) {
                            el.replaceWith(...el.childNodes);
                        }
                    });
                }

                // Replace <br> elements with \n\n text nodes
                document.querySelectorAll('br').forEach(br => {
                    br.replaceWith(document.createTextNode('\n\n'));
                });

                // 4. Prune empty elements
                const pruneEmpty = () => {
                    let found = false;
                    document.querySelectorAll('*').forEach(el => {
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

            // 7. Clean and Convert HTML to Markdown
            const cleanedHtml = htmlContent
                .replace(/<br\s*\/?>/gi, '\n\n')
                .replace(/[ \t]+/g, ' ')      // Collapse horizontal whitespace
                .replace(/>[ \t]+</g, '><')   // Remove space between tags
                .replace(/\n\s+/g, '\n')      // Clean whitespace after newlines
                .replace(/\n{3,}/g, '\n\n')   // Limit consecutive newlines to double newline
                .trim();

            const turndownService = new TurndownService({
                headingStyle: 'atx',
                codeBlockStyle: 'fenced'
            });
            const rawMarkdown = turndownService.turndown(cleanedHtml)
                .replace(/\.\s*\n/g, '\n')
                .replace(/ +/g, ' ')
                .replace(/\t/g, '  ')
                .replace(/\n\s+/g, '\n')
                .replace(/\n{3,}/g, '\n\n');
            const markdown = rawMarkdown.substring(0, 50000);

            await browser.close();
            // fs.writeFileSync('scraped.md', `Markdown parsed from [${url}]:\n\n${markdown}${rawMarkdown.length > 50000 ? '\n\n[TRUNCATED AT 50K CHARS]' : ''}`);
            return `Markdown parsed from [${url}]:\n\n${markdown}${rawMarkdown.length > 50000 ? '\n\n[TRUNCATED AT 50K CHARS]' : ''}`;

        } catch (err) {
            lastError = err;
            if (browser) await browser.close();
            fs.writeFileSync(path.join(LOGS_DIR, "web_tools", "scrape", "standard_mode", "ERROR.txt"), err.message);
            if (attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Scrape failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
};
