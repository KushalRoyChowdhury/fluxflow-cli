#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.jsx';

// 1. SUPPRESS NOISE: Block Node.js deprecation warnings and internal library logs
process.env.NODE_NO_WARNINGS = '1';

// 2. LOG HIJACKER: Silence diagnostic noise from libraries (like cuimp) that leak to stdout
const silentPatterns = [
    'cuimp',
    'Found existing binary',
    'Binary verified',
    'curl.exe not found',
    'Falling back to .bat file',
    'DeprecationWarning'
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

// 3. CLEAN SLATE: Hard reset terminal for Ink rendering
process.stdout.write('\x1Bc');

render(<App />);
