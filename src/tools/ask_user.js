import { parseArgs } from '../utils/arg_parser.js';

/**
 * Ask User Tool
 * Prompts the user with a question and multiple-choice options.
 */
export const ask_user = async (args, context) => {
    const parsed = parseArgs(args);
    const { question } = parsed;

    if (!question) return 'ERROR: Missing "question" argument for ask_user.';
    if (!context.onAskUser) return 'ERROR: onAskUser callback not provided in tool context.';

    // Parse options: optionA, optionB, etc.
    const options = [];
    Object.keys(parsed).forEach(key => {
        if (key.startsWith('option')) {
            const val = parsed[key];
            if (typeof val === 'string' && val.includes('::')) {
                const [label, desc] = val.split('::');
                options.push({ 
                    id: key, 
                    label: label.trim(), 
                    description: desc.trim() 
                });
            } else {
                options.push({ 
                    id: key, 
                    label: String(val).trim(), 
                    description: '' 
                });
            }
        }
    });

    try {
        const choice = await context.onAskUser(question, options);
        return `USER CHOOSE: ${choice}`;
    } catch (err) {
        return `ERROR: Failed to get user input: ${err.message}`;
    }
};
