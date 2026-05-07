import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { exec } from 'child_process';

const UpdateProcessor = ({ latest, current, settings, onClose, onUpdateSettings, onSuccess }) => {
    const [status, setStatus] = useState('initializing'); // initializing, downloading, success, error
    const [log, setLog] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
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

            // Add force if requested (Force is handled by the command caller adding --force to the input)
            // But since we are in a dedicated view, we can just log the intent.
            setStatus('downloading');
            setLog(`Running: ${command}...`);

            const child = exec(command, (err, stdout, stderr) => {
                if (err) {
                    setError(stderr || err.message);
                    setStatus('error');
                    return;
                }
                setStatus('success');
                if (onSuccess) onSuccess();
            });

            // Stream output for that professional feel
            child.stdout.on('data', (data) => {
                setLog(prev => (prev + '\n' + data).split('\n').slice(-5).join('\n'));
            });
        };

        runUpdate();
    }, []);

    if (status === 'initializing' || status === 'downloading') {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
                <Box>
                    <Text color="cyan"><Spinner type="dots" /></Text>
                    <Text marginLeft={1} bold> Updating Flux Flow to v{latest}...</Text>
                </Box>
                <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="#333">
                    <Text color="gray" dimColor italic>{log || 'Preparing environment...'}</Text>
                </Box>
                <Text marginTop={1} dimColor>(Please do not close the terminal)</Text>
            </Box>
        );
    }

    if (status === 'success') {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={2} paddingY={1}>
                <Text color="green" bold>✅ UPDATE SUCCESSFUL!</Text>
                <Text marginTop={1}>Flux Flow has been upgraded to <Text color="cyan">v{latest}</Text>.</Text>
                <Text marginTop={1} color="yellow" bold>CRITICAL: Please restart your terminal session to apply changes.</Text>
                <Box marginTop={1}>
                    <Text dimColor>(Press ESC to return to chat)</Text>
                </Box>
            </Box>
        );
    }

    if (status === 'error') {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
                <Text color="red" bold>❌ UPDATE FAILED</Text>
                <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="red">
                    <Text color="red">{error}</Text>
                </Box>
                <Text marginTop={1}>Possible causes:</Text>
                <Text>• Missing permissions (Try running as Administrator/Sudo)</Text>
                <Text>• Package manager ({settings.updateManager}) not found</Text>
                <Text>• Network failure</Text>
                <Box marginTop={1}>
                    <Text dimColor>(Press ESC to return to chat)</Text>
                </Box>
            </Box>
        );
    }

    return null;
};

export default UpdateProcessor;
