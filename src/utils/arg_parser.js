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
                    after.startsWith(',') ||           // Next argument separator
                    /^(\w+)\s*=/.test(after) ||        // Next argument key=
                    (after.startsWith(')') && (after.length === 1 || /^\)\s*([,\]\s]|tool:)/i.test(after))); // Robust Tool End

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
                    // Surgical escape: Only escape quotes that are NOT already escaped
                    const surgicalValue = value.replace(/(^|[^\\])"/g, '$1\\"');
                    value = JSON.parse(`"${surgicalValue.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
                }
            } catch (e) {
                value = value
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'")
                    .replace(/\\`/g, '`')
                    .replace(/\\\\/g, '\\')
                    .replace(/\\n/g, '\n');
            }
        } else if (i < argsString.length && argsString[i] === '[') {
            // ARRAY LITERAL DETECTION
            let balance = 0;
            let inString = null;
            let start = i;
            let end = -1;

            for (let j = i; j < argsString.length; j++) {
                const char = argsString[j];
                if (!inString && (char === '"' || char === "'" || char === '`')) {
                    inString = char;
                } else if (inString && char === inString && argsString[j - 1] !== '\\') {
                    inString = null;
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
