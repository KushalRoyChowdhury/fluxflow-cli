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
        const pngPath = getAssetPath('logo.png');
        const icoPath = getAssetPath('logo.ico');
        const iconForUri = fs.existsSync(pngPath) ? pngPath : icoPath;

        // Register FluxFlow directly in AppUserModelId registry.
        // This gives Windows the App Display Name & App Icon WITHOUT creating any Start Menu shortcut icon!
        const script = `
$key = 'HKCU:\\Software\\Classes\\AppUserModelId\\FluxFlow'
New-Item -Path $key -Force | Out-Null
Set-ItemProperty -Path $key -Name 'DisplayName' -Value 'FluxFlow'
Set-ItemProperty -Path $key -Name 'IconUri' -Value '${iconForUri.replace(/'/g, "''")}'
Set-ItemProperty -Path $key -Name 'IconBackgroundColor' -Value '00000000'
Set-ItemProperty -Path $key -Name 'ShowInSettings' -Value 0 -Type DWord -ErrorAction SilentlyContinue
Remove-Item -Path '${shortcutDir.replace(/'/g, "''")}' -Recurse -Force -ErrorAction SilentlyContinue
`.replace(/\r?\n\s*/g, '; ');

        execSync(`powershell -NoProfile -Command "${script}"`, { stdio: 'ignore' });
    } catch {
        // Silently ignore registration failure
    }
};

export const getWindowsAppID = () => {
    return 'FluxFlow';
};
