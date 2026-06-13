import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { isPtyAvailable } from '../tools/exec_command.js';

const CATEGORIES = [
    { id: 'memory', label: '🧠 Memory', desc: 'Manage system context & agent\'s memory' },
    { id: 'security', label: '🔒 Security', desc: 'Configure permissions & data safety' },
    { id: 'updater', label: '🔄 Updater', desc: 'Manage application updates' },
    { id: 'other', label: '📋 Other', desc: 'Miscellaneous preferences' },
    { id: 'exit', label: '🚪 Exit Settings', desc: 'Return to chat view' }
];

const getActivePreset = (settings) => {
    const approve = settings.autoApproveCommands || '';
    const disallow = settings.autoDisallowCommands || '';
    const alwaysAsk = settings.alwaysAskCommands || '';

    const isStrict =
        settings.autoExec === false &&
        settings.allowExternalAccess === false &&
        settings.networkAccess === false &&
        approve === '' &&
        disallow === 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c' &&
        alwaysAsk === 'killall, pkill, taskkill, shutdown, reboot, init 0, init 6, Stop-Process, Stop-Service, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, netsh advfirewall, iptables -F, ufw disable, git reset --hard, git clean -fd, npm r, npm uninstall' &&
        settings.autoApproveGit === false;

    const isBalanced =
        settings.autoExec === true &&
        settings.allowExternalAccess === false &&
        settings.networkAccess !== false &&
        approve === 'ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time, mkdir' &&
        disallow === 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c' &&
        alwaysAsk === 'killall, pkill, taskkill, Stop-Process, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, shutdown, reboot, init 0, init 6, git reset --hard, git clean -fd, npm r, npm uninstall' &&
        settings.autoApproveGit === false;

    const isAutonomous =
        settings.autoExec === true &&
        settings.allowExternalAccess === true &&
        settings.networkAccess !== false &&
        approve === 'ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time, mkdir' &&
        disallow === '' &&
        alwaysAsk === 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c' &&
        settings.autoApproveGit === true;

    if (isStrict) return 'Strict';
    if (isBalanced) return 'Balanced';
    if (isAutonomous) return 'Autonomous';
    return settings.sandboxPreset || 'Custom';
};

const truncateCSV = (val) => {
    if (!val || val.trim() === '') return 'None';
    if (val.length > 40) return val.substring(0, 40) + '...';
    return val;
};

