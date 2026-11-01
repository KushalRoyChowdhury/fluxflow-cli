import {
    getProviderLabel,
    normalizeProvider,
    getProviderSlots,
    getProviderSummary,
    countProviderKeys,
    getActiveIndex,
    setActiveIndex,
    addProviderKey,
    removeProviderKey,
    useProviderKey,
    cleanProviderKeys,
    buildListLines,
    setTempKey,
    clearTempKey,
    isUrlBearing,
    isHiddenFromSummary,
} from './secrets_v2.js';

/**
 * Parse a `/key ...` argument string into structured tokens.
 * Supports a floating `--provider <name>` pair, `--index <n>`, and bare
 * flags `--temp` / `--all`.
 */
export const parseKeyArgs = (raw) => {
    const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const result = { sub: null, args: [], provider: null, providerBare: false, index: null, url: null, temp: false, all: false, unmask: false };
    const rest = [];

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === '--provider') {
            const next = tokens[i + 1];
            if (next && !next.startsWith('--')) {
                result.provider = next;
                i++; // consume value
            } else {
                result.providerBare = true; // no value -> summary listing
            }
        } else if (t === '--index') {
            const next = tokens[i + 1];
            if (next && /^\d+$/.test(next)) { result.index = parseInt(next, 10) - 1; i++; }
        } else if (t === '--url') {
            const next = tokens[i + 1];
            if (next && !next.startsWith('--')) { result.url = next; i++; }
        } else if (t === '--temp') {
            result.temp = true;
        } else if (t === '--all') {
            result.all = true;
        } else if (t === '--unmask' || t === '--reveal') {
            result.unmask = true;
        } else if (t === '--mask') {
            result.unmask = false;
        } else {
            rest.push(t);
        }
    }

    result.sub = rest.length ? rest[0].toLowerCase() : null;
    result.args = rest.slice(1);
    return result;
};

const HELP_LINES = [
    '✦ API KEY MANAGEMENT',
    '⠀⠀\x1b[2m└─\x1b[22m /key list [--provider <name>] [--unmask]',
    '⠀⠀\x1b[2m└─\x1b[22m /key add <key> [--index <n>] [--provider <name>] [--url <endpoint>]',
    '⠀⠀\x1b[2m└─\x1b[22m /key remove [<index>|<key>|--all] [--provider <name>]',
    '⠀⠀\x1b[2m└─\x1b[22m /key use <index>|<key>   |   /key use <key> --temp',
    '⠀⠀\x1b[2m└─\x1b[22m /key clean [--provider <name>]',
    '⠀',
];

/**
 * Execute a /key command.
 * @param {string} raw - everything after `/key`
 * @param {object} ctx - { currentProvider }
 * @returns {Promise<object>} { lines: string[], promptNewKey?: bool }
 */
