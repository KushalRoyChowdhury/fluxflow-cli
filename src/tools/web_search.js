import puppeteer from 'puppeteer';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';
import path from 'path';
import { LOGS_DIR } from '../utils/paths.js';
import { getPuppeteerConfig } from '../utils/puppeteer_helper.js';

/**
 * Advanced Web Search Tool (Puppeteer Powered)
 * Uses a full Chromium instance for JS-heavy rendering and stealth.
 */
export const web_search = async (argsString) => {
    const { query, limit = 10, aiMode = false } = parseArgs(argsString);
    if (!query) return 'ERROR: Missing "query" argument for web_search.';

    const maxRetries = 3;
    let lastError = null;

    if (aiMode) {
        const aiPrompt = `Query: ${query}

RESPONSE RULES:
- ANSWER CONCISELY WITH REQUIRED DETAILS UNDER 300 WORDS.
- DO NOT CITE, REFERENCE, OR MENTION SOURCES ANYWHERE BETWEEN THE MAIN RESPONSE.
- DO NOT USE MARKDOWN EXCEPT FOR THE SOURCES SECTION BELOW.
- END THE RESPONSE WITH EXACTLY:

Sources:
- <URL 1>
- <URL 2>
- <URL 3>

- LIST ONE RAW URL PER BULLET.
- DO NOT USE MARKDOWN LINKS.
- DO NOT INCLUDE ANY TEXT, NOTES, OR EXPLANATIONS AFTER THE SOURCES SECTION.`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            let browser = null;
            try {
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
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.178 Safari/537.36');
                await page.setViewport({ width: 1366, height: 768 });

                const jitter = attempt === 1 ? Math.random() * 1000 + 500 : Math.random() * 2000 + 1000;
                await new Promise(r => setTimeout(r, jitter));

                const searchUrl = `https://search.brave.com/ask?q=${encodeURIComponent(aiPrompt)}&source=web`;
                // console.log(searchUrl);
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });

                let extractedData = null;
                const maxWaitMs = 45000;
                const startTime = Date.now();

                while (Date.now() - startTime < maxWaitMs) {
                    extractedData = await page.evaluate(() => {
                        const assistantMsgs = Array.from(document.querySelectorAll('.message:not(.user), .answer-text, .llm-content, [data-type="answer"]'));
                        let text = '';
                        if (assistantMsgs.length > 0) {
                            text = assistantMsgs.map(m => m.innerText.trim()).filter(Boolean).join('\n\n');
                        }
                        if (!text) {
                            text = document.body.innerText;
                        }

                        if (text.includes('anomaly')) throw new Error("ANOMALY_DETECTED");

                        // Detect active loading spinners or streaming state in assistant container / page
                        const isStreaming = Boolean(
                            document.querySelector('.spinner, .loading, .typing, .streaming, [data-streaming="true"], [data-state="loading"], svg.animate-spin, circle[cx], div[class*="spin"]')
                        );

                        // Check if assistant container explicitly has Finished status
                        const assistantEl = assistantMsgs[0] || document.body;
                        const assistantText = assistantEl ? assistantEl.innerText.trim() : '';
                        const hasFinishedText = /^(?:[✓✔]\s*)?Finished/i.test(assistantText) ||
                                               Boolean(assistantEl && assistantEl.querySelector('.status-finished, .finished'));

                        // ONLY finished if NOT streaming AND (has finished header OR (contains Sources: and not streaming))
                        const isFinished = !isStreaming && (hasFinishedText || (text.includes('Sources:') && !isStreaming));

                        // Extract full href URLs from DOM anchor elements
                        const hrefMap = {};
                        document.querySelectorAll('a[href]').forEach(a => {
                            let href = a.getAttribute('href') || a.href || '';
                            if (href.includes('uddg=')) href = decodeURIComponent(href.split('uddg=')[1].split('&')[0]);
                            if (href.includes('url=')) href = decodeURIComponent(href.split('url=')[1].split('&')[0]);
                            if (href && (href.startsWith('http://') || href.startsWith('https://')) && !href.includes('search.brave.com')) {
                                const linkText = a.innerText.trim();
                                if (linkText) hrefMap[linkText] = href;
                                a.textContent = href;
                            }
                        });

                        return { isFinished, text, hrefMap };
                    });

                    if (extractedData && extractedData.isFinished) {
                        break;
                    }

                    await new Promise(r => setTimeout(r, 1000));
                }

                // Clean junk lines and un-truncate URLs
                let rawText = (extractedData ? extractedData.text : '') || '';
                const hrefMap = extractedData ? (extractedData.hrefMap || {}) : {};

                const promptMarker = "DO NOT INCLUDE ANY TEXT, NOTES, OR EXPLANATIONS AFTER THE SOURCES SECTION.";
                if (rawText.includes(promptMarker)) {
                    rawText = rawText.split(promptMarker).pop();
                }

                rawText = rawText
                    .replace(/^.*?(Ctrl \+ Shift \+ O|Ask\nAll\nImages)/s, '')
                    .replace(/AI-generated answer\. Please verify critical facts\..*/s, '')
                    .replace(/Brave Search uses private usage metrics.*/s, '');

                let mainPart = rawText;
                let sourcesPart = '';

                if (rawText.includes('Sources:')) {
                    const parts = rawText.split('Sources:');
                    mainPart = parts[0];
                    sourcesPart = parts.slice(1).join('Sources:');
                }

                const cleanLines = [];
                for (let line of mainPart.split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    if (/^(View all|Finished|Searching|Answering|Thinking)$/i.test(trimmed)) continue;
                    if (/^[\+\-]?\d+$/.test(trimmed)) continue;
                    if (trimmed.includes('search.brave.com')) continue;
                    if (trimmed.startsWith('https://www.youtube.com/watch') || trimmed.startsWith('https://youtube.com/watch')) continue;
                    cleanLines.push(line);
                }

                let cleanMain = cleanLines.join('\n').replace(/^(?:[\+\-]?\d+\s*)+/i, '').replace(/\n{3,}/g, '\n\n').trim();

                const isIgnoredUrl = (u) => !u || u.includes('search.brave.com') || u.includes('youtube.com') || u.includes('youtu.be');

                let finalSources = '';
                if (sourcesPart) {
                    const rawUrls = sourcesPart.match(/https?:\/\/[^\s\)\>]+/g) || [];
                    const expandedUrls = [];

                    for (let url of rawUrls) {
                        let cleanUrl = url.replace(/[\.\,\;]+$/, '');
                        const matchedKey = Object.keys(hrefMap).find(k => k.startsWith(cleanUrl) || cleanUrl.startsWith(k));
                        if (matchedKey && hrefMap[matchedKey]) {
                            cleanUrl = hrefMap[matchedKey];
                        }
                        if (!isIgnoredUrl(cleanUrl)) {
                            expandedUrls.push(cleanUrl);
                        }
                    }

                    Object.values(hrefMap).forEach(url => {
                        if (!isIgnoredUrl(url) && !expandedUrls.includes(url)) {
                            expandedUrls.push(url);
                        }
                    });

                    const uniqueUrls = Array.from(new Set(expandedUrls));
                    if (uniqueUrls.length > 0) {
                        finalSources = 'Sources:\n' + uniqueUrls.map(u => `- ${u}`).join('\n');
                    }
                }

                const aiResult = cleanMain + (finalSources ? '\n\n' + finalSources : '');

                if (!aiResult || /^(\+\d+|Searching|Answering|Thinking|Finished)$/i.test(aiResult)) {
                    throw new Error("EMPTY_AI_RESPONSE");
                }

                // Temporarily save rendered page to page.pdf for visual confirmation
                // await page.pdf({ path: 'page.pdf', format: 'A4' }).catch(() => {});

                await browser.close();
                // fs.writeFileSync("DEBUG.txt", `AI Search results for [${query}]:\n\n${aiResult}`);
                return `AI Search results for [${query}]:\n\n${aiResult}`;
            } catch (err) {
                lastError = err;
                fs.writeFileSync(path.join(LOGS_DIR, "web_tools", "search", "ai_mode", "ERROR.txt"), err.message);
                if (browser) await browser.close();
                if (attempt < maxRetries) {
                    const backoff = Math.pow(2, attempt) * 1000;
                    await new Promise(r => setTimeout(r, backoff));
                }
            }
        }
    }

    // Normal DuckDuckGo search (fallback or default when aiMode is false)
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
            await browser.close();
            const prefix = aiMode ? 'AI Mode temporarily failed, used Standard search.\n\n' : '';
            return `${prefix}Search results for [${query}]:\n\n${finalResults}`;

        } catch (err) {
            lastError = err;
            if (browser) await browser.close();
            fs.writeFileSync(path.join(LOGS_DIR, "web_tools", "search", "standard_mode", "ERROR.txt"), err.message);
            if (attempt < maxRetries) {
                const backoff = Math.pow(2, attempt) * 1000;
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    return `ERROR: Search failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`;
};
