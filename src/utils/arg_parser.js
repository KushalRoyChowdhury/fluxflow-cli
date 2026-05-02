/**
 * Smart Argument Parser for Tool Signals (Fidelity v2.0)
 * Handles unescaped quotes by using heuristic end-of-string detection.
 */
export const parseArgs = (argsString) => {
    const args = {};
    if (!argsString) return args;

    let i = 0;
    while (i < argsString.length) {
        // Skip whitespace and commas
        while (i < argsString.length && (/[\s,]/.test(argsString[i]))) i++;
        if (i >= argsString.length) break;

        // 1. Capture Key
        let keyMatch = argsString.substring(i).match(/^(\w+)\s*=\s*/);
        if (!keyMatch) {
            i++; // Skip noise
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

                // Check if this quote is escaped
                if (argsString[qIdx - 1] === '\\' && argsString[qIdx - 2] !== '\\') {
                    searchIndex = qIdx + 1;
                    continue;
                }

                // CHECK BOUNDARY: Is this quote likely the END of the argument?
                const after = argsString.substring(qIdx + 1).trim();
                const isLogicalEnd = 
                    after === '' ||                    // End of entire string
                    after.startsWith(')') ||           // End of tool call
                    after.startsWith(',') ||           // Next argument separator
                    /^(\w+)\s*=/.test(after);          // Next argument key=

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
            try {
                // Only use JSON.parse if it looks like it might have escapes
                if (value.includes('\\')) {
                    value = JSON.parse(`"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
                }
            } catch (e) {
                value = value
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'")
                    .replace(/\\`/g, '`')
                    .replace(/\\\\/g, '\\');
            }
        } else {
            // Unquoted value
            let endMatch = argsString.substring(i).match(/([^,\s\)]+)/);
            if (endMatch) {
                value = endMatch[1];
                i += value.length;
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
