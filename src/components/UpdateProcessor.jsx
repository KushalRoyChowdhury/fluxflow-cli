import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { spawn } from 'child_process';

let pty = null;
try {
    const ptyModule = await import('node-pty');
    pty = ptyModule.default || ptyModule;
    pty = false;
} catch (err) {}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const UpdateProcessor = ({ latest, current, settings, onClose, onUpdateSettings, onSuccess }) => {
    const [status, setStatus] = useState('initializing'); // initializing, downloading, success, error
    const [log, setLog] = useState('');
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);

    // Drive the custom spinner animation
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => (t + 1) % 1000);
        }, 33);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let child;
        const runUpdate = async () => {
            const manager = settings.updateManager || 'npm';

            // If they haven't picked a manager yet, we need to send them to settings
            if (!settings.updateManager) {
                onUpdateSettings();
                return;
            }

            let command = '';
            if (manager === 'pnpm') command = `pnpm add -g fluxflow-cli@${latest}`;
            else if (manager === 'bun') command = `bun add -g fluxflow-cli@${latest}`;
            else if (manager === 'yarn') command = `yarn global add fluxflow-cli@${latest}`;
            else if (manager === 'custom') command = settings.customUpdateCommand;
            else command = `npm install -g fluxflow-cli@${latest}`;

            setStatus('downloading');
            setLog(`Running: ${command}...`);

            const isWin = process.platform === 'win32';

            const executeCommand = (usePowerShell) => {
                return new Promise((resolve) => {
                    const shell = isWin ? (usePowerShell ? 'powershell.exe' : 'cmd.exe') : (process.env.SHELL || 'bash');
                    const shellArgs = isWin ? (usePowerShell ? ['-NoProfile', '-Command', command] : ['/c', command]) : ['-c', command];

                    const handleOutput = (data) => {
                        const str = data.toString();
                        // Strip ANSI codes and carriage returns for clean log display
                        const cleanStr = str.replace(/\x1B\[[0-?]*[ -/]*[@-~]|\x1B\][^\x07\x1B]*[\x07\x1B]|\b|\x07/g, '').replace(/\r/g, '').trim();
                        if (cleanStr) {
                            setLog(prev => {
                                const lines = prev.split('\n');
                                const lastLine = lines[lines.length - 1];
                                
                                // Deduplicate progress updates (pnpm/npm style)
                                if (lastLine?.startsWith('Progress:') && cleanStr.startsWith('Progress:')) {
                                    lines[lines.length - 1] = cleanStr;
                                    return lines.slice(-5).join('\n');
                                }
                                
                                return (prev + '\n' + cleanStr).split('\n').slice(-5).join('\n');
                            });
                        }
                    };

                    if (pty) {
                        try {
                            const ptyProcess = pty.spawn(shell, shellArgs, {
                                name: 'xterm-256color',
                                cols: 80,
                                rows: 30,
                                cwd: process.cwd(),
                                env: process.env
                            });
                            child = ptyProcess;

                            ptyProcess.onData(handleOutput);

                            ptyProcess.onExit(({ exitCode }) => {
                                child = null;
                                if (exitCode !== 0) {
                                    resolve({ error: `Process exited with code ${exitCode}` });
                                } else {
                                    resolve({ success: true });
                                }
                            });
                            return;
                        } catch (err) {
                            if (isWin && usePowerShell && err.code === 'ENOENT') {
                                resolve({ retryCmd: true });
                                return;
                            }
                            // Proceed to spawn fallback if pty fails
                        }
                    }

                    // Fallback to standard spawn
                    const cp = isWin
                        ? spawn(shell, shellArgs, { cwd: process.cwd(), env: process.env })
                        : spawn(command, { shell: true, cwd: process.cwd(), env: process.env });

                    child = cp;

                    cp.stdout.on('data', handleOutput);
                    cp.stderr.on('data', handleOutput);

                    cp.on('close', (code) => {
                        child = null;
                        if (code !== 0) {
                            resolve({ error: `Process exited with code ${code}` });
                        } else {
                            resolve({ success: true });
                        }
                    });

                    cp.on('error', (err) => {
                        if (isWin && usePowerShell && err.code === 'ENOENT') {
                            resolve({ retryCmd: true });
                        } else {
                            child = null;
                            resolve({ error: err.message });
                        }
                    });
                });
            };

            let result = {};
            if (isWin) {
                result = await executeCommand(true);
                if (result.retryCmd) {
                    result = await executeCommand(false);
                }
            } else {
                result = await executeCommand(false);
            }

            if (result.error) {
                setError(result.error);
                setStatus('error');
            } else if (result.success) {
                setStatus('success');
                if (onSuccess) onSuccess();
            }
        };

        runUpdate();

        return () => {
            if (child) {
                try {
                    if (typeof child.destroy === 'function') {
                        child.destroy();
                    } else if (typeof child.kill === 'function') {
                        child.kill();
                    }
                } catch (e) {}
            }
        };
    }, []);

    if (status === 'initializing' || status === 'downloading') {
        const frame = SPINNER_FRAMES[Math.floor(tick / 3) % SPINNER_FRAMES.length];
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1}>
                <Box>
                    <Text color="gray">{frame}</Text>
                    <Text marginLeft={1} bold color="white"> Updating Flux Flow to v{latest}...</Text>
                </Box>
                <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="gray">
                    <Text color="gray" italic>{log || 'Preparing environment...'}</Text>
                </Box>
                <Text marginTop={1} color="gray">(Please do not close the terminal)</Text>
            </Box>
        );
    }

    if (status === 'success') {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1}>
                <Text color="white" bold>✅ UPDATE SUCCESSFUL!</Text>
                <Text marginTop={1} color="white">Flux Flow has been updated to <Text color="gray">v{latest}</Text>.</Text>
                <Text marginTop={1} color="white" bold>Please restart your terminal session to apply changes.</Text>
                <Box marginTop={1}>
                    <Text color="gray">(Press ESC to return to chat)</Text>
                </Box>
            </Box>
        );
    }

    if (status === 'error') {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1}>
                <Text color="white" bold>❌ UPDATE FAILED</Text>
                <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="gray">
                    <Text color="white">{error}</Text>
                </Box>
                <Text marginTop={1} color="white">Possible causes:</Text>
                <Text color="white">• Missing permissions (Try running as Administrator/Sudo)</Text>
                <Text color="white">• Package manager ({settings.updateManager}) not found</Text>
                <Text color="white">• Network failure</Text>
                <Box marginTop={1}>
                    <Text color="gray">(Press ESC to return to chat)</Text>
                </Box>
            </Box>
        );
    }

    return null;
};

export default UpdateProcessor;
