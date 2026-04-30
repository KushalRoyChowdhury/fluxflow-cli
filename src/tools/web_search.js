import * as cuimp from 'cuimp';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from '../utils/paths.js';

/**
 * Direct HTML Search Tool (DuckDuckGo HTML)
 * No dependencies required.
 */
export const web_search = async (argsString) => {
    const { query, limit = 10 } = parseArgs(argsString);
    if (!query) return 'ERROR: Missing "query" argument for web_search.';

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 1. Chameleon Strategy: Rotate User-Agents to avoid anomaly detection
            const userAgents = [
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0'
            ];
            const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // 2. Random jitter delay (Increased on retries)
            const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
            await new Promise(r => setTimeout(r, jitter));

            const response = await cuimp.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': randomUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://duckduckgo.com/',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'max-age=0'
                }
            });

            const html = response.data;

            // Detailed regex for DDG HTML result structure
            const results = [];
            const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

            let match;
            let count = 0;
            while ((match = resultRegex.exec(html)) !== null && count < limit) {
                let url = match[1];
                if (url.includes('uddg=')) {
                    url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                }

                const title = match[2].replace(/<[^>]*>/g, '').trim();
                const snippet = match[3].replace(/<[^>]*>/g, '').trim();

                results.push(`${count + 1}. ${title}\nSource: ${url}\nSnippet: ${snippet}`);
                count++;
            }

            if (results.length === 0) {
                if (html.includes('anomaly')) {
                    throw new Error("DDG_ANOMALY_DETECTED");
                }
                return `No results found for query: [${query}].`;
            }

            const finalResults = results.join('\n\n');
            return `Search results for [${query}]:\n\n${finalResults}`;

        } catch (err) {
            lastError = err;
            const toolErrDir = path.join(LOGS_DIR, 'tools');
            if (!fs.existsSync(toolErrDir)) fs.mkdirSync(toolErrDir, { recursive: true });
            fs.appendFileSync(path.join(toolErrDir, 'error.log'), `ERROR ${new Date().toISOString()} - Attempt ${attempt}/${maxRetries} failed: ${err.message}\n`);

            if (attempt < maxRetries) {
                // Exponential Backoff: 2s, 4s, 8s...
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Search failed after ${maxRetries} attempts. Last error: ${lastError.message}`;
};
