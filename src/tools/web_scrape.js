import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from '../utils/paths.js';

import * as cuimp from 'cuimp';

/**
 * Advanced Web Scraping Tool with Cuimp Stealth
 */
export const web_scrape = async (args) => {
    const urlMatch = args.match(/url\s*=\s*["'](.*)["']/);
    const url = urlMatch ? urlMatch[1] : args;

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 1. Chameleon Strategy: Rotate User-Agents
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
            ];
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // 2. Random jitter delay
            const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
            await new Promise(r => setTimeout(r, jitter));

            const response = await cuimp.get(url, {
                headers: {
                    'User-Agent': randomUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                }
            });

            let html = response.data;
            if (!html) throw new Error("EMPTY_RESPONSE");

            // 1. Strip useless tags
            html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
            html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
            html = html.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
            html = html.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
            html = html.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

            // 2. Extract visible text only
            let text = html
                .replace(/<[^>]+>/g, ' ') // Strip remaining tags
                .replace(/\s+/g, ' ')      // Clean up whitespace
                .trim();

            // 3. Limit size to 20,000 chars to avoid context overflow
            const finalContent = text.substring(0, 20000);

            // Add general logging
            const toolLogDir = path.join(LOGS_DIR, 'tools');
            if (!fs.existsSync(toolLogDir)) fs.mkdirSync(toolLogDir, { recursive: true });
            fs.appendFileSync(path.join(toolLogDir, 'search-scraped.log'), `RESULTS ${new Date().toISOString()} - \nURL: [${url}]. Content Length: ${finalContent.length}\n\n`);

            return `CONTENT FROM [${url}]:\n\n${finalContent}${text.length > 20000 ? '\n\n[TRUNCATED AT 20K CHARS]' : ''}`;

        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Scrape failed after ${maxRetries} attempts. Last error: ${lastError.message}`;
};
