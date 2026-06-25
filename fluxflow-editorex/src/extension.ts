import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';

let wss: WebSocketServer | undefined;
let lastDiffTimestamp = 0;
let lastCursorLine = 0;
const activeDecs: vscode.TextEditorDecorationType[] = [];
let statusBarItem: vscode.StatusBarItem;
let isCliConnected = false;
let fluxFlowTerminal: vscode.Terminal | undefined;

const lastKnownStates = new Map<string, string>();
const originalStates = new Map<string, string>();
const virtualDocs = new Map<string, string>();
const newFilesCreatedByBridge = new Set<string>();
const accumulatedEdits = new Map<string, Map<number, string>>();
const manualEditBaseContents = new Map<string, string[]>();

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
        fluxFlowTerminal = terminal;
        terminal.show();
        terminal.sendText('fluxflow');
    }));

    // Register command to focus the FluxFlow terminal
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.chat', async () => {
        if (fluxFlowTerminal) {
            fluxFlowTerminal.show(false);
        } else {
            // Fallback: try finding by name if PID link wasn't established
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
                terminal.show(false);
            } else {
                const newTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal = newTerminal;
                newTerminal.show(false);
                await newTerminal.processId;
                newTerminal.sendText('fluxflow');
            }
        }
    }));

    // Register command to fix errors
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.fixErrors', async () => {
        const editor = vscode.window.activeTextEditor;
        const allDiags = vscode.languages.getDiagnostics();
        const brokenFiles = allDiags.filter(([uri, diags]) => diags.some(d => d.severity === vscode.DiagnosticSeverity.Error));
        
        let command = "";
        if (brokenFiles.length === 1) {
            const fileName = path.basename(brokenFiles[0][0].fsPath);
            command = `Fix the errors in ${fileName}`;
        } else if (brokenFiles.length > 1) {
            command = `Fix the errors in the workspace (${brokenFiles.length} files broken)`;
        } else if (editor) {
            const fileName = path.basename(editor.document.fileName);
            command = `Fix the errors in ${fileName}`;
        } else {
            command = "Fix the errors in the workspace";
        }

        if (!fluxFlowTerminal) {
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
            } else {
                fluxFlowTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal.show(false);
                await fluxFlowTerminal.processId;
                fluxFlowTerminal.sendText('fluxflow');
                await new Promise(r => setTimeout(r, 2500));
            }
        }

        fluxFlowTerminal.show(false);
        await fluxFlowTerminal.processId;
        setTimeout(() => {
            fluxFlowTerminal?.sendText(command, true);
        }, 500);
    }));

    // Register command to fix warnings
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.fixWarnings', async () => {
        const editor = vscode.window.activeTextEditor;
        const allDiags = vscode.languages.getDiagnostics();
        const warningFiles = allDiags.filter(([uri, diags]) => diags.some(d => d.severity === vscode.DiagnosticSeverity.Warning));
        
        let command = "";
        if (warningFiles.length === 1) {
            const fileName = path.basename(warningFiles[0][0].fsPath);
            command = `Fix the lint warnings in ${fileName}`;
        } else if (warningFiles.length > 1) {
            command = `Fix the lint warnings in the workspace (${warningFiles.length} files with warnings)`;
        } else if (editor) {
            const fileName = path.basename(editor.document.fileName);
            command = `Fix the lint warnings in ${fileName}`;
        } else {
            command = "Fix the lint warnings in the workspace";
        }

        if (!fluxFlowTerminal) {
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
            } else {
                fluxFlowTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal.show(false);
                await fluxFlowTerminal.processId;
                fluxFlowTerminal.sendText('fluxflow');
                await new Promise(r => setTimeout(r, 2500));
            }
        }

        fluxFlowTerminal.show(false);
        await fluxFlowTerminal.processId;
        setTimeout(() => {
            fluxFlowTerminal?.sendText(command, true);
        }, 500);
    }));

    // Register commands for Accept/Deny from Title Bar
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.acceptDiff', () => {
        wss?.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ command: 'securityResponse', result: 'allow' }));
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.denyDiff', () => {
        wss?.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ command: 'securityResponse', result: 'deny' }));
            }
        });
    }));

    // Cleanup reference if terminal is closed manually
    context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === fluxFlowTerminal) {
            fluxFlowTerminal = undefined;
        }
    }));

    // Background Diagnostic Scanner
    const updateErrorContext = () => {
        const allDiags = vscode.languages.getDiagnostics();
        let hasErrors = false;
        let hasWarnings = false;
        let activeFileHasWarnings = false;

        const activeEditor = vscode.window.activeTextEditor;

        for (const [uri, diags] of allDiags) {
            const fileHasErrors = diags.some(d => d.severity === vscode.DiagnosticSeverity.Error);
            const fileHasWarnings = diags.some(d => d.severity === vscode.DiagnosticSeverity.Warning);

            if (fileHasErrors) hasErrors = true;
            if (fileHasWarnings) hasWarnings = true;

            if (activeEditor && uri.fsPath === activeEditor.document.uri.fsPath) {
                if (fileHasWarnings) activeFileHasWarnings = true;
            }
        }

        vscode.commands.executeCommand('setContext', 'fluxflow.hasErrors', hasErrors);
        vscode.commands.executeCommand('setContext', 'fluxflow.hasWarnings', hasWarnings);
        vscode.commands.executeCommand('setContext', 'fluxflow.activeFileHasWarnings', activeFileHasWarnings);

        // Update Diff Visibility Context
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        const isDiff = activeTab?.input instanceof vscode.TabInputTextDiff && 
                       activeTab.input.original.scheme === 'fluxflow-diff';
        vscode.commands.executeCommand('setContext', 'fluxflow.isDiffVisible', isDiff);
    };

    context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(updateErrorContext));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        updateErrorContext();
        // Clear cache first when file changes/closes
        lastCursorLine = 0;
        if (editor) {
            lastCursorLine = editor.selection.active.line + 1;
        }
    }));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(() => updateErrorContext()));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabGroups(() => updateErrorContext()));
    updateErrorContext();

    // Code Action Provider (The Lightbulb)
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('*', {
            provideCodeActions(document, range, context) {
                const diagnostics = context.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                if (diagnostics.length === 0) return [];

                const action = new vscode.CodeAction('Fix with FluxFlow', vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'fluxflow-editorex.fixErrors',
                    title: 'Fix with FluxFlow'
                };
                action.isPreferred = true;
                return [action];
            }
        })
    );

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
                
                // When receiving PID, find and link the terminal
                if (message.pid) {
                    let found = false;
                    for (const t of vscode.window.terminals) {
                        const tpid = await t.processId;
                        // Match if shell PID is either the CLI PID or the CLI Parent PID
                        if (tpid === message.pid || tpid === message.ppid) {
                            fluxFlowTerminal = t;
                            found = true;
                            break;
                        }
                    }

                    // If still not found and there's an active terminal, 
                    // assume it's the one that just connected (high probability)
                    if (!found && vscode.window.activeTerminal) {
                        fluxFlowTerminal = vscode.window.activeTerminal;
                    }
                }

                if (message.command === 'requestContext') {
                    const ctx = await getIDEContext();
                    ws.send(JSON.stringify({ command: 'contextResponse', data: ctx }));
                    accumulatedEdits.clear();
                    manualEditBaseContents.clear();
                } else if (message.command === 'status') {
                    updateStatusBar(message.status);
                } else if (message.command === 'version') {
                    const majorVersion = parseInt(message.version?.split('.')[0] || '0');
                    if (majorVersion < 2) {
                        vscode.window.showErrorMessage(`FluxFlow Companion Error: CLI version ${message.version} is not supported. Please update FluxFlow CLI to 2.0.0 or later.`);
                        ws?.close();
                        return;
                    }
                } else {
                    await handleMessage(message, ws);
                }
            } catch (err) {
                console.error('Error:', err);
            }
        });
        ws.on('close', () => {
            isCliConnected = (wss?.clients.size || 0) > 0;
            if (!isCliConnected) {
                fluxFlowTerminal = undefined;
            }
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

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        if (e.selections.length > 0) {
            lastCursorLine = e.selections[0].active.line + 1;
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(cleanup));

    // Initialize lastKnownStates for currently open documents
    vscode.workspace.textDocuments.forEach(doc => {
        if (!doc.isUntitled && !doc.fileName.includes('.git')) {
            lastKnownStates.set(doc.fileName, doc.getText());
        }
    });

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (!doc.isUntitled && !doc.fileName.includes('.git')) {
            lastKnownStates.set(doc.fileName, doc.getText());
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        cleanup();

        const doc = e.document;
        if (doc.isUntitled || doc.fileName.includes('.git')) {
            return;
        }
        const docPath = doc.fileName;
        const currentContent = doc.getText();
        const lastContent = lastKnownStates.get(docPath);
        if (lastContent !== undefined && lastContent !== currentContent) {
            const currentLines = currentContent.split(/\r?\n/);
            const lastLines = lastContent.split(/\r?\n/);
            
            // Capture baseline content if not already present
            if (!manualEditBaseContents.has(docPath)) {
                manualEditBaseContents.set(docPath, lastLines);
            }
            const baseLines = manualEditBaseContents.get(docPath)!;

            let fileMap = accumulatedEdits.get(docPath);
            if (!fileMap) {
                fileMap = new Map<number, string>();
            }

            currentLines.forEach((line, idx) => {
                if (line !== lastLines[idx]) {
                    const originalLine = baseLines[idx] !== undefined ? baseLines[idx] : "";
                    if (line.trim() === originalLine.trim()) {
                        fileMap!.delete(idx + 1);
                    } else {
                        fileMap!.set(idx + 1, line.trim());
                    }
                }
            });

            // Move the file map to the end to maintain insertion order of most recent edits
            accumulatedEdits.delete(docPath);
            if (fileMap.size > 0) {
                accumulatedEdits.set(docPath, fileMap);
            } else {
                manualEditBaseContents.delete(docPath);
            }
        }
        lastKnownStates.set(docPath, currentContent);
    }));

    // Terminal Link Provider (Clickable File Paths)
    context.subscriptions.push(vscode.window.registerTerminalLinkProvider({
        provideTerminalLinks: (context: vscode.TerminalLinkContext, token: vscode.CancellationToken) => {
            const links: (vscode.TerminalLink & { path: string, line?: number })[] = [];
            
            // Match paths like src/app.js:42 or D:\path\file.ts:10
            // Also matches simple paths like src/app.js
            const regex = /((?:[a-zA-Z]:\\|[./\\])[^ \n\r\t:"']+\.[a-zA-Z0-9]+)(?::(\d+))?/g;
            
            let match;
            while ((match = regex.exec(context.line)) !== null) {
                const fullPath = match[1];
                const lineNumber = match[2] ? parseInt(match[2]) : undefined;
                
                links.push({
                    startIndex: match.index,
                    length: match[0].length,
                    tooltip: `Open ${path.basename(fullPath)}${lineNumber ? ` at line ${lineNumber}` : ''}`,
                    path: fullPath,
                    line: lineNumber
                });
            }
            return links;
        },
        handleTerminalLink: async (link: any) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let absolutePath = link.path;
            
            if (!path.isAbsolute(absolutePath) && workspaceFolders) {
                absolutePath = path.resolve(workspaceFolders[0].uri.fsPath, absolutePath);
            }

            if (fs.existsSync(absolutePath)) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
                const editor = await vscode.window.showTextDocument(doc);
                
                if (link.line) {
                    const pos = new vscode.Position(link.line - 1, 0);
                    editor.selection = new vscode.Selection(pos, pos);
                    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                }
            } else {
                vscode.window.showErrorMessage(`Could not find file: ${link.path}`);
            }
        }
    }));

    context.subscriptions.push({ dispose: () => wss?.close() });
}

