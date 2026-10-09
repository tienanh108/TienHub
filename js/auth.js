document.addEventListener("DOMContentLoaded", () => {

    // TienHub Account v0.4 staging. Requires OTP Worker v0.4 before signup.
    const ENABLE_VERIFIED_EMAIL_SIGNUP = true;
    const registerEmail = document.getElementById("registerEmail");
    const emailField = document.getElementById("registerEmailField");
    if (emailField) emailField.hidden = !ENABLE_VERIFIED_EMAIL_SIGNUP;
    if (registerEmail) registerEmail.required = ENABLE_VERIFIED_EMAIL_SIGNUP;
    const loginUsernameLabel = document.querySelector('label[for="loginUsername"]');
    if (loginUsernameLabel) loginUsernameLabel.textContent = "Username hoặc email";

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
        if (!response.ok) throw new Error(result.error || "Không thể kết nối dịch vụ khôi phục mật khẩu.");
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
                ? 'Gửi mã xác minh <span aria-hidden="true">→</span>'
                : step === "code"
                    ? 'Xác minh mã <span aria-hidden="true">→</span>'
                    : 'Đặt mật khẩu mới <span aria-hidden="true">→</span>';
        }
        if (authSubtitle) authSubtitle.textContent = step === "email"
            ? "Nhập email đã đăng ký hoặc liên kết với TienHub."
            : step === "code"
                ? "Nhập mã 6 số đã gửi đến email của bạn."
                : "Mã hợp lệ. Hãy đặt mật khẩu mới cho tài khoản.";
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
            recoveryResend.textContent = remaining ? `Gửi lại (${remaining}s)` : "Gửi lại mã";
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
        if (authTitle) authTitle.textContent = "Quên mật khẩu";
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
            showMessage(recoveryMessage, "Mã xác minh mới đã được gửi. Hãy kiểm tra email và thư Spam.", "success");
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
                    throw new Error("Hãy nhập email thật đã đăng ký hoặc liên kết.");
                }
                await resetApi("send", { email });
                recoveryActiveEmail = email;
                setRecoveryStep("code");
                cooldownRecovery();
                showMessage(recoveryMessage, "Mã xác minh đã được gửi. Hãy kiểm tra email và thư Spam.", "success");
            } else if (recoveryStep === "code") {
                const code = recoveryCode?.value.trim() || "";
                if (!/^\d{6}$/.test(code)) throw new Error("Nhập đủ mã xác minh 6 số.");
                await resetApi("check", { email: recoveryActiveEmail, code });
                setRecoveryStep("password");
                showMessage(recoveryMessage, "Xác minh thành công. Hãy nhập mật khẩu mới.", "success");
            } else {
                const nextPassword = recoveryNewPassword?.value || "";
                const confirmation = recoveryConfirmPassword?.value || "";
                if (nextPassword.length < 10 || nextPassword.length > 128) throw new Error("Mật khẩu mới cần từ 10 đến 128 ký tự.");
                if (nextPassword !== confirmation) throw new Error("Hai mật khẩu mới không khớp.");
                await resetApi("confirm", {email:recoveryActiveEmail,code:recoveryCode.value.trim(),newPassword:nextPassword});
                recoveryNewPassword.value = "";
                recoveryConfirmPassword.value = "";
                if (recoveryPasswordStep) recoveryPasswordStep.hidden = true;
                if (recoverySubmit) recoverySubmit.hidden = true;
                if (authSubtitle) authSubtitle.textContent = "Bạn có thể quay lại đăng nhập bằng mật khẩu mới.";
                showMessage(recoveryMessage, "Đổi mật khẩu thành công! Hãy quay lại đăng nhập.", "success");
                return;
            }
        } catch (error) {
            showMessage(recoveryMessage, error.message || "Không thể xử lý yêu cầu.", "error");
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
        if (!response.ok) throw new Error(data.error || "Dịch vụ gửi mã chưa sẵn sàng. Vui lòng thử lại sau.");
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
            sendRegisterCodeBtn.textContent = seconds ? `Gửi lại (${seconds}s)` : "Gửi lại mã";
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
                sendRegisterCodeBtn.textContent = seconds ? `Gửi lại (${seconds}s)` : "Gửi mã";
                if (!seconds) clearInterval(cooldownTimer);
            };
            tick(); cooldownTimer = setInterval(tick, 1000);
        } else if (sendRegisterCodeBtn) {
            sendRegisterCodeBtn.disabled = false; sendRegisterCodeBtn.textContent = "Gửi mã";
        }
    });
    sendRegisterCodeBtn?.addEventListener("click", async () => {
        const email = registerEmail?.value.trim().toLowerCase() || "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage(codeMessage, "Vui lòng nhập email hợp lệ trước.", "error"); return;
        }
        sendRegisterCodeBtn.disabled = true;
        try {
            await otpRequest("send", { email, purpose: "signup" });
            startCooldown(email);
            showMessage(codeMessage, "Đã gửi mã 6 số. Kiểm tra hộp thư và Spam.", "success");
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

            authTitle.textContent = "Đăng nhập";

        }



        if (authSubtitle) {

            authSubtitle.textContent =

                "Đăng nhập vào tài khoản TienHub của bạn.";

        }



        if (switchAuth) {

            switchAuth.textContent = "Đăng ký";

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

            authTitle.textContent = "Đăng ký";

        }



        if (authSubtitle) {

            authSubtitle.textContent =

                "Tạo tài khoản TienHub để bắt đầu.";

        }



        if (switchAuth) {

            switchAuth.textContent = "Đăng nhập";

        }



        if (switchText) {

            switchText.style.display = "none";

        }



        clearMessages();

    }





    // Nút Đăng ký / Đăng nhập

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

                    "Không tìm thấy ô mật khẩu:",

                    targetId

                );



                return;

            }





            // Đang ẩn → hiện

            if (input.type === "password") {



                input.type = "text";



                button.textContent = "Ẩn";



                button.setAttribute(

                    "aria-label",

                    "Ẩn mật khẩu"

                );



            }



            // Đang hiện → ẩn

            else {



                input.type = "password";



                button.textContent = "Hiện";



                button.setAttribute(

                    "aria-label",

                    "Hiện mật khẩu"

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

                "Không thể kết nối Firebase."

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

                "Không xác định được username của tài khoản."

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
            throw new Error("Đăng ký email chưa được bật.");
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
            throw new Error("Tên đăng nhập không hợp lệ.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)
            || signupEmail.endsWith("@auth.tienhub.vn")) {
            throw new Error("Hãy nhập email thật để nhận thư xác minh.");
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
                    throw new Error("Email này thuộc một tài khoản TienHub khác.");
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
                const conflict = new Error("Tên đăng nhập đã được sử dụng. Hãy chọn tên khác.");
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
                    throw new Error("Hồ sơ cũ không khớp tên đăng nhập; dừng để bảo vệ UID.");
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
                throw new Error(`Không thể tiếp tục đăng ký hiện có: ${error.message}`);
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
                throw new Error("Tạo tài khoản chưa hoàn tất. Đừng đăng ký lặp lại; hãy liên hệ quản trị TienHub để kiểm tra.");
            }
            throw error;
        }

        // Code is consumed by Worker only after new UID & username persist.
        // If this network call fails, leave the newly created UID intact so
        // user can retry safely; never replace/change another account's UID.
        try {
            await otpRequest("claim", { email: signupEmail, purpose: "signup", code }, user);
        } catch (error) {
            throw new Error(`Tài khoản đã được tạo nhưng chưa xác minh xong: ${error.message}. Giữ trang này và thử lại.`);
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



        // Release this browser's lease when Firebase disconnects.
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

            const error = new Error("Không thể nhận quyền đăng nhập trên thiết bị này.");

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



            // Do not remove the new device's lock.

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



            // Never delete another device's lease.

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
                // account's real email must NEVER be returned to the browser.
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
                    const error = new Error("Không thể kết nối máy chủ đăng nhập TienHub.");
                    error.code = "tienhub/username-login-unavailable";
                    throw error;
                }
                if (!response.ok) {
                    const error = new Error(response.status === 401
                        ? "Tên người dùng hoặc mật khẩu không đúng."
                        : "Dịch vụ đăng nhập bằng username tạm thời không khả dụng.");
                    error.code = response.status === 401 ? "auth/invalid-credential" : "tienhub/username-login-unavailable";
                    throw error;
                }
                const data = await response.json();
                if (typeof data.customToken !== "string" || data.customToken.length < 80) {
                    const error = new Error("Máy chủ trả về dữ liệu đăng nhập không hợp lệ.");
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
                // Either Firebase's native verified flag, or TienHub's
                // server-verified 6-digit code is accepted.
                await reload(user);
                if (!user.emailVerified) {
                    const response = await fetch(`${EMAIL_API}/api/v1/email/status`, {
                        headers: { Authorization: `Bearer ${await user.getIdToken(true)}` }, cache: "no-store"
                    });
                    const data = response.ok ? await response.json() : {};
                    if (!data.verified) {
                        const error = new Error("Email chưa được xác minh bằng mã.");
                        error.code = "tienhub/email-not-verified";
                        throw error;
                    }
                }
            }
            // A new Gmail user's username comes from /users; never infer it
            // from the email address, avoiding orphan/mismatched records.
            if (!legacy) {
                const { db } = await import("../src/core/firebase.js");
                const { get, ref } = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js");
                const record = (await get(ref(db, `users/${user.uid}`))).val();
                if (!record?.username || !record?.usernameNormalized) {
                    throw new Error("Hồ sơ đăng ký chưa hoàn tất. Hãy liên hệ quản trị TienHub để hỗ trợ.");
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

                return "Tài khoản này đang được đăng nhập trên một thiết bị khác.";



            case "tienhub/device-lock-failed":

                return "Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.";



            case "auth/email-already-in-use":

                return "Tên người dùng này đã tồn tại.";



            case "auth/invalid-credential":

            case "auth/invalid-login-credentials":

                return "Tên người dùng hoặc mật khẩu không đúng.";



            case "auth/user-not-found":

                return "Tài khoản không tồn tại.";



            case "auth/wrong-password":

                return "Mật khẩu không đúng.";



            case "auth/weak-password":

                return "Mật khẩu phải có ít nhất 6 ký tự.";



            case "auth/network-request-failed":

                return "Không thể kết nối mạng.";



            case "auth/too-many-requests":

                return "Có quá nhiều lần thử. Hãy thử lại sau.";



            case "tienhub/username-login-unavailable":
                return "Máy chủ đăng nhập username tạm thời không khả dụng. Hãy đăng nhập bằng Gmail trong lúc chờ khắc phục.";

            case "tienhub/email-not-verified":
                return "Email chưa xác minh. Hãy dùng mã 6 số đã gửi khi đăng ký.";

            case "tienhub/username-taken":
                return "Username đã được đăng ký. Hãy chọn tên khác.";

            case "auth/operation-not-allowed":

                return "Firebase chưa bật Email/Password.";



            default:

                return (

                    error.message ||

                    "Đã xảy ra lỗi. Hãy thử lại."

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

                        "Tên người dùng phải có 3–20 ký tự, chỉ gồm chữ, số hoặc _.",

                        "error"

                    );



                    registerUsername?.focus();



                    return;



                }





                if (ENABLE_VERIFIED_EMAIL_SIGNUP && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.trim().toLowerCase().endsWith("@auth.tienhub.vn"))) {
                    showMessage(registerMessage, "Vui lòng nhập email hợp lệ.", "error");
                    registerEmail?.focus();
                    return;
                }

                if (!/^\d{6}$/.test(code)) {
                    showMessage(registerMessage, "Nhập mã xác minh gồm 6 số đã gửi đến email.", "error");
                    registerCode?.focus();
                    return;
                }

                if (!validPassword(password)) {



                    showMessage(

                        registerMessage,

                        "Mật khẩu phải có ít nhất 6 ký tự.",

                        "error"

                    );



                    registerPassword?.focus();



                    return;



                }





                if (password !== confirmPassword) {



                    showMessage(

                        registerMessage,

                        "Mật khẩu xác nhận không khớp.",

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

                        "Đang đăng ký...";



                }





                try {



                    const registerResult = await registerUser(username, password, email, code);
                    if (registerResult.pendingVerification) {
                        showMessage(registerMessage, registerResult.verificationSent
                            ? "Tài khoản đã được tạo. Kiểm tra email (kể cả Spam) để xác minh rồi đăng nhập bằng email."
                            : "Tài khoản đã được tạo nhưng chưa gửi được thư xác minh. Chọn Đăng nhập rồi dùng Gửi lại email xác minh.", "success");
                        if (submitButton) {
                            submitButton.disabled = false;
                            submitButton.textContent = "Đăng ký";
                        }
                        return;
                    }





                    showMessage(

                        registerMessage,

                        "Đăng ký thành công. Đang vào TienHub...",

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

                            "Đăng ký";



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

                        "Tên người dùng không hợp lệ.",

                        "error"

                    );



                    loginUsername?.focus();



                    return;



                }





                if (!password) {



                    showMessage(

                        loginMessage,

                        "Vui lòng nhập mật khẩu.",

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

                        "Đang đăng nhập...";



                }





                try {



                    await loginUser(

                        username,

                        password

                    );





                    showMessage(

                        loginMessage,

                        "Đăng nhập thành công. Đang vào TienHub...",

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

                            "Đăng nhập";



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