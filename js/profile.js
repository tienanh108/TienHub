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

    // profile.js được dùng ở cả trang gốc và các trang nằm trong /pages/.
    // Dùng đường dẫn tuyệt đối theo root để tránh /pages/pages/auth.html (404).
    const authPage = "/pages/auth.html";

    if (!profileWrap || !profileButton) return;

    let auth = null;
    let currentUser = null;
    let deviceHeartbeat = null;
    let deviceId = null;
    let lockBusy = false;

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
            if (!user || user.isAnonymous || !deviceId) return;
            const core = await import("../src/core/firebase.js");
            const { ref, remove } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );
            await remove(ref(core.db, `activeDevices/${user.uid}/${deviceId}`));
        } catch (error) {
            console.warn("TienHub release device lock error:", error);
        }
    }

    async function setupDeviceLock(user) {
        if (!user || user.isAnonymous || lockBusy) return true;
        lockBusy = true;
        try {
            const core = await import("../src/core/firebase.js");
            const { ref, runTransaction, onDisconnect, set, remove } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );

            const id = getDeviceId();
            const rootRef = ref(core.db, `activeDevices/${user.uid}`);
            const deviceRef = ref(core.db, `activeDevices/${user.uid}/${id}`);
            const now = Date.now();
            const STALE_MS = 90 * 1000;

            const tx = await runTransaction(rootRef, current => {
                const data = current && typeof current === "object" ? current : {};
                for (const [otherId, info] of Object.entries(data)) {
                    if (!info || otherId === id) continue;
                    const lastSeen = Number(info.lastSeen || 0);
                    if (lastSeen && now - lastSeen < STALE_MS) return;
                }
                return {
                    [id]: { uid: user.uid, lastSeen: now, online: true }
                };
            });

            if (!tx.committed) {
                await auth.signOut();
                localStorage.removeItem("tienhub_logged_in");
                localStorage.removeItem("tienhub_username");
                alert("Tài khoản này đang được đăng nhập trên một thiết bị khác.");
                window.location.replace(authPage);
                return false;
            }

            await onDisconnect(deviceRef).remove();
            if (deviceHeartbeat) clearInterval(deviceHeartbeat);
            deviceHeartbeat = setInterval(() => {
                set(deviceRef, { uid: user.uid, lastSeen: Date.now(), online: true })
                    .catch(error => console.warn("TienHub device heartbeat error:", error));
            }, 20000);

            window.addEventListener("beforeunload", () => {
                remove(deviceRef).catch(() => {});
            }, { once: true });
            return true;
        } catch (error) {
            // Không nuốt permission_denied: tài khoản vẫn hiển thị bình thường,
            // nhưng lock sẽ không được coi là đã thiết lập nếu Firebase từ chối.
            console.error("TienHub device lock error:", error);
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
            window.location.href = authPage;
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
            window.location.replace(authPage);
        }
    });

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

    await syncAuth(currentUser);

    if (auth) {
        auth.onAuthStateChanged(async user => {
            await syncAuth(user);
        });
    }
});