function updateStatusBar(status?: string) {
    if (isCliConnected) {
        statusBarItem.text = `$(zap) FluxFlow: ${status || 'Connected'}`;
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
        cursor_line: lastCursorLine,
        selected: 0,
        manual_edits: "",
        full_content: "",
        file_focused: activeEditor ? activeEditor.document.fileName : "none",
        opened_editors: [...new Set(openedEditors)],
        diagnostics: "",
        warnings: ""
    };

    if (activeEditor) {
        const selection = activeEditor.selection;
        lastCursorLine = selection.active.line + 1;
        context.cursor_line = lastCursorLine;
        if (!selection.isEmpty) {
            context.selected = activeEditor.document.getText(selection);
        }

        const filePath = activeEditor.document.fileName;
        
        // Aggregated Workspace Diagnostics (Errors & Warnings)
        const allDiags = vscode.languages.getDiagnostics();
        const workspaceErrors: string[] = [];
        const workspaceWarnings: string[] = [];
        let errorFileCount = 0;
        let warningFileCount = 0;

        for (const [uri, diags] of allDiags) {
            const relPath = vscode.workspace.asRelativePath(uri);
            
            // Collect Errors
            if (errorFileCount < 10) {
                const errors = diags
                    .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                    .map(d => `  Line ${d.range.start.line + 1}: ${d.message}`);
                
                if (errors.length > 0) {
                    workspaceErrors.push(`File: ${relPath}\n${errors.join('\n')}`);
                    errorFileCount++;
                }
            }

            // Collect Warnings
            if (warningFileCount < 10) {
                const warnings = diags
                    .filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
                    .map(d => `  Line ${d.range.start.line + 1}: ${d.message}`);
                
                if (warnings.length > 0) {
                    workspaceWarnings.push(`File: ${relPath}\n${warnings.join('\n')}`);
                    warningFileCount++;
                }
            }
        }

        if (workspaceErrors.length > 0) {
            context.diagnostics = `[WORKSPACE ERRORS]:\n${workspaceErrors.join('\n\n')}`;
        }
        if (workspaceWarnings.length > 0) {
            context.warnings = `[WORKSPACE WARNINGS/LINT]:\n${workspaceWarnings.join('\n\n')}`;
        }

        context.full_content = activeEditor.document.getText();

        if (accumulatedEdits.size > 0) {
            const manualEditsParts: string[] = [];
            accumulatedEdits.forEach((fileMap, docPath) => {
                if (fileMap.size > 0) {
                    const fileEdits: string[] = [];
                    // Sort lines by line number
                    const sortedLines = Array.from(fileMap.keys()).sort((a, b) => a - b);
                    sortedLines.forEach(lineNum => {
                        fileEdits.push(`    Line ${lineNum}: ${fileMap.get(lineNum)}`);
                    });
                    const relPath = vscode.workspace.asRelativePath(docPath);
                    manualEditsParts.push(`${relPath}:\n${fileEdits.join('\n')}`);
                }
            });
            context.manual_edits = manualEditsParts.join('\n');
        }
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
            // Store original state for robust denial/revert
            originalStates.set(uri.fsPath.toLowerCase(), originalContent !== undefined ? originalContent : doc.getText());
            
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
            const targetPath = uri.fsPath.toLowerCase();
            const tabsToClose: vscode.Tab[] = [];

            // 1. Identify all matching tabs first
            for (const group of vscode.window.tabGroups.all) {
                for (const tab of group.tabs) {
                    if (tab.input instanceof vscode.TabInputTextDiff &&
                        tab.input.original.scheme === 'fluxflow-diff') {
                        const tabPath = (tab.input.modified as vscode.Uri).fsPath.toLowerCase();
                        if (tabPath === targetPath) {
                            tabsToClose.push(tab);
                        }
                    }
                }
            }

            // 2. Perform restoration/save logic in background
            if (result === 'deny') {
                try {
                    const original = originalStates.get(targetPath);
                    if (original !== undefined) {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const wsEdit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            doc.positionAt(0),
                            doc.positionAt(doc.getText().length)
                        );
                        wsEdit.replace(uri, fullRange, original);
                        await vscode.workspace.applyEdit(wsEdit);
                        await doc.save();
                    } else {
                        // Fallback revert
                        await vscode.commands.executeCommand('workbench.action.files.revert', uri);
                    }
                    
                    // If it was a new file created by us, delete it from disk
                    if (newFilesCreatedByBridge.has(targetPath)) {
                        if (fs.existsSync(targetPath)) {
                            fs.unlinkSync(targetPath);
                        }
                    }
                } catch (e) {}
            } else if (result === 'allow') {
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await doc.save();
                } catch (e) {}
            }

            // 3. Cleanup state
            originalStates.delete(targetPath);
            newFilesCreatedByBridge.delete(targetPath);

            // 4. Close the tabs
            for (const tab of tabsToClose) {
                try {
                    await vscode.window.tabGroups.close(tab);
                } catch (e) {}
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
