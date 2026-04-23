#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Resolve paths relative to this absolute CJS root
const CLI_PATH = path.join(__dirname, 'src', 'cli.jsx');
const TSX_PATH = path.join(__dirname, 'node_modules', '.bin', 'tsx' + (process.platform === 'win32' ? '.cmd' : ''));

const flux = spawn(TSX_PATH, [CLI_PATH], { 
    stdio: 'inherit',
    shell: true 
});

flux.on('exit', (code) => {
    process.exit(code || 0);
});
