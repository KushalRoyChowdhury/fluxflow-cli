import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';

let wss: WebSocketServer | undefined;
let lastDiffTimestamp = 0;
const activeDecs: vscode.TextEditorDecorationType[] = [];
let statusBarItem: vscode.StatusBarItem;
let isCliConnected = false;

const lastKnownStates = new Map<string, string>();
const virtualDocs = new Map<string, string>();
const newFilesCreatedByBridge = new Set<string>();

class FluxFlowDiffProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
        return virtualDocs.get(uri.toString()) || '';
    }
}

export function activate(context: vscode.ExtensionContext) {
    const diffProvider = new FluxFlowDiffProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('fluxflow-diff', diffProvider));

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'fluxflow-editorex.startCompanion';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    statusBarItem.show();

    // Register command to launch CLI
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorx.run', () => {
        const terminal = vscode.window.createTerminal('FluxFlow');
        terminal.show();
        terminal.sendText('fluxflow');
    }));

    // Register command so clicking the status bar doesn't errort
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.startCompanion', () => {
        if (isCliConnected) {
            vscode.window.showInformationMessage('FluxFlow Companion is connected and active.');
        } else {
            vscode.window.showWarningMessage('Start FluxFlow CLI in your terminal to enable IDE features.');
        }
    }));

    const port = 56832;
    wss = new WebSocketServer({ port });

    wss.on('connection', (ws: WebSocket) => {
        isCliConnected = true;
        updateStatusBar();
        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.command === 'requestContext') {
                    const ctx = await getIDEContext();
                    ws.send(JSON.stringify({ command: 'contextResponse', data: ctx }));
                } else {
                    await handleMessage(message, ws);
                }
            } catch (err) {
                console.error('Error:', err);
            }
        });
        ws.on('close', () => {
            isCliConnected = (wss?.clients.size || 0) > 0;
            updateStatusBar();
        });
    });

    setInterval(() => {
        const currentlyConnected = (wss?.clients.size || 0) > 0;
        if (currentlyConnected !== isCliConnected) {
            isCliConnected = currentlyConnected;
            updateStatusBar();
        }
    }, 5000);

    const decorationAdded = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.15)',
        isWholeLine: true,
    });

    const cleanup = () => {
        if (Date.now() - lastDiffTimestamp < 1500) {
            return;
        }
        while(activeDecs.length > 0) {
            const d = activeDecs.pop();
            if (d) d.dispose();
        }
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(decorationAdded, []);
        });
    };

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(cleanup));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(cleanup));
    context.subscriptions.push({ dispose: () => wss?.close() });
}

function updateStatusBar() {
    if (isCliConnected) {
        statusBarItem.text = `$(zap) FluxFlow: Connected`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
    } else {
        statusBarItem.text = `$(circle-slash) FluxFlow: Not Running`;
        statusBarItem.backgroundColor = undefined;
    }
}

async function getIDEContext() {
    const activeEditor = vscode.window.activeTextEditor;
    const openedEditors: string[] = [];
    try {
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    openedEditors.push(tab.input.uri.fsPath);
                }
            }
        }
    } catch (e) {
        vscode.workspace.textDocuments.forEach(doc => {
            if (!doc.isUntitled && !doc.fileName.includes('.git')) {
                openedEditors.push(doc.fileName);
            }
        });
    }

    let context: any = {
        cursor_line: 0,
        selected: 0,
        manual_edits: "",
        full_content: "",
        file_focused: activeEditor ? activeEditor.document.fileName : "none",
        opened_editors: [...new Set(openedEditors)]
    };

    if (activeEditor) {
        const selection = activeEditor.selection;
        context.cursor_line = selection.active.line + 1;
        if (!selection.isEmpty) {
            context.selected = activeEditor.document.getText(selection);
        }

        const filePath = activeEditor.document.fileName;
        const currentContent = activeEditor.document.getText();
        context.full_content = currentContent;
        const lastContent = lastKnownStates.get(filePath);

        if (lastContent && lastContent !== currentContent) {
            const currentLines = currentContent.split(/\r?\n/);
            const lastLines = lastContent.split(/\r?\n/);
            const edits: string[] = [];
            currentLines.forEach((line, idx) => {
                if (line !== lastLines[idx]) {
                    edits.push(`Line ${idx + 1}: ${line}`);
                }
            });
            context.manual_edits = edits.join('\n');
        }
        lastKnownStates.set(filePath, currentContent);
    }

    return context;
}

