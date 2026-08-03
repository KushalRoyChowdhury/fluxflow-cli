export const subagentProgress = [];

export let pendingSubagentNudges = [];

export const addPendingNudge = (msg) => {
    if (msg) {
        pendingSubagentNudges.push(msg);
    }
};

export const consumePendingNudges = () => {
    if (pendingSubagentNudges.length === 0) return [];
    const nudges = [...pendingSubagentNudges];
    pendingSubagentNudges = [];
    return nudges;
};

export const clearPendingNudges = () => {
    pendingSubagentNudges = [];
};
