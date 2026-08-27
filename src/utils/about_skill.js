import fs from 'fs';
import path from 'path';
import { FLUXFLOW_DIR } from './paths.js';
import { ABOUT_SKILL_MANIFEST } from '../data/about-data.js';

/**
 * Initializes and auto-synchronizes the 'about-fluxflow' skill files.
 * Force-syncs any modified/new files and cleans up removed references.
 */
export const createAboutSkill = () => {
    try {
        const aboutSkillDir = path.join(FLUXFLOW_DIR, 'skills', 'fluxflow');
        const referencesDir = path.join(aboutSkillDir, 'references');

        const isNoDev = process.env.NO_DEV === 'true' || process.env.NO_DEV === '1' || process.env.NO_DEV === true || false;

        if (isNoDev) {
            if (fs.existsSync(aboutSkillDir)) {
                fs.rmSync(aboutSkillDir, { recursive: true, force: true });
            }
            return;
        }

        // Track valid relative paths defined in the manifest for cleanup
        const validRelPaths = new Set(Object.keys(ABOUT_SKILL_MANIFEST).map(p => path.normalize(p)));

        // 1. Sync all manifest files (write/update if content differs)
        for (const [relPath, rawContent] of Object.entries(ABOUT_SKILL_MANIFEST)) {
            const targetFile = path.join(aboutSkillDir, relPath);
            const parentDir = path.dirname(targetFile);

            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }

            const normalizedContent = rawContent.trim() + '\n';
            let currentContent = null;
            if (fs.existsSync(targetFile)) {
                currentContent = fs.readFileSync(targetFile, 'utf8');
            }

            if (currentContent !== normalizedContent) {
                fs.writeFileSync(targetFile, normalizedContent, 'utf8');
            }
        }

        // 2. Clean up any obsolete reference files removed from the manifest
        if (fs.existsSync(referencesDir)) {
            const existingFiles = fs.readdirSync(referencesDir);
            for (const file of existingFiles) {
                const relPath = path.normalize(path.join('references', file));
                if (!validRelPaths.has(relPath)) {
                    const fullPath = path.join(referencesDir, file);
                    try {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    } catch (e) { }
                }
            }
        }
    } catch (e) {
        // Silently handle any filesystem errors during initialization
    }
};
