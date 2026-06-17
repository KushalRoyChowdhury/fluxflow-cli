import fs from 'fs-extra';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TreeSitter = require('web-tree-sitter');

import { EXTENSION_TO_WASM } from '../utils/parsers.js';
import { PARSER_DIR } from '../utils/paths.js';
import { parseArgs } from '../utils/arg_parser.js';

let isParserInitialized = false;

const INTERESTING_TYPES = new Set([
    'class_declaration', 'function_declaration', 'method_definition', 'arrow_function', 'function_expression',
    'if_statement', 'else_clause', 'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement', 'switch_statement', 'try_statement', 'catch_clause',
    'variable_declarator', 'export_statement', 'lexical_declaration', 'variable_declaration',
    'interface_declaration', 'type_alias_declaration', 'enum_declaration',
    'import_declaration', 'jsx_element', 'jsx_self_closing_element',
    'class_definition', 'function_definition', 'decorated_definition',
    'import_from_statement', 'import_statement', 'preproc_include',
    'method_declaration', 'constructor_declaration',
    'assignment_expression', 'pair',
    // C/C++
    'class_specifier', 'struct_specifier', 'enum_specifier', 'field_declaration',
    // HTML
    'element', 'script_element', 'style_element'
]);

// These types are treated as "transparent wrappers" - they don't print themselves IF they have interesting children.
const PASSTHROUGH_TYPES = new Set(['export_statement', 'lexical_declaration', 'variable_declaration', 'variable_declarator', 'pair', 'assignment_expression']);

function sanitize(text, limit = 50) {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > limit ? clean.substring(0, limit - 3) + '...' : clean;
}

