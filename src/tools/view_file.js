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

const stripSkillFrontmatter = (content) => {
    return content.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\s*(\r?\n)?/, '');
};

const findSkillSubFile = (skillDir, subPath) => {
    if (!subPath) return null;

    // 1. Direct path check (normalized / case-insensitive)
    const directPath = path.join(skillDir, subPath);
    if (fs.existsSync(directPath)) {
        try {
            if (fs.statSync(directPath).isFile()) return directPath;
        } catch (e) {}
    }

    // Try with .md extension if not present
    if (!subPath.toLowerCase().endsWith('.md')) {
        const withMd = path.join(skillDir, `${subPath}.md`);
        if (fs.existsSync(withMd)) {
            try {
                if (fs.statSync(withMd).isFile()) return withMd;
            } catch (e) {}
        }
    }

    // 2. Case-insensitive path traversal from skillDir
    const segments = subPath.replace(/\\/g, '/').split('/').filter(Boolean);
    let currentDir = skillDir;
    let found = true;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i].toLowerCase();
        const isLast = i === segments.length - 1;
        try {
            if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
                found = false;
                break;
            }
            const entries = fs.readdirSync(currentDir);
            const matchedEntry = entries.find(e => {
                const eLower = e.toLowerCase();
                if (eLower === seg) return true;
                if (isLast && !seg.endsWith('.md') && eLower === `${seg}.md`) return true;
                return false;
            });

            if (!matchedEntry) {
                found = false;
                break;
            }

            const nextPath = path.join(currentDir, matchedEntry);
            if (isLast) {
                if (fs.statSync(nextPath).isFile()) return nextPath;
                found = false;
            } else {
                currentDir = nextPath;
            }
        } catch (e) {
            found = false;
            break;
        }
    }

    // 3. Fallback: check inside standard folders (references/, scripts/, examples/, resources/) if single filename provided
    if (segments.length === 1) {
        const singleFile = segments[0];
        const fallbackDirs = ['references', 'reference', 'scripts', 'script', 'examples', 'example', 'resources', 'resource'];
        for (const fDir of fallbackDirs) {
            const nestedDir = path.join(skillDir, fDir);
            if (fs.existsSync(nestedDir)) {
                const subResult = findSkillSubFile(nestedDir, singleFile);
                if (subResult) return subResult;
            }
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

        let explicitScope = null;
        let skillName = '';
        let subPath = '';

        if (parts[0]?.toLowerCase() === 'global' || parts[0]?.toLowerCase() === 'project') {
            explicitScope = parts[0].toLowerCase();
            skillName = parts[1];
            subPath = parts.slice(2).join('/');
        } else {
            skillName = parts[0];
            subPath = parts.slice(1).join('/');
        }

        if (!skillName) {
            return `ERROR: Missing skill name in path [${targetPath}].`;
        }

        const findMatchingSkillInDir = (baseDir) => {
            const skillFiles = findSkillFiles(baseDir);
            for (const fPath of skillFiles) {
                try {
                    const fileContent = fs.readFileSync(fPath, 'utf8');
                    const meta = parseSkillFrontmatter(fileContent);
                    const parentDirName = path.basename(path.dirname(fPath)).toLowerCase();
                    if ((meta?.name && meta.name.toLowerCase() === skillName.toLowerCase()) ||
                        parentDirName === skillName.toLowerCase() ||
                        (fPath.toLowerCase() === path.join(baseDir, 'skill.md').toLowerCase() && skillName.toLowerCase() === 'skill')) {
                        return fPath;
                    }
                } catch (e) {}
            }
            return null;
        };

        let matchedSkillFile = null;
        let hasConflict = false;
        if (explicitScope) {
            const baseDir = explicitScope === 'global' ? FLUXFLOW_DIR : process.cwd();
            matchedSkillFile = findMatchingSkillInDir(baseDir);
        } else {
            // When no scope is provided: check project first (precedence), then fallback to global
            const projectMatch = findMatchingSkillInDir(process.cwd());
            const globalMatch = findMatchingSkillInDir(FLUXFLOW_DIR);
            if (projectMatch && globalMatch) {
                hasConflict = true;
            }
            matchedSkillFile = projectMatch || globalMatch;
        }

        if (!matchedSkillFile) {
            return `No '${skillName}' exist in given scope.`;
        }

        const skillDir = path.dirname(matchedSkillFile);
        let targetFileToRead = matchedSkillFile;
        let isMainSkill = true;

        if (subPath) {
            const subFile = findSkillSubFile(skillDir, subPath);
            if (!subFile) {
                return `No such file or reference '${subPath}' exist for skill '${skillName}'. It could be standard file path?`;
            }
            targetFileToRead = subFile;
            isMainSkill = false;
        }

        try {
            let content = fs.readFileSync(targetFileToRead, 'utf8');
            if (content.startsWith('\uFEFF')) {
                content = content.slice(1);
            }
            content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

            if (isMainSkill) {
                content = stripSkillFrontmatter(content);
            }

            const lines = content.split('\n');
            const totalLines = lines.length;

            const start = startProvided ? Math.max(0, finalStart - 1) : 0;
            const end = endProvided ? Math.min(totalLines, finalEnd) : totalLines;
            const resultLines = lines.slice(start, end);

            const normTarget = targetPath.replace(/\\/g, '/').toLowerCase();
            const isDocs = normTarget.includes('#skill/global/fluxflow') || normTarget.includes('#skills/global/fluxflow');
            const conflictNote = hasConflict ? ` (Found ${targetPath} in both global & project scope. Loaded [project] as default fallback. Use '#skills/global/...' if needed global)` : '';
            const header = `${isDocs ? 'DOCs' : 'Skill'}: [${targetPath.replace(/\\/g, '/')}]${conflictNote}`;
            const code = resultLines.map(line => line.trimEnd()).join('\n');

            return `${header}\n\n${code}`;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return `ERROR: Failed to read skill file [${targetPath}]: ${errorMsg}`;
        }
    }

    try {
        const absolutePath = path.resolve(process.cwd(), targetPath);

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
