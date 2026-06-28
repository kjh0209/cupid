"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callCupid = callCupid;
exports.getSessionStats = getSessionStats;
exports.resetSession = resetSession;
exports.checkHealth = checkHealth;
async function callCupid(opts) {
    const res = await fetch(`${opts.backendUrl}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            prompt: opts.prompt,
            userMode: opts.userMode,
            routingMode: opts.routingMode,
            optimizePrompt: true,
            enhancedPrompts: true,
            sessionKey: opts.sessionKey,
            useCpl: true,
            extractCpl: true,
            fileName: opts.fileName,
            rawCode: opts.selectedCode,
            selfRevise: opts.selfRevise,
        }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cupid API error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}
async function getSessionStats(backendUrl, sessionKey) {
    const res = await fetch(`${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
    if (!res.ok)
        throw new Error(`Stats API error ${res.status}`);
    return res.json();
}
async function resetSession(backendUrl, sessionKey) {
    await fetch(`${backendUrl}/api/cpl/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
    });
}
async function checkHealth(backendUrl) {
    try {
        const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=client.js.map