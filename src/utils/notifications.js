import notifier from 'node-notifier';
import { registerWindowsShortcut, getWindowsAppID, getAssetPath } from './winShortcut.js';

let isShortcutRegistered = false;

/**
 * Displays a native OS notification with custom FluxFlow branding.
 * Header: FluxFlow
 * Body: Agent finished - <chat name>
 */
export const showAgentFinishNotification = (chatName = '') => {
    const title = 'FluxFlow';
    const message = `Agent finished - ${chatName || 'Session'}`;

    try {
        if (!isShortcutRegistered) {
            registerWindowsShortcut();
            isShortcutRegistered = true;
        }

        const appID = process.platform === 'win32' ? getWindowsAppID() : 'FluxFlow';
        const logoPath = getAssetPath('logo.png');

        notifier.notify({
            title,
            message,
            appID,
            icon: logoPath,
            contentImage: logoPath,
            wait: false
        });
    } catch {
        // Silently ignore notification errors
    }
};

/**
 * Displays a native OS notification for user action required.
 * Header: FluxFlow
 * Body: User action required
 */
export const showUserActionRequiredNotification = (message = 'User action required') => {
    const title = 'FluxFlow';

    try {
        if (!isShortcutRegistered) {
            registerWindowsShortcut();
            isShortcutRegistered = true;
        }

        const appID = process.platform === 'win32' ? getWindowsAppID() : 'FluxFlow';
        const logoPath = getAssetPath('logo.png');

        notifier.notify({
            title,
            message,
            appID,
            icon: logoPath,
            contentImage: logoPath,
            wait: false
        });
    } catch {
        // Silently ignore notification errors
    }
};
