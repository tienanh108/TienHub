// TienHub Cloudflare API — verified public /health endpoint, 2026-10-09.
// Use Firebase ID Token for /api/v1/me. Never put a server/admin secret here.
// The wallet API returns authoritative THC from D1; it cannot be edited in this JS.
const API_BASE_URL = "https://tienhub-api.tienhub-api.workers.dev";

export async function syncUser(user) {
    if (!API_BASE_URL || !user || user.isAnonymous) return { status: "not-configured" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/v1/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${idToken}` },
            signal: controller.signal,
            cache: "no-store"
        });
        if (!response.ok) return { status: "http-error", code: response.status };
        return { status: "connected", account: await response.json() };
    } catch (error) {
        console.warn("TienHub API temporarily unavailable:", error?.message);
        return { status: "network-error" };
    } finally {
        clearTimeout(timeout);
    }
}