function getDisplayName(node) {
    const type = node.type;

    // 1. Structural / Control Flow
    if (type === 'if_statement') {
        const cond = node.childForFieldName('condition');
        return cond ? `if (${sanitize(cond.text, 40)})` : 'if';
    }
    if (type === 'else_clause') return 'else';
    if (type === 'while_statement' || type === 'do_statement') {
        const cond = node.childForFieldName('condition');
        return `${type.split('_')[0]} (${cond ? sanitize(cond.text, 40) : ''})`;
    }
    if (type === 'for_statement' || type === 'for_in_statement' || type === 'for_of_statement') {
        const text = node.text.split('\n')[0];
        const match = text.match(/for\s*(?:await\s*)?\((.*)\)/);
        if (match) return `for (${sanitize(match[1], 40)})`;
        return 'for';
    }
    if (type === 'switch_statement') {
        const val = node.childForFieldName('value');
        return `switch (${val ? sanitize(val.text, 40) : ''})`;
    }
    if (type === 'try_statement') return 'try';
    if (type === 'catch_clause') return 'catch';

    // 2. HTML / JSX
    if (type === 'element' || type === 'script_element' || type === 'style_element' ||
        type === 'jsx_element' || type === 'jsx_self_closing_element') {
        const opening = node.childForFieldName('opening_element') ||
            node.childForFieldName('start_tag') ||
            node.children.find(c => c.type === 'start_tag') || node;
        const tagName = opening.childForFieldName('name') ||
            opening.childForFieldName('tag_name') ||
            opening.children.find(c => c.type === 'tag_name');
        return tagName ? `<${sanitize(tagName.text, 30)}>` : null;
    }

    // 3. Imports
    if (['import_declaration', 'import_from_statement', 'import_statement', 'preproc_include'].includes(type)) {
        return sanitize(node.text.split('\n')[0], 60);
    }

    // 4. Names
    if (type === 'pair') {
        const key = node.childForFieldName('key');
        return key ? sanitize(key.text.replace(/["']/g, ''), 40) : null;
    }
    if (type === 'assignment_expression') {
        const left = node.childForFieldName('left');
        return left ? `${sanitize(left.text, 30)} = ...` : null;
    }
    if (type === 'variable_declarator') {
        const id = node.childForFieldName('name') || node.children.find(c => ['identifier', 'object_pattern', 'array_pattern'].includes(c.type));
        return id ? sanitize(id.text, 40) : null;
    }

    const nameNode = node.childForFieldName('name') ||
        node.childForFieldName('declarator') ||
        node.children.find(c => ['identifier', 'type_identifier', 'field_identifier', 'property_identifier', 'shorthand_property_identifier'].includes(c.type));

    if (nameNode) {
        if (nameNode.type.includes('declarator')) {
            const id = nameNode.descendantsOfType('identifier')[0] ||
                nameNode.descendantsOfType('field_identifier')[0];
            if (id) return sanitize(id.text, 40);
        }
        return sanitize(nameNode.text, 40);
    }

    // Recursive name lookup for functions assigned to vars/keys
    if (['arrow_function', 'function_expression', 'function_declaration'].includes(type)) {
        let p = node.parent;
        while (p && p.type !== 'program') {
            const pName = getDisplayName(p);
            if (pName) return pName;
            if (!PASSTHROUGH_TYPES.has(p.type)) break;
            p = p.parent;
        }
    }

    return null;
}

function getNextInterestingNodes(node) {
    const nodes = [];
    function walk(n) {
        for (const child of n.children) {
            if (INTERESTING_TYPES.has(child.type)) {
                nodes.push(child);
            } else {
                walk(child);
            }
        }
    }
    walk(node);
    return nodes;
}

function toCamelCase(str) {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

function traverse(node, depth = 0, isLast = true, prefix = '', parentName = null, maxDepth = 12) {
    // if (depth > maxDepth) return '';

    const type = node.type;
    const name = getDisplayName(node);
    const isInteresting = INTERESTING_TYPES.has(type) || depth === 0;
    const children = getNextInterestingNodes(node);

    // A node is skipped if it's a structural passthrough wrapper AND has children,
    // OR if its name is identical to its parent (avoiding redundant lines for the same variable/function)
    const isPassthrough = isInteresting && depth > 0 &&
        ((PASSTHROUGH_TYPES.has(type) && children.length > 0) ||
            (name !== null && name === parentName && children.length > 0));

    let result = '';
    let nextPrefix = prefix;
    let nextDepth = depth;
    let nextParentName = parentName;

    if (isInteresting && !isPassthrough) {
        const startLine = node.startPosition.row + 1;
        const endLine = node.endPosition.row + 1;
        const camelType = toCamelCase(type);
        const label = name ? `${camelType} [${name}]` : camelType;

        if (depth === 0) {
            result += `📁 ROOT (Lines: ${startLine}-${endLine})\n`;
            nextPrefix = prefix; // remains same
        } else {
            result += `${prefix}${isLast ? '└── ' : '├── '}${label} (Lines: ${startLine}-${endLine})\n`;
            nextPrefix += isLast ? '    ' : '│   ';
        }
        nextDepth = depth + 1;
        nextParentName = name;
    }

    if (nextDepth > maxDepth && children.length > 0) {
        result += `${nextPrefix}└── ... depth exceeded ...\n`;
    } else {
        children.forEach((child, index) => {
            const isLastChildInLoop = index === children.length - 1;

            // If we are passing through, we must propagate our OWN 'isLast' status to our children.
            // Visually, the child is only the "end of the branch" if it's the last child AND the passthrough parent was the last.
            const effectiveIsLast = isPassthrough ? (isLast && isLastChildInLoop) : isLastChildInLoop;

            result += traverse(child, nextDepth, effectiveIsLast, nextPrefix, nextParentName, maxDepth);
        });
    }
    return result;
}

export const file_map = async (args) => {
    let filePath;
    try {
        const parsed = parseArgs(args);
        filePath = parsed.path;
    } catch (e) {
        return `ERROR: Failed to parse arguments: ${args}`;
    }

    if (!filePath) {
        return 'ERROR: No file path provided. Use [tool:functions.FileMap(path="...")]';
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(absolutePath)) {
        return `ERROR: File not found: ${filePath}`;
    }

    const ext = path.extname(absolutePath).slice(1).toLowerCase();
    const wasmFile = EXTENSION_TO_WASM[ext];
    if (!wasmFile) {
        return `ERROR: Unsupported file extension: .${ext}`;
    }

    const wasmPath = path.resolve(PARSER_DIR, wasmFile);
    if (!fs.existsSync(wasmPath)) {
        return `ERROR: Parser for .${ext} not found. Please download it in Settings > Other.`;
    }

    try {
        const Parser = TreeSitter.Parser;
        if (!isParserInitialized) {
            let tsWasmPath;
            try {
                tsWasmPath = path.join(path.dirname(require.resolve('web-tree-sitter')), 'tree-sitter.wasm');
            } catch (e) {
                tsWasmPath = path.join(process.cwd(), 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
            }

            await Parser.init({
                locateFile: (p) => {
                    if (p === 'tree-sitter.wasm' || p.endsWith('tree-sitter.wasm')) {
                        return tsWasmPath;
                    }
                    return p;
                }
            });
            isParserInitialized = true;
        }

        const parser = new Parser();
        const Lang = await TreeSitter.Language.load(wasmPath);
        parser.setLanguage(Lang);

        const sourceCode = await fs.readFile(absolutePath, 'utf8');
        const lines = sourceCode.split('\n').length;
        let maxDepth = 12;
        if (lines > 10000) maxDepth = 2;
        else if (lines >= 8000) maxDepth = 3;
        else if (lines >= 5000) maxDepth = 5;
        else if (lines >= 4000) maxDepth = 8;
        else if (lines > 2000) maxDepth = 10;

        const tree = parser.parse(sourceCode);
        const map = traverse(tree.rootNode, 0, true, ' ', null, maxDepth);

        // fs.writeFileSync('filemap.txt', map);
        return `📄 File Map for: ${filePath}\n${map}`;
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
        const stack = err instanceof Error ? `\nStack: ${err.stack}` : '';
        return `ERROR: Failed to map file: ${errMsg}${stack}`;
    }
};
