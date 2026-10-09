/** TienHub Login Rewards v1 — UI only; the Worker awards all THC. */
const API = 'https://tienhub-api.tienhub-api.workers.dev';
const schedule = [20, 20, 50, 20, 20, 20, 50];
let runningFor = null;
let currentUid = null;
let activeUser = null;
let status = null;
let overlay = null;
let loading = false;
const amount = n => `${new Intl.NumberFormat('vi-VN').format(n)} THC`;
const vnToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0,10);

async function api(user, path, method = 'GET') {
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const resp = await fetch(`${API}${path}`, {
            method, headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store', signal: controller.signal
        });
        let json = {};
        try { json = await resp.json(); } catch (_) { /* API may be temporarily down */ }
        if (!resp.ok) throw new Error(json.error || `API ${resp.status}`);
        return json;
    } finally { clearTimeout(timer); }
}
function isCurrent(uid) {
    return activeUser?.uid === uid && window.location.pathname !== '/pages/auth.html';
}
function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'th-reward-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
        <div class="th-reward-backdrop"></div>
        <section class="th-reward-panel" role="dialog" aria-modal="true" aria-labelledby="th-reward-title" tabindex="-1">
            <span class="th-reward-eyebrow">TIENHUB COIN</span>
            <h2 id="th-reward-title">🎁 Quà đăng nhập</h2>
            <p class="th-reward-subtitle">Nhận quà mỗi ngày bạn ghé TienHub. Nghỉ ngày nào vẫn giữ tiến độ!</p>
            <div class="th-reward-slots" aria-label="Chu kỳ nhận thưởng 7 ngày"></div>
            <p class="th-reward-message" aria-live="polite"></p>
            <button type="button" class="th-reward-claim">Nhận thưởng</button>
            <p class="th-reward-footnote">Mỗi ngày nhận tối đa 1 ô · Giờ Việt Nam</p>
        </section>`;
    // The player must claim first; backdrop and Escape never dismiss the modal.
    overlay.querySelector('.th-reward-claim').addEventListener('click', claim);
    document.body.append(overlay);
    return overlay;
}
function closeOverlay() {
    // Never dismiss a pending reward unless the user has signed out.
    if (!overlay || (activeUser && status?.canClaim)) return;
    overlay.hidden = true;
}
function redraw() {
    if (!status) return;
    const ui = ensureOverlay();
    const grid = ui.querySelector('.th-reward-slots');
    grid.replaceChildren();
    const count = Number(status.claimCount || 0);
    const next = Number(status.nextSlot || 1);
    const claimedToday = !status.canClaim;
    // The visual cycle resets after all seven rewards have been claimed.
    const progress = count % 7 === 0 && claimedToday ? 7 : count % 7;
    for (let i = 1; i <= 7; i++) {
        const card = document.createElement('div');
        card.className = 'th-reward-slot';
        if (i <= progress) card.classList.add('is-done');
        if (i === next && !claimedToday) card.classList.add('is-current');
        if (i === 3 || i === 7) card.classList.add('is-bonus');
        const label = document.createElement('span'); label.textContent = `Ngày ${i}`;
        const icon = document.createElement('strong'); icon.textContent = i <= progress ? '✓' : (i === 3 || i === 7 ? '🎁' : '🪙');
        const reward = document.createElement('b'); reward.textContent = amount(schedule[i-1]);
        card.append(label, icon, reward); grid.append(card);
    }
    const msg = ui.querySelector('.th-reward-message');
    msg.textContent = claimedToday
        ? `Hôm nay bạn đã nhận quà. Hẹn gặp lại ngày mai!`
        : `Đang chờ nhận: Ngày ${next} — ${amount(schedule[next-1])}`;
    const btn = ui.querySelector('.th-reward-claim');
    btn.disabled = loading;
    btn.textContent = claimedToday ? 'Tiếp tục ✓' : (loading ? 'Đang xử lý...' : `Nhận ${amount(schedule[next-1])}`);
}
async function claim() {
    if (!activeUser || loading || !status) return;
    if (!status.canClaim) {
        closeOverlay();
        return;
    }
    const uid = activeUser.uid;
    loading = true; redraw();
    try {
        const result = await api(activeUser, '/api/v1/rewards/login/claim', 'POST');
        if (!isCurrent(uid)) return;
        status = result;
        redraw();
        const msg = overlay.querySelector('.th-reward-message');
        msg.textContent = result.awarded
            ? `🎉 Đã cộng ${amount(result.rewardThc)} vào ví! Số dư: ${amount(result.balance)}.`
            : 'Bạn đã nhận thưởng hôm nay rồi.';
        if (result.awarded) window.dispatchEvent(new Event('tienhub:wallet-changed'));
    } catch (error) {
        if (isCurrent(uid)) {
            overlay.querySelector('.th-reward-message').textContent = 'Chưa xác nhận được phần thưởng. Kiểm tra kết nối và nhấn lại để thử.';
            // Avoid accidental double awards: the Worker validates one claim per day.
            try {
                const latest = await api(activeUser, '/api/v1/rewards/login');
                if (isCurrent(uid)) {
                    status = latest;
                    if (!status.canClaim) overlay.querySelector('.th-reward-message').textContent = 'Bạn đã nhận phần thưởng hôm nay. Nhấn Tiếp tục để vào TienHub.';
                }
            } catch (_) { /* Keep the claim button available for a retry. */ }
        }
        console.warn('TienHub reward claim failed:', error);
    } finally { loading = false; if (isCurrent(uid)) redrawButtonOnly(); }
}
function redrawButtonOnly() {
    const button = overlay?.querySelector('.th-reward-claim');
    if (button) {
        button.disabled = !status;
        button.textContent = status?.canClaim ? `Nhận ${amount(schedule[status.nextSlot-1])}` : 'Tiếp tục ✓';
    }
}
function showWelcome() {
    const node = document.createElement('div');
    node.className = 'th-welcome-overlay';
    node.innerHTML = `<div class="th-reward-backdrop"></div>
        <section class="th-welcome-card" role="dialog" aria-modal="true" aria-label="Quà chào mừng TienHub">
          <div class="th-welcome-icon">🎉</div>
          <h2>Chào mừng đến TienHub!</h2>
          <p>Quà đăng ký tài khoản mới</p>
          <strong>+200 THC</strong>
          <span>Đã cộng vào ví TienHub của bạn</span>
          <button type="button">Tuyệt vời! Tiếp tục</button>
        </section>`;
    document.body.append(node);
    return new Promise(resolve => {
        const done = () => { node.remove(); resolve(); };
        node.querySelector('button').addEventListener('click', done, {once:true});
    });
}
export async function showForUser(user) {
    if (!user || user.isAnonymous) return;
    if (runningFor === user.uid) return;
    runningFor = user.uid; currentUid = user.uid; activeUser = user;
    const uid = user.uid;
    try {
        try {
            const welcome = await api(user, '/api/v1/rewards/welcome', 'POST');
            if (welcome.awarded && isCurrent(uid)) {
                window.dispatchEvent(new Event('tienhub:wallet-changed'));
                await showWelcome();
            }
        } catch (e) {
            // Welcome can be retried on next sign-in if Firebase Admin is unavailable.
            console.warn('TienHub welcome reward pending:', e);
        }
        if (!isCurrent(uid)) return;
        status = await api(user, '/api/v1/rewards/login');
        if (!isCurrent(uid) || !status.canClaim) return;
        // Do not use a sessionStorage "seen" flag: closing a tab without claiming
        // must never suppress the popup on the next visit or page navigation.
        redraw();
        ensureOverlay().hidden = false;
        overlay.querySelector('.th-reward-claim').focus();
    } catch (e) {
        console.warn('TienHub rewards unavailable:', e);
    } finally { if (runningFor === uid) runningFor = null; }
}
export function hideForGuest() {
    activeUser = null; currentUid = null; status = null; runningFor = null;
    // Signing out always closes the old account's modal.
    if (overlay) overlay.hidden = true;
}
