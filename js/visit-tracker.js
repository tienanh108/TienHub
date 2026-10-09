/* TienHub Web Analytics v0.1 — 30-minute anonymous sessions.
   No Firebase account, email, IP or personal information is sent.
   Collects visits to Home / Mini Games / Downloads, not per-game events. */
(() => {
    const allowed = new Set(['tienhub.vn', 'www.tienhub.vn']);
    if (!allowed.has(location.hostname)) return;
    if (!window.crypto?.randomUUID) return;
    const key = 'tienhub.visit.v01';
    const ttl = 30 * 60 * 1000;
    const now = Date.now();
    let value;
    try {
        const stored = JSON.parse(localStorage.getItem(key) || 'null');
        if (stored && typeof stored.id === 'string' && stored.until > now && stored.until < now + ttl + 1000) {
            value = stored;
        }
    } catch { /* private mode/storage disabled */ }
    if (!value) value = { id: crypto.randomUUID(), until: now + ttl };
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* optional */ }
    fetch('https://tienhub-api.tienhub-api.workers.dev/api/v1/analytics/visit', {
        method: 'POST', mode: 'cors', cache: 'no-store', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: value.id })
    }).catch(() => { /* analytics must never interrupt a game or login */ });
})();
