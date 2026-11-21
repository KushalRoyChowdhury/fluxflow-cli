import http from 'node:http';
import { markRepoStarred } from './secrets_v2.js';

export const REPO_URL = 'https://github.com/KushalRoyChowdhury/fluxflow-cli';

/**
 * Spin up a tiny local HTTP server that acts as a click beacon for the
 * 'Star on GitHub' OSC 8 hyperlink. When the user clicks the link (browser
 * hits /star), we mark the repo as starred and 302-redirect them to the
 * actual GitHub repo. Server self-destructs on timeout or process exit.
 */
export const startStarServer = (timeoutMs = 5 * 60 * 1000) => {
    let clicked = false;
    const server = http.createServer((req, res) => {
        const pathname = (req.url || '/').split('?')[0];
        if (pathname !== '/star') {
            res.statusCode = 404;
            return res.end('Not found');
        }
        if (!clicked) {
            markRepoStarred();
            clicked = true;
        }
        res.writeHead(302, { Location: REPO_URL });
        res.end('Redirecting to GitHub...');
    });
    let externalResolve = null;
    const ready = new Promise((res) => { externalResolve = res; });
    server.on('error', (err) => {
        console.error(`[star-server] failed: ${err.message}`);
        externalResolve(null);
    });
    server.unref(); // never keep the CLI process alive just for this
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        externalResolve(address && address.port ? `http://127.0.0.1:${address.port}/star` : null);
    });
    const timer = setTimeout(() => {
        try { server.close(); } catch { /* already gone */ }
    }, timeoutMs);
    timer.unref();
    return { ready, server, isClicked: () => clicked };
};
