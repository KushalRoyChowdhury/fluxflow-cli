import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { FLUXFLOW_DIR } from '../utils/paths.js';

const parseSkillFrontmatter = (content) => {
    if (!content) return null;
    const match = content.match(/^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
    if (!match) return null;
    const frontmatter = match[1];
    const body = (match[2] || '').trim();
    if (body.length === 0) return null;

    let name = '';
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    if (nameMatch) {
        name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    return name ? { name } : null;
};

const findSkillFiles = (baseDir) => {
    const results = [];
    if (!baseDir || !fs.existsSync(baseDir)) return results;

    const traverse = (dir, depth = 0) => {
        if (depth > 5) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const lowerName = entry.name.toLowerCase();
                if (entry.isFile()) {
                    if (lowerName === 'skill.md') {
                        results.push(fullPath);
                    }
                } else if (entry.isDirectory()) {
                    if (depth === 0) {
                        if (lowerName === 'skills' || lowerName === '.skills' || lowerName === 'skill' || lowerName === '.skill') {
                            traverse(fullPath, depth + 1);
                        }
                    } else {
                        traverse(fullPath, depth + 1);
                    }
                }
            }
        } catch (e) {}
    };

    traverse(baseDir, 0);
    return results;
};

const stripSkillDescription = (content) => {
    return content.replace(/^(\s*---\r?\n)([\s\S]*?)(\r?\n---)/, (match, open, body, close) => {
        const lines = body.split('\n');
        const filteredLines = [];
        let inDesc = false;
        for (const line of lines) {
            if (/^\s*description\s*:/i.test(line)) {
                inDesc = true;
                continue;
            }
            if (inDesc) {
                if (/^\s+/.test(line)) {
                    continue;
                } else {
                    inDesc = false;
                }
            }
            filteredLines.push(line);
        }
        return `${open}${filteredLines.join('\n')}${close}`;
    });
};

const findReferenceFile = (skillDir, refName) => {
    const candidateDirs = [
        path.join(skillDir, 'references'),
        path.join(skillDir, 'reference'),
        skillDir
    ];
    const targetBase = refName.toLowerCase().endsWith('.md') ? refName.toLowerCase() : `${refName.toLowerCase()}.md`;
    const targetExact = refName.toLowerCase();

    for (const cDir of candidateDirs) {
        if (fs.existsSync(cDir) && fs.statSync(cDir).isDirectory()) {
            try {
                const files = fs.readdirSync(cDir);
                for (const f of files) {
                    const fLower = f.toLowerCase();
                    if (fLower === targetBase || fLower === targetExact) {
                        const full = path.join(cDir, f);
                        if (fs.statSync(full).isFile()) {
                            return full;
                        }
                    }
                }
            } catch (e) {}
        }
    }
    return null;
};

/**
 * View File Tool
 * Reads a file, optionally within a specific line range.
 */
