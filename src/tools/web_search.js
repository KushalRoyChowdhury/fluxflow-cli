import * as cuimp from 'cuimp';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_ROOT = path.join(__dirname, '../../');

/**
 * Direct HTML Search Tool (DuckDuckGo HTML)
 * No dependencies required.
 */
export const web_search = async (argsString) => {
    const { query, limit = 10 } = parseArgs(argsString);
    if (!query) return 'ERROR: Missing "query" argument for web_search.';

    try {
        // 1. Brief random delay to avoid burst patterns
        await new Promise(r => setTimeout(r, Math.random() * 1000 + 500));

        const response = await cuimp.get(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
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
            // Fix DDG redirect if present
            if (url.includes('uddg=')) {
                url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
            }

            const title = match[2].replace(/<[^>]*>/g, '').trim();
            const snippet = match[3].replace(/<[^>]*>/g, '').trim();

            results.push(`${count+1}. ${title}\nSource: ${url}\nSnippet: ${snippet}`);
            count++;
        }
        // Add general logging of results to /logs/tools/results.log
        const toolLogDir = path.join(AGENT_ROOT, 'logs', 'tools');
        if (!fs.existsSync(toolLogDir)) {
            fs.mkdirSync(toolLogDir, { recursive: true });
        }
        fs.appendFileSync(path.join(toolLogDir, 'search-results.log'), `RESULTS ${new Date().toISOString()} - \nQuery: [${query}]. Results Count: ${results.length}.\nResults: ${results}\n\n\n`);


        if (results.length === 0) {
            if (html.includes('anomaly')) {
                const toolErrDir = path.join(AGENT_ROOT, 'logs', 'tools');
                if (!fs.existsSync(toolErrDir)) {
                    fs.mkdirSync(toolErrDir, { recursive: true });
                }
                fs.appendFileSync(path.join(toolErrDir, 'error.log'), `ERROR ${new Date().toISOString()} - DDG detected unusual activity. Cuimp impersonation might need adjustment.\n`);
                throw new Error("DDG detected unusual activity. Cuimp impersonation might need adjustment.");
            }
            return `No results found for query: [${query}].`;
        }

        const finalResults = results.join('\n\n');
        return `Search results for [${query}]:\n\n${finalResults}`;

    } catch (err) {
        return `ERROR: Stealth Search failed. ${err.message}`;
    }
};
