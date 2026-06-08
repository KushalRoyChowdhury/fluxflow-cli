import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs-extra';
import { PDFDocument } from 'pdf-lib';
import { parseArgs } from '../utils/arg_parser.js';
import { RevertManager } from '../utils/revert.js';

/**
 * Write PDF Tool (Stable Puppeteer Version)
 * Uses bundled Chromium for 100% consistent rendering across all platforms.
 */
export const write_pdf = async (args) => {
    const {
        path: targetPath,
        content,
        orientation = 'portrait',
        margin = '0px'
    } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_pdf.';
    if (!content) return 'ERROR: Missing "content" (HTML/CSS) for write_pdf.';

    const absolutePath = path.resolve(process.cwd(), targetPath);
    let browser = null;

    try {
        // Ensure directory exists
        await fs.ensureDir(path.dirname(absolutePath));

        // Record file change for Reversion Time Travel
        await RevertManager.recordFileChange(absolutePath);

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

        // [IMAGE & RESOURCE RESOLUTION ENGINE]
        // Puppeteer's about:blank strict security blocks local file URIs.
        // We dynamically intercept local stylesheets (<link rel="stylesheet">), local image paths in HTML <img> tags,
        // and CSS url() definitions, converting them to inlined styles and Base64 Data URIs to prevent layout/image breakage.
        let resolvedContent = content;
        const resolvedCache = {};

        const resolveToBase64 = async (originalSrc) => {
            if (!originalSrc || originalSrc.startsWith('http://') || originalSrc.startsWith('https://') || originalSrc.startsWith('data:')) {
                return null;
            }
            try {
                const imgPath = path.resolve(process.cwd(), originalSrc);
                if (await fs.pathExists(imgPath)) {
                    const ext = path.extname(imgPath).toLowerCase().replace('.', '') || 'png';
                    const mime = ext === 'jpg' ? 'jpeg' : (ext === 'svg' ? 'svg+xml' : ext);
                    const base64 = await fs.readFile(imgPath, 'base64');
                    return `data:image/${mime};base64,${base64}`;
                }
            } catch (e) {
                // Silently ignore unresolvable images
            }
            return null;
        };

        // 1. Resolve local external stylesheets to inline style tags
        const linkRegex = /<link[^>]+href=["']([^"']+)["']/gi;
        const cssCache = {};
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            const originalHref = match[1];
            const fullTag = match[0];
            if (originalHref && fullTag.toLowerCase().includes('stylesheet') && !originalHref.startsWith('http://') && !originalHref.startsWith('https://') && !originalHref.startsWith('data:')) {
                try {
                    const cssPath = path.resolve(process.cwd(), originalHref);
                    if (await fs.pathExists(cssPath)) {
                        const cssContent = await fs.readFile(cssPath, 'utf-8');
                        cssCache[fullTag] = `<style>${cssContent}</style>`;
                    }
                } catch (e) {
                    // Silently ignore CSS errors
                }
            }
        }
        for (const [tag, styleTag] of Object.entries(cssCache)) {
            resolvedContent = resolvedContent.split(tag).join(styleTag);
        }

        // 2. Discover local images in <img> tags
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        while ((match = imgRegex.exec(resolvedContent)) !== null) {
            const originalSrc = match[1];
            if (originalSrc && !resolvedCache[originalSrc]) {
                const dataUri = await resolveToBase64(originalSrc);
                if (dataUri) {
                    resolvedCache[originalSrc] = dataUri;
                }
            }
        }

        // 3. Discover local images in CSS url() expressions
        const urlRegex = /url\(\s*['"]?([^'")]+?)['"]?\s*\)/gi;
        while ((match = urlRegex.exec(resolvedContent)) !== null) {
            const originalSrc = match[1].trim();
            if (originalSrc && !resolvedCache[originalSrc]) {
                const dataUri = await resolveToBase64(originalSrc);
                if (dataUri) {
                    resolvedCache[originalSrc] = dataUri;
                }
            }
        }

        // 4. Safely substitute resolved base64 resources inside src attributes and url() expressions specifically
        // to prevent substring collision bugs (e.g. replacing 'bg.png' inside 'hero-bg.png' or inside unrelated text)
        for (const [originalSrc, dataUri] of Object.entries(resolvedCache)) {
            const escapedSrc = originalSrc.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

            // Safe replacement in HTML src attributes
            const srcRegex = new RegExp(`(src=["'])(${escapedSrc})(["'])`, 'gi');
            resolvedContent = resolvedContent.replace(srcRegex, `$1${dataUri}$3`);

            // Safe replacement in CSS url() definitions
            const urlReplaceRegex = new RegExp(`url\\(\\s*(['"]?)(${escapedSrc})\\1\\s*\\)`, 'gi');
            resolvedContent = resolvedContent.replace(urlReplaceRegex, `url($1${dataUri}$1)`);
        }


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
                .watermark {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-50deg);
                    font-size: 52px;
                    font-weight: bold;
                    color: rgba(0, 0, 0, 0.005);
                    pointer-events: none;
                    z-index: -1000;
                    text-align: center;
                    width: 150%;
                    white-space: nowrap;
                    text-transform: uppercase;
                    letter-spacing: 5px;
                }
            </style>
            <div class="watermark">Generated by FluxFlow CLI (AI)</div>
            ${resolvedContent}
        `;

        // Set HTML content
        await page.setContent(styledContent, { waitUntil: 'networkidle0', timeout: 180000 });

        // Generate PDF Buffer
        const pdfBytes = await page.pdf({
            format: 'A4',
            landscape: String(orientation).toLowerCase() === 'landscape',
            margin: {
                top: margin,
                right: margin,
                bottom: margin,
                left: margin
            },
            printBackground: true
        });

        // --- PDF-LIB METADATA INJECTION (Hardcoded Branded Metadata) ---
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const fileName = path.basename(targetPath);
        pdfDoc.setTitle(`FluxFlow_${fileName}`);
        pdfDoc.setAuthor('FluxFlow CLI');
        pdfDoc.setSubject('Generated with Agentic AI System');
        pdfDoc.setKeywords(['FluxFlow', 'AI', 'Agentic', 'Automated']);
        pdfDoc.setCreator('FluxFlow PDF Engine');
        pdfDoc.setProducer('FluxFlow (Generative AI)');

        const finalPdfBytes = await pdfDoc.save();
        await fs.writeFile(absolutePath, finalPdfBytes);

        const stats = await fs.stat(absolutePath);
        return `SUCCESS: PDF generated successfully at [${targetPath}] (${(stats.size / 1024).toFixed(2)} KB).`;
    } catch (err) {
        return `ERROR: Failed to generate PDF [${targetPath}]: ${err.message}`;
    } finally {
        // Cleanup
        if (browser) await browser.close();
    }
};
