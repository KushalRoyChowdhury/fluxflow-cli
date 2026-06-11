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
  'class_declaration', 'function_declaration', 'method_definition', 'arrow_function',
  'if_statement', 'for_statement', 'while_statement', 'do_statement', 'switch_statement', 'try_statement',
  'variable_declaration', 'lexical_declaration', 'export_statement',
  'interface_declaration', 'type_alias_declaration', 'enum_declaration',
  'import_declaration', 'jsx_element', 'jsx_self_closing_element',
  'class_definition', 'function_definition', 'decorated_definition',
  'import_from_statement', 'import_statement', 'preproc_include',
  'method_declaration', 'constructor_declaration',
  // C/C++
  'class_specifier', 'struct_specifier', 'enum_specifier', 'field_declaration',
  // HTML
  'element', 'script_element', 'style_element'
]);

function getDisplayName(node) {
  // HTML Support
  if (node.type === 'element' || node.type === 'script_element' || node.type === 'style_element') {
    const startTag = node.childForFieldName('start_tag') || node.children.find(c => c.type === 'start_tag');
    if (startTag) {
      const tagName = startTag.childForFieldName('name') || startTag.children.find(c => c.type === 'tag_name');
      return tagName ? tagName.text : null;
    }
    const tagName = node.children.find(c => c.type === 'tag_name');
    return tagName ? tagName.text : null;
  }

  if (node.type === 'jsx_element' || node.type === 'jsx_self_closing_element') {
    const openingNode = node.childForFieldName('opening_element') || node;
    const nameNode = openingNode.childForFieldName('name');
    return nameNode ? nameNode.text : null;
  }

  if (node.type === 'import_declaration' || node.type === 'import_from_statement' || node.type === 'import_statement' || node.type === 'preproc_include') {
    return node.text.split('\n')[0].trim();
  }

  // C/C++ Specifics
  if (node.type === 'function_definition' || node.type === 'function_declaration') {
    const declarator = node.childForFieldName('declarator');
    if (declarator) {
      const id = declarator.descendantsOfType('identifier')[0] || 
                 declarator.descendantsOfType('field_identifier')[0];
      if (id) return id.text;
    }
  }

  const nameNode = node.childForFieldName('name') ||
                   node.children.find(c => c.type === 'identifier' || c.type === 'variable_declarator' || c.type === 'type_identifier' || c.type === 'field_identifier');
  
  if (nameNode) {
    if (nameNode.type === 'variable_declarator') {
       const idNode = nameNode.childForFieldName('name') || nameNode.children.find(c => c.type === 'identifier');
       return idNode ? idNode.text : null;
    }
    return nameNode.text;
  }

  if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      const decl = node.children.find(c => c.type === 'variable_declarator');
      if (decl) return getDisplayName(decl);
  }

  if (node.type === 'method_definition' || node.type === 'function_declaration') {
     const id = node.childForFieldName('name') || node.children.find(c => c.type === 'identifier');
     if (id) return id.text;
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

function traverse(node, depth = 0, isLast = true, prefix = '') {
  const MAX_DEPTH = 6;
  if (depth > MAX_DEPTH) return '';
  const type = node.type;
  const isInteresting = INTERESTING_TYPES.has(type) || depth === 0;
  let result = '';
  let nextPrefix = prefix;
  if (isInteresting) {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const name = getDisplayName(node);
    const label = name ? `${type} [${name}]` : type;
    if (depth === 0) {
      result += `📁 ROOT (Lines: ${startLine}-${endLine})\n`;
    } else {
      result += `${prefix}${isLast ? '└── ' : '├── '}${label} (Lines: ${startLine}-${endLine})\n`;
      nextPrefix += isLast ? '    ' : '│   ';
    }
  }

  const childrenToProcess = getNextInterestingNodes(node);
  childrenToProcess.forEach((child, index) => {
    const lastChild = index === childrenToProcess.length - 1;
    result += traverse(child, depth + 1, lastChild, isInteresting ? nextPrefix : prefix);
  });
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
      // In bundled environments, we might need a more direct path to the wasm
      let tsWasmPath;
      try {
        tsWasmPath = path.join(path.dirname(require.resolve('web-tree-sitter')), 'tree-sitter.wasm');
      } catch (e) {
        // Fallback to a common location if resolve fails
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
    const tree = parser.parse(sourceCode);
    const map = traverse(tree.rootNode);

    return `📄 File Map for: ${filePath}\n${map}`;
  } catch (err) {
    // Stringify error more carefully
    const errMsg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
    const stack = err instanceof Error ? `\nStack: ${err.stack}` : '';
    return `ERROR: Failed to map file: ${errMsg}${stack}`;
  }
};
