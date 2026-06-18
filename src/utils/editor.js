import { WebSocket } from 'ws';

let ws = null;
let isConnecting = false;
const BRIDGE_URL = 'ws://localhost:56832';
const messageQueue = [];
let contextResolver = null;
let securityListener = null;

let cliVersion = '2.0.0'; // Default fallback

export const initBridge = (version) => {
    cliVersion = version;
    connect();
};

export const registerSecurityListener = (callback) => {
    securityListener = callback;
};

const connect = () => {
    if (ws || isConnecting) return;
    isConnecting = true;
    const socket = new WebSocket(BRIDGE_URL);
    socket.on('open', () => {
        ws = socket;
        isConnecting = false;

        // Handshake: Send current CLI version, PID, and PPID
        ws.send(JSON.stringify({
            command: 'version',
            version: cliVersion,
            pid: process.pid,
            ppid: process.ppid
        }));

        while (messageQueue.length > 0) {
            ws.send(JSON.stringify(messageQueue.shift()));
        }
    });
    socket.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.command === 'contextResponse' && contextResolver) {
                contextResolver(msg.data);
                contextResolver = null;
            } else if (msg.command === 'securityResponse' && securityListener) {
                securityListener(msg.result);
            }
        } catch (e) { }
    });
    socket.on('error', () => { isConnecting = false; ws = null; });
    socket.on('close', () => { isConnecting = false; ws = null; });
};

const send = (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    } else {
        messageQueue.push(payload);
        if (!isConnecting) connect();
    }
};

export const isBridgeConnected = () => {
    return ws !== null && ws.readyState === WebSocket.OPEN;
};

export const sendStatus = (status) => {
    send({
        command: 'status',
        status: status
    });
};

export const getIDEContext = () => {
    return new Promise((resolve) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            resolve({ cursor_line: 0, selected: 0, manual_edits: "", file_focused: "none", opened_editors: [] });
            return;
        }
        contextResolver = resolve;
        ws.send(JSON.stringify({ command: 'requestContext' }));
        setTimeout(() => {
            if (contextResolver === resolve) {
                resolve({ cursor_line: 0, selected: 0, manual_edits: "", file_focused: "none", opened_editors: [] });
                contextResolver = null;
            }
        }, 1000);
    });
};

export const openFileInEditor = (filePath) => {
    send({ command: 'open', filePath });
};

export const showDiffInIDE = (filePath, originalContent, modifiedContent) => {
    send({ command: 'showDiff', filePath, originalContent, modifiedContent });
};

export const closeDiffInIDE = (filePath, result) => {
    send({ command: 'closeDiff', filePath, result });
};

export const highlightDiffInEditor = (filePath, diffText) => {
    const addedLines = [];
    const lines = diffText.split(/\r?\n/);

    let inDiffBlock = false;
    for (const line of lines) {
        if (line.includes('[DIFF_START]')) { inDiffBlock = true; continue; }
        if (line.includes('[DIFF_END]')) { inDiffBlock = false; continue; }

        if (inDiffBlock) {
            // More robust matching: handle whitespace and ensure we get the full number
            const match = line.match(/^\s*\+(\d+)\|/);
            if (match) {
                addedLines.push(parseInt(match[1]) - 1);
            }
        }
    }

    if (addedLines.length > 0) {
        // If we have gaps (like your 1404 ... 1407), fill them in
        // because usually a diff block is contiguous.
        const min = Math.min(...addedLines);
        const max = Math.max(...addedLines);
        const filledLines = [];
        for (let i = min; i <= max; i++) {
            filledLines.push(i);
        }

        send({
            command: 'diff',
            filePath,
            addedLines: filledLines
        });
    }
};