export const runKeyCommand = async (raw, ctx = {}) => {
    const parsed = parseKeyArgs(raw);
    const current = ctx.currentProvider || 'Google';
    const lines = [];
    const done = (extra = {}) => ({ lines, ...extra });

    // Resolve the provider the command targets.
    let provider = current;
    if (parsed.provider) {
        const norm = normalizeProvider(parsed.provider);
        if (!norm) {
            return { lines: [`✦ Unknown provider: ${parsed.provider}`] };
        }
        provider = norm;
    }

    const sub = parsed.sub;

    // Bare /key -> help.
    if (!sub) {
        return { lines: HELP_LINES };
    }

    // ---- list ----
    if (sub === 'list') {
        if (parsed.providerBare) {
            const summary = getProviderSummary();
            lines.push('✦ SAVED API KEYS');
            for (const row of summary) {
                lines.push(`- ${row.provider} (${row.hasKeys ? row.count : 'No Saved Keys'})`);
            }
            lines.push('⠀');
            return done();
        }
        const listLines = await buildListLines(provider, { unmask: parsed.unmask });
        lines.push(`✦ ${getProviderLabel(provider)} API KEYS`);
        lines.push(...listLines);
        lines.push('⠀');
        return done();
    }

    // ---- add / new ----
    if (sub === 'add' || sub === 'new') {
        const keyArg = parsed.args.join(' ').trim();
        if (!keyArg) {
            return done({ promptNewKey: true });
        }
        const res = await addProviderKey(provider, keyArg, {
            index: parsed.index !== null ? parsed.index : undefined,
            baseUrl: parsed.url !== null ? parsed.url : undefined,
        });
        if (!res.ok) {
            if (res.full) {
                return { lines: [`✦ ${res.error}`, '⠀⠀\x1b[2m└─\x1b[22m Use /key add <key> --index <n> to overwrite a slot.'] };
            }
            return { lines: [`✦ Failed to add key: ${res.error}`] };
        }
        // A newly added provider with no active index -> make it active.
        const active = await getActiveIndex(provider);
        if (active === null) await setActiveIndex(provider, res.index);
        lines.push(`✦ Key added to ${provider} slot ${res.index + 1}.`);
        if (parsed.url !== null && isUrlBearing(provider)) {
            lines.push(`⠀⠀\x1b[2m└─\x1b[22m Using URL: ${parsed.url}`);
        }
        return done();
    }

    // ---- remove ----
    if (sub === 'remove') {
        let target;
        if (parsed.all) {
            target = undefined;
        } else if (parsed.args.length) {
            const joined = parsed.args.join(' ');
            target = /^\d+$/.test(joined) ? parseInt(joined, 10) - 1 : joined;
        }

        const res = await removeProviderKey(provider, target, { all: parsed.all });
        if (!res.ok) return { lines: [`✦ ${res.error}`] };

        if (res.all) {
            lines.push(`✦ Cleared all keys for ${provider}.`);
            return done({ promptNewKey: true });
        }

        lines.push(`✦ Removed key from ${provider} slot ${res.removedIndex + 1}.`);
        if (res.needsNewKey) {
            lines.push(`⠀⠀\x1b[2m└─\x1b[22m No keys remain for ${provider}. Please enter a new key.`);
            return done({ promptNewKey: true });
        }
        return done();
    }

    // ---- use ----
    if (sub === 'use') {
        const argStr = parsed.args.join(' ').trim();
        if (!argStr) return { lines: ['✦ Usage: /key use <index> | <key> [--temp]'] };

        if (parsed.temp) {
            // Temp key: full key only, session-scoped in memory.
            setTempKey(provider, argStr);
            lines.push(`✦ Temporary key set for ${provider} (session only).`);
            if (isUrlBearing(provider)) {
                lines.push('⠀⠀\x1b[2m└─\x1b[22m Will use the current Custom base URL.');
            }
            return done();
        }

        const target = /^\d+$/.test(argStr) ? parseInt(argStr, 10) - 1 : argStr;
        const res = await useProviderKey(provider, target);
        if (!res.ok) return { lines: [`✦ ${res.error}`] };
        // Using a saved key clears any temp override for that provider.
        clearTempKey(provider);
        lines.push(`✦ ${provider} now using slot ${res.index + 1}.`);
        if (res.switchedBaseUrl) {
            lines.push(`⠀⠀\x1b[2m└─\x1b[22m Switched Base URL to: ${res.switchedBaseUrl}`);
        }
        return done({ switchedBaseUrl: res.switchedBaseUrl, switchedKey: res.key });
    }

    // ---- clean ----
    if (sub === 'clean') {
        // No --provider -> whole DB.
        const scope = parsed.provider ? provider : null;
        const res = await cleanProviderKeys(scope);
        lines.push(scope
            ? `✦ Compacted ${scope} key slots.`
            : `✦ Compacted all key stores (${res.touched} provider(s) touched).`);
        return done();
    }

    return { lines: [`✦ Unknown subcommand: ${sub}`, ...HELP_LINES] };
};
