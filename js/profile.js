/* =========================================================
   TIENHUB — PROFILE + ONE ACCOUNT / ONE DEVICE
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
    const profileWrap = document.querySelector(".profile-wrap");
    const profileButton = document.querySelector(".profile");
    const profileName = document.querySelector(".profile-name");
    const profileAvatar = document.querySelector(".profile-avatar");
    const menuUsername = document.querySelector(".profile-menu-username");
    const logoutButton = document.querySelector(".profile-logout");
    const profileMenu = profileWrap?.querySelector(".profile-menu");

    if (!profileWrap || !profileButton) return;

    let auth = null;
    let currentUser = null;
    let firebaseReady = false;
    let deviceHeartbeat = null;
    let deviceId = null;
    let lockBusy = false;

    function getAuthPath() {
        return window.location.pathname.includes("/pages/")
            ? "auth.html"
            : "pages/auth.html";
    }

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
            // auth.js owns the lease during the authenticated session.
            // profile.js only verifies that this browser still owns it;
            // it must NOT create a second independent lock.
            const core = await import("../src/core/firebase.js");
            const { ref, get } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );

            const id = getDeviceId();
            const lockRef = ref(core.db, `activeDevices/${user.uid}/lock`);
            const snap = await get(lockRef);
            const lock = snap.val();

            if (!lock || lock.deviceId !== id) {
                await core.auth.signOut();
                localStorage.removeItem("tienhub_logged_in");
                localStorage.removeItem("tienhub_username");
                alert("Tài khoản này đang được đăng nhập trên một thiết bị khác.");
                window.location.replace(getAuthPath());
                return false;
            }

            if (deviceHeartbeat) clearInterval(deviceHeartbeat);
            deviceHeartbeat = setInterval(async () => {
                try {
                    const result = await runTransaction(lockRef, current => {
                        if (!current || current.deviceId !== id) return;
                        return {
                            ...current,
                            uid: user.uid,
                            deviceId: id,
                            lastSeen: Date.now(),
                            online: true
                        };
                    });

                    if (!result.committed) {
                        clearInterval(deviceHeartbeat);
                        deviceHeartbeat = null;
                        await core.auth.signOut();
                        localStorage.removeItem("tienhub_logged_in");
                        localStorage.removeItem("tienhub_username");
                        alert("Tài khoản này đã được đăng nhập trên một thiết bị khác.");
                        window.location.replace(getAuthPath());
                    }
                } catch (error) {
                    console.warn("TienHub device heartbeat error:", error);
                }
            }, 20000);

            window.addEventListener("beforeunload", () => {
                clearInterval(deviceHeartbeat);
                deviceHeartbeat = null;
            }, { once: true });

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
        profileButton.onclick = () => {
            window.location.href = getAuthPath();
        };
    }

    async function renderLoggedIn(user) {
        const saved = localStorage.getItem("tienhub_username");
        const username =
            saved?.trim() ||
            user.displayName ||
            user.email?.split("@")[0] ||
            "Người chơi";

        profileName.textContent = username;
        profileAvatar.textContent = username.charAt(0).toUpperCase() || "T";
        if (menuUsername) menuUsername.textContent = username;
        if (profileMenu) profileMenu.hidden = false;
        profileButton.setAttribute("aria-label", `Tài khoản ${username}`);

        const lockOk = await setupDeviceLock(user);
        if (!lockOk) return;

        profileButton.onclick = event => {
            event.stopPropagation();
            profileWrap.classList.contains("open") ? closeProfile() : openProfile();
        };
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
            window.location.replace(getAuthPath());
        }
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
        currentUser = user || null;
        if (!currentUser || currentUser.isAnonymous) {
            renderGuest();
        } else {
            await renderLoggedIn(currentUser);
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
