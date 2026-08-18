#!/usr/bin/env node
import os from 'os';
import path from 'path';
import { enableCompileCache } from 'node:module';

const cacheDir = path.join(os.homedir(), '.fluxflow', '.cache');

if (typeof enableCompileCache === 'function') {
    try {
        enableCompileCache(cacheDir);
    } catch {
        try {
            enableCompileCache();
        } catch {}
    }
}

await import('./cli.js');
