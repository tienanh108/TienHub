/* =========================================================
   TIENHUB — PROFILE
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

    try {
        const core = await import("../src/core/firebase.js");
        auth = core.auth;

        if (typeof auth.authStateReady === "function") {
            await auth.authStateReady();
        }

        currentUser = auth.currentUser;
    } catch (error) {
        console.warn("TienHub profile auth unavailable:", error);
    }

    const isGuest = !currentUser || currentUser.isAnonymous;

    // =========================================================
    // ONE ACCOUNT / ONE DEVICE — keep the lock alive after login
    // =========================================================
    let deviceHeartbeat = null;
    let deviceId = null;

    async function setupDeviceLock(user) {
        if (!user || user.isAnonymous) return;

        try {
            const core = await import("../src/core/firebase.js");
            const { ref, runTransaction, onDisconnect, set, remove } =
                await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");

            deviceId = localStorage.getItem("tienhub_device_id");
            if (!deviceId) {
                deviceId =
                    (crypto?.randomUUID && crypto.randomUUID()) ||
                    `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                localStorage.setItem("tienhub_device_id", deviceId);
            }

            const rootRef = ref(core.db, `activeDevices/${user.uid}`);
            const deviceRef = ref(core.db, `activeDevices/${user.uid}/${deviceId}`);
            const now = Date.now();
            const STALE_MS = 90 * 1000;

            const tx = await runTransaction(rootRef, (current) => {
                const data = current && typeof current === "object" ? current : {};

                for (const [otherId, info] of Object.entries(data)) {
                    if (!info || otherId === deviceId) continue;
                    const lastSeen = Number(info.lastSeen || 0);
                    if (lastSeen && now - lastSeen < STALE_MS) {
                        return;
                    }
                }

                return {
                    [deviceId]: {
                        uid: user.uid,
                        lastSeen: now,
                        online: true
                    }
                };
            });

            // Existing session on another device: sign this session out.
            if (!tx.committed) {
                await core.auth.signOut();
                localStorage.removeItem("tienhub_logged_in");
                localStorage.removeItem("tienhub_username");
                alert("Tài khoản này đang được đăng nhập trên một thiết bị khác.");
                window.location.replace("pages/auth.html");
                return false;
            }

            await onDisconnect(deviceRef).remove();

            if (deviceHeartbeat) clearInterval(deviceHeartbeat);
            deviceHeartbeat = setInterval(async () => {
                try {
                    await set(deviceRef, {
                        uid: user.uid,
                        lastSeen: Date.now(),
                        online: true
                    });
                } catch (error) {
                    console.warn("TienHub device heartbeat error:", error);
                }
            }, 20000);

            window.addEventListener("beforeunload", () => {
                remove(deviceRef).catch(() => {});
            });

            return true;
        } catch (error) {
            console.warn("TienHub device lock unavailable:", error);
            return true;
        }
    }

    async function releaseDeviceLock(user) {
        try {
            if (deviceHeartbeat) {
                clearInterval(deviceHeartbeat);
                deviceHeartbeat = null;
            }

            if (!user || user.isAnonymous || !deviceId) return;

            const core = await import("../src/core/firebase.js");
            const { ref, remove } =
                await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");

            await remove(ref(core.db, `activeDevices/${user.uid}/${deviceId}`));
        } catch (error) {
            console.warn("TienHub release device lock error:", error);
        }
    }

    // Guest: show a simple Đăng nhập button instead of a fake profile.
    if (isGuest) {
        profileName.textContent = "Đăng nhập";
        profileAvatar.textContent = "→";
        profileButton.setAttribute("aria-label", "Đăng nhập TienHub");
        profileButton.setAttribute("aria-expanded", "false");

        if (profileMenu) {
            profileMenu.hidden = true;
        }

        profileButton.addEventListener("click", () => {
            window.location.href = "pages/auth.html";
        });

        return;
    }

    const lockOk = await setupDeviceLock(currentUser);
    if (!lockOk) return;

    // Logged-in user: preserve the existing profile behaviour.
    const savedUsername = localStorage.getItem("tienhub_username");
    const username =
        savedUsername && savedUsername.trim()
            ? savedUsername.trim()
            : currentUser.displayName ||
              currentUser.email?.split("@")[0] ||
              "Người chơi";

    const firstLetter = username.charAt(0).toUpperCase() || "T";

    profileName.textContent = username;
    profileAvatar.textContent = firstLetter;
    if (menuUsername) menuUsername.textContent = username;

    function openProfile() {
        profileWrap.classList.add("open");
        profileButton.setAttribute("aria-expanded", "true");
    }

    function closeProfile() {
        profileWrap.classList.remove("open");
        profileButton.setAttribute("aria-expanded", "false");
    }

    profileButton.addEventListener("click", (event) => {
        event.stopPropagation();
        profileWrap.classList.contains("open") ? closeProfile() : openProfile();
    });

    profileMenu?.addEventListener("click", (event) => event.stopPropagation());

    document.addEventListener("click", (event) => {
        if (!profileWrap.contains(event.target)) closeProfile();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeProfile();
    });

    logoutButton?.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            await releaseDeviceLock(currentUser);
            await auth.signOut();
        } catch (error) {
            console.error("TienHub logout error:", error);
        } finally {
            localStorage.removeItem("tienhub_username");
            localStorage.removeItem("tienhub_logged_in");
            window.location.replace("pages/auth.html");
        }
    });
});
