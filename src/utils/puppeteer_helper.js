import os from 'os';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Programmatically resolves the Chrome/Chromium executable path based on
 * the configuration defined in .puppeteerrc.cjs at the package root.
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

    // Resolve .puppeteerrc.cjs relative to this file
    // In source mode: src/utils/puppeteer_helper.js -> package root is "../../"
    // In bundled mode: dist/fluxflow.js -> package root is "../"
    let configPath = path.resolve(__dirname, '..', '..', '.puppeteerrc.cjs');
    if (!fs.existsSync(configPath)) {
        configPath = path.resolve(__dirname, '..', '.puppeteerrc.cjs');
    }

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const config = require(configPath);
        const cacheDir = config.cacheDirectory;
        const version = config.chrome?.version;

        if (cacheDir) {
            // Set environment variable as a fallback/hint for Puppeteer's internal logic
            process.env.PUPPETEER_CACHE_DIR = cacheDir;

            if (version) {
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
                            // If we match the executable name
                            // If a version is pinned, check if the path contains the version string
                            if (!version || fullPath.includes(version)) {
                                return fullPath;
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
        }
    } catch (error) {
        // Fall back to default puppeteer discovery
    }

    return {};
}