export const view_file = async (args, context = {}) => {
    let { path: targetPath, StartLine, EndLine, start_line, end_line, startLine, endLine } = parseArgs(args);

    // Normalize argument names and apply dynamic paging logic
    const sLine = parseInt(StartLine || start_line || startLine);
    const eLine = parseInt(EndLine || end_line || endLine);

    const startProvided = !isNaN(sLine);
    const endProvided = !isNaN(eLine);

    let finalStart = sLine || 1;
    let finalEnd = eLine || (sLine ? (sLine + 800) : 800);

    if (!targetPath) return 'ERROR: Missing "path" argument for ReadFile.';

    // Deterministic #skill path resolution
    if (targetPath.trim().toLowerCase().startsWith('#skill')) {
        const normalized = targetPath.trim().replace(/\\/g, '/');
        const rest = normalized.replace(/^#skills?\/?/i, '');
        const parts = rest.split('/').filter(Boolean);

        const scope = parts[0]?.toLowerCase();
        if (scope !== 'global' && scope !== 'project') {
            return `ERROR: Invalid skill scope '${scope || ''}'. Expected 'global' or 'project'.`;
        }

        const skillName = parts[1];
        if (!skillName) {
            return `ERROR: Missing skill name in path [${targetPath}].`;
        }

        const isReference = parts[2]?.toLowerCase() === 'references' || parts[2]?.toLowerCase() === 'reference';
        const refName = isReference ? parts.slice(3).join('/') : null;

        const baseDir = scope === 'global' ? FLUXFLOW_DIR : process.cwd();
        const skillFiles = findSkillFiles(baseDir);

        let matchedSkillFile = null;
        for (const fPath of skillFiles) {
            try {
                const fileContent = fs.readFileSync(fPath, 'utf8');
                const meta = parseSkillFrontmatter(fileContent);
                const parentDirName = path.basename(path.dirname(fPath)).toLowerCase();
                if ((meta?.name && meta.name.toLowerCase() === skillName.toLowerCase()) ||
                    parentDirName === skillName.toLowerCase() ||
                    (fPath.toLowerCase() === path.join(baseDir, 'skill.md').toLowerCase() && skillName.toLowerCase() === 'skill')) {
                    matchedSkillFile = fPath;
                    break;
                }
            } catch (e) {}
        }

        if (!matchedSkillFile) {
            return `No '${skillName}' exist in given scope.`;
        }

        const skillDir = path.dirname(matchedSkillFile);
        let targetFileToRead = matchedSkillFile;
        let isMainSkill = true;

        if (isReference) {
            if (!refName) {
                return `ERROR: Missing reference file name in path [${targetPath}].`;
            }
            const refFile = findReferenceFile(skillDir, refName);
            if (!refFile) {
                return `No such reference exist for skill '${skillName}'`;
            }
            targetFileToRead = refFile;
            isMainSkill = false;
        }

        try {
            let content = fs.readFileSync(targetFileToRead, 'utf8');
            if (content.startsWith('\uFEFF')) {
                content = content.slice(1);
            }
            content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            if (isMainSkill) {
                content = stripSkillDescription(content);
            }

            const lines = content.split('\n');
            const totalLines = lines.length;

            const start = startProvided ? Math.max(0, finalStart - 1) : 0;
            const end = endProvided ? Math.min(totalLines, finalEnd) : totalLines;
            const resultLines = lines.slice(start, end);

            const header = `Skill: [${targetPath.replace(/\\/g, '/')}]`;
            const code = resultLines.map((line, i) => `${String(start + i + 1).padStart(4)}: ${line.trimEnd()}`).join('\n');

            return `${header}\n\n${code}`;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return `ERROR: Failed to read skill file [${targetPath}]: ${errorMsg}`;
        }
    }

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: File [${targetPath}] does not exist.`;
        }

        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
            return `ERROR: Path [${targetPath}] is a directory. Use list_files instead.`;
        }

        // --- MULTIMODAL DETECTION ---
        const ext = path.extname(targetPath).toLowerCase();

        const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.mpeg', '.mpg'];
        if (videoExtensions.includes(ext)) {
            const format = ext.slice(1).toUpperCase();
            return `ERROR: Unable to read. Type ${format} not supported`;
        }

        const mimeMap = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword'
        };

        if (mimeMap[ext]) {
            const isMultiModal = context.isMultiModal !== false;
            if (!isMultiModal) {
                return `ERROR: Multimodality is not supported for the current model. Unable to load [${targetPath}].`;
            }
            const buffer = fs.readFileSync(absolutePath);
            const base64 = buffer.toString('base64');
            const mimeType = mimeMap[ext];

            return {
                text: `[BINARY FILE]: ${targetPath} (${mimeType}) - Loaded as multimodal part.`,
                binaryPart: {
                    inlineData: {
                        data: base64,
                        mimeType: mimeType
                    }
                }
            };
        }
        // ----------------------------

        let content = fs.readFileSync(absolutePath, 'utf8');
        // Strip BOM if present
        if (content.startsWith('\uFEFF')) {
            content = content.slice(1);
        }
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const lines = content.split('\n');
        const totalLines = lines.length;

        // If no start/end arguments given and file is large (>800 lines),
        // show only the first 50 lines to avoid overwhelming context.
        if (!startProvided && !endProvided && totalLines > 800) {
            finalStart = 1;
            finalEnd = 50;
        }

        // Slice lines (adjusting for 1-based indexing)
        const start = Math.max(0, finalStart - 1);
        const end = Math.min(totalLines, finalEnd);
        const resultLines = lines.slice(start, end);

        const header = `File: [${targetPath}] (Showing lines ${start + 1}-${end} of ${totalLines}).`;
        const code = resultLines.map((line, i) => `${String(start + i + 1).padStart(4)}: ${line.trimEnd()}`).join('\n');

        return `${header}\n\n${code}`;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to read file [${targetPath}]: ${errorMsg}`;
    }
};
