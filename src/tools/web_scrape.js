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

    try {
        const response = await cuimp.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        let html = response.data;
        if (!html) throw new Error("No content received from URL.");

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

        // Add general logging of results to /logs/tools/results.log
        const toolLogDir = path.join(LOGS_DIR, 'tools');
        if (!fs.existsSync(toolLogDir)) {
            fs.mkdirSync(toolLogDir, { recursive: true });
        }
        fs.appendFileSync(path.join(toolLogDir, 'search-scraped.log'), `RESULTS ${new Date().toISOString()} - \nQuery: [${url}].\nResults: ${finalContent}\n\n\n`);


        return `CONTENT FROM [${url}]:\n\n${finalContent}${text.length > 20000 ? '\n\n[TRUNCATED AT 20K CHARS]' : ''}`;

    } catch (err) {
        return `ERROR: Failed to read page at ${url}. ${err.message}`;
    }
};
