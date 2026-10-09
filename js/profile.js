/* =========================================================

   TIENHUB — PROFILE + ONE ACCOUNT / ONE DEVICE

========================================================= */





/* =========================================================

   DEVICE KICK MODAL

========================================================= */

if (!window.TienHubShowDeviceKickModal) {

    window.TienHubShowDeviceKickModal = function (onClose) {

        if (window.TienHubDeviceKickShowing) return;

        window.TienHubDeviceKickShowing = true;



        const old = document.getElementById("tienhubDeviceKickModal");

        old?.remove();



        const overlay = document.createElement("div");

        overlay.id = "tienhubDeviceKickModal";

        overlay.innerHTML = `

            <div class="tienhub-device-kick-backdrop"></div>

            <div class="tienhub-device-kick-card" role="dialog" aria-modal="true" aria-labelledby="tienhubDeviceKickTitle">

                <button type="button" class="tienhub-device-kick-x" aria-label="Đóng">×</button>

                <div class="tienhub-device-kick-icon">⚠</div>

                <h2 id="tienhubDeviceKickTitle">Tài khoản đã đăng nhập ở thiết bị khác</h2>

                <p>Tài khoản này vừa được đăng nhập trên một thiết bị khác. Phiên đăng nhập trên thiết bị này đã kết thúc.</p>

                <button type="button" class="tienhub-device-kick-close">Đóng</button>

            </div>

        `;



        const style = document.createElement("style");

        style.id = "tienhubDeviceKickStyle";

        style.textContent = `

            #tienhubDeviceKickModal {

                position: fixed;

                inset: 0;

                z-index: 2147483647;

                display: grid;

                place-items: center;

                font-family: inherit;

            }

            .tienhub-device-kick-backdrop {

                position: absolute;

                inset: 0;

                background: rgba(2, 10, 22, .78);

                backdrop-filter: blur(5px);

            }

            .tienhub-device-kick-card {

                position: relative;

                width: min(92vw, 460px);

                box-sizing: border-box;

                padding: 30px 30px 26px;

                border: 1px solid rgba(44, 190, 255, .35);

                border-radius: 22px;

                background: linear-gradient(145deg, #09213d, #061322);

                box-shadow: 0 25px 80px rgba(0,0,0,.55);

                color: #fff;

                text-align: center;

            }

            .tienhub-device-kick-x {

                position: absolute;

                top: 10px;

                right: 12px;

                width: 38px;

                height: 38px;

                border: 0;

                border-radius: 50%;

                background: transparent;

                color: rgba(255,255,255,.65);

                font-size: 28px;

                line-height: 1;

                cursor: pointer;

            }

            .tienhub-device-kick-x:hover { background: rgba(255,255,255,.08); color: #fff; }

            .tienhub-device-kick-icon {

                width: 56px;

                height: 56px;

                margin: 0 auto 16px;

                display: grid;

                place-items: center;

                border-radius: 50%;

                background: rgba(255, 180, 0, .12);

                color: #ffc44d;

                font-size: 28px;

            }

            .tienhub-device-kick-card h2 {

                margin: 0 0 12px;

                font-size: 21px;

            }

            .tienhub-device-kick-card p {

                margin: 0 auto 24px;

                max-width: 360px;

                color: rgba(255,255,255,.68);

                line-height: 1.55;

                font-size: 14px;

            }

            .tienhub-device-kick-close {

                min-width: 130px;

                padding: 11px 22px;

                border: 0;

                border-radius: 12px;

                background: #16a34a;

                color: #fff;

                font-weight: 700;

                cursor: pointer;

            }

            .tienhub-device-kick-close:hover { filter: brightness(1.08); }

        `;

        document.head.appendChild(style);

        document.body.appendChild(overlay);



        const finish = async () => {

            const buttons = overlay.querySelectorAll("button");

            buttons.forEach(btn => btn.disabled = true);

            try { await onClose?.(); } catch (_) {}

            overlay.remove();

            document.getElementById("tienhubDeviceKickStyle")?.remove();

            window.TienHubDeviceKickShowing = false;

            window.location.replace("/pages/auth.html");

        };



        overlay.querySelector(".tienhub-device-kick-x")?.addEventListener("click", finish);

        overlay.querySelector(".tienhub-device-kick-close")?.addEventListener("click", finish);

    };

}





