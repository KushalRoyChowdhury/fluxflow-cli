import fs from 'fs-extra';
import path from 'path';
import pptxgen from 'pptxgenjs';
import html2pptxgenjs from 'html2pptxgenjs';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Write PPTX Tool (HTML-to-Native Version)
 * Converts HTML slides into a native PowerPoint presentation using html2pptxgenjs.
 * Provides selectable text and high-performance generation without Puppeteer.
 */
export const write_pptx = async (args) => {
    let {
        path: targetPath,
        content = '',
        title = 'Autonomous Agent Report'
    } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for write_pptx.';
    if (!content) return 'ERROR: No "content" (HTML) provided for write_pptx.';

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        await fs.ensureDir(path.dirname(absolutePath));

        // ROBUST CONSTRUCTOR CHECK
        const PptxConstructor = (typeof pptxgen === 'function') ? pptxgen : pptxgen.default;
        if (!PptxConstructor) throw new Error('Could not find PptxGenJS constructor in module');

        const pres = new PptxConstructor();
        pres.layout = 'LAYOUT_4x3';
        pres.title = title;
        pres.author = 'FluxFlow CLI';
        pres.company = 'Generated with Agentic AI System';

        // 1. Split content into Slides (separated by ---)
        const slideBlocks = content.split(/---/).filter(s => s.trim().length > 0);
        
        if (slideBlocks.length === 0) {
            slideBlocks.push(content);
        }

        // 2. Process each slide
        for (let i = 0; i < slideBlocks.length; i++) {
            const slide = pres.addSlide();
            const htmlSnippet = slideBlocks[i].trim();

            // Use html2pptxgenjs to convert HTML to pptxgenjs text items
            // We use a heuristic: headers are titles, rest is body
            try {
                const items = html2pptxgenjs.htmlToPptxText(htmlSnippet);
                
                // Add the converted items as a native text box
                slide.addText(items, { 
                    x: 0.5, y: 0.5, w: '90%', h: '90%', 
                    valign: 'top', fontSize: 18, color: '363636'
                });
            } catch (err) {
                // Fallback: Add as plain text if translation fails
                slide.addText(htmlSnippet.replace(/<[^>]*>/g, ''), { 
                    x: 0.5, y: 0.5, w: '90%', h: '90%', 
                    fontSize: 14 
                });
            }
        }

        // 3. Export to Disk
        const buffer = await pres.write({ outputType: 'nodebuffer' });
        await fs.writeFile(absolutePath, buffer);

        return `SUCCESS: Native HTML-to-PPTX [${targetPath}] generated with ${slideBlocks.length} slides.\n- Size: ${(buffer.length / 1024).toFixed(1)} KB`;

    } catch (err) {
        return `ERROR: Failed to generate native HTML-to-PPTX [${targetPath}]: ${err.message}`;
    }
};
