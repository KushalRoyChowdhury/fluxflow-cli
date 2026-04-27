#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * AUTO-HEAP SCALER (4GB)
 * This ensures the agent can handle massive sessions and large project scans
 * without hitting Node's default memory limits.
 */
const HEAP_LIMIT = 4096;
const isBundled = fileURLToPath(import.meta.url).endsWith('.js');

if (isBundled && !process.execArgv.some(arg => arg.includes('max-old-space-size'))) {
    const cp = spawn(process.execPath, [
        `--max-old-space-size=${HEAP_LIMIT}`,
        fileURLToPath(import.meta.url),
        ...process.argv.slice(2)
    ], { stdio: 'inherit' });
    cp.on('exit', (code) => process.exit(code || 0));
} else {
    // START APPLICATION
    const { default: React } = await import('react');
    const { render } = await import('ink');
    const { default: App } = await import('./app.jsx');

    // 1. SUPPRESS NOISE
    process.env.NODE_NO_WARNINGS = '1';

    // 2. LOG HIJACKER
    const silentPatterns = [
        'cuimp', 'Found existing binary', 'Binary verified',
        'curl.exe not found', 'Falling back to .bat file', 'DeprecationWarning'
    ];

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const isNoise = (args) => {
        const msg = args.map(String).join(' ');
        return silentPatterns.some(p => msg.includes(p));
    };

    console.log = (...args) => !isNoise(args) && originalLog(...args);
    console.warn = (...args) => !isNoise(args) && originalWarn(...args);
    console.error = (...args) => !isNoise(args) && originalError(...args);

    // 3. CLEAN SLATE
    process.stdout.write('\x1Bc');

    render(<App />);
}
