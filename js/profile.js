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



    if (!profileWrap || !profileButton) return;



    // Keep the account UI hidden until Firebase restores the session.

    profileWrap.style.visibility = "hidden";
    profileAvatar?.style.setProperty("background-image", "");
    profileAvatar?.classList.remove("has-image");



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

            // auth.js owns the lease during the authenticated session.

            // profile.js only verifies that this browser still owns it;

            // it must NOT create a second independent lock.

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

        profileAvatar.style.backgroundImage = "";
        profileAvatar.classList.remove("has-image");
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



        // Avatar is shared through Realtime Database. Never reuse old uploaded photos.
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

        if (!lockOk) return;



        profileWrap.style.visibility = "visible";

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

            window.location.replace("/pages/auth.html");

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
