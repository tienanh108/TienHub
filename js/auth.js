document.addEventListener("DOMContentLoaded", () => {

    // TienHub Account v0.4 staging. Requires OTP Worker v0.4 before signup.
    const ENABLE_VERIFIED_EMAIL_SIGNUP = true;
    const registerEmail = document.getElementById("registerEmail");
    const emailField = document.getElementById("registerEmailField");
    if (emailField) emailField.hidden = !ENABLE_VERIFIED_EMAIL_SIGNUP;
    if (registerEmail) registerEmail.required = ENABLE_VERIFIED_EMAIL_SIGNUP;
    const loginUsernameLabel = document.querySelector('label[for="loginUsername"]');
    if (loginUsernameLabel) loginUsernameLabel.textContent = "Username or email";

    // =========================================================
    // ACCOUNT RECOVERY: email OTP -> verify code -> set new password.
    // Cloudflare verifies OTP and updates Firebase Auth via server-side
    // credentials. Never change Firebase passwords from browser code.
    // =========================================================
    const resetLink = document.getElementById("forgotPasswordBtn");
    const recoveryForm = document.getElementById("recoveryForm");
    const recoveryEmail = document.getElementById("recoveryEmail");
    const recoveryCode = document.getElementById("recoveryCode");
    const recoveryNewPassword = document.getElementById("recoveryNewPassword");
    const recoveryConfirmPassword = document.getElementById("recoveryConfirmPassword");
    const recoveryEmailStep = document.getElementById("recoveryEmailStep");
    const recoveryCodeStep = document.getElementById("recoveryCodeStep");
    const recoveryPasswordStep = document.getElementById("recoveryPasswordStep");
    const recoverySubmit = document.getElementById("recoverySubmit");
    const recoveryResend = document.getElementById("recoveryResend");
    const recoveryMessage = document.getElementById("recoveryMessage");
    const returnLoginBtn = document.getElementById("returnLoginBtn");
    const RESET_API_BASE = "https://tienhub-api.tienhub-api.workers.dev";
    let recoveryStep = "email";
    let recoveryActiveEmail = "";
    let recoveryResendTimer = null;
    let recoveryResendUntil = 0;

    async function resetApi(endpoint, payload) {
        const response = await fetch(`${RESET_API_BASE}/api/v1/password/${endpoint}`, {
            method: "POST", cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        let result = {};
        try { result = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(result.error || "Couldn’t connect to password recovery.");
        return result;
    }
    function setRecoveryStep(step) {
        recoveryStep = step;
        if (recoveryEmailStep) recoveryEmailStep.hidden = step !== "email";
        if (recoveryCodeStep) recoveryCodeStep.hidden = step !== "code";
        if (recoveryPasswordStep) recoveryPasswordStep.hidden = step !== "password";
        if (recoverySubmit) {
            recoverySubmit.hidden = false;
            recoverySubmit.disabled = false;
            recoverySubmit.innerHTML = step === "email"
                ? 'Send Verification Code <span aria-hidden="true">→</span>'
                : step === "code"
                    ? 'Verify Code <span aria-hidden="true">→</span>'
                    : 'Set New Password <span aria-hidden="true">→</span>';
        }
        if (authSubtitle) authSubtitle.textContent = step === "email"
            ? "Enter the email registered or linked to TienHub."
            : step === "code"
                ? "Enter the 6-digit code sent to your email."
                : "Code verified. Set a new password for your account.";
        if (step === "code") recoveryCode?.focus();
        if (step === "password") recoveryNewPassword?.focus();
    }
    function cooldownRecovery() {
        recoveryResendUntil = Date.now() + 60000;
        clearInterval(recoveryResendTimer);
        const tick = () => {
            if (!recoveryResend) return;
            const remaining = Math.max(0, Math.ceil((recoveryResendUntil - Date.now()) / 1000));
            recoveryResend.disabled = remaining > 0;
            recoveryResend.textContent = remaining ? `Resend (${remaining}s)` : "Resend Code";
            if (!remaining) clearInterval(recoveryResendTimer);
        };
        tick(); recoveryResendTimer = setInterval(tick, 1000);
    }
    resetLink?.addEventListener("click", (event) => {
        event.preventDefault();
        showMessage(loginMessage, "");
        if (loginForm) loginForm.hidden = true;
        if (registerForm) registerForm.hidden = true;
        if (recoveryForm) recoveryForm.hidden = false;
        if (authTitle) authTitle.textContent = "Forgot Password";
        if (switchAuth) switchAuth.hidden = true;
        if (switchText) switchText.hidden = true;
        setRecoveryStep("email");
        if (recoveryCode) recoveryCode.value = "";
        if (recoveryNewPassword) recoveryNewPassword.value = "";
        if (recoveryConfirmPassword) recoveryConfirmPassword.value = "";
        if (loginUsername?.value.includes("@")) recoveryEmail.value = loginUsername.value.trim();
        showMessage(recoveryMessage, "");
        recoveryEmail?.focus();
    });
    returnLoginBtn?.addEventListener("click", () => {
        if (recoveryForm) recoveryForm.hidden = true;
        if (switchAuth) switchAuth.hidden = false;
        if (switchText) switchText.hidden = false;
        recoveryActiveEmail = "";
        clearInterval(recoveryResendTimer);
        setRecoveryStep("email");
        showLogin();
    });
    recoveryResend?.addEventListener("click", async () => {
        if (!recoveryActiveEmail) return;
        recoveryResend.disabled = true;
        try {
            await resetApi("send", {email:recoveryActiveEmail});
            cooldownRecovery();
            showMessage(recoveryMessage, "A new verification code was sent. Check your inbox and spam folder.", "success");
        } catch (error) {
            recoveryResend.disabled = false;
            showMessage(recoveryMessage, error.message, "error");
        }
    });
    recoveryForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        recoverySubmit.disabled = true;
        showMessage(recoveryMessage, "");
        try {
            if (recoveryStep === "email") {
                const email = recoveryEmail?.value.trim().toLowerCase() || "";
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith("@auth.tienhub.vn")) {
                    throw new Error("Enter your registered or linked email address.");
                }
                await resetApi("send", { email });
                recoveryActiveEmail = email;
                setRecoveryStep("code");
                cooldownRecovery();
                showMessage(recoveryMessage, "Verification code sent. Check your inbox and spam folder.", "success");
            } else if (recoveryStep === "code") {
                const code = recoveryCode?.value.trim() || "";
                if (!/^\d{6}$/.test(code)) throw new Error("Enter all six digits of the verification code.");
                await resetApi("check", { email: recoveryActiveEmail, code });
                setRecoveryStep("password");
                showMessage(recoveryMessage, "Verification successful. Enter your new password.", "success");
            } else {
                const nextPassword = recoveryNewPassword?.value || "";
                const confirmation = recoveryConfirmPassword?.value || "";
                if (nextPassword.length < 10 || nextPassword.length > 128) throw new Error("Your new password must be 10–128 characters long.");
                if (nextPassword !== confirmation) throw new Error("The new passwords do not match.");
                await resetApi("confirm", {email:recoveryActiveEmail,code:recoveryCode.value.trim(),newPassword:nextPassword});
                recoveryNewPassword.value = "";
                recoveryConfirmPassword.value = "";
                if (recoveryPasswordStep) recoveryPasswordStep.hidden = true;
                if (recoverySubmit) recoverySubmit.hidden = true;
                if (authSubtitle) authSubtitle.textContent = "You can now sign in with your new password.";
                showMessage(recoveryMessage, "Password updated! Please sign in again.", "success");
                return;
            }
        } catch (error) {
            showMessage(recoveryMessage, error.message || "Unable to process your request.", "error");
        } finally {
            if (recoverySubmit && !recoverySubmit.hidden) recoverySubmit.disabled = false;
        }
    });

    // Cloudflare is authoritative for six-digit codes. Never generate/verify
    // them in the browser. The sender must be configured on the Worker.
    const EMAIL_API = "https://tienhub-api.tienhub-api.workers.dev";
    const registerCode = document.getElementById("registerCode");
    const sendRegisterCodeBtn = document.getElementById("sendRegisterCode");
    const codeMessage = document.getElementById("codeMessage");
    let cooldownTimer = null;
    async function otpRequest(endpoint, body, user = null) {
        const headers = { "Content-Type": "application/json" };
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
        const response = await fetch(`${EMAIL_API}/api/v1/email/${endpoint}`, {
            method: "POST", headers, body: JSON.stringify(body), cache: "no-store"
        });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(data.error || "Verification service unavailable. Please try again later.");
        return data;
    }
    function startCooldown(email) {
        const until = Date.now() + 60000;
        sessionStorage.setItem(`th-email-cooldown:${email}`, String(until));
        clearInterval(cooldownTimer);
        const tick = () => {
            const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            if (!sendRegisterCodeBtn) return;
            sendRegisterCodeBtn.disabled = seconds > 0;
            sendRegisterCodeBtn.textContent = seconds ? `Resend (${seconds}s)` : "Resend Code";
            if (!seconds) clearInterval(cooldownTimer);
        };
        tick();
        cooldownTimer = setInterval(tick, 1000);
    }
    registerEmail?.addEventListener("input", () => {
        const email = registerEmail.value.trim().toLowerCase();
        const until = Number(sessionStorage.getItem(`th-email-cooldown:${email}`) || 0);
        clearInterval(cooldownTimer);
        if (until > Date.now()) {
            const tick = () => {
                const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
                sendRegisterCodeBtn.disabled = seconds > 0;
                sendRegisterCodeBtn.textContent = seconds ? `Resend (${seconds}s)` : "Send Code";
                if (!seconds) clearInterval(cooldownTimer);
            };
            tick(); cooldownTimer = setInterval(tick, 1000);
        } else if (sendRegisterCodeBtn) {
            sendRegisterCodeBtn.disabled = false; sendRegisterCodeBtn.textContent = "Send Code";
        }
    });
    sendRegisterCodeBtn?.addEventListener("click", async () => {
        const email = registerEmail?.value.trim().toLowerCase() || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage(codeMessage, "Enter a valid email first.", "error"); return;
        }
        sendRegisterCodeBtn.disabled = true;
        try {
            await otpRequest("send", { email, purpose: "signup" });
            startCooldown(email);
            showMessage(codeMessage, "Six-digit code sent. Check your inbox and spam folder.", "success");
        } catch (error) {
            sendRegisterCodeBtn.disabled = false;
            showMessage(codeMessage, error.message, "error");
        }
    });

    // =========================================================

    // ELEMENTS

    // =========================================================



    const authTitle = document.getElementById("authTitle");

    const authSubtitle = document.getElementById("authSubtitle");



    const loginForm = document.getElementById("loginForm");

    const registerForm = document.getElementById("registerForm");



    const switchAuth = document.getElementById("switchAuth");

    const switchText = document.getElementById("switchText");



    const loginUsername =

        document.getElementById("loginUsername");



    const loginPassword =

        document.getElementById("loginPassword");



    const loginMessage =

        document.getElementById("loginMessage");



    const registerUsername =

        document.getElementById("registerUsername");



    const registerPassword =

        document.getElementById("registerPassword");



    const registerPasswordConfirm =

        document.getElementById("registerPasswordConfirm");



    const registerMessage =

        document.getElementById("registerMessage");





    // =========================================================

    // STATE

    // =========================================================



    let isRegisterMode = false;





    // =========================================================

    // MESSAGE

    // =========================================================



    function showMessage(element, message, type = "") {



        if (!element) return;



        element.textContent = message;

        element.className = "auth-message";



        if (type) {

            element.classList.add(type);

        }

    }





    function clearMessages() {



        showMessage(loginMessage, "");

        showMessage(registerMessage, "");



    }





    // =========================================================

    // LOGIN / REGISTER

    // =========================================================



    function showLogin() {



        isRegisterMode = false;



        if (loginForm) {

            loginForm.hidden = false;

        }



        if (registerForm) {

            registerForm.hidden = true;

        }



        if (authTitle) {

            authTitle.textContent = "Sign In";

        }



        if (authSubtitle) {

            authSubtitle.textContent =

                "Sign in to your TienHub account.";

        }



        if (switchAuth) {

            switchAuth.textContent = "Sign Up";

        }



        if (switchText) {

            switchText.style.display = "none";

        }



        clearMessages();

    }





    function showRegister() {



        isRegisterMode = true;



        if (loginForm) {

            loginForm.hidden = true;

        }



        if (registerForm) {

            registerForm.hidden = false;

        }



        if (authTitle) {

            authTitle.textContent = "Sign Up";

        }



        if (authSubtitle) {

            authSubtitle.textContent =

                "Create a TienHub account to get started.";

        }



        if (switchAuth) {

            switchAuth.textContent = "Sign In";

        }



        if (switchText) {

            switchText.style.display = "none";

        }



        clearMessages();

    }





    // Nút Sign Up / Sign In

    if (switchAuth) {



        switchAuth.addEventListener("click", (event) => {



            event.preventDefault();



            if (isRegisterMode) {

                showLogin();

            } else {

                showRegister();

            }



        });



    }





    // =========================================================

    // HIỆN / ẨN MẬT KHẨU

    // =========================================================

    //

    // auth.html của bạn dùng:

    //

    // data-target="loginPassword"

    // data-target="registerPassword"

    // data-target="registerPasswordConfirm"

    //

    // =========================================================



    const passwordButtons =

        document.querySelectorAll(".auth-password-toggle");





    passwordButtons.forEach((button) => {



        button.addEventListener("click", (event) => {



            event.preventDefault();

            event.stopPropagation();





            const targetId =

                button.getAttribute("data-target");





            if (!targetId) {

                return;

            }





            const input =

                document.getElementById(targetId);





            if (!input) {

                console.error(

                    "Password field not found:",

                    targetId

                );



                return;

            }





            // Đang ẩn → hiện

            if (input.type === "password") {



                input.type = "text";



                button.textContent = "Hide";



                button.setAttribute(

                    "aria-label",

                    "Hide password"

                );



            }



            // Đang hiện → ẩn

            else {



                input.type = "password";



                button.textContent = "Show";



                button.setAttribute(

                    "aria-label",

                    "Show password"

                );



            }



        });



    });





    // =========================================================

    // VALIDATION

    // =========================================================



    function validUsername(username) {



        return /^[a-zA-Z0-9_]{3,20}$/.test(username);



    }





    function validPassword(password) {



        return password.length >= 6;



    }





    // =========================================================

    // FIREBASE

    // =========================================================



    async function getFirebaseAuth() {



        try {



            const firebase =

                await import("../src/core/firebase.js");



            const {

                setPersistence,

                browserLocalPersistence

            } = await import(

                "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"

            );



            // Explicitly persist the real Firebase session across pages.

            // This is important because Flappy is a separate HTML document.

            await setPersistence(

                firebase.auth,

                browserLocalPersistence

            );



            return firebase.auth;



        } catch (error) {



            console.error(

                "Firebase error:",

                error

            );



            throw new Error(

                "Unable to connect to the authentication service."

            );



        }



    }





    // =========================================================

    // ENSURE USER RECORD

    // =========================================================



    async function ensureUserRecord(user, username) {



        if (!user || user.isAnonymous) {

            return;

        }



        const { db } =

            await import("../src/core/firebase.js");



        const {

            ref,

            get,

            update

        } = await import(

            "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"

        );



        const userRef =

            ref(db, `users/${user.uid}`);



        const snapshot =

            await get(userRef);



        const existing =

            snapshot.val() || {};



        const cleanUsername =

            String(

                existing.username ||

                username ||

                user.displayName ||

                ""

            ).trim();



        if (!cleanUsername) {

            throw new Error(

                "Unable to determine the account username."

            );

        }



        await update(userRef, {

            username: cleanUsername,

            usernameNormalized:

                cleanUsername.toLowerCase(),

            createdAt:

                typeof existing.createdAt === "number"

                    ? existing.createdAt

                    : Date.now()

        });

    }





    // =========================================================

    // REGISTER

    // =========================================================



    async function registerUser(username, password, email = "", code = "") {
        const auth = await getFirebaseAuth();
        const {
            createUserWithEmailAndPassword,
            updateProfile,
            deleteUser
        } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js");
        const { db } = await import("../src/core/firebase.js");
        const {
            ref, get, set, remove, runTransaction
        } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");

        const clean = username.trim();
        const normalized = clean.toLowerCase();
        const signupEmail = email.trim().toLowerCase();
        if (!ENABLE_VERIFIED_EMAIL_SIGNUP) {
            throw new Error("Email registration is not enabled.");
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
            throw new Error("Invalid username.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)
            || signupEmail.endsWith("@auth.tienhub.vn")) {
            throw new Error("Enter a valid email address to receive the verification email.");
        }

        // The old account UID and username mappings are never altered here.
        // We must create a new Auth user before a namespaced write is allowed
        // by the RTDB rules. A transaction then reserves ONE unique username.
        // A multi-location update without a reservation is unsafe (last-writer wins).
        // Check OTP before creating Firebase UID: incorrect codes cannot create
        // abandoned Firebase users. The Worker does not consume it yet.
        await otpRequest("check", {email: signupEmail, purpose: "signup", code});
        // Recover a pending signup after a network failure without re-creating UID.
        const samePending = auth.currentUser?.email?.toLowerCase() === signupEmail;
        let resumed = Boolean(samePending);
        let account;
        if (samePending) {
            account = { user: auth.currentUser };
        } else {
            try {
                account = await createUserWithEmailAndPassword(auth, signupEmail, password);
            } catch (error) {
                if (error.code !== "auth/email-already-in-use") throw error;
                const { signInWithEmailAndPassword } = await import(
                    "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"
                );
                account = await signInWithEmailAndPassword(auth, signupEmail, password);
                const record = await get(ref(db, `users/${account.user.uid}`));
                if (record.exists() && record.val()?.usernameNormalized !== normalized) {
                    await auth.signOut();
                    throw new Error("This email belongs to another TienHub account.");
                }
                resumed = true;
            }
        }
        const user = account.user;
        const nameRef = ref(db, `usernames/${normalized}`);
        let reserved = false;
        let userRecordWritten = false;
        try {
            const transaction = await runTransaction(
                nameRef,
                (existing) => (existing === null || existing === undefined || existing === user.uid)
                    ? user.uid : undefined,
                { applyLocally: false }
            );
            if (!transaction.committed || transaction.snapshot.val() !== user.uid) {
                const conflict = new Error("Username already taken. Please choose another.");
                conflict.code = "tienhub/username-taken";
                throw conflict;
            }
            reserved = true;
            // Must write AFTER reservation so the hardened user rules can
            // check root.child('usernames').child(normalized) == auth.uid.
            const recordRef = ref(db, `users/${user.uid}`);
            const existingRecord = await get(recordRef);
            if (existingRecord.exists()) {
                if (existingRecord.val()?.usernameNormalized !== normalized) {
                    throw new Error("Existing profile username mismatch. Operation stopped to protect account integrity.");
                }
                // Retry after a failed email claim. Do not rewrite createdAt.
            } else {
                await set(recordRef, {
                    username: clean,
                    usernameNormalized: normalized,
                    createdAt: Date.now()
                });
            }
            userRecordWritten = true;
            await updateProfile(user, { displayName: clean });
        } catch (error) {
            if (resumed) {
                throw new Error(`Unable to resume existing registration: ${error.message}`);
            }
            // Roll back ONLY this freshly created account, never existing UIDs.
            // If cleanup itself fails, warn support rather than claiming success.
            let cleanupFailed = false;
            try {
                // Check remote state even if set() lost its acknowledgement.
                // Never delete Firebase Auth if RTDB cleanup did not succeed.
                const userRef = ref(db, `users/${user.uid}`);
                const storedUser = await get(userRef);
                if (storedUser.exists() && storedUser.val()?.usernameNormalized === normalized) {
                    await remove(userRef);
                } else if (storedUser.exists()) {
                    throw new Error("Signup cleanup: unexpected user record");
                }
                const storedName = await get(nameRef);
                if (storedName.val() === user.uid) await remove(nameRef);
                await deleteUser(user);
            } catch (cleanupError) {
                cleanupFailed = true;
                console.error("Incomplete signup cleanup:", cleanupError);
            } finally {
                await auth.signOut().catch(() => {});
            }
            if (cleanupFailed) {
                throw new Error("Account creation is incomplete. Do not sign up again; contact TienHub support.");
            }
            throw error;
        }

        // Code is consumed by Worker only after new UID & username persist.
        // If this network call fails, leave the newly created UID intact so
        // user can retry safely; never replace/change another account’s UID.
        try {
            await otpRequest("claim", { email: signupEmail, purpose: "signup", code }, user);
        } catch (error) {
            throw new Error(`Account created but verification is incomplete: ${error.message}. Keep this page open and try again.`);
        }
        try {
            await acquireAccountDeviceLock(user);
        } catch (error) {
            await auth.signOut().catch(() => {});
            throw error;
        }
        localStorage.setItem("tienhub_logged_in", "true");
        localStorage.setItem("tienhub_username", clean);
        return { pendingVerification:false, user };
    }

    // =========================================================

    // ONE ACCOUNT / ONE DEVICE

    // Server-backed lease at activeDevices/{uid}/lock.

    // =========================================================



    const DEVICE_ID_KEY = "tienhub_device_id";

    const DEVICE_LOCK_PATH = "lock";

    const DEVICE_LOCK_STALE_MS = 90 * 1000;

    let deviceHeartbeat = null;

    let deviceLockLost = false;



    function getDeviceId() {

        let id = localStorage.getItem(DEVICE_ID_KEY);

        if (!id) {

            id =

                (crypto?.randomUUID && crypto.randomUUID()) ||

                `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;

            localStorage.setItem(DEVICE_ID_KEY, id);

        }

        return id;

    }



    async function getDeviceApi() {

        const core = await import("../src/core/firebase.js");

        const api = await import(

            "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"

        );

        return { core, api };

    }



    async function acquireAccountDeviceLock(user) {

        const { core, api } = await getDeviceApi();

        const { ref, runTransaction, onDisconnect } = api;

        const uid = user.uid;

        const deviceId = getDeviceId();

        const lockRef = ref(core.db, `activeDevices/${uid}/${DEVICE_LOCK_PATH}`);



        // Release this browser’s lease when Firebase disconnects.
        try {
            await onDisconnect(lockRef).remove();
        } catch (error) {
            console.warn("TienHub onDisconnect registration error:", error);
        }

        deviceLockLost = false;



        // LAST LOGIN WINS:

        // Every successful login takes ownership of the account lock.

        // The previous browser is notified through the realtime listener below.

        const now = Date.now();

        const tx = await runTransaction(lockRef, () => ({

            uid,

            deviceId,

            lastSeen: now,

            online: true

        }));



        if (!tx.committed) {

            const error = new Error("Unable to authorize sign-in on this device.");

            error.code = "tienhub/device-lock-failed";

            throw error;

        }



        if (deviceHeartbeat) clearInterval(deviceHeartbeat);

        deviceHeartbeat = setInterval(async () => {

            try {

                const result = await runTransaction(lockRef, current => {

                    if (!current || current.deviceId !== deviceId) return;

                    return {

                        ...current,

                        uid,

                        deviceId,

                        lastSeen: Date.now(),

                        online: true

                    };

                });



                if (!result.committed && !deviceLockLost) {

                    deviceLockLost = true;

                    clearInterval(deviceHeartbeat);

                    deviceHeartbeat = null;

                    try { await core.auth.signOut(); } catch (_) {}

                }

            } catch (error) {

                console.warn("TienHub device heartbeat error:", error);

            }

        }, 20000);



        // If another device logs in later, its deviceId replaces ours.

        // Realtime notification immediately signs this browser out.

        const { onValue } = api;

        const unsubscribe = onValue(lockRef, async snapshot => {

            const lock = snapshot.val();

            if (!lock || lock.deviceId === deviceId || deviceLockLost) return;



            deviceLockLost = true;

            if (deviceHeartbeat) {

                clearInterval(deviceHeartbeat);

                deviceHeartbeat = null;

            }



            // Do not remove the new device’s lock.

            localStorage.removeItem("tienhub_logged_in");

            localStorage.removeItem("tienhub_username");



            if (!location.pathname.includes("/pages/auth.html")) {

                const finish = async () => {

                    try { await core.auth.signOut(); } catch (_) {}

                };

                if (typeof window.TienHubShowDeviceKickModal === "function") {

                    window.TienHubShowDeviceKickModal(finish);

                } else {

                    try { await core.auth.signOut(); } catch (_) {}

                    window.location.replace("/pages/auth.html");

                }

            } else {

                try { await core.auth.signOut(); } catch (_) {}

            }

        });



        // Keep the listener reference so logout can remove it.

        window.TienHubDeviceLockListener = unsubscribe;



        return true;

    }



    async function releaseAccountDeviceLock(user = null) {

        try {

            if (deviceHeartbeat) {

                clearInterval(deviceHeartbeat);

                deviceHeartbeat = null;

            }

            if (typeof window.TienHubDeviceLockListener === "function") {

                window.TienHubDeviceLockListener();

                window.TienHubDeviceLockListener = null;

            }



            const { core, api } = await getDeviceApi();

            const current = user || core.auth.currentUser;

            if (!current || current.isAnonymous) return;



            const deviceId = getDeviceId();

            const { ref, runTransaction } = api;

            const lockRef = ref(

                core.db,

                `activeDevices/${current.uid}/${DEVICE_LOCK_PATH}`

            );



            // Never delete another device’s lease.

            await runTransaction(lockRef, existing => {

                if (!existing || existing.deviceId !== deviceId) {

                    return;

                }

                return null;

            });

        } catch (error) {

            console.warn("TienHub release device lock error:", error);

        }

    }



    window.TienHubDeviceLock = {

        acquire: acquireAccountDeviceLock,

        release: releaseAccountDeviceLock

    };



    // =========================================================

    // LOGIN

    // =========================================================



    async function loginUser(usernameOrEmail, password) {
        const auth = await getFirebaseAuth();
        const { signInWithEmailAndPassword, signInWithCustomToken, reload } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"
        );
        const loginInput = usernameOrEmail.trim().toLowerCase();
        let result;
        if (loginInput.includes("@")) {
            // Sign-in by email: leave the proven Firebase path unchanged.
            result = await signInWithEmailAndPassword(auth, loginInput, password);
        } else {
            // Existing usernames still sign in with their technical Firebase email.
            try {
                result = await signInWithEmailAndPassword(auth, `${loginInput}@auth.tienhub.vn`, password);
            } catch (legacyError) {
                // Never turn service/network failures into a second sign-in attempt.
                if (!["auth/invalid-credential", "auth/invalid-login-credentials", "auth/wrong-password", "auth/user-not-found"]
                    .includes(legacyError?.code)) throw legacyError;

                // Gmail-signup usernames need privileged resolution, but the
                // account’s real email must NEVER be returned to the browser.
                // The backend verifies the password with Firebase and creates a
                // short-lived custom sign-in token for the exact same UID.
                let response;
                try {
                    response = await fetch(`${EMAIL_API}/api/v1/auth/username-login`, {
                        method: "POST", cache: "no-store",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: loginInput, password })
                    });
                } catch (_networkError) {
                    const error = new Error("Unable to connect to the TienHub sign-in server.");
                    error.code = "tienhub/username-login-unavailable";
                    throw error;
                }
                if (!response.ok) {
                    const error = new Error(response.status === 401
                        ? "Incorrect username or password."
                        : "Username sign-in is temporarily unavailable.");
                    error.code = response.status === 401 ? "auth/invalid-credential" : "tienhub/username-login-unavailable";
                    throw error;
                }
                const data = await response.json();
                if (typeof data.customToken !== "string" || data.customToken.length < 80) {
                    const error = new Error("Sign-in server returned an invalid response.");
                    error.code = "tienhub/username-login-unavailable";
                    throw error;
                }
                result = await signInWithCustomToken(auth, data.customToken);
            }
        }
        const user = result.user;
        const legacy = (user.email || "").toLowerCase().endsWith("@auth.tienhub.vn");
        try {
            if (!legacy) {
                // Either Firebase’s native verified flag, or TienHub’s
                // server-verified 6-digit code is accepted.
                await reload(user);
                if (!user.emailVerified) {
                    const response = await fetch(`${EMAIL_API}/api/v1/email/status`, {
                        headers: { Authorization: `Bearer ${await user.getIdToken(true)}` }, cache: "no-store"
                    });
                    const data = response.ok ? await response.json() : {};
                    if (!data.verified) {
                        const error = new Error("Email has not been verified with a code.");
                        error.code = "tienhub/email-not-verified";
                        throw error;
                    }
                }
            }
            // A new Gmail user’s username comes from /users; never infer it
            // from the email address, avoiding orphan/mismatched records.
            if (!legacy) {
                const { db } = await import("../src/core/firebase.js");
                const { get, ref } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");
                const record = (await get(ref(db, `users/${user.uid}`))).val();
                if (!record?.username || !record?.usernameNormalized) {
                    throw new Error("Registration profile is incomplete. Please contact TienHub support.");
                }
            }
            await ensureUserRecord(user, user.displayName || usernameOrEmail);
            await acquireAccountDeviceLock(user);
            const actualName = user.displayName || (legacy ? loginInput : "");
            localStorage.setItem("tienhub_logged_in", "true");
            if (actualName) localStorage.setItem("tienhub_username", actualName);
            return user;
        } catch (error) {
            await auth.signOut().catch(() => {});
            throw error;
        }
    }

    // =========================================================

    // FIREBASE ERROR

    // =========================================================



    function firebaseError(error) {



        console.error(error);





        switch (error.code) {



            case "tienhub/device-limit":

                return "This account is signed in on another device.";



            case "tienhub/device-lock-failed":

                return "Unable to verify your session. Please try again.";



            case "auth/email-already-in-use":

                return "Username already exists.";



            case "auth/invalid-credential":

            case "auth/invalid-login-credentials":

                return "Incorrect username or password.";



            case "auth/user-not-found":

                return "Account not found.";



            case "auth/wrong-password":

                return "Incorrect password.";



            case "auth/weak-password":

                return "Password must be at least six characters.";



            case "auth/network-request-failed":

                return "Network connection failed.";



            case "auth/too-many-requests":

                return "Too many attempts. Please try again later.";



            case "tienhub/username-login-unavailable":
                return "Username sign-in is temporarily unavailable. Please sign in with Gmail instead.";

            case "tienhub/email-not-verified":
                return "Email not verified. Use the six-digit code sent at registration.";

            case "tienhub/username-taken":
                return "Username is taken. Choose another.";

            case "auth/operation-not-allowed":

                return "Email/password sign-in is not enabled.";



            default:

                return (

                    error.message ||

                    "Something went wrong. Please try again."

                );



        }



    }





    // =========================================================

    // REGISTER FORM

    // =========================================================



    if (registerForm) {



        registerForm.addEventListener(

            "submit",

            async (event) => {



                event.preventDefault();





                const username =

                    registerUsername?.value.trim() || "";

                const email = registerEmail?.value.trim() || "";
                const code = registerCode?.value.trim() || "";






                const password =

                    registerPassword?.value || "";





                const confirmPassword =

                    registerPasswordConfirm?.value || "";





                clearMessages();





                if (!validUsername(username)) {



                    showMessage(

                        registerMessage,

                        "Username must be 3–20 characters, using letters, numbers or _.",

                        "error"

                    );



                    registerUsername?.focus();



                    return;



                }





                if (ENABLE_VERIFIED_EMAIL_SIGNUP && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.trim().toLowerCase().endsWith("@auth.tienhub.vn"))) {
                    showMessage(registerMessage, "Please enter a valid email address.", "error");
                    registerEmail?.focus();
                    return;
                }

                if (!/^\d{6}$/.test(code)) {
                    showMessage(registerMessage, "Enter the six-digit verification code emailed to you.", "error");
                    registerCode?.focus();
                    return;
                }

                if (!validPassword(password)) {



                    showMessage(

                        registerMessage,

                        "Password must be at least six characters.",

                        "error"

                    );



                    registerPassword?.focus();



                    return;



                }





                if (password !== confirmPassword) {



                    showMessage(

                        registerMessage,

                        "Passwords do not match.",

                        "error"

                    );



                    registerPasswordConfirm?.focus();



                    return;



                }





                const submitButton =

                    registerForm.querySelector(

                        'button[type="submit"]'

                    );





                if (submitButton) {



                    submitButton.disabled = true;



                    submitButton.textContent =

                        "Signing up...";



                }





                try {



                    const registerResult = await registerUser(username, password, email, code);
                    if (registerResult.pendingVerification) {
                        showMessage(registerMessage, registerResult.verificationSent
                            ? "Account created. Check your inbox (and spam folder), verify your email, and sign in."
                            : "Account created, but the verification email couldn’t be sent. Sign in and request another verification email.", "success");
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = "Sign Up";
                        }
                        return;
                    }





                    showMessage(

                        registerMessage,

                        "Sign-up successful. Opening TienHub...",

                        "success"

                    );





                    setTimeout(() => {



                        window.location.replace(

                            "../index.html"

                        );



                    }, 700);





                } catch (error) {



                    showMessage(

                        registerMessage,

                        firebaseError(error),

                        "error"

                    );





                    if (submitButton) {



                        submitButton.disabled = false;



                        submitButton.textContent =

                            "Sign Up";



                    }



                }



            }

        );



    }





    // =========================================================

    // LOGIN FORM

    // =========================================================



    if (loginForm) {



        loginForm.addEventListener(

            "submit",

            async (event) => {



                event.preventDefault();





                const username =

                    loginUsername?.value.trim() || "";





                const password =

                    loginPassword?.value || "";





                clearMessages();





                if (!validUsername(username) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {



                    showMessage(

                        loginMessage,

                        "Invalid username.",

                        "error"

                    );



                    loginUsername?.focus();



                    return;



                }





                if (!password) {



                    showMessage(

                        loginMessage,

                        "Please enter your password.",

                        "error"

                    );



                    loginPassword?.focus();



                    return;



                }





                const submitButton =

                    loginForm.querySelector(

                        'button[type="submit"]'

                    );





                if (submitButton) {



                    submitButton.disabled = true;



                    submitButton.textContent =

                        "Signing in...";



                }





                try {



                    await loginUser(

                        username,

                        password

                    );





                    showMessage(

                        loginMessage,

                        "Sign-in successful. Opening TienHub...",

                        "success"

                    );





                    setTimeout(() => {



                        window.location.replace(

                            "../index.html"

                        );



                    }, 700);





                } catch (error) {



                    showMessage(

                        loginMessage,

                        firebaseError(error),

                        "error"

                    );





                    if (submitButton) {



                        submitButton.disabled = false;



                        submitButton.textContent =

                            "Sign In";



                    }



                }



            }

        );



    }





    // =========================================================

    // INITIAL STATE

    // =========================================================



    // Mở thẳng biểu mẫu khi người chơi đi từ TienHub Desktop.
    // Tham số URL không chứa mật khẩu hay thông tin đăng nhập.
    const desktopAuthMode = new URLSearchParams(window.location.search).get('mode');
    if (desktopAuthMode === 'register') {
        showRegister();
    } else if (desktopAuthMode === 'recover' || desktopAuthMode === 'reset') {
        showLogin();
        resetLink?.click();
    } else {
        showLogin();
    }

});