export default function SettingsMenu({
    systemSettings,
    setSystemSettings,
    apiTier,
    setActiveView,
    setInputConfig,
    saveSettings,
    quotas,
    setMessages,
    aiProvider
}) {
    const [activeColumn, setActiveColumn] = useState('categories'); // 'categories' or 'items'
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(0);
    const [editingItem, setEditingItem] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Get items for current category
    const getCategoryItems = (catId) => {
        switch (catId) {
            case 'memory':
                return [
                    { label: 'Toggle Memory', value: 'memory', status: systemSettings.memory ? 'ON' : 'OFF' }
                ];
            case 'security':
                const activePreset = getActivePreset(systemSettings);
                return [
                    { label: 'Sandbox Preset', value: 'sandboxPreset', status: activePreset, section: 'Sandbox' },
                    { label: 'YOLO Mode', value: 'autoExec', status: systemSettings.autoExec ? 'ON' : 'OFF', section: 'Sandbox' },
                    { label: 'External Workspace Access', value: 'externalAccess', status: systemSettings.allowExternalAccess ? 'ON' : 'OFF', section: 'Sandbox' },
                    { label: 'Network Access (Terminal)', value: 'networkAccess', status: systemSettings.networkAccess !== false ? 'ON' : 'OFF', section: 'Sandbox' },
                    { label: 'Always Ask Commands', value: 'alwaysAsk', status: truncateCSV(systemSettings.alwaysAskCommands), section: 'Sandbox' },
                    { label: 'Auto Approve Commands', value: 'autoApprove', status: truncateCSV(systemSettings.autoApproveCommands), section: 'Sandbox' },
                    { label: 'Auto Disapprove Commands', value: 'autoDisallow', status: truncateCSV(systemSettings.autoDisallowCommands), section: 'Sandbox' },
                    { label: 'Auto Approve Git Commits', value: 'autoApproveGit', status: systemSettings.autoApproveGit ? 'ON' : 'OFF', section: 'Sandbox' },
                    { label: 'Auto-Delete History', value: 'autoDelete', status: systemSettings.autoDeleteHistory || '30d', section: 'Other' },
                    { label: 'Save AppData Externally', value: 'externalData', status: systemSettings.useExternalData ? 'ON' : 'OFF', section: 'Other' }
                ];
            case 'updater':
                return [
                    { label: 'Auto-Update', value: 'autoUpdate', status: systemSettings.autoUpdate ? 'ON' : 'OFF' },
                    { label: 'Preferred Updater', value: 'updateManager', status: (systemSettings.updateManager || 'npm') === 'custom' ? 'Custom' : (systemSettings.updateManager || 'npm').toUpperCase() }
                ];
            case 'other':
                return [
                    { label: 'Current Provider', value: 'aiProvider', status: aiProvider },
                    { label: 'API Tier', value: 'apiTier', status: apiTier },
                    { label: 'Download Language Parsers', value: 'parserDownload', status: 'ACTION' }
                ];            default:
                return [];
        }
    };

    const currentCatId = CATEGORIES[selectedCategoryIndex].id;
    const currentItems = getCategoryItems(currentCatId);

    useInput((input, key) => {
        if (editingItem) {
            if (key.escape) {
                setEditingItem(null);
            }
            return;
        }

        if (activeColumn === 'categories') {
            if (key.upArrow) {
                setSelectedCategoryIndex(prev => (prev - 1 + CATEGORIES.length) % CATEGORIES.length);
            } else if (key.downArrow) {
                setSelectedCategoryIndex(prev => (prev + 1) % CATEGORIES.length);
            } else if (key.return || key.rightArrow) {
                const targetCat = CATEGORIES[selectedCategoryIndex];
                if (targetCat.id === 'exit') {
                    setActiveView('chat');
                } else {
                    setActiveColumn('items');
                    setSelectedItemIndex(0);
                }
            } else if (key.escape) {
                setActiveView('chat');
            }
        } else if (activeColumn === 'items') {
            if (key.upArrow) {
                setSelectedItemIndex(prev => (prev - 1 + currentItems.length) % currentItems.length);
            } else if (key.downArrow) {
                setSelectedItemIndex(prev => (prev + 1) % currentItems.length);
            } else if (key.leftArrow || key.escape) {
                setActiveColumn('categories');
            } else if (key.return) {
                const item = currentItems[selectedItemIndex];
                handleSelect(item);
            }
        }
    });

    const handleSelect = (item) => {
        if (item.value === 'memory') {
            setSystemSettings(s => ({ ...s, memory: !s.memory }));
        } else if (item.value === 'sandboxPreset') {
            const activePreset = getActivePreset(systemSettings);
            const presets = ['Autonomous', 'Balanced', 'Strict'];
            const curIndex = presets.indexOf(activePreset);
            const nextIndex = (curIndex + 1) % presets.length;
            const nextPreset = presets[nextIndex];

            setSystemSettings(s => {
                const updated = { ...s, sandboxPreset: nextPreset };
                if (nextPreset === 'Strict') {
                    updated.autoExec = false;
                    updated.allowExternalAccess = false;
                    updated.networkAccess = false;
                    updated.autoApproveCommands = '';
                    updated.autoDisallowCommands = 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c';
                    updated.alwaysAskCommands = 'killall, pkill, taskkill, shutdown, reboot, init 0, init 6, Stop-Process, Stop-Service, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, netsh advfirewall, iptables -F, ufw disable, git reset --hard, git clean -fd, npm r, npm uninstall';
                    updated.autoApproveGit = false;
                } else if (nextPreset === 'Balanced') {
                    updated.autoExec = true;
                    updated.allowExternalAccess = false;
                    updated.networkAccess = true;
                    updated.autoApproveCommands = 'ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time';
                    updated.autoDisallowCommands = 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c';
                    updated.alwaysAskCommands = 'killall, pkill, taskkill, Stop-Process, mv /*, move c:\\*, chmod 000, chmod -R 777, chown, icacls, shutdown, reboot, init 0, init 6, git reset --hard, git clean -fd, npm r, npm uninstall';
                    updated.autoApproveGit = false;
                } else if (nextPreset === 'Autonomous') {
                    updated.autoExec = true;
                    updated.allowExternalAccess = true;
                    updated.networkAccess = true;
                    updated.autoApproveCommands = 'ls, dir, cat, type, echo, pwd, cd, git status, git log, git diff, git branch, git show, help, mkdir, touch, md, whoami, hostname, ps, Get-Process, date, time';
                    updated.autoDisallowCommands = '';
                    updated.alwaysAskCommands = 'rm -rf, rm -f, del /f, del /q, rd /s, rmdir /s, format, mkfs, dd if=/dev, shred, srm, Remove-Item -Recurse -Force, Initialize-Disk, Clear-Disk, format c:, flashrom, nvram -c';
                    updated.autoApproveGit = true;
                }
                return updated;
            });
        } else if (item.value === 'autoExec') {
            if (!systemSettings.autoExec) {
                if (systemSettings.allowExternalAccess) {
                    setActiveView('doubleDanger');
                } else {
                    setActiveView('autoExecDanger');
                }
            } else {
                setSystemSettings(s => ({ ...s, autoExec: false, sandboxPreset: 'Custom' }));
            }
        } else if (item.value === 'externalAccess') {
            if (!systemSettings.allowExternalAccess) {
                if (systemSettings.autoExec) {
                    setActiveView('doubleDanger');
                } else {
                    setActiveView('externalDanger');
                }
            } else {
                setSystemSettings(s => ({ ...s, allowExternalAccess: false, sandboxPreset: 'Custom' }));
            }
        } else if (item.value === 'networkAccess') {
            setSystemSettings(s => ({ ...s, networkAccess: s.networkAccess === false, sandboxPreset: 'Custom' }));
        } else if (item.value === 'alwaysAsk') {
            setEditingItem('alwaysAskCommands');
            setEditValue(systemSettings.alwaysAskCommands || '');
        } else if (item.value === 'autoApprove') {
            setEditingItem('autoApproveCommands');
            setEditValue(systemSettings.autoApproveCommands || '');
        } else if (item.value === 'autoApproveGit') {
            setSystemSettings(s => ({ ...s, autoApproveGit: !s.autoApproveGit, sandboxPreset: 'Custom' }));
        } else if (item.value === 'autoDisallow') {
            setEditingItem('autoDisallowCommands');
            setEditValue(systemSettings.autoDisallowCommands || '');
        } else if (item.value === 'apiTier') {
            setActiveView('apiTier');
        } else if (item.value === 'aiProvider') {
            setActiveView('selectProvider');
        } else if (item.value === 'autoDelete') {
            const options = ['1d', '7d', '30d'];
            const currentIndex = options.indexOf(systemSettings.autoDeleteHistory || '30d');
            const nextIndex = (currentIndex + 1) % options.length;
            setSystemSettings(s => ({ ...s, autoDeleteHistory: options[nextIndex] }));
        } else if (item.value === 'autoUpdate') {
            setSystemSettings(s => ({ ...s, autoUpdate: !s.autoUpdate }));
        } else if (item.value === 'externalData') {
            if (!systemSettings.useExternalData) {
                setInputConfig({
                    label: "Enter absolute path for External AppData:",
                    note: "All history, logs and secrets will be stored here. ~/.fluxflow/settings.json stays as anchor.",
                    key: 'externalDataPath',
                    value: systemSettings.externalDataPath || ''
                });
                setActiveView('input');
            } else {
                const newSettings = { ...systemSettings, useExternalData: false };
                setSystemSettings(newSettings);
                saveSettings({ systemSettings: newSettings, apiTier, quotas });
                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '🏠 [STORAGE RESET] Flux Flow will return to default ~/.fluxflow after restart.' }]);
                setActiveView('chat');
            }
        } else if (item.value === 'updateManager') {
            setActiveView('updateManager');
        } else if (item.value === 'parserDownload') {
            setActiveView('parserDownload');
        }
    };

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="white" padding={0} width="100%" minHeight={32}>
            {/* Title Bar */}
            <Box paddingX={1} paddingY={0} marginBottom={0} borderStyle="single" borderColor="gray" width="100%">
                <Text color="gray" bold>🔧 SYSTEM CONFIGURATION</Text>
            </Box>

            {/* Main Area: 2 Columns */}
            <Box flexDirection="row" width="100%" minHeight={26}>
                {/* Left Column: Categories */}
                <Box flexDirection="column" width="30%" borderStyle="round" borderColor={activeColumn === 'categories' ? 'gray' : 'white'} padding={1} paddingY={0}>
                    <Box marginBottom={1}>
                        <Text color={activeColumn === 'categories' ? 'gray' : 'white'} bold underline>
                            CATEGORIES
                        </Text>
                    </Box>
                    {CATEGORIES.map((cat, index) => {
                        const isSelected = selectedCategoryIndex === index;
                        const isExit = cat.id === 'exit';
                        return (
                            <Box
                                key={cat.id}
                                marginTop={isExit ? 17 : 0}
                                backgroundColor={isSelected ? (activeColumn === 'categories' ? '#2a2a2a' : '#1e1e1e') : undefined}
                                paddingX={1}
                            >
                                <Text
                                    color={isSelected ? (activeColumn === 'categories' ? 'gray' : 'white') : 'white'}
                                    bold={isSelected}
                                >
                                    {isSelected ? '❯ ' : '  '}{cat.label}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>

                {/* Right Column: Settings */}
                <Box flexDirection="column" width="70%" borderStyle="round" borderColor={activeColumn === 'items' ? 'gray' : 'white'} paddingX={1} marginLeft={1} paddingY={0}>
                    <Box marginBottom={1}>
                        <Text color={activeColumn === 'items' ? 'gray' : 'white'} bold underline>
                            {CATEGORIES[selectedCategoryIndex].label.toUpperCase()} SETTINGS
                        </Text>
                    </Box>

                    {currentItems.length > 0 ? (
                        (() => {
                            let lastSection = null;
                            const elements = [];

                            const getListItems = (val) => (val || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                            const approveList = getListItems(systemSettings.autoApproveCommands);
                            const disallowList = getListItems(systemSettings.autoDisallowCommands);
                            const askList = getListItems(systemSettings.alwaysAskCommands);
                            const allLists = [...approveList, ...disallowList, ...askList];
                            const uniqueLists = new Set(allLists);
                            const hasConflict = currentCatId === 'security' && allLists.length !== uniqueLists.size;

                            currentItems.forEach((item, index) => {
                                const isSelected = activeColumn === 'items' && selectedItemIndex === index;
                                // Calculate padding to align statuses perfectly
                                const labelLength = item.label.length;
                                const dotsCount = Math.max(2, 35 - labelLength);
                                const dots = '.'.repeat(dotsCount);

                                const getStatusColor = (item) => {
                                    if (currentCatId === 'security') {
                                        if ((item.value === 'autoExec' || item.value === 'externalAccess') && item.status === 'ON') {
                                            return 'white';
                                        }
                                        return 'gray';
                                    }
                                    if (item.status?.startsWith('✓')) return 'white';
                                    if (item.status?.startsWith('⚠')) return 'gray';
                                    return item.status === 'ON' ? 'white' : (item.status === 'OFF' ? 'gray' : 'white');
                                };

                                // Render section header if it changed
                                if (item.section && item.section !== lastSection) {
                                    lastSection = item.section;
                                    elements.push(
                                        <Box key={`sec-hdr-${item.section}`} marginTop={elements.length > 0 ? 1 : 0} marginBottom={0} paddingX={1}>
                                            <Text color="gray" bold underline>📂 {item.section.toUpperCase()}</Text>
                                        </Box>
                                    );
                                }

                                const isEditingThis = isSelected && editingItem &&
                                    ((editingItem === 'alwaysAskCommands' && item.value === 'alwaysAsk') ||
                                     (editingItem === 'autoApproveCommands' && item.value === 'autoApprove') ||
                                     (editingItem === 'autoDisallowCommands' && item.value === 'autoDisallow'));
                                const isCommandListItem = item.value === 'alwaysAsk' || item.value === 'autoApprove' || item.value === 'autoDisallow';
                                const isParserDownload = item.value === 'parserDownload';

                                elements.push(
                                    <Box key={item.value} flexDirection="column">
                                        <Box backgroundColor={isSelected && !isEditingThis ? '#2a2a2a' : undefined} paddingX={2}>
                                            <Text
                                                color={isSelected ? 'gray' : 'white'}
                                                bold={isSelected}
                                                underline={isParserDownload}
                                            >
                                                {isSelected ? '❯ ' : '  '}{item.label}
                                            </Text>
                                            {!isCommandListItem && !isParserDownload && (
                                                <>
                                                    <Text color="gray">{dots}</Text>
                                                    <Text color={getStatusColor(item)} bold>
                                                        {item.value === 'aiProvider' ? item.status : `[ ${item.status} ]`}
                                                    </Text>
                                                </>
                                            )}
                                        </Box>
                                        {isCommandListItem && !isEditingThis && item.status !== 'None' && (
                                            <Box paddingX={4} marginBottom={1}>
                                                <Text color="gray">↳ {item.status}</Text>
                                            </Box>
                                        )}
                                        {isEditingThis && (
                                            <Box flexDirection="column" marginLeft={4} marginBottom={1}>
                                                <Box paddingX={1} borderStyle="single" borderColor="gray" flexDirection="row">
                                                    <Text color="gray" bold>{'> '} </Text>
                                                    <TextInput
                                                        value={editValue}
                                                        onChange={setEditValue}
                                                        onSubmit={(val) => {
                                                            const newSysSettings = { ...systemSettings, [editingItem]: val.trim(), sandboxPreset: 'Custom' };
                                                            setSystemSettings(newSysSettings);
                                                            saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                                                            setEditingItem(null);
                                                        }}
                                                    />
                                                </Box>
                                                <Text color="gray" italic>  Comma separated • Press Enter to save, Esc to cancel</Text>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            });

                            if (currentCatId === 'other') {
                                elements.push(
                                    <Box key="pty-notice" marginTop={18} paddingX={1}>
                                        <Text color="white">
                                            {isPtyAvailable ? "✓ Advance Interactive Terminal Supported" : "⚠ Interactive Terminal is Limited"}
                                        </Text>
                                    </Box>
                                );
                            }

                            if (hasConflict) {
                                elements.push(
                                    <Box key="conflict-warning" marginTop={1} paddingX={1}>
                                        <Text color="white" italic>
                                            * Conflicting commands will be ignored and defaulted to highest priority
                                        </Text>
                                    </Box>
                                );
                            }

                            return elements;
                        })()
                    ) : (
                        <Box paddingX={1}>
                            <Text color="gray" italic>
                                {CATEGORIES[selectedCategoryIndex].desc}
                            </Text>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Navigation Guide Footer */}
            <Box paddingX={1} marginTop={0} flexDirection="row" justifyContent="space-between">
                <Text color="gray" italic>
                    {activeColumn === 'categories'
                        ? '▲▼ Select Category • Enter/► to configure'
                        : '▲▼ Select Option • Enter to Toggle • ◄/ESC to go back'}
                </Text>
                {activeColumn === 'categories' && (
                    <Text color="gray">
                        {CATEGORIES[selectedCategoryIndex].desc}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