document.addEventListener("DOMContentLoaded", async () => {

    const profileWrap = document.querySelector(".profile-wrap");

    const profileButton = document.querySelector(".profile");

    const profileName = document.querySelector(".profile-name");

    const profileAvatar = document.querySelector(".profile-avatar");

    const menuUsername = document.querySelector(".profile-menu-username");

    const logoutButton = document.querySelector(".profile-logout");

    const profileMenu = profileWrap?.querySelector(".profile-menu");

    // Wallet is part of the small account menu on Home / Mini Games / Download.
    // No wallet UI is inserted on the dedicated Profile page (no .profile-wrap).
    let walletBalance = null;
    let walletStatus = null;
    if (profileMenu) {
        const card = document.createElement("div");
        card.className = "tienhub-wallet-card";
        card.setAttribute("aria-label", "Ví TienHub Coin");
        card.innerHTML = `
            <span class="tienhub-wallet-coin" aria-hidden="true">T</span>
            <div class="tienhub-wallet-details">
                <span class="tienhub-wallet-label">Số dư TienHub Coin</span>
                <strong class="tienhub-wallet-balance" aria-live="polite">— THC</strong>
                <span class="tienhub-wallet-status">Chưa kết nối ví</span>
            </div>
        `;
        const profileLink = profileMenu.querySelector(".profile-menu-profile");
        if (profileLink) profileLink.before(card);
        walletBalance = card.querySelector(".tienhub-wallet-balance");
        walletStatus = card.querySelector(".tienhub-wallet-status");
    }

    let walletUid = null;
    let walletLastFetch = 0;
    let walletRequest = null;
    let walletRequestUid = null;

    function resetWallet() {
        if (walletBalance) walletBalance.textContent = "— THC";
        if (walletStatus) walletStatus.textContent = "Chưa kết nối ví";
    }

    async function refreshWallet(user) {
        if (!walletBalance || !user || user.isAnonymous || currentUser?.uid !== user.uid) return;
        if (walletUid !== user.uid) {
            walletUid = user.uid;
            walletLastFetch = 0;
            resetWallet();
        }
        if (walletRequest && walletRequestUid === user.uid) return walletRequest;
        // Recheck on reopening the account menu, not on every click or auth callback.
        if (Date.now() - walletLastFetch < 30_000) return;
        walletLastFetch = Date.now();
        if (walletStatus) walletStatus.textContent = "Đang đồng bộ...";

        const expectedUid = user.uid;
        const task = (async () => {
            try {
                const { syncUser } = await import("./tienhub-api.js?v=20261009-live1");
                const result = await syncUser(user);
                // Ignore stale responses after logout / account changes.
                if (currentUser?.uid !== expectedUid || walletUid !== expectedUid) return;
                const balance = result?.account?.thc;
                if (result?.status === "connected" &&
                    Number.isSafeInteger(balance) && balance >= 0) {
                    walletBalance.textContent = `${new Intl.NumberFormat("vi-VN").format(balance)} THC`;
                    if (walletStatus) walletStatus.textContent = "Ví THC dùng chung";
                } else {
                    walletBalance.textContent = "— THC";
                    if (walletStatus) {
                        walletStatus.textContent = result?.status === "not-configured"
                            ? "Chưa kết nối ví"
                            : "Không tải được số dư";
                    }
                }
            } catch (error) {
                if (currentUser?.uid !== expectedUid || walletUid !== expectedUid) return;
                walletBalance.textContent = "— THC";
                if (walletStatus) walletStatus.textContent = "Không tải được số dư";
                console.warn("TienHub wallet read error:", error);
            }
        })();
        walletRequest = task;
        walletRequestUid = expectedUid;
        try { await task; } finally {
            if (walletRequest === task) {
                walletRequest = null;
                walletRequestUid = null;
            }
        }
    }



    if (!profileWrap || !profileButton) return;



    // Keep the account UI hidden until Firebase restores the session.

    profileWrap.style.visibility = "hidden";



    let auth = null;

    let currentUser = null;

    let firebaseReady = false;

    let deviceHeartbeat = null;

    let deviceId = null;

    let lockBusy = false;

    let lockUnsubscribe = null;

    let lockLostHandled = false;



    function getDeviceId() {

        if (deviceId) return deviceId;

        deviceId = localStorage.getItem("tienhub_device_id");

        if (!deviceId) {

            deviceId =

                (crypto?.randomUUID && crypto.randomUUID()) ||

                `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;

            localStorage.setItem("tienhub_device_id", deviceId);

        }

        return deviceId;

    }



    async function releaseDeviceLock(user = currentUser) {

        try {

            if (deviceHeartbeat) {

                clearInterval(deviceHeartbeat);

                deviceHeartbeat = null;

            }

            if (typeof lockUnsubscribe === "function") {

                lockUnsubscribe();

                lockUnsubscribe = null;

            }

            if (!user || user.isAnonymous) return;



            const core = await import("../src/core/firebase.js");

            const { ref, runTransaction } = await import(

                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"

            );



            const id = getDeviceId();

            const lockRef = ref(core.db, `activeDevices/${user.uid}/lock`);



            await runTransaction(lockRef, current => {

                if (!current || current.deviceId !== id) return;

                return null;

            });

        } catch (error) {

            console.warn("TienHub release device lock error:", error);

        }

    }



    async function setupDeviceLock(user) {

        if (!user || user.isAnonymous || lockBusy) return true;

        lockBusy = true;



        try {

            // On a fresh login, wait until auth.js has claimed the lock.

            // Otherwise this page can see the old/empty lock for a moment

            // and incorrectly kick the newly logged-in user.

            if (window.TienHubDeviceLockReady) {

                try {
                    await window.TienHubDeviceLockReady;
                } catch (_) {
                    return false;
                }

                window.TienHubDeviceLockReady = null;
            }



            // auth.js owns the lease during the authenticated session.

            // profile.js only verifies that this browser still owns it.

            const core = await import("../src/core/firebase.js");

            const { ref, get, onValue } = await import(

                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"

            );



            const id = getDeviceId();

            const lockRef = ref(core.db, `activeDevices/${user.uid}/lock`);

            const snap = await get(lockRef);

            const lock = snap.val();



            // If the lock disappeared, let auth.js reacquire it for this same browser.
            // A lock belonging to another device still means this browser must be kicked.
            if (!lock) {
                if (window.TienHubDeviceLock?.acquire) {
                    try {
                        await window.TienHubDeviceLock.acquire(user);
                        const reacquired = await get(lockRef);
                        const reacquiredLock = reacquired.val();

                        if (reacquiredLock?.deviceId !== id) {
                            localStorage.removeItem("tienhub_logged_in");
                            localStorage.removeItem("tienhub_username");
                            window.TienHubShowDeviceKickModal(async () => {
                                try { await core.auth.signOut(); } catch (_) {}
                            });
                            return false;
                        }
                    } catch (error) {
                        console.error("TienHub device lock reacquire error:", error);
                        localStorage.removeItem("tienhub_logged_in");
                        localStorage.removeItem("tienhub_username");
                        window.TienHubShowDeviceKickModal(async () => {
                            try { await core.auth.signOut(); } catch (_) {}
                        });
                        return false;
                    }
                } else {
                    localStorage.removeItem("tienhub_logged_in");
                    localStorage.removeItem("tienhub_username");
                    window.TienHubShowDeviceKickModal(async () => {
                        try { await core.auth.signOut(); } catch (_) {}
                    });
                    return false;
                }
            } else if (lock.deviceId !== id) {

                localStorage.removeItem("tienhub_logged_in");

                localStorage.removeItem("tienhub_username");

                window.TienHubShowDeviceKickModal(async () => {

                    try { await core.auth.signOut(); } catch (_) {}

                });

                return false;

            }



            // Keep a realtime listener on EVERY authenticated page.

            // auth.js only runs the login-time listener, so without this

            // the old device would stay logged in after a later login.

            if (typeof lockUnsubscribe === "function") {

                lockUnsubscribe();

                lockUnsubscribe = null;

            }

            lockLostHandled = false;

            lockUnsubscribe = onValue(lockRef, async snapshot => {

                const latest = snapshot.val();

                if (lockLostHandled || !latest || latest.deviceId === id) return;



                lockLostHandled = true;

                if (deviceHeartbeat) {

                    clearInterval(deviceHeartbeat);

                    deviceHeartbeat = null;

                }

                localStorage.removeItem("tienhub_logged_in");

                localStorage.removeItem("tienhub_username");

                window.TienHubShowDeviceKickModal(async () => {

                    try { await core.auth.signOut(); } catch (_) {}

                });

            });



            // auth.js owns the single device heartbeat.
            // profile.js only watches for a newer login on another device.


            return true;

        } catch (error) {

            // A lock failure must never silently allow the account through.

            console.error("TienHub device lock error:", error);

            await auth?.signOut().catch(() => {});

            localStorage.removeItem("tienhub_logged_in");

            localStorage.removeItem("tienhub_username");

            return false;

        } finally {

            lockBusy = false;

        }

    }



    function closeProfile() {

        profileWrap.classList.remove("open");

        profileButton.setAttribute("aria-expanded", "false");

    }



    function openProfile() {

        profileWrap.classList.add("open");

        profileButton.setAttribute("aria-expanded", "true");

    }



    function renderGuest() {

        closeProfile();

        profileName.textContent = "Đăng nhập";

        profileAvatar.textContent = "→";

        profileButton.setAttribute("aria-label", "Đăng nhập TienHub");

        if (profileMenu) profileMenu.hidden = true;

        profileWrap.style.visibility = "visible";

        profileButton.onclick = () => {

            window.location.href = "/pages/auth.html";

        };

    }



    async function renderLoggedIn(user) {

        const saved = localStorage.getItem("tienhub_username");

        const username =

            saved?.trim() ||

            user.displayName ||

            user.email?.split("@")[0] ||

            "Người chơi";



        // Avatar dùng chung lấy từ Realtime Database users/{uid}.avatar.
        let avatar = username.charAt(0).toUpperCase() || "T";
        try {
            const core = await import("../src/core/firebase.js");
            const { ref, get } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );
            const snapshot = await get(ref(core.db, `users/${user.uid}`));
            const profileData = snapshot.exists() ? snapshot.val() : null;
            if (profileData?.avatar && typeof profileData.avatar === "string") {
                avatar = profileData.avatar;
            }
        } catch (error) {
            console.warn("TienHub avatar read skipped:", error);
        }

        profileName.textContent = username;
        profileAvatar.style.backgroundImage = "";
        profileAvatar.classList.remove("has-image");
        profileAvatar.textContent = avatar;
        if (menuUsername) menuUsername.textContent = username;

        if (profileMenu) profileMenu.hidden = false;

        profileButton.setAttribute("aria-label", `Tài khoản ${username}`);



        const lockOk = await setupDeviceLock(user);

        if (!lockOk) return false;



        profileWrap.style.visibility = "visible";

        profileButton.onclick = event => {

            event.stopPropagation();

            if (profileWrap.classList.contains("open")) {
                closeProfile();
            } else {
                openProfile();
                void refreshWallet(user);
            }

        };
        return true;

    }



    profileButton.addEventListener("click", event => {

        if (profileButton.dataset.bound === "dynamic") return;

        event.stopPropagation();

    });



    profileMenu?.addEventListener("click", event => event.stopPropagation());

    document.addEventListener("click", event => {

        if (!profileWrap.contains(event.target)) closeProfile();

    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape") closeProfile();

    });



    logoutButton?.addEventListener("click", async event => {

        event.stopPropagation();

        logoutButton.disabled = true;

        try {

            await releaseDeviceLock(currentUser);

            await auth.signOut();

        } catch (error) {

            console.error("TienHub logout error:", error);

        } finally {

            localStorage.removeItem("tienhub_username");

            localStorage.removeItem("tienhub_logged_in");

            window.location.replace("/pages/auth.html");

        }

    });



    window.addEventListener('tienhub:wallet-changed', async () => {
        if (!currentUser || currentUser.isAnonymous) return;
        // Avoid showing the pre-reward balance from an in-flight request.
        if (walletRequest) await walletRequest;
        walletLastFetch = 0;
        void refreshWallet(currentUser);
    });

    async function initFirebaseAuth() {

        if (firebaseReady && auth) return auth;



        const core = await import("../src/core/firebase.js");

        auth = core.auth;



        if (!auth) {

            throw new Error("Không lấy được Firebase Auth của TienHub.");

        }



        if (typeof auth.authStateReady === "function") {

            await auth.authStateReady();

        }



        firebaseReady = true;

        return auth;

    }



    async function syncAuth(user) {

        if (currentUser && !currentUser.isAnonymous && !user) {

            await releaseDeviceLock(currentUser);

        }

        const previousUid = currentUser?.uid ?? null;
        currentUser = user || null;
        if (previousUid !== (currentUser?.uid ?? null)) {
            walletUid = null;
            walletLastFetch = 0;
            resetWallet();
        }

        if (!currentUser || currentUser.isAnonymous) {
            void import('./daily-rewards.js?v=20261009-reward2').then(mod => mod.hideForGuest()).catch(() => {});
            renderGuest();
        } else {
            const rendered = await renderLoggedIn(currentUser);
            // Balance is read from the verified server API, never browser storage.
            if (rendered) {
                void refreshWallet(currentUser);
                // Daily login rewards are shared across Web and future Desktop.
                void import('./daily-rewards.js?v=20261009-reward2')
                    .then(mod => mod.showForUser(currentUser))
                    .catch(error => console.warn('Daily rewards unavailable:', error));
            }
        }

    }



    try {

        await initFirebaseAuth();



        // IMPORTANT: after a full page reload Firebase needs to restore

        // the LOCAL session before we decide whether the user is logged in.

        // Never treat the temporary null state as a logout.

        currentUser = auth.currentUser || null;

        await syncAuth(currentUser);



        auth.onAuthStateChanged(async user => {

            await syncAuth(user);

        });

    } catch (error) {

        console.error("TienHub profile Firebase init error:", error);

        renderGuest();

    }

});
