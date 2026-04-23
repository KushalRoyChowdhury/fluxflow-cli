/**
 * Smart Argument Parser for Tool Signals
 * Handles key="val", key='val', key=123, key=true
 */
export const parseArgs = (argsString) => {
    const args = {};
    
    // Pattern to match key=value pairs
    // Group 1: key
    // Group 2: value (unquoted or starting with quote)
    // We use a more comprehensive regex to catch various types
    const regex = /(\w+)\s*=\s*(?:(["'])((?:\\.|(?!\2)[\s\S])*)\2|([^,\s\)]+))/g;
    
    let match;
    while ((match = regex.exec(argsString)) !== null) {
        const key = match[1];
        let value = match[3] !== undefined ? match[3] : match[4];
        
        // Unescape strings using JSON.parse logic for high-fidelity
        if (match[3] !== undefined) {
            try {
                // Wrap in quotes and parse to handle all escapes (\n, \t, \", etc) correctly
                value = JSON.parse(`"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
            } catch (e) {
                // Fallback for messy inputs
                value = value
                    .replace(/\\"/g, '"')
                    .replace(/\\'/g, "'")
                    .replace(/\\\\/g, '\\');
            }
        }

        // Type conversion
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') value = Number(value);
        
        args[key] = value;
    }
    
    return args;
};
