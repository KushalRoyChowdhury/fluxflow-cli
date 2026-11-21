import os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CHROME_VERSION = '158.0.8127.36';
const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.cache', 'puppeteer');

/**
 * Programmatically resolves the Chrome/Chromium executable path.
 * Checks default Puppeteer cache directory and fallback version 148.0.7778.178.
 *
 * @returns {object} { executablePath: string | undefined, cacheDirectory: string | undefined }
 */
export function getPuppeteerConfig() {
    const platform = os.platform();
    const arch = os.arch();

    let pptrPlatform = '';
    let execName = '';
    let subDir = '';

    if (platform === 'win32') {
        pptrPlatform = arch === 'x64' ? 'win64' : 'win32';
        execName = 'chrome.exe';
        subDir = `chrome-${pptrPlatform}`;
    } else if (platform === 'darwin') {
        pptrPlatform = arch === 'arm64' ? 'mac_arm' : 'mac';
        const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
        execName = 'Google Chrome.app/Contents/MacOS/Google Chrome';
        subDir = `chrome-mac-${archSuffix}`;
    } else if (platform === 'linux') {
        pptrPlatform = 'linux';
        execName = 'chrome';
        subDir = 'chrome-linux64';
    } else {
        return {};
    }

    try {
        const cacheDir = process.env.PUPPETEER_CACHE_DIR || DEFAULT_CACHE_DIR;
        const version = DEFAULT_CHROME_VERSION;

        process.env.PUPPETEER_CACHE_DIR = cacheDir;

        const expectedPath = path.join(
            cacheDir,
            'chrome',
            `${pptrPlatform}-${version}`,
            subDir,
            execName
        );

        if (fs.existsSync(expectedPath)) {
            return {
                executablePath: expectedPath,
                cacheDirectory: cacheDir
            };
        }

            // Fallback: Recursively search the cache directory for the executable
            // Prioritize paths containing the target version if specified
            const findExecutable = (dir) => {
                if (!fs.existsSync(dir)) return null;
                try {
                    const files = fs.readdirSync(dir);
                    const dirsToSearch = [];

                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        let stat;
                        try {
                            stat = fs.statSync(fullPath);
                        } catch (e) {
                            continue; // Skip inaccessible files/symlinks
                        }

                        if (stat.isDirectory()) {
                            dirsToSearch.push(fullPath);
                        } else if (file.toLowerCase() === execName.toLowerCase()) {
                            // A legitimate Chrome binary is multi-MB. A truncated/interrupted
                            // download is tiny and causes an opaque "spawn UNKNOWN" on launch.
                            // Reject suspiciously small candidates so we never spawn garbage.
                            if (stat.size > 1024 * 1024) {
                                // If a version is pinned, prefer a path containing the version string
                                if (!version || fullPath.includes(version)) {
                                    return fullPath;
                                }
                            }
                        }
                    }

                    // First search directories that match the version
                    if (version) {
                        for (const d of dirsToSearch) {
                            if (d.includes(version)) {
                                const found = findExecutable(d);
                                if (found) return found;
                            }
                        }
                    }

                    // Otherwise search remaining directories
                    for (const d of dirsToSearch) {
                        if (!version || !d.includes(version)) {
                            const found = findExecutable(d);
                            if (found) return found;
                        }
                    }
                } catch (e) {
                    // Ignore directory read errors
                }
                return null;
            };

            const foundPath = findExecutable(cacheDir);
            if (foundPath) {
                return {
                    executablePath: foundPath,
                    cacheDirectory: cacheDir
                };
            }
    } catch (error) {
        // Fall back to default puppeteer discovery
    }

    return {};
}
