#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Resolve paths relative to this absolute CJS root
const CLI_PATH = path.join(__dirname, 'src', 'cli.jsx');

// Run through the current Node binary with tsx's ESM loader instead of spawning
// a shell + tsx.cmd. Avoids shell startup and .cmd resolution overhead.
const flux = spawn(process.execPath, ['--import', 'tsx', CLI_PATH], {
    stdio: 'inherit',
    cwd: __dirname
});

flux.on('exit', (code) => {
    process.exit(code || 0);
});
