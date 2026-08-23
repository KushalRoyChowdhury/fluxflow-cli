// Shared utilities used across provider stream functions

export const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    const signal = options?.signal;
    for (let i = 0; i < retries; i++) {
        if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
        }
        try {
            const response = await fetch(url, options);
            // Clear performance measures to prevent undici/fetch buffer overflow (Node 18+)
            if (typeof performance !== 'undefined' && performance.clearMeasures) {
                performance.clearMeasures();
                performance.clearMarks();
            }
            if (response.ok) return response;
            if (response.status !== 429 && response.status < 500) return response;
        } catch (e) {
            if (typeof performance !== 'undefined' && performance.clearMeasures) {
                performance.clearMeasures();
                performance.clearMarks();
            }
            if (e.name === 'AbortError' || signal?.aborted) throw e;
            if (i === retries - 1) throw e;
        }
        if (signal) {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    signal.removeEventListener('abort', abortHandler);
                    resolve();
                }, Math.min(24000, delay * Math.pow(2, i)));
                const abortHandler = () => {
                    clearTimeout(timer);
                    reject(new DOMException('The user aborted a request.', 'AbortError'));
                };
                signal.addEventListener('abort', abortHandler);
            });
        } else {
            await new Promise(resolve => setTimeout(resolve, Math.min(24000, delay * Math.pow(2, i))));
        }
    }
    if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
    }
    const response = await fetch(url, options);
    if (typeof performance !== 'undefined' && performance.clearMeasures) {
        performance.clearMeasures();
        performance.clearMarks();
    }
    return response;
};

export async function hash(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);

    return [...new Uint8Array(digest).slice(0, 16)]
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

export const convertChannelThinkTags = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<\|channel>thought/gi, '<think>')
        .replace(/<channel\|>/gi, '</think>');
};
