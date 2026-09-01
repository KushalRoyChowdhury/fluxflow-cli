import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { isPtyAvailable } from '../tools/exec_command.js';
import { getThemeColors, THEMES } from '../utils/theme.js';
import { getModels } from '../data/model_config.js';
import { getProviderAPIKey } from '../utils/secrets.js';
import v8 from 'v8';
import { DATA_DIR, FLUXFLOW_DIR } from '../utils/paths.js';
import os from 'os';

const themeOptions = [...Object.keys(THEMES), 'Mystery'];

const CATEGORIES = [
    { id: 'appearance', label: 'Appearance', desc: 'Customize UI theme & rendering options' },
    { id: 'memory', label: 'Memory', desc: 'Manage system context & agent\'s memory' },
    { id: 'other', label: 'Miscellaneous', desc: 'Miscellaneous preferences' },
    { id: 'providers', label: 'Providers', desc: 'Configure AI models' },
    { id: 'security', label: 'Security', desc: 'Configure permissions & data safety' },
    { id: 'updater', label: 'Updater', desc: 'Manage application updates' },
    { id: 'exit', label: 'Exit Settings', desc: 'Return to chat view' }
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
    aiProvider,
    initialSelectingTheme = false,
    onCloseTheme = null,
    setProviderReturnView = null
}) {
    const activeTheme = (systemSettings.theme === 'Chaos' || systemSettings.theme === 'Mystery') ? 'Mystery' : (systemSettings.theme || 'Dark');
    const defaultIdx = themeOptions.indexOf(activeTheme);

    const [activeColumn, setActiveColumn] = useState('categories'); // 'categories' or 'items'
    const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
    const [selectedItemIndex, setSelectedItemIndex] = useState(0);
    const [editingItem, setEditingItem] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [isSelectingTheme, setIsSelectingTheme] = useState(initialSelectingTheme);
    const [themeIndex, setThemeIndex] = useState(defaultIdx >= 0 ? defaultIdx : 0);
    const [initialTheme, setInitialTheme] = useState(systemSettings.theme || 'Dark');

    const [isSelectingSubAgentModel, setIsSelectingSubAgentModel] = useState(false);
    const [subAgentModelIndex, setSubAgentModelIndex] = useState(0);
    const [subAgentScrollOffset, setSubAgentScrollOffset] = useState(0);
    const [subAgentSearchQuery, setSubAgentSearchQuery] = useState('');
    const [subAgentFocusMode, setSubAgentFocusMode] = useState('list'); // 'search' or 'list'
    const [activeProviderKeys, setActiveProviderKeys] = useState({});

    useEffect(() => {
        const checkKeys = async () => {
            const providers = ['Google', 'DeepSeek', 'OpenRouter', 'NVIDIA', 'Mistral', 'Ollama', 'CrofAI', 'InferX', 'SenseNova', 'AIHubMix', 'Poolside', '9router'];
            const keyMap = {};
            for (const p of providers) {
                try {
                    const k = await getProviderAPIKey(p);
                    if (k) keyMap[p] = true;
                } catch (e) { }
            }
            setActiveProviderKeys(keyMap);
        };
        checkKeys();
    }, []);

    const allSubAgentItems = React.useMemo(() => {
        const ALL_PROVIDERS = ['Google', 'DeepSeek', 'OpenRouter', 'NVIDIA', 'Mistral', 'Ollama', 'CrofAI', 'InferX', 'SenseNova', 'AIHubMix', 'Poolside', '9router'];
        const hasEnv = !!(process.env.SUBAGENT_MODEL && process.env.SUBAGENT_MODEL.trim());
        const envLabel = hasEnv ? `ENV (${process.env.SUBAGENT_MODEL.trim()})` : 'ENV';

        const items = [
            { label: 'Default (use the current model)', value: 'Default', isHeader: false },
            { label: envLabel, value: 'ENV', isHeader: false }
        ];

        // Primary: current active provider first
        const activeTier = quotas?.providerTiers?.[aiProvider] || apiTier || 'Free';
        const currentModels = getModels(aiProvider, activeTier) || [];
        if (currentModels.length > 0) {
            items.push({ label: `── ${aiProvider.toUpperCase()}${activeTier !== 'Free' ? ` (${activeTier})` : ''} ──`, isHeader: true });
            currentModels.forEach(m => {
                const name = typeof m === 'string' ? m : (m.cmd || m.name || m.id || String(m));
                if (name && !name.trim().startsWith('---') && !name.startsWith('\n---')) {
                    items.push({ label: name, value: name, isHeader: false, provider: aiProvider });
                }
            });
        }

        // Other providers with saved keys
        for (const p of ALL_PROVIDERS) {
            if (p === aiProvider) continue;
            if (activeProviderKeys[p]) {
                const tier = quotas?.providerTiers?.[p] || 'Free';
                const models = getModels(p, tier) || [];
                if (models.length > 0) {
                    items.push({ label: `── ${p.toUpperCase()}${tier !== 'Free' ? ` (${tier})` : ''} ──`, isHeader: true });
                    models.forEach(m => {
                        const name = typeof m === 'string' ? m : (m.cmd || m.name || m.id || String(m));
                        if (name && !name.trim().startsWith('---') && !name.startsWith('\n---')) {
                            items.push({ label: name, value: name, isHeader: false, provider: p });
                        }
                    });
                }
            }
        }

        return items;
    }, [aiProvider, apiTier, quotas, activeProviderKeys]);

    const availableModels = React.useMemo(() => {
        if (!subAgentSearchQuery.trim()) return allSubAgentItems;
        const q = subAgentSearchQuery.trim().toLowerCase();

        const filtered = [];
        let currentHeader = null;

        for (const item of allSubAgentItems) {
            if (item.isHeader) {
                currentHeader = item;
            } else {
                const matches = item.label.toLowerCase().includes(q) || (item.value && item.value.toLowerCase().includes(q));
                if (matches) {
                    if (currentHeader && !filtered.includes(currentHeader)) {
                        filtered.push(currentHeader);
                    }
                    filtered.push(item);
                }
            }
        }
        return filtered;
    }, [allSubAgentItems, subAgentSearchQuery]);

    // Reset cursor & scroll offset to top whenever search query changes
    useEffect(() => {
        if (isSelectingSubAgentModel) {
            let firstValid = availableModels.findIndex(item => !item.isHeader);
            setSubAgentModelIndex(firstValid >= 0 ? firstValid : 0);
            setSubAgentScrollOffset(0);
        }
    }, [subAgentSearchQuery]);

    // Keep subAgentModelIndex valid when availableModels changes
    useEffect(() => {
        if (isSelectingSubAgentModel) {
            if (availableModels.length === 0) {
                setSubAgentModelIndex(0);
                setSubAgentScrollOffset(0);
                return;
            }
            if (subAgentModelIndex >= availableModels.length || availableModels[subAgentModelIndex]?.isHeader) {
                let firstValid = availableModels.findIndex(item => !item.isHeader);
                setSubAgentModelIndex(firstValid >= 0 ? firstValid : 0);
            }
        }
    }, [availableModels, isSelectingSubAgentModel]);

    const [currentMemory, setCurrentMemory] = useState(0);
    const [maxMemory, setMaxMemory] = useState(0);
    const [memoryUnit, setMemoryUnit] = useState('MB');

    useEffect(() => {
        // 1. Get the absolute max limit in bytes (Runs ONCE on mount)
        const maxLimitBytes = v8.getHeapStatistics().heap_size_limit;

        // 2. Decide the best unit based on the MAX limit so they match perfectly
        const isGB = maxLimitBytes >= 1024 * 1024 * 1024;
        const unitLabel = isGB ? 'GB' : 'MB';
        const divisor = isGB ? (1024 * 1024 * 1024) : (1024 * 1024);

        // Set the stable max limit state
        setMaxMemory(parseFloat((maxLimitBytes / divisor).toFixed(2)));
        setMemoryUnit(unitLabel);

        const getMemoryStats = () => {
            const usage = process.memoryUsage();

            // Switch to usage.heapTotal here if you prefer allocated space over actual used!
            const targetBytes = usage.rss;
            const converted = targetBytes / divisor;

            // Keep 2 decimals for GB stats, or round nicely for MB stats
            const formattedCurrent = isGB
                ? parseFloat(converted.toFixed(2))
                : Math.round(converted);

            setCurrentMemory(formattedCurrent);
        }

        getMemoryStats();

        // 3. Track the live memory usage every 1 seconds
        const interval = setInterval(() => {
            getMemoryStats();
        }, 30000);

        // Keep your memory leak-free! 🧹
        return () => clearInterval(interval);
    }, []);

    // Get items for current category
    const getCategoryItems = (catId) => {
        switch (catId) {
            case 'providers': {
                const items = [
                    { label: 'Current Provider', value: 'aiProvider', status: aiProvider },
                    ...(
                        aiProvider.toLowerCase() === 'google' ||
                            aiProvider.toLowerCase() === 'openrouter'
                            ? [{
                                label: 'Show Paid Models?',
                                value: 'apiTier',
                                status: apiTier === 'Free' ? 'No' : 'Yes'
                            }]
                            : []
                    )
                ];
                if (aiProvider === 'Ollama') {
                    items.push({
                        label: 'Endpoint',
                        value: 'ollamaEndpoint',
                        status: systemSettings.ollamaEndpoint || 'Cloud'
                    });
                }
                return items;
            }
            case 'appearance':
                return [
                    { label: 'Theme', value: 'theme', status: systemSettings.theme || 'Dark' },
                    { label: 'Loading Phrases', value: 'loadingPhrases', status: systemSettings.loadingPhrases !== false ? 'ON' : 'OFF' },
                    { label: 'Progressive Rendering [EXPERIMENTAL]', value: 'progressiveRendering', status: systemSettings.progressiveRendering ? 'ON' : 'OFF' },
                    { label: 'Show TPM Estimate', value: 'showTPMEstimate', status: systemSettings.showTPMEstimate ? 'ON' : 'OFF' }
                ];
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
                    { label: 'Advanced Recovery [EXPERIMENTAL]', value: 'advanceRollback', status: systemSettings.advanceRollback ? 'ON' : 'OFF', section: 'Other' },
                    { label: 'Auto-Delete History', value: 'autoDelete', status: systemSettings.autoDeleteHistory || '30d', section: 'Other' },
                    { label: 'Save AppData Externally', value: 'externalData', status: systemSettings.useExternalData ? 'ON' : 'OFF', section: 'Other' }
                ];
            case 'updater':
                return [
                    { label: 'Auto-Update', value: 'autoUpdate', status: systemSettings.autoUpdate ? 'ON' : 'OFF' },
                    { label: 'Preferred Package Manager', value: 'updateManager', status: (systemSettings.updateManager || 'npm') === 'custom' ? 'Custom' : (systemSettings.updateManager || 'npm').toUpperCase() }
                ];
            case 'other':
                return [
                    { label: 'Sub-Agents', value: 'subAgents', status: systemSettings.subAgents !== false ? 'ON' : 'OFF' },
                    { label: 'Sub-Agent Model', value: 'subAgentModel', status: (systemSettings.CustomSubAgent && systemSettings.SubAgentModel) ? systemSettings.SubAgentModel : 'Default' },
                    { label: 'Preserve Thinking', value: 'preserveThinking', status: systemSettings.preserveThinking !== false ? 'ON' : 'OFF' },
                    { label: 'Dynamic Directory Awareness', value: 'dynamicDirAwareness', status: systemSettings.dynamicDirAwareness ? 'ON' : 'OFF' },
                    { label: 'Directory Tree Design', value: 'indentationTree', status: systemSettings.indentationTree !== false ? 'Modern' : 'Classic (deprecated)' },
                    { label: 'Compact Large Tool Results', value: 'compressToolResults', status: systemSettings.compressToolResults ? 'ON' : 'OFF' },
                    { label: 'Auto Truncate Results', value: 'autoTruncateResults', status: systemSettings.autoTruncateResults ? 'ON' : 'OFF' },
                    // { label: 'Download Language Parsers', value: 'parserDownload', status: 'ACTION' } // Dont remove this comment
                ];
            default:
                return [];
        }
    };

    const currentCatId = CATEGORIES[selectedCategoryIndex].id;
    const currentItems = getCategoryItems(currentCatId);

    useInput((input, key) => {
        if (isSelectingSubAgentModel) {
            if (key.tab) {
                setSubAgentFocusMode(prev => prev === 'search' ? 'list' : 'search');
                return;
            }

            if (subAgentFocusMode === 'search') {
                if (key.escape) {
                    setIsSelectingSubAgentModel(false);
                } else if (key.downArrow || key.return) {
                    setSubAgentFocusMode('list');
                } else if (key.backspace || key.delete) {
                    setSubAgentSearchQuery(q => q.slice(0, -1));
                } else if (input && !key.ctrl && !key.meta && input.length === 1) {
                    setSubAgentSearchQuery(q => q + input);
                }
                return;
            }

            if (key.upArrow) {
                setSubAgentModelIndex(prev => {
                    if (availableModels.length === 0) return 0;
                    let next = (prev - 1 + availableModels.length) % availableModels.length;
                    let count = 0;
                    while (availableModels[next]?.isHeader && count < availableModels.length) {
                        next = (next - 1 + availableModels.length) % availableModels.length;
                        count++;
                    }
                    return next;
                });
            } else if (key.downArrow) {
                setSubAgentModelIndex(prev => {
                    if (availableModels.length === 0) return 0;
                    let next = (prev + 1) % availableModels.length;
                    let count = 0;
                    while (availableModels[next]?.isHeader && count < availableModels.length) {
                        next = (next + 1) % availableModels.length;
                        count++;
                    }
                    return next;
                });
            } else if (key.return) {
                const selectedOpt = availableModels[subAgentModelIndex];
                if (selectedOpt && !selectedOpt.isHeader) {
                    setSystemSettings(s => {
                        const isDefault = selectedOpt.value === 'Default';
                        const newSysSettings = {
                            ...s,
                            CustomSubAgent: !isDefault,
                            SubAgentModel: selectedOpt.value,
                            SubAgentProvider: isDefault ? '' : (selectedOpt.provider || '')
                        };
                        saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                        return newSysSettings;
                    });
                    setIsSelectingSubAgentModel(false);
                }
            } else if (key.escape) {
                setIsSelectingSubAgentModel(false);
            } else if (input && !key.ctrl && !key.meta && input.length === 1) {
                // Quick jump to search if typing while in list mode
                setSubAgentSearchQuery(q => q + input);
                setSubAgentFocusMode('search');
            }
            return;
        }

        if (isSelectingTheme) {
            if (key.upArrow) {
                const nextIdx = (themeIndex - 1 + themeOptions.length) % themeOptions.length;
                setThemeIndex(nextIdx);
            } else if (key.downArrow) {
                const nextIdx = (themeIndex + 1) % themeOptions.length;
                setThemeIndex(nextIdx);
            } else if (key.return) {
                const selectedTheme = themeOptions[themeIndex];
                setSystemSettings(s => {
                    const newSysSettings = { ...s, theme: selectedTheme };
                    saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                    return newSysSettings;
                });
                if (onCloseTheme) onCloseTheme();
                else setIsSelectingTheme(false);
            } else if (key.escape) {
                if (onCloseTheme) onCloseTheme();
                else setIsSelectingTheme(false);
            }
            return;
        }

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
            const currentItem = currentItems[selectedItemIndex];
            if (input === '?' && currentItem?.value === 'dynamicDirAwareness') {
                setActiveView('dynamicDirHelp');
                return;
            }

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
        } else if (item.value === 'ollamaEndpoint') {
            setSystemSettings(s => {
                const nextEndpoint = (s.ollamaEndpoint === 'Local') ? 'Cloud' : 'Local';
                const updated = { ...s, ollamaEndpoint: nextEndpoint };
                saveSettings({ systemSettings: updated, apiTier, quotas });
                return updated;
            });
        } else if (item.value === 'apiTier') {
            setActiveView('apiTier');
        } else if (item.value === 'aiProvider') {
            if (setProviderReturnView) setProviderReturnView('settings');
            setActiveView('selectProvider');
        } else if (item.value === 'advanceRollback') {
            if (!systemSettings.advanceRollback) {
                setActiveView('advanceRollbackDanger');
            } else {
                setSystemSettings(s => {
                    const newSysSettings = { ...s, advanceRollback: false };
                    saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                    return newSysSettings;
                });
            }
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
                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '[STORAGE RESET] Flux Flow will return to default ~/.fluxflow after restart.' }]);
                setActiveView('chat');
            }
        } else if (item.value === 'updateManager') {
            setActiveView('updateManager');
        } else if (item.value === 'parserDownload') {
            setActiveView('parserDownload');
        } else if (item.value === 'indentationTree') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, indentationTree: s.indentationTree === false ? true : false };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'compressToolResults') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, compressToolResults: !s.compressToolResults };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'autoTruncateResults') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, autoTruncateResults: !s.autoTruncateResults };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'subAgents') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, subAgents: s.subAgents === false ? true : false };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'subAgentModel') {
            const currentSubAgentModel = (systemSettings.CustomSubAgent && systemSettings.SubAgentModel) ? systemSettings.SubAgentModel : 'Default';
            const curIdx = availableModels.findIndex(m => m.value === currentSubAgentModel);
            setSubAgentModelIndex(curIdx >= 0 ? curIdx : 0);
            setIsSelectingSubAgentModel(true);
        } else if (item.value === 'preserveThinking') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, preserveThinking: s.preserveThinking === false ? true : false };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'dynamicDirAwareness') {
            if (!systemSettings.dynamicDirAwareness) {
                setActiveView('dynamicDirDanger');
            } else {
                setSystemSettings(s => {
                    const newSysSettings = { ...s, dynamicDirAwareness: false };
                    saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                    return newSysSettings;
                });
            }
        } else if (item.value === 'loadingPhrases') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, loadingPhrases: s.loadingPhrases === false ? true : false };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'progressiveRendering') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, progressiveRendering: !s.progressiveRendering };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'showTPMEstimate') {
            setSystemSettings(s => {
                const newSysSettings = { ...s, showTPMEstimate: !s.showTPMEstimate };
                saveSettings({ systemSettings: newSysSettings, apiTier, quotas });
                return newSysSettings;
            });
        } else if (item.value === 'theme') {
            const activeTheme = (systemSettings.theme === 'Chaos' || systemSettings.theme === 'Mystery') ? 'Mystery' : (systemSettings.theme || 'Dark');
            const idx = themeOptions.indexOf(activeTheme);
            setThemeIndex(idx >= 0 ? idx : 0);
            setInitialTheme(systemSettings.theme || 'Dark');
            setIsSelectingTheme(true);
        }
    };

    const colors = getThemeColors(systemSettings.theme);

    if (isSelectingSubAgentModel) {
        const currentSavedModel = (systemSettings.CustomSubAgent && systemSettings.SubAgentModel) ? systemSettings.SubAgentModel : 'Default';

        // Proper Viewport Scroll Logic:
        // Keep window fixed while cursor moves inside [offset, offset + VISIBLE_COUNT - 1]
        const VISIBLE_COUNT = 15;
        let startIndex = subAgentScrollOffset;
        if (subAgentModelIndex < startIndex) {
            startIndex = subAgentModelIndex;
        } else if (subAgentModelIndex >= startIndex + VISIBLE_COUNT) {
            startIndex = subAgentModelIndex - VISIBLE_COUNT + 1;
        }
        startIndex = Math.max(0, Math.min(startIndex, Math.max(0, availableModels.length - VISIBLE_COUNT)));

        if (startIndex !== subAgentScrollOffset) {
            setSubAgentScrollOffset(startIndex);
        }

        const visibleItems = availableModels.slice(startIndex, startIndex + VISIBLE_COUNT);

        return (
            <Box flexDirection="column" borderStyle="round" borderColor={colors.border} padding={1} width="100%" minHeight={32}>
                {/* Title */}
                <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
                    <Text color={colors.text} bold underline>
                        Select Sub-Agent Model:
                    </Text>
                    {availableModels.length > 0 && (
                        <Text color="gray">
                            {subAgentModelIndex + 1}/{availableModels.length}
                        </Text>
                    )}
                </Box>

                {/* Search Bar */}
                <Box
                    borderStyle="single"
                    borderColor={subAgentFocusMode === 'search' ? colors.primary || 'cyan' : 'gray'}
                    paddingX={1}
                    marginBottom={1}
                >
                    <Text color={subAgentFocusMode === 'search' ? colors.primary || 'cyan' : 'gray'} bold>
                        🔍 Search: {' '}
                    </Text>
                    <Text color={colors.text}>
                        {subAgentSearchQuery}
                    </Text>
                    {subAgentFocusMode === 'search' && (
                        <Text color={colors.primary || 'cyan'}>█</Text>
                    )}
                    {!subAgentSearchQuery && subAgentFocusMode !== 'search' && (
                        <Text color="gray" italic>(Press TAB or type to filter models...)</Text>
                    )}
                </Box>

                {/* Windowed Item List */}
                <Box flexDirection="column" flexGrow={1} height={VISIBLE_COUNT}>
                    {visibleItems.length > 0 ? (
                        visibleItems.map((opt, idx) => {
                            const actualIndex = startIndex + idx;
                            if (opt.isHeader) {
                                return (
                                    <Box key={`hdr-${actualIndex}`} paddingX={1}>
                                        <Text color="gray" bold underline>{opt.label}</Text>
                                    </Box>
                                );
                            }

                            const isSelected = subAgentModelIndex === actualIndex && subAgentFocusMode === 'list';
                            const isSaved = currentSavedModel === opt.value;
                            return (
                                <Box key={`item-${opt.value}-${actualIndex}`} paddingX={1} backgroundColor={isSelected ? colors.highlightBg : undefined}>
                                    <Text color={isSelected ? colors.text : colors.textDim} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}{opt.label}
                                        {isSaved ? <Text color={colors.primary || 'cyan'} italic> (active)</Text> : ''}
                                    </Text>
                                </Box>
                            );
                        })
                    ) : (
                        <Box paddingX={1}>
                            <Text color="gray" italic>No models matching "{subAgentSearchQuery}"</Text>
                        </Box>
                    )}
                </Box>

                {/* Footer Navigation */}
                <Box paddingX={1} marginTop={1} flexDirection="row" justifyContent="space-between">
                    <Text color="gray" italic>
                        TAB to switch search/list • ▲▼ Navigate • ENTER to Select • ESC to Cancel
                    </Text>
                    <Text color={subAgentFocusMode === 'search' ? colors.primary || 'cyan' : 'gray'} bold>
                        [{subAgentFocusMode.toUpperCase()} MODE]
                    </Text>
                </Box>
            </Box>
        );
    }

    if (isSelectingTheme) {
        const previewThemeName = themeOptions[themeIndex];
        const previewColors = getThemeColors(previewThemeName);

        return (
            <Box flexDirection="column" borderStyle="round" borderColor={previewColors.border} padding={1} width="100%" minHeight={32}>
                {/* Title */}
                <Box marginBottom={1}>
                    <Text color={previewColors.text} bold>
                        Choose your color scheme:
                    </Text>
                </Box>

                {/* 2 Column Main Body */}
                <Box flexDirection="row" width="100%" flexGrow={1}>
                    {/* Left Column: Theme List (No box border, clean list) */}
                    <Box flexDirection="column" width="30%" paddingRight={1}>
                        {themeOptions.map((tName, index) => {
                            const isSelected = themeIndex === index;
                            const isSaved = (systemSettings.theme || 'Dark') === tName;
                            const isForest = tName === 'Forest Sprite';
                            return (
                                <Box key={tName} paddingX={0}>
                                    <Text color={isSelected ? previewColors.text : previewColors.textDim} bold={isSelected}>
                                        {isSelected ? '> ' : '  '}{tName}
                                        {isForest && <Text color={isSelected ? (previewColors.success || '#52b788') : 'green'} bold> ★</Text>}
                                        {isSaved ? <Text color={previewColors.primary || 'cyan'} italic> (saved)</Text> : ''}
                                    </Text>
                                </Box>
                            );
                        })}
                    </Box>

                    {/* Right Column: Dummy Terminal & Diff Viewer Box */}
                    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={previewColors.borderMuted} paddingX={2} paddingY={1} backgroundColor={previewColors.cardBg}>
                        {/* User Prompt */}
                        <Box marginBottom={1}>
                            <Text color={previewColors.secondary || 'cyan'} bold>{'> '}you: </Text>
                            <Text color={previewColors.text}>add a greeting function</Text>
                        </Box>

                        {/* Heading */}
                        <Box marginBottom={1}>
                            <Text color={previewColors.success || 'green'}>  Here's the change:</Text>
                        </Box>

                        {/* Diff Lines */}
                        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
                            <Text>
                                <Text color={previewColors.textDim}>3 </Text>
                                <Text color={previewColors.textDim}>  import "fmt"</Text>
                            </Text>
                            <Text color={previewColors.textDim}>4</Text>
                            <Box backgroundColor={previewColors.diffRemovalBg}>
                                <Text>
                                    <Text color={previewColors.diffRemovalNum || previewColors.diffRemovalText}>5 </Text>
                                    <Text color={previewColors.diffRemovalPrefix || previewColors.diffRemovalText}>- </Text>
                                    <Text color={previewColors.diffRemovalText}>func </Text>
                                    <Text color={previewColors.diffRemovalHighlightColor || previewColors.diffRemovalText} backgroundColor={previewColors.diffRemovalHighlightBg} bold>main()</Text>
                                    <Text color={previewColors.diffRemovalText}> &#123;</Text>
                                </Text>
                            </Box>
                            <Box backgroundColor={previewColors.diffAdditionBg}>
                                <Text>
                                    <Text color={previewColors.diffAdditionNum || previewColors.diffAdditionText}>5 </Text>
                                    <Text color={previewColors.diffAdditionPrefix || previewColors.diffAdditionText}>+ </Text>
                                    <Text color={previewColors.diffAdditionText}>func </Text>
                                    <Text color={previewColors.diffAdditionHighlightColor || previewColors.diffAdditionText} backgroundColor={previewColors.diffAdditionHighlightBg} bold>greet(name string)</Text>
                                    <Text color={previewColors.diffAdditionText}> &#123;</Text>
                                </Text>
                            </Box>
                            <Box backgroundColor={previewColors.diffAdditionBg}>
                                <Text>
                                    <Text color={previewColors.diffAdditionNum || previewColors.diffAdditionText}>6 </Text>
                                    <Text color={previewColors.diffAdditionPrefix || previewColors.diffAdditionText}>+ </Text>
                                    <Text color={previewColors.diffAdditionText}>    </Text>
                                    <Text color={previewColors.diffAdditionHighlightColor || previewColors.diffAdditionText} backgroundColor={previewColors.diffAdditionHighlightBg}>fmt.Printf("Hello, %s!\n", name)</Text>
                                </Text>
                            </Box>
                            <Text color={previewColors.textDim}>7   &#125;</Text>
                        </Box>

                        {/* Thought Process */}
                        <Box flexDirection="column" marginTop={1} marginBottom={1}>
                            <Text color={previewColors.textDim}>▾ Thought Process</Text>
                            <Text color={previewColors.textMuted}>  I need to add a greeting function. I'll use fmt.Printf.</Text>
                        </Box>

                        {/* UI Indicators */}
                        <Box flexDirection="column">
                            <Text><Text color={previewColors.warning || 'yellow'}>⚙ tool: </Text><Text color={previewColors.text}>write_file main.go</Text></Text>
                            <Text><Text color={previewColors.accent || 'magenta'}>⦿ task: </Text><Text color={previewColors.text}>Implementing greeting</Text></Text>
                            <Text><Text color={previewColors.danger || 'red'}>X error: </Text><Text color={previewColors.text}>compilation failed</Text></Text>
                            <Text><Text color={previewColors.warning || 'yellow'}>⚠ warning: </Text><Text color={previewColors.text}>deprecation warning</Text></Text>
                            <Text><Text color={previewColors.info || 'blue'}>→ link: </Text><Text color={previewColors.info || 'blue'} underline>file:///path/to/main.go</Text></Text>
                            <Text><Text color={previewColors.accent || 'magenta'}>★ accent: </Text><Text color={previewColors.text}>highlighted text</Text></Text>
                            <Text color={previewColors.textDim}>· dim: press Enter to continue</Text>
                        </Box>
                    </Box>
                </Box>

                {/* Footer Navigation */}
                <Box paddingX={1} marginTop={1} flexDirection="row" justifyContent="space-between">
                    <Text color="gray" italic>
                        ▲▼ Navigate • ENTER to Select • ESC to Cancel
                    </Text>
                    <Text color="gray">
                        Previewing: {themeOptions[themeIndex]}{themeOptions[themeIndex] === 'Forest Sprite' ? ' ★' : ''}
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={colors.border} padding={0} width="100%" minHeight={32}>
            {/* Title Bar */}
            <Box paddingX={1} paddingY={0} marginBottom={0} borderStyle="single" borderColor={colors.borderMuted} width="100%">
                <Text color={colors.text} bold>SYSTEM CONFIGURATION</Text>
            </Box>

            {/* Main Area: 2 Columns */}
            <Box flexDirection="row" width="100%" minHeight={26}>
                {/* Left Column: Categories */}
                <Box flexDirection="column" width="30%" maxWidth={40} borderStyle="round" borderColor={activeColumn === 'categories' ? colors.border : colors.borderMuted} padding={1} paddingY={0}>
                    <Box marginBottom={1}>
                        <Text color={activeColumn === 'categories' ? colors.text : colors.textDim} bold underline>
                            CATEGORIES
                        </Text>
                    </Box>
                    {CATEGORIES.map((cat, index) => {
                        const isSelected = selectedCategoryIndex === index;
                        const isExit = cat.id === 'exit';
                        return (
                            <Box
                                key={cat.id}
                                marginTop={isExit ? 15 : 0}
                                backgroundColor={isSelected ? (activeColumn === 'categories' ? colors.highlightBg : colors.cardBg) : undefined}
                                paddingX={1}
                            >
                                <Text
                                    color={isSelected ? (activeColumn === 'categories' ? colors.text : colors.textDim) : colors.textDim}
                                    bold={isSelected}
                                >
                                    {isSelected ? '❯ ' : '  '}{cat.label}
                                </Text>
                            </Box>
                        );
                    })}
                </Box>

                {/* Right Column: Settings */}
                <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={activeColumn === 'items' ? colors.border : colors.borderMuted} paddingX={1} marginLeft={1} paddingY={0}>
                    <Box marginBottom={1}>
                        <Text color={activeColumn === 'items' ? colors.text : colors.textDim} bold underline>
                            {CATEGORIES[selectedCategoryIndex].label.toUpperCase().includes('EXIT') ? 'Runtime Information' : `${CATEGORIES[selectedCategoryIndex].label} Settings`}
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
                                const dotsCount = Math.max(2, 38 - labelLength);
                                const dots = '.'.repeat(dotsCount);

                                const getStatusColor = (item) => {
                                    if (currentCatId === 'security') {
                                        if ((item.value === 'autoExec' || item.value === 'externalAccess') && item.status === 'ON') {
                                            return colors.statusOn;
                                        }
                                        return colors.statusOff;
                                    }
                                    if (item.status?.startsWith('✓')) return colors.statusOn;
                                    if (item.status?.startsWith('⚠')) return colors.statusOff;
                                    return item.status === 'ON' ? colors.statusOn : (item.status === 'OFF' ? colors.statusOff : colors.text);
                                };

                                // Render section header if it changed
                                if (item.section && item.section !== lastSection) {
                                    lastSection = item.section;
                                    elements.push(
                                        <Box key={`sec-hdr-${item.section}`} marginTop={elements.length > 0 ? 1 : 0} marginBottom={0} paddingX={1}>
                                            <Text color="gray" bold underline>{item.section.toUpperCase()}</Text>
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
                                        <Box backgroundColor={isSelected && !isEditingThis ? colors.highlightBg : undefined} paddingX={2}>
                                            <Text
                                                color={isSelected ? colors.text : colors.textDim}
                                                bold={isSelected}
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

                            if (hasConflict) {
                                elements.push(
                                    <Box key="conflict-warning" marginTop={1} paddingX={1}>
                                        <Text color={colors.text} italic>
                                            * Conflicting commands will be ignored and defaulted to highest priority
                                        </Text>
                                    </Box>
                                );
                            }

                            return elements;
                        })()
                    ) : (
                        <Box paddingX={1} flexDirection="column" width="100%">
                            {currentCatId === 'exit' ? (
                                <>
                                    {/* System Info Panel */}
                                    <Box flexDirection="column" marginBottom={1}>
                                            {/* OS */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>OS{' '}</Text>
                                                <Text color="gray">{'..................... '}</Text>
                                                <Text color={colors.text}>{process.env.OS || process.platform || 'N/A'}</Text>
                                            </Box>

                                            {/* Computer Name */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>Computer Name{' '}</Text>
                                                <Text color="gray">{'.......... '}</Text>
                                                <Text color={colors.text}>{process.env.COMPUTERNAME || process.env.HOSTNAME || 'N/A'}</Text>
                                            </Box>

                                            {/* Processor Count */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>Processor Count{' '}</Text>
                                                <Text color="gray">{'........ '}</Text>
                                                <Text color={colors.text}>{process.env.NUMBER_OF_PROCESSORS || 'N/A'}</Text>
                                            </Box>

                                            {/* Node.js Version */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>Node.js Version{' '}</Text>
                                                <Text color="gray">{'........ '}</Text>
                                                <Text color={colors.text}>v{process.versions.node}</Text>
                                            </Box>

                                            {/* V8 Version */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>V8 Version{' '}</Text>
                                                <Text color="gray">{'...... ...... '}</Text>
                                                <Text color={colors.text}>v{process.versions.v8}</Text>
                                            </Box>

                                            {/* Data Directory */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>Data Directory{' '}</Text>
                                                <Text color="gray">{'......... '}</Text>
                                                {FLUXFLOW_DIR === DATA_DIR ? '' : <Text color={colors.text}>{FLUXFLOW_DIR.replaceAll(os.homedir(), '~').replaceAll('\\\\', '/').replaceAll('\\', '/')}, </Text>}
                                                <Text color={colors.text}>{DATA_DIR.replaceAll(os.homedir(), '~').replaceAll('\\\\', '/').replaceAll('\\', '/')}</Text>
                                            </Box>

                                            {/* Viewport */}
                                            <Box flexDirection="row">
                                                <Text color={colors.textDim}>Viewport{' '}</Text>
                                                <Text color="gray">{'............... '}</Text>
                                                <Text color={colors.text}>{process.stdout.rows || '?'} rows × {process.stdout.columns || '?'} cols {process.stdout.columns < 90 ? '(too small width)' : ''}</Text>
                                            </Box>

                                            {/* Memory Load */}
                                            <Box flexDirection="row" marginBottom={0}>
                                                <Text color={colors.textDim}>Memory Load{' '}</Text>
                                                <Text color="gray">{'............ '}</Text>
                                                <Text color={colors.text}>{currentMemory}/{maxMemory} {memoryUnit}</Text>
                                            </Box>
                                    </Box>

                                    {/* PTY Status */}
                                    <Box key="pty-notice" paddingX={0} marginTop={0}>
                                        <Text color={isPtyAvailable ? colors.statusOn : colors.warning}>
                                            {isPtyAvailable ? '✓ Advance Interactive Terminal Supported' : '⚠ Interactive Terminal is Limited'}
                                        </Text>
                                    </Box>
                                </>
                            ) : (
                                <Text color="gray" italic>
                                    {CATEGORIES[selectedCategoryIndex].desc}
                                </Text>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Navigation Guide Footer */}
            <Box paddingX={1} marginTop={0} flexDirection="row" justifyContent="space-between">
                <Text color="gray" italic>
                    {activeColumn === 'categories'
                        ? '▲▼ Select Category • Enter/► to configure'
                        : (currentItems[selectedItemIndex]?.value === 'dynamicDirAwareness'
                            ? '▲▼ Select Option • Enter to Toggle • ? HELP • ◄/ESC to go back'
                            : '▲▼ Select Option • Enter to Toggle • ◄/ESC to go back')}
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
