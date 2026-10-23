import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getAssetPath = (fileName) => {
    const candidates = [
        path.resolve(__dirname, '../assets', fileName),
        path.resolve(__dirname, '../../assets', fileName),
        path.resolve(__dirname, '../../src/assets', fileName),
        path.resolve(process.cwd(), 'src/assets', fileName),
        path.resolve(process.cwd(), 'dist/assets', fileName)
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return candidates[0];
};

const shortcutDir = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'FluxFlow');
const fluxLnk = path.join(shortcutDir, 'FluxFlow.lnk');
const snoreToastPath = path.resolve(__dirname, '../../node_modules/node-notifier/vendor/snoreToast/snoretoast-x64.exe');

export const registerWindowsShortcut = () => {
    if (process.platform !== 'win32') return;
    try {
        const icoPath = getAssetPath('logo.ico');
        if (!fs.existsSync(icoPath)) return;
        if (!fs.existsSync(shortcutDir)) {
            fs.mkdirSync(shortcutDir, { recursive: true });
        }

        const script = `
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('${fluxLnk.replace(/'/g, "''")}')
$sc.TargetPath = '${snoreToastPath.replace(/'/g, "''")}'
$sc.IconLocation = '${icoPath.replace(/'/g, "''")},0'
$sc.Description = 'FluxFlow'
$sc.Save()
`.replace(/\r?\n\s*/g, '; ');

        execSync(`powershell -NoProfile -Command "${script}"`, { stdio: 'ignore' });
    } catch {
        // Silently ignore shortcut creation failure
    }
};

export const getWindowsAppID = () => {
    return snoreToastPath;
};