async function handleMessage(message: any, ws?: WebSocket) {
    const { command, version, filePath, addedLines, originalContent, modifiedContent, result } = message;

    if (command === 'version') {
        const majorVersion = parseInt(version?.split('.')[0] || '0');
        if (majorVersion < 2) {
            vscode.window.showErrorMessage(`FluxFlow Companion Error: CLI version ${version} is not supported. Please update FluxFlow CLI to 2.0.0 or later.`);
            ws?.close();
            return;
        }
        return;
    }

    if (!filePath) return;

    // Use absolute path
    const uri = vscode.Uri.file(filePath);

    try {
        if (command === 'open') {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
            lastKnownStates.set(doc.fileName, doc.getText());
        }
        else if (command === 'diff') {
            lastDiffTimestamp = Date.now();
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false });
        }
        else if (command === 'showDiff') {
            // Handle new file creation placeholder
            if (!fs.existsSync(uri.fsPath)) {
                const parentDir = path.dirname(uri.fsPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.writeFileSync(uri.fsPath, '');
                newFilesCreatedByBridge.add(uri.fsPath.toLowerCase());
            }

            const doc = await vscode.workspace.openTextDocument(uri);
            // Open doc with preserveFocus: true
            const editor = await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

            // Setup virtual document for the left side (Original)
            const virtualUri = vscode.Uri.parse(`fluxflow-diff://original/${path.basename(filePath)}?${Date.now()}`);
            virtualDocs.set(virtualUri.toString(), originalContent !== undefined ? originalContent : doc.getText());

            // Apply modified content to the REAL document buffer (unsaved)
            if (modifiedContent !== undefined) {
                await editor.edit(editBuilder => {
                    const fullRange = new vscode.Range(
                        doc.positionAt(0),
                        doc.positionAt(doc.getText().length)
                    );
                    editBuilder.replace(fullRange, modifiedContent);
                });
            }

            // Open side-by-side diff with preserveFocus: true
            await vscode.commands.executeCommand('vscode.diff',
                virtualUri,
                uri,
                `${path.basename(filePath)} (Original) ↔ Modified (AI)`,
                { preserveFocus: true }
            );
        }
        else if (command === 'save') {
            const doc = await vscode.workspace.openTextDocument(uri);
            await doc.save();
        }
        else if (command === 'closeDiff') {
            const tabGroups = vscode.window.tabGroups.all;
            const targetPath = uri.fsPath.toLowerCase();

            for (const group of tabGroups) {
                for (const tab of group.tabs) {
                    if (tab.input instanceof vscode.TabInputTextDiff &&
                        tab.input.original.scheme === 'fluxflow-diff') {

                        const tabPath = tab.input.modified.fsPath.toLowerCase();
                        if (tabPath === targetPath) {
                            if (result === 'deny') {
                                try {
                                    await vscode.commands.executeCommand('workbench.action.files.revert', tab.input.modified);
                                    // If it was a new file created by us, delete it from disk
                                    if (newFilesCreatedByBridge.has(targetPath)) {
                                        await vscode.workspace.fs.delete(tab.input.modified, { recursive: false });
                                    }
                                } catch (e) {}
                            } else if (result === 'allow') {
                                try {
                                    const doc = await vscode.workspace.openTextDocument(tab.input.modified);
                                    await doc.save();
                                } catch (e) {}
                            }

                            newFilesCreatedByBridge.delete(targetPath);
                            await vscode.window.tabGroups.close(tab);
                        }
                    }
                }
            }
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`FluxFlow Companion Error [${command}]: ${err.message}`);
        console.error(`FluxFlow Companion Error [${command}]:`, err);
    }
}

export function deactivate() {
    wss?.close();
}
