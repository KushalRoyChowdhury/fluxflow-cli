/**
 * Smart Argument Parser for Tool Signals (Fidelity v3.5)
 * Handles unescaped quotes by using heuristic end-of-string detection.
 * @param {string} argsString - Raw arguments string from model tool call.
 * @param {string[]} [knownKeys=[]] - Optional array of expected parameter names.
 * @param {string[]} [strictQuoteKeys=[]] - Optional keys that strictly end at the very first unescaped quote.
 */
export const parseArgs = (argsString, knownKeys = [], strictQuoteKeys = []) => {
    const args = {};
    if (!argsString) return args;

    // Helper to match key against knownKeys (supports exact string, 'prefix*', or RegExp)
    const isKeyAllowed = (keyName) => {
        if (!Array.isArray(knownKeys) || knownKeys.length === 0) return true;
        return knownKeys.some(pattern => {
            if (pattern instanceof RegExp) return pattern.test(keyName);
            if (typeof pattern === 'string') {
                if (pattern.endsWith('*')) {
                    return keyName.startsWith(pattern.slice(0, -1));
                }
                return pattern === keyName;
            }
            return false;
        });
    };

    let i = 0;
    while (i < argsString.length) {
        // Skip whitespace and commas
        while (i < argsString.length && (/[\s,]/.test(argsString[i]))) i++;
        if (i >= argsString.length) break;

        // 1. Capture Key
        let keyMatch = argsString.substring(i).match(/^(\w+)\s*=\s*/);
        if (!keyMatch || !isKeyAllowed(keyMatch[1])) {
            i++; // Skip noise or unexpected keys
            continue;
        }
        const key = keyMatch[1];
        i += keyMatch[0].length;

        // 2. Capture Value
        let value = '';
        if (i < argsString.length && (argsString[i] === '"' || argsString[i] === "'" || argsString[i] === '`')) {
            const quote = argsString[i];
            i++; // Start after quote
            let start = i;
            let end = -1;

            // HEURISTIC SEARCH: Find the REAL closing quote
            // We look for the quote followed by [, \s] \w+ = or \s* \) or end of string
            let searchIndex = i;
            while (searchIndex < argsString.length) {
                let qIdx = argsString.indexOf(quote, searchIndex);
                if (qIdx === -1) break;

                // Check if this quote is escaped: count backslashes preceding it
                let backslashCount = 0;
                for (let k = qIdx - 1; k >= 0 && argsString[k] === '\\'; k--) {
                    backslashCount++;
                }
                if (backslashCount % 2 !== 0) {
                    searchIndex = qIdx + 1;
                    continue;
                }

                // If key is marked for strict quote-to-quote matching, the first unescaped quote IS the end!
                if (Array.isArray(strictQuoteKeys) && strictQuoteKeys.includes(key)) {
                    end = qIdx;
                    break;
                }

                // CHECK BOUNDARY: Is this quote likely the END of the argument?
                // We must be careful not to end prematurely if a newline happens to be followed by something that looks like a key
                const afterRaw = argsString.substring(qIdx + 1);
                const after = afterRaw.trim();

                // STRICTER LOGICAL END:
                // A quote is ONLY a logical end if it's followed by:
                // 1. A comma AND then another valid key= (e.g. "path", content=) - must match allowedKeys if provided
                // 2. A closing parenthesis that marks the end of the tool call (e.g. "path") ]]
                let nextArgValid = false;
                const nextKeyMatch = after.match(/^,\s*(\w+)\s*=/);
                if (nextKeyMatch) {
                    const nextKeyName = nextKeyMatch[1];
                    // If key is not in allowedKeys OR has already been captured, it CANNOT be a real argument boundary!
                    if (!isKeyAllowed(nextKeyName)) {
                        nextArgValid = false;
                    } else if (args[nextKeyName] !== undefined) {
                        nextArgValid = false; // Already captured earlier!
                    } else {
                        // 1. Highest Index Encounter: Check if this same key appears again later downstream.
                        // If it appears again later, this current occurrence is premature (inside text).
                        const downstreamText = after.substring(nextKeyMatch[0].length);
                        const nextOccurrence = downstreamText.search(new RegExp(`,\\s*${nextKeyName}\\s*=`, 'i'));
                        if (nextOccurrence !== -1) {
                            nextArgValid = false;
                        } else {
                            // 2. Candidate Argument Well-Formedness Check:
                            // Check the candidate value immediately after ", <nextKey>="
                            const candidateRest = downstreamText.trim();
                            if (candidateRest.startsWith('"') || candidateRest.startsWith("'") || candidateRest.startsWith('`')) {
                                // Quoted value candidate: must have a matching non-escaped closing quote
                                const qChar = candidateRest[0];
                                let foundClosing = false;
                                for (let p = 1; p < candidateRest.length; p++) {
                                    if (candidateRest[p] === qChar) {
                                        let bs = 0;
                                        for (let b = p - 1; b >= 0 && candidateRest[b] === '\\'; b--) bs++;
                                        if (bs % 2 === 0) {
                                            foundClosing = true;
                                            break;
                                        }
                                    }
                                }
                                nextArgValid = foundClosing;
                            } else if (candidateRest.startsWith('[')) {
                                // Array literal candidate: check for matching closing ']'
                                let balance = 0;
                                let foundClosingBracket = false;
                                for (let p = 0; p < candidateRest.length; p++) {
                                    if (candidateRest[p] === '[') balance++;
                                    else if (candidateRest[p] === ']') {
                                        balance--;
                                        if (balance === 0) {
                                            foundClosingBracket = true;
                                            break;
                                        }
                                    }
                                }
                                nextArgValid = foundClosingBracket;
                            } else {
                                // Unquoted value candidate: if it contains dangling quotes or code delimiters (e.g. World"),
                                // it indicates this is part of the outer string where model forgot real parameter!
                                const firstToken = candidateRest.split(/[,\)\s]/)[0] || '';
                                const hasDanglingQuote = /["'`]/.test(firstToken);
                                nextArgValid = !hasDanglingQuote;
                            }
                        }
                    }
                }

                const isLogicalEnd =
                    after === '' ||                    // End of entire string
                    nextArgValid ||                    // Next valid argument separator
                    (after.startsWith(')') && (after.length === 1 || /^\)\s*([,\]\s]|\[\[?tool:)/i.test(after))); // Robust Tool End

                // ADDITIONAL CHECK: If there is a newline right after the quote, and the next line doesn't look like a NEW argument, it's probably NOT the end
                if (isLogicalEnd && afterRaw.startsWith('\n')) {
                   const nextLine = after.split('\n')[0];
                   if (!nextLine.includes('=') && !nextLine.includes(')')) {
                       // This was likely a quote inside a multi-line string, keep searching
                       searchIndex = qIdx + 1;
                       continue;
                   }
                }

                if (isLogicalEnd) {
                    end = qIdx;
                    break;
                }

                // Not a logical end, skip this quote and keep searching
                searchIndex = qIdx + 1;
            }

            if (end !== -1) {
                value = argsString.substring(start, end);
                i = end + 1;
            } else {
                // Fallback: capture till end
                value = argsString.substring(start);
                i = argsString.length;
            }

            // High-fidelity unescaping
            const isPathKey = key.toLowerCase().includes('path') || ['dest', 'source', 'to', 'from'].includes(key.toLowerCase());

            // Standard unescaping logic for all strings:
            // Uses a single-pass regex to avoid order-of-operation issues (e.g. \\n becoming \n)
            value = value.replace(/\\(.)/g, (match, char) => {
                switch (char) {
                    case 'n': return '\n';
                    case 'r': return '\r';
                    case 't': return '\t';
                    case '\\': return '\\';
                    default:
                        if (char === quote) return quote;
                        return char; // Properly unescape \. \+ \( \) \* \? etc. to . + ( ) * ?
                }
            });
        } else if (i < argsString.length && argsString[i] === '[') {
            // ARRAY LITERAL DETECTION
            let balance = 0;
            let inString = null;
            let start = i;
            let end = -1;

            for (let j = i; j < argsString.length; j++) {
                const char = argsString[j];
                if (inString && char === inString) {
                    let backslashCount = 0;
                    for (let k = j - 1; k >= 0 && argsString[k] === '\\'; k--) {
                        backslashCount++;
                    }
                    if (backslashCount % 2 === 0) {
                        inString = null;
                    }
                } else if (!inString && (char === '"' || char === "'" || char === '`')) {
                    inString = char;
                }

                if (!inString) {
                    if (char === '[') balance++;
                    else if (char === ']') balance--;

                    if (balance === 0) {
                        end = j;
                        break;
                    }
                }
            }

            if (end !== -1) {
                value = argsString.substring(start, end + 1);
                i = end + 1;

                // Attempt to parse the array string into a real array
                try {
                    // Normalize for JSON: replace single quotes with double quotes
                    // This is a heuristic fix for AI-generated "messy" JSON
                    let normalized = value.trim();
                    if (normalized.startsWith("'") || normalized.includes("'")) {
                         // Simple replacement is risky, but for slide content it's often better than failing
                         // Better: try to use a more lenient parser later
                    }
                    // For now, leave it as string and let the tool's "Hiccup Handler" parse it
                } catch (e) {}
            } else {
                value = argsString.substring(start);
                i = argsString.length;
            }
        } else {
            // Unquoted value: capture everything until the next logical key= boundary or closing brackets
            let rest = argsString.substring(i);
            let boundaryMatch = rest.match(/,\s*\w+\s*=|(?:\s*\)\s*(?:$|\]\]))/);
            if (boundaryMatch) {
                let boundaryIndex = boundaryMatch.index;
                value = rest.substring(0, boundaryIndex).trim();
                i += boundaryIndex;
            } else {
                value = rest.trim();
                i = argsString.length;
            }
        }

        // Type conversion
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') value = Number(value);

        // [PATH-SENTRY] Path Sanitization
        if (typeof value === 'string' && (key.toLowerCase().includes('path') || ['dest', 'source', 'to', 'from'].includes(key.toLowerCase()))) {
            value = value.replace(/\x0C/g, '\\f').replace(/\x0D/g, '\\r').replace(/\x0B/g, '\\v').replace(/\x08/g, '\\b');
        }

        args[key] = value;
    }

    return args;
};
