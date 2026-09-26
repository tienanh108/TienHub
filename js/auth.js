document.addEventListener("DOMContentLoaded", () => {



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



        // Keep profile fields such as displayName and avatar intact.
        // Using set() here used to overwrite users/{uid} on every login,
        // which erased the saved avatar.
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



    async function registerUser(username, password) {



        const auth =

            await getFirebaseAuth();





        const {

            createUserWithEmailAndPassword,

            updateProfile

        } = await import(

            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"

        );





        const normalizedUsername =

            username.trim().toLowerCase();





        const technicalEmail =

            `${normalizedUsername}@auth.tienhub.vn`;





        const result =

            await createUserWithEmailAndPassword(

                auth,

                technicalEmail,

                password

            );





        await updateProfile(

            result.user,

            {

                displayName: username.trim()

            }

        );



        await ensureUserRecord(

            result.user,

            username.trim()

        );



        try {

            await acquireAccountDeviceLock(result.user);

        } catch (error) {

            await auth.signOut();

            throw error;

        }





        localStorage.setItem(

            "tienhub_logged_in",

            "true"

        );





        localStorage.setItem(

            "tienhub_username",

            username.trim()

        );





        return result.user;



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

        const { ref, runTransaction, get, onValue } = api;

        const uid = user.uid;

        const deviceId = getDeviceId();

        const lockRef = ref(core.db, `activeDevices/${uid}/${DEVICE_LOCK_PATH}`);



        // Do NOT register onDisconnect on the shared lock node.
        // A previous browser can be kicked while a new browser owns the same
        // node; an old onDisconnect callback could otherwise remove the new
        // browser's lock. The owner is cleared only by an owner-checked
        // logout transaction, while a later login always takes ownership.
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



        if (!tx.committed || tx.snapshot.val()?.deviceId !== deviceId) {

            const error = new Error("Không thể nhận quyền đăng nhập trên thiết bị này.");

            error.code = "tienhub/device-lock-failed";

            throw error;

        }

        // Confirm the server-side value before allowing the login to continue.
        const confirmed = await get(lockRef);
        if (confirmed.val()?.deviceId !== deviceId) {
            const error = new Error("Phiên đăng nhập đã bị thay thế trên thiết bị khác.");
            error.code = "tienhub/device-limit";
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



    async function loginUser(username, password) {



        const auth =

            await getFirebaseAuth();





        const {

            signInWithEmailAndPassword

        } = await import(

            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"

        );





        const normalizedUsername =

            username.trim().toLowerCase();





        const technicalEmail =

            `${normalizedUsername}@auth.tienhub.vn`;





        const result =

            await signInWithEmailAndPassword(

                auth,

                technicalEmail,

                password

            );



        await ensureUserRecord(

            result.user,

            username.trim()

        );



        try {

            await acquireAccountDeviceLock(result.user);

        } catch (error) {

            await auth.signOut();

            throw error;

        }





        localStorage.setItem(

            "tienhub_logged_in",

            "true"

        );





        localStorage.setItem(

            "tienhub_username",

            result.user.displayName ||

            username.trim()

        );





        return result.user;



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



                    await registerUser(

                        username,

                        password

                    );





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





                if (!validUsername(username)) {



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



    showLogin();



});
