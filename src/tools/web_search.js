import puppeteer from 'puppeteer';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from '../utils/paths.js';

/**
 * Advanced Web Search Tool (Puppeteer Powered)
 * Uses a full Chromium instance for JS-heavy rendering and stealth.
 */
export const web_search = async (argsString) => {
    const { query, limit = 10 } = parseArgs(argsString);
    if (!query) return 'ERROR: Missing "query" argument for web_search.';

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

            // 4. Navigate to DDG
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 180000 });

            // 5. Extract Results using DOM Selection
            const results = await page.$$eval('.result', (elements, maxLimit) => {
                return elements.slice(0, maxLimit).map((el, i) => {
                    const titleEl = el.querySelector('.result__a');
                    const snippetEl = el.querySelector('.result__snippet');

                    let url = titleEl ? titleEl.href : '';
                    if (url.includes('uddg=')) {
                        url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                    }

                    const title = titleEl ? titleEl.innerText.trim() : 'No Title';
                    const snippet = snippetEl ? snippetEl.innerText.trim() : 'No Snippet';

                    return `${i + 1}. ${title}\nSource: ${url}\nSnippet: ${snippet}`;
                });
            }, limit);

            if (results.length === 0) {
                const bodyText = await page.evaluate(() => document.body.innerText);
                if (bodyText.includes('anomaly')) {
                    throw new Error("ANOMALY_DETECTED");
                }
                await browser.close();
                return `No results found for query: [${query}].`;
            }

            const finalResults = results.join('\n\n');

            // Log for audit
            const toolLogDir = path.join(LOGS_DIR, 'tools');
            if (!fs.existsSync(toolLogDir)) fs.mkdirSync(toolLogDir, { recursive: true });
            fs.appendFileSync(path.join(toolLogDir, 'search-results.log'), `SEARCH ${new Date().toLocaleString()} - Query: [${query}]. Count: ${results.length}.\nContent:\n${finalResults}\n\n--------------------------------------------------------\n\n\n`);

            // fs.writeFileSync('search.txt', finalResults);
            await browser.close();
            return `Search results for [${query}]:\n\n${finalResults}`;

        } catch (err) {
            lastError = err;
            if (browser) await browser.close();

            if (attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Search failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
};
