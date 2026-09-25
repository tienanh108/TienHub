/* =========================================================
   TienHuB — HUB.JS
   Firebase + Authentication + Lobby Presence
   + Public Statistics + Music
   + Game Library / Search / Filter / Sort
========================================================= */

(function () {

    "use strict";


    /* =====================================================
       BASIC
    ===================================================== */

    const yearElement =
        document.querySelector("#year");


    if (yearElement) {
        yearElement.textContent =
            new Date().getFullYear();
    }


    /* =====================================================
       FIREBASE CONFIG
    ===================================================== */

    const FIREBASE_CONFIG = {

        apiKey:
            "AIzaSyA2uJ2-lHYjNeA40kFoS1-VsCaqhjYszdw",

        authDomain:
            "caro-3460d.firebaseapp.com",

        databaseURL:
            "https://caro-3460d-default-rtdb.asia-southeast1.firebasedatabase.app/",

        projectId:
            "caro-3460d",

        storageBucket:
            "caro-3460d.firebasestorage.app",

        messagingSenderId:
            "473059233945",

        appId:
            "1:473059233945:web:7bbf037f41a8a8d331e808",

        measurementId:
            "G-WXXMSSSN3W"

    };


    /* =====================================================
       FIREBASE STATE
    ===================================================== */

    let firebaseApp = null;
    let database = null;
    let auth = null;
    let currentUser = null;

    let firebaseReady = false;
    let authReady = false;

    const GUEST_MODE_KEY =
        "TienHuB_guest_mode";


    /* =====================================================
       LOBBY PRESENCE
    ===================================================== */

    let lobbyPresenceRef = null;
    let lobbyHeartbeat = null;

    let lobbyConnectedRef = null;
    let lobbyConnectedListener = null;

    const lobbySessionId =
        "hub_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 10);


    /* =====================================================
       HELPERS
    ===================================================== */

    function formatNumber(number) {

        return Number(
            number || 0
        ).toLocaleString("vi-VN");

    }


    function getVietnamDate() {

        const formatter =
            new Intl.DateTimeFormat(
                "en-CA",
                {
                    timeZone:
                        "Asia/Ho_Chi_Minh",

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit"
                }
            );

        return formatter.format(
            new Date()
        );

    }


    function getLastSevenDates() {

        const dates = [];

        const now =
            new Date(
                new Date().toLocaleString(
                    "en-US",
                    {
                        timeZone:
                            "Asia/Ho_Chi_Minh"
                    }
                )
            );


        for (
            let i = 6;
            i >= 0;
            i--
        ) {

            const date =
                new Date(now);

            date.setDate(
                date.getDate() - i
            );


            const year =
                date.getFullYear();

            const month =
                String(
                    date.getMonth() + 1
                ).padStart(2, "0");

            const day =
                String(
                    date.getDate()
                ).padStart(2, "0");


            dates.push(
                `${year}-${month}-${day}`
            );

        }


        return dates;

    }


    function formatShortDate(
        dateString
    ) {

        const parts =
            String(dateString).split("-");


        if (
            parts.length !== 3
        ) {

            return dateString;

        }


        return (
            parts[2] +
            "/" +
            parts[1]
        );

    }


    /* =====================================================
       AUTH HELPERS
    ===================================================== */

    function normalizeUsername(
        username
    ) {

        return String(username || "")
            .trim()
            .toLowerCase();

    }


    function usernameToEmail(
        username
    ) {

        return (
            normalizeUsername(username) +
            "@TienHuB.local"
        );

    }


    function isValidUsername(
        username
    ) {

        return /^[a-zA-Z0-9_]{3,20}$/
            .test(
                String(username || "")
            );

    }


    /* =====================================================
       AUTH MODAL
    ===================================================== */

    function openAuthModal() {

        const modal =
            document.querySelector(
                "#authModal"
            );


        if (!modal) {
            return;
        }


        modal.classList.remove(
            "hidden"
        );

        modal.style.display =
            "flex";

    }


    function closeAuthModal() {

        const modal =
            document.querySelector(
                "#authModal"
            );


        if (!modal) {
            return;
        }


        modal.classList.add(
            "hidden"
        );

        modal.style.display =
            "none";

    }


    /* =====================================================
       USER PROFILE MENU
    ===================================================== */

    let profileMenu = null;


    function createProfileMenu() {

        if (profileMenu) {
            return profileMenu;
        }


        const profile =
            document.querySelector(
                "#userProfile"
            );


        if (!profile) {
            return null;
        }


        profileMenu =
            document.createElement(
                "div"
            );


        profileMenu.id =
            "TienHuBProfileMenu";


        profileMenu.innerHTML = `

            <div class="TienHuB-profile-menu-header">

                <div class="TienHuB-profile-menu-avatar">
                    👤
                </div>

                <div class="TienHuB-profile-menu-info">

                    <strong
                        id="TienHuBProfileMenuName"
                    >
                        Người chơi
                    </strong>

                    <span
                        id="TienHuBProfileMenuStatus"
                    >
                        🟢 Đang online
                    </span>

                </div>

            </div>

            <div class="TienHuB-profile-menu-divider"></div>

            <button
                type="button"
                id="TienHuBLogoutButton"
                class="TienHuB-profile-logout"
            >
                <span>🚪</span>
                <span id="TienHuBLogoutText">
                    Đăng xuất
                </span>
            </button>

        `;


        Object.assign(
            profileMenu.style,
            {
                position:
                    "absolute",

                top:
                    "calc(100% + 8px)",

                right:
                    "0",

                width:
                    "235px",

                padding:
                    "10px",

                background:
                    "#ffffff",

                border:
                    "1px solid #e5e0ef",

                borderRadius:
                    "16px",

                boxShadow:
                    "0 14px 35px rgba(40,25,80,.16)",

                zIndex:
                    "9999",

                display:
                    "none",

                boxSizing:
                    "border-box",

                fontFamily:
                    "inherit"
            }
        );


        const header =
            profileMenu.querySelector(
                ".TienHuB-profile-menu-header"
            );


        if (header) {

            Object.assign(
                header.style,
                {
                    display:
                        "flex",

                    alignItems:
                        "center",

                    gap:
                        "10px",

                    padding:
                        "7px 7px 9px"
                }
            );

        }


        const menuAvatar =
            profileMenu.querySelector(
                ".TienHuB-profile-menu-avatar"
            );


        if (menuAvatar) {

            Object.assign(
                menuAvatar.style,
                {
                    width:
                        "38px",

                    height:
                        "38px",

                    minWidth:
                        "38px",

                    borderRadius:
                        "50%",

                    background:
                        "#f5f2ff",

                    border:
                        "1px solid #ded8ed",

                    display:
                        "flex",

                    alignItems:
                        "center",

                    justifyContent:
                        "center",

                    fontSize:
                        "20px",

                    overflow:
                        "hidden"
                }
            );

        }


        const info =
            profileMenu.querySelector(
                ".TienHuB-profile-menu-info"
            );


        if (info) {

            Object.assign(
                info.style,
                {
                    minWidth:
                        "0",

                    display:
                        "flex",

                    flexDirection:
                        "column",

                    gap:
                        "4px"
                }
            );

        }


        const menuName =
            profileMenu.querySelector(
                "#TienHuBProfileMenuName"
            );


        if (menuName) {

            Object.assign(
                menuName.style,
                {
                    color:
                        "#211a32",

                    fontSize:
                        "14px",

                    fontWeight:
                        "800",

                    overflow:
                        "hidden",

                    textOverflow:
                        "ellipsis",

                    whiteSpace:
                        "nowrap",

                    maxWidth:
                        "155px"
                }
            );

        }


        const menuStatus =
            profileMenu.querySelector(
                "#TienHuBProfileMenuStatus"
            );


        if (menuStatus) {

            Object.assign(
                menuStatus.style,
                {
                    color:
                        "#6f6780",

                    fontSize:
                        "11px",

                    fontWeight:
                        "600"
                }
            );

        }


        const divider =
            profileMenu.querySelector(
                ".TienHuB-profile-menu-divider"
            );


        if (divider) {

            Object.assign(
                divider.style,
                {
                    height:
                        "1px",

                    background:
                        "#eeeaf5",

                    margin:
                        "2px 4px 7px"
                }
            );

        }


        const logoutButton =
            profileMenu.querySelector(
                "#TienHuBLogoutButton"
            );


        if (logoutButton) {

            Object.assign(
                logoutButton.style,
                {
                    width:
                        "100%",

                    height:
                        "42px",

                    border:
                        "none",

                    borderRadius:
                        "11px",

                    background:
                        "transparent",

                    color:
                        "#c0392b",

                    display:
                        "flex",

                    alignItems:
                        "center",

                    gap:
                        "10px",

                    padding:
                        "0 12px",

                    fontSize:
                        "13px",

                    fontWeight:
                        "800",

                    cursor:
                        "pointer",

                    textAlign:
                        "left",

                    fontFamily:
                        "inherit",

                    transition:
                        "background .15s ease"
                }
            );


            logoutButton.addEventListener(
                "mouseenter",
                () => {

                    logoutButton.style.background =
                        "#fff1ef";

                }
            );


            logoutButton.addEventListener(
                "mouseleave",
                () => {

                    logoutButton.style.background =
                        "transparent";

                }
            );


            logoutButton.addEventListener(
                "click",
                async event => {

                    event.preventDefault();
                    event.stopPropagation();

                    await logoutUser();

                }
            );

        }


        if (
            getComputedStyle(profile).position ===
            "static"
        ) {

            profile.style.position =
                "relative";

        }


        profile.appendChild(
            profileMenu
        );


        return profileMenu;

    }


    function toggleProfileMenu() {

        const menu =
            createProfileMenu();


        if (!menu) {
            return;
        }


        const isOpen =
            menu.style.display ===
            "block";


        menu.style.display =
            isOpen
                ? "none"
                : "block";

    }


    function closeProfileMenu() {

        if (!profileMenu) {
            return;
        }


        profileMenu.style.display =
            "none";

    }


    /* =====================================================
       LOGOUT
    ===================================================== */

    async function logoutUser() {

        if (!auth) {
            return;
        }


        const logoutButton =
            document.querySelector(
                "#TienHuBLogoutButton"
            );

        const logoutText =
            document.querySelector(
                "#TienHuBLogoutText"
            );


        try {

            if (logoutButton) {

                logoutButton.disabled =
                    true;

                logoutButton.style.opacity =
                    "0.6";

                logoutButton.style.cursor =
                    "wait";

            }


            if (logoutText) {

                logoutText.textContent =
                    "Đang đăng xuất...";

            }


            if (lobbyPresenceRef) {

                try {

                    await lobbyPresenceRef.remove();

                } catch (error) {

                    console.warn(
                        "TienHuB logout presence lỗi:",
                        error
                    );

                }

            }


            if (lobbyHeartbeat) {

                clearInterval(
                    lobbyHeartbeat
                );

                lobbyHeartbeat =
                    null;

            }


            lobbyPresenceRef =
                null;


            localStorage.removeItem(
                GUEST_MODE_KEY
            );


            await auth.signOut();


            currentUser =
                null;

            authReady =
                false;


            closeProfileMenu();


        } catch (error) {

            console.error(
                "TienHuB Logout ERROR:",
                error
            );


            if (logoutText) {

                logoutText.textContent =
                    "Đăng xuất";

            }

        } finally {

            if (logoutButton) {

                logoutButton.disabled =
                    false;

                logoutButton.style.opacity =
                    "1";

                logoutButton.style.cursor =
                    "pointer";

            }

        }

    }


    /* =====================================================
       SETUP USER PROFILE
    ===================================================== */

    function setupUserProfile() {

        const profile =
            document.querySelector(
                "#userProfile"
            );


        if (!profile) {
            return;
        }


        createProfileMenu();


        profile.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        "#TienHuBLogoutButton"
                    )
                ) {

                    return;

                }


                event.preventDefault();
                event.stopPropagation();

                toggleProfileMenu();

            }
        );


        document.addEventListener(
            "click",
            event => {

                if (
                    !profile.contains(
                        event.target
                    )
                ) {

                    closeProfileMenu();

                }

            }
        );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeProfileMenu();

                }

            }
        );

    }


    /* =====================================================
       UPDATE USER PROFILE
    ===================================================== */

    function updateUserProfile(
        user
    ) {

        const profile =
            document.querySelector(
                "#userProfile"
            );

        const avatar =
            document.querySelector(
                "#userAvatar"
            );

        const displayName =
            document.querySelector(
                "#userDisplayName"
            );


        if (
            !profile ||
            !avatar ||
            !displayName
        ) {

            return;

        }


        if (!user) {

            profile.classList.add(
                "hidden"
            );

            closeProfileMenu();

            return;

        }


        avatar.innerHTML =
            "👤";

        avatar.style.backgroundImage =
            "";


        if (user.isAnonymous) {

            displayName.textContent =
                "Khách";


            profile.classList.remove(
                "hidden"
            );


            createProfileMenu();


            const menuName =
                document.querySelector(
                    "#TienHuBProfileMenuName"
                );

            const menuStatus =
                document.querySelector(
                    "#TienHuBProfileMenuStatus"
                );

            const logoutText =
                document.querySelector(
                    "#TienHuBLogoutText"
                );


            if (menuName) {
                menuName.textContent =
                    "Khách";
            }


            if (menuStatus) {
                menuStatus.textContent =
                    "🟢 Chơi với tư cách khách";
            }


            if (logoutText) {
                logoutText.textContent =
                    "Thoát khách";
            }


            return;

        }


        profile.classList.remove(
            "hidden"
        );


        displayName.textContent =
            "Đang tải...";


        createProfileMenu();


        const menuName =
            document.querySelector(
                "#TienHuBProfileMenuName"
            );

        const menuStatus =
            document.querySelector(
                "#TienHuBProfileMenuStatus"
            );

        const logoutText =
            document.querySelector(
                "#TienHuBLogoutText"
            );


        if (menuName) {
            menuName.textContent =
                "Đang tải...";
        }


        if (menuStatus) {
            menuStatus.textContent =
                "🟢 Đang online";
        }


        if (logoutText) {
            logoutText.textContent =
                "Đăng xuất";
        }


        if (!database) {

            displayName.textContent =
                "Người chơi";

            if (menuName) {
                menuName.textContent =
                    "Người chơi";
            }

            return;

        }


        database
            .ref(
                `users/${user.uid}`
            )
            .once("value")
            .then(
                snapshot => {

                    if (
                        !currentUser ||
                        currentUser.uid !==
                        user.uid
                    ) {

                        return;

                    }


                    const data =
                        snapshot.val() || {};


                    const username =
                        data.username ||
                        "Người chơi";


                    displayName.textContent =
                        data.displayName ||
                        username;


                    if (menuName) {

                        menuName.textContent =
                            data.displayName ||
                            username;

                    }


                    if (
                        data.avatarUrl
                    ) {

                        avatar.innerHTML =
                            "";

                        avatar.style.backgroundImage =
                            `url("${data.avatarUrl}")`;

                        avatar.style.backgroundSize =
                            "cover";

                        avatar.style.backgroundPosition =
                            "center";

                        avatar.style.backgroundRepeat =
                            "no-repeat";


                        const menuAvatar =
                            document.querySelector(
                                ".TienHuB-profile-menu-avatar"
                            );


                        if (menuAvatar) {

                            menuAvatar.textContent =
                                "";

                            menuAvatar.style.backgroundImage =
                                `url("${data.avatarUrl}")`;

                            menuAvatar.style.backgroundSize =
                                "cover";

                            menuAvatar.style.backgroundPosition =
                                "center";

                        }

                    }

                }
            )
            .catch(
                error => {

                    console.warn(
                        "TienHuB profile lỗi:",
                        error
                    );


                    displayName.textContent =
                        "Người chơi";

                    if (menuName) {
                        menuName.textContent =
                            "Người chơi";
                    }

                }
            );

    }


    /* =====================================================
       AUTH UI
    ===================================================== */

    function setupAuthUI() {

        const authModal =
            document.querySelector("#authModal");

        const loginPanel =
            document.querySelector("#loginPanel");

        const registerPanel =
            document.querySelector("#registerPanel");

        const showRegisterButton =
            document.querySelector("#showRegisterButton");

        const backToLoginButton =
            document.querySelector("#backToLoginButton");

        const loginButton =
            document.querySelector("#loginButton");

        const registerButton =
            document.querySelector("#registerButton");

        const guestButton =
            document.querySelector("#guestButton");

        const closeButton =
            document.querySelector("#closeAuthButton");


        if (
            !authModal ||
            !loginPanel ||
            !registerPanel
        ) {

            return;

        }


        function showLoginPanel() {

            loginPanel.classList.remove("hidden");
            registerPanel.classList.add("hidden");

            loginPanel.style.display = "block";
            registerPanel.style.display = "none";

        }


        function showRegisterPanel() {

            loginPanel.classList.add("hidden");
            registerPanel.classList.remove("hidden");

            loginPanel.style.display = "none";
            registerPanel.style.display = "block";

        }


        showLoginPanel();


        if (showRegisterButton) {

            showRegisterButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    showRegisterPanel();

                }
            );

        }


        if (backToLoginButton) {

            backToLoginButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    showLoginPanel();

                }
            );

        }


        async function enterAsGuest() {

            const message =
                document.querySelector(
                    "#loginMessage"
                );


            try {

                if (!auth) {

                    if (message) {
                        message.textContent =
                            "Firebase Auth chưa sẵn sàng.";
                    }

                    return;

                }


                if (guestButton) {

                    guestButton.disabled = true;
                    guestButton.textContent = "Đang vào...";

                }


                if (closeButton) {
                    closeButton.disabled = true;
                }


                localStorage.setItem(
                    GUEST_MODE_KEY,
                    "true"
                );


                if (
                    auth.currentUser &&
                    !auth.currentUser.isAnonymous
                ) {

                    currentUser =
                        auth.currentUser;

                } else if (
                    !auth.currentUser
                ) {

                    const credential =
                        await auth.signInAnonymously();

                    currentUser =
                        credential.user;

                } else {

                    currentUser =
                        auth.currentUser;

                }


                authReady = true;


                updateUserProfile(
                    currentUser
                );


                await setupLobbyPresence();

                closeAuthModal();


            } catch (error) {

                console.error(
                    "TienHuB Guest ERROR:",
                    error
                );


                if (message) {

                    message.textContent =
                        "Không thể vào khách: " +
                        (
                            error.message ||
                            "Lỗi không xác định."
                        );

                }

            } finally {

                if (guestButton) {

                    guestButton.disabled = false;
                    guestButton.textContent = "👤 Chơi khách";

                }


                if (closeButton) {
                    closeButton.disabled = false;
                }

            }

        }


        if (guestButton) {
            guestButton.addEventListener(
                "click",
                enterAsGuest
            );
        }


        if (closeButton) {
            closeButton.addEventListener(
                "click",
                enterAsGuest
            );
        }


        /* =================================================
           LOGIN
        ================================================= */

        if (loginButton) {

            loginButton.addEventListener(
                "click",
                async () => {

                    const username =
                        document
                            .querySelector("#loginUsername")
                            ?.value
                            .trim();

                    const password =
                        document
                            .querySelector("#loginPassword")
                            ?.value;

                    const message =
                        document.querySelector(
                            "#loginMessage"
                        );


                    if (!username || !password) {

                        if (message) {
                            message.textContent =
                                "Vui lòng nhập tên người dùng và mật khẩu.";
                        }

                        return;

                    }


                    try {

                        loginButton.disabled = true;
                        loginButton.textContent =
                            "Đang đăng nhập...";


                        const email =
                            usernameToEmail(username);


                        const credential =
                            await auth.signInWithEmailAndPassword(
                                email,
                                password
                            );


                        localStorage.removeItem(
                            GUEST_MODE_KEY
                        );


                        currentUser =
                            credential.user;

                        authReady = true;


                        updateUserProfile(
                            currentUser
                        );


                        await setupLobbyPresence();

                        closeAuthModal();


                    } catch (error) {

                        console.error(
                            "TienHuB Login ERROR:",
                            error
                        );


                        if (message) {

                            if (
                                error.code === "auth/invalid-credential" ||
                                error.code === "auth/user-not-found" ||
                                error.code === "auth/wrong-password"
                            ) {

                                message.textContent =
                                    "Tên người dùng hoặc mật khẩu không đúng.";

                            } else {

                                message.textContent =
                                    error.message ||
                                    "Đăng nhập thất bại.";

                            }

                        }

                    } finally {

                        loginButton.disabled = false;
                        loginButton.textContent =
                            "Đăng nhập";

                    }

                }
            );

        }


        /* =================================================
           REGISTER
        ================================================= */

        if (registerButton) {

            registerButton.addEventListener(
                "click",
                async () => {

                    const username =
                        document
                            .querySelector("#registerUsername")
                            ?.value
                            .trim();

                    const password =
                        document
                            .querySelector("#registerPassword")
                            ?.value;

                    const confirmPassword =
                        document
                            .querySelector("#registerPasswordConfirm")
                            ?.value;

                    const message =
                        document.querySelector(
                            "#registerMessage"
                        );


                    if (!isValidUsername(username)) {

                        if (message) {
                            message.textContent =
                                "Tên người dùng phải có 3–20 ký tự, chỉ gồm chữ, số và _.";
                        }

                        return;

                    }


                    if (!password || password.length < 6) {

                        if (message) {
                            message.textContent =
                                "Mật khẩu phải có ít nhất 6 ký tự.";
                        }

                        return;

                    }


                    if (password !== confirmPassword) {

                        if (message) {
                            message.textContent =
                                "Mật khẩu xác nhận không khớp.";
                        }

                        return;

                    }


                    try {

                        registerButton.disabled = true;
                        registerButton.textContent =
                            "Đang tạo tài khoản...";


                        const normalized =
                            normalizeUsername(username);

                        const email =
                            usernameToEmail(username);


                        const credential =
                            await auth.createUserWithEmailAndPassword(
                                email,
                                password
                            );


                        const user =
                            credential.user;


                        localStorage.removeItem(
                            GUEST_MODE_KEY
                        );


                        const usernameRef =
                            database.ref(
                                `usernames/${normalized}`
                            );


                        const transaction =
                            await usernameRef.transaction(
                                currentValue => {

                                    if (
                                        currentValue !== null
                                    ) {
                                        return;
                                    }

                                    return user.uid;

                                }
                            );


                        if (
                            !transaction.committed ||
                            transaction.snapshot.val() !== user.uid
                        ) {

                            await user.delete();

                            throw new Error(
                                "Tên người dùng này đã được sử dụng."
                            );

                        }


                        await database
                            .ref(`users/${user.uid}`)
                            .set({

                                username:
                                    username,

                                usernameNormalized:
                                    normalized,

                                displayName:
                                    username,

                                avatarUrl:
                                    "",

                                createdAt:
                                    firebase.database.ServerValue.TIMESTAMP

                            });


                        currentUser =
                            user;

                        authReady = true;


                        updateUserProfile(
                            currentUser
                        );


                        await setupLobbyPresence();

                        closeAuthModal();


                    } catch (error) {

                        console.error(
                            "TienHuB Register ERROR:",
                            error
                        );


                        if (message) {

                            if (
                                error.code ===
                                "auth/email-already-in-use"
                            ) {

                                message.textContent =
                                    "Tên người dùng này đã được sử dụng.";

                            } else {

                                message.textContent =
                                    error.message ||
                                    "Đăng ký thất bại.";

                            }

                        }

                    } finally {

                        registerButton.disabled = false;
                        registerButton.textContent =
                            "Đăng ký";

                    }

                }
            );

        }


        window.TienHuBAuthUI = {

            showLogin:
                showLoginPanel,

            showRegister:
                showRegisterPanel,

            open:
                openAuthModal,

            close:
                closeAuthModal

        };

    }


    /* =====================================================
       FIREBASE INIT
    ===================================================== */

    async function initFirebaseDatabase() {

        if (typeof firebase === "undefined") {

            console.error(
                "TienHuB: Firebase SDK chưa tải."
            );

            return false;

        }


        try {

            const APP_NAME =
                "TienHuB";


            const existingApp =
                firebase.apps.find(
                    app =>
                        app.name === APP_NAME
                );


            if (existingApp) {

                firebaseApp =
                    existingApp;

            } else {

                firebaseApp =
                    firebase.initializeApp(
                        FIREBASE_CONFIG,
                        APP_NAME
                    );

            }


            database =
                firebaseApp.database();

            auth =
                firebaseApp.auth();


            firebaseReady = true;


            await auth.setPersistence(
                firebase.auth.Auth.Persistence.LOCAL
            );


            console.log(
                "TienHuB Firebase: READY"
            );


            return true;

        } catch (error) {

            console.error(
                "TienHuB Firebase ERROR:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       AUTH STATE
    ===================================================== */

    function setupAuth() {

        if (!firebaseApp || !auth) {
            return false;
        }


        auth.onAuthStateChanged(
            async user => {

                currentUser =
                    user;


                if (!user) {

                    currentUser = null;
                    authReady = false;

                    updateUserProfile(null);

                    openAuthModal();

                    return;

                }


                if (user.isAnonymous) {

                    const guestMode =
                        localStorage.getItem(
                            GUEST_MODE_KEY
                        ) === "true";


                    if (!guestMode) {

                        currentUser = null;
                        authReady = false;

                        updateUserProfile(null);

                        openAuthModal();


                        try {
                            await auth.signOut();
                        } catch (error) {
                            console.warn(
                                "TienHuB: Không thể xóa Guest cũ:",
                                error
                            );
                        }

                        return;

                    }


                    authReady = true;

                    updateUserProfile(user);

                    closeAuthModal();

                    await setupLobbyPresence();

                    return;

                }


                localStorage.removeItem(
                    GUEST_MODE_KEY
                );

                authReady = true;

                closeAuthModal();

                updateUserProfile(user);

                await setupLobbyPresence();

            }
        );


        return true;

    }


    /* =====================================================
       LOBBY PRESENCE
    ===================================================== */

    async function updateLobbyPresence() {

        if (!lobbyPresenceRef || !currentUser) {
            return;
        }


        try {

            await lobbyPresenceRef.set({

                uid:
                    currentUser.uid,

                sessionId:
                    lobbySessionId,

                game:
                    "hub",

                online:
                    true,

                lastSeen:
                    firebase.database.ServerValue.TIMESTAMP

            });

        } catch (error) {

            console.warn(
                "TienHuB presence update lỗi:",
                error
            );

        }

    }


    async function setupLobbyPresence() {

        if (
            !firebaseReady ||
            !authReady ||
            !currentUser
        ) {
            return;
        }


        if (lobbyHeartbeat) {

            clearInterval(
                lobbyHeartbeat
            );

            lobbyHeartbeat = null;

        }


        const uid =
            currentUser.uid;


        lobbyPresenceRef =
            database.ref(
                `presence/${uid}/${lobbySessionId}`
            );


        try {

            await lobbyPresenceRef
                .onDisconnect()
                .remove();

        } catch (error) {

            console.warn(
                "TienHuB onDisconnect lỗi:",
                error
            );

        }


        if (!lobbyConnectedRef) {

            lobbyConnectedRef =
                database.ref(".info/connected");

        }


        if (!lobbyConnectedListener) {

            lobbyConnectedListener =
                lobbyConnectedRef.on(
                    "value",
                    async snapshot => {

                        if (
                            snapshot.val() !== true
                        ) {
                            return;
                        }


                        if (
                            !lobbyPresenceRef ||
                            !currentUser
                        ) {
                            return;
                        }


                        try {

                            await lobbyPresenceRef
                                .onDisconnect()
                                .remove();

                            await updateLobbyPresence();

                        } catch (error) {

                            console.warn(
                                "TienHuB reconnect lỗi:",
                                error
                            );

                        }

                    }
                );

        }


        lobbyHeartbeat =
            setInterval(
                updateLobbyPresence,
                20000
            );


        await updateLobbyPresence();

    }


    /* =====================================================
       ONLINE UI
    ===================================================== */

    function updateOnlineUI(users) {

        const uniqueUsers =
            new Set();


        users.forEach(
            user => {

                if (
                    user &&
                    user.uid
                ) {

                    uniqueUsers.add(
                        user.uid
                    );

                }

            }
        );


        const count =
            uniqueUsers.size;


        const onlineNumber =
            document.querySelector(
                "#onlineNumber"
            );

        const mobileOnlineNumber =
            document.querySelector(
                "#mobileOnlineNumber"
            );

        const analyticsOnline =
            document.querySelector(
                "#analyticsOnline"
            );


        if (onlineNumber) {
            onlineNumber.textContent =
                count;
        }


        if (mobileOnlineNumber) {
            mobileOnlineNumber.textContent =
                count;
        }


        if (analyticsOnline) {
            analyticsOnline.textContent =
                formatNumber(count);
        }

    }


    /* =====================================================
       GAME ONLINE COUNTS
    ===================================================== */

    const gameOnlineCounts = {};


    function updateGameOnlineUI(users) {

        Object.keys(
            gameOnlineCounts
        ).forEach(
            key => {
                delete gameOnlineCounts[key];
            }
        );


        users.forEach(
            user => {

                if (
                    !user ||
                    !user.uid ||
                    !user.game
                ) {
                    return;
                }


                if (user.game === "hub") {
                    return;
                }


                gameOnlineCounts[user.game] =
                    (
                        gameOnlineCounts[user.game] ||
                        0
                    ) + 1;

            }
        );


        document
            .querySelectorAll(
                ".game-card[data-game-id]"
            )
            .forEach(
                card => {

                    const gameId =
                        card.dataset.gameId;


                    const element =
                        card.querySelector(
                            `[data-game-online="${gameId}"]`
                        );


                    if (!element) {
                        return;
                    }


                    element.textContent =
                        gameOnlineCounts[gameId] ||
                        0;

                }
            );


        renderHotGames();

        sortAllGames();

    }


    /* =====================================================
       PRESENCE LISTENER
    ===================================================== */

    function setupPresenceListener() {

        if (!firebaseReady) {
            return;
        }


        const presenceRef =
            database.ref("presence");


        presenceRef.on(
            "value",
            snapshot => {

                const data =
                    snapshot.val() || {};

                const users = [];


                Object.keys(data).forEach(
                    uid => {

                        const sessions =
                            data[uid];


                        if (
                            !sessions ||
                            typeof sessions !== "object"
                        ) {
                            return;
                        }


                        /*
                         * Legacy:
                         * presence/uid = {...}
                         */

                        if (
                            sessions.game ||
                            sessions.online !== undefined
                        ) {

                            if (
                                sessions.online === true ||
                                sessions.game
                            ) {

                                users.push({

                                    uid,

                                    sessionId:
                                        "legacy",

                                    game:
                                        sessions.game ||
                                        "unknown",

                                    online:
                                        true

                                });

                            }


                            return;

                        }


                        /*
                         * Current:
                         * presence/uid/sessionId
                         */

                        Object.keys(
                            sessions
                        ).forEach(
                            sessionId => {

                                const session =
                                    sessions[sessionId];


                                if (
                                    !session ||
                                    typeof session !== "object"
                                ) {
                                    return;
                                }


                                if (
                                    session.online !== true
                                ) {
                                    return;
                                }


                                users.push({

                                    uid,

                                    sessionId,

                                    game:
                                        session.game ||
                                        "unknown",

                                    online:
                                        true

                                });

                            }
                        );

                    }
                );


                updateOnlineUI(users);

                updateGameOnlineUI(users);

            },
            error => {

                console.error(
                    "TienHuB presence error:",
                    error
                );

            }
        );

    }


    /* =====================================================
       DAILY PLAYERS
    ===================================================== */

    function setupDailyPlayersListener() {

        if (!firebaseReady) {
            return;
        }


        const date =
            getVietnamDate();


        database
            .ref(
                `analytics/daily/${date}/players`
            )
            .on(
                "value",
                snapshot => {

                    const data =
                        snapshot.val() || {};


                    const count =
                        Object.keys(data).length;


                    const element =
                        document.querySelector(
                            "#analyticsPlayersToday"
                        );


                    if (element) {

                        element.textContent =
                            formatNumber(count);

                    }

                }
            );

    }


    /* =====================================================
       GAME CONFIG
    ===================================================== */

    const PUBLIC_GAME_CONFIG = {

        caro5: {
            name: "Caro 5",
            icon: "✕"
        },

        flappy: {
            name: "Flappy Bird",
            icon: "🐦"
        },

        chess: {
            name: "Cờ vua",
            icon: "♞"
        },

        snake: {
            name: "Snake",
            icon: "🐍"
        },

        ludo: {
            name: "Cờ cá ngựa",
            icon: "🎲"
        },

        racing: {
            name: "Đua xe",
            icon: "🏎️"
        },

        stickman: {
            name: "Stickman",
            icon: "⚔️"
        }

    };


    const GAME_CONFIG = {

        caro5: {
            name: "Caro 5",
            url: "./games/caro5/index.html"
        },

        flappy: {
            name: "Flappy Bird",
            url: "./games/flappy/index.html"
        },

        chess: {
            name: "Cờ vua",
            url: "./games/chess/index.html"
        },

        snake: {
            name: "Snake",
            url: "#"
        },

        ludo: {
            name: "Cờ cá ngựa",
            url: "#"
        },

        racing: {
            name: "Đua xe",
            url: "./games/racing/index.html"
        },

        stickman: {
            name: "Stickman",
            url: "#"
        }

    };


    function getGameName(gameId) {

        return PUBLIC_GAME_CONFIG[gameId]
            ? PUBLIC_GAME_CONFIG[gameId].name
            : gameId || "Game";

    }


    function getGameIcon(gameId) {

        return PUBLIC_GAME_CONFIG[gameId]
            ? PUBLIC_GAME_CONFIG[gameId].icon
            : "🎮";

    }


    /* =====================================================
       ANALYTICS HELPERS
    ===================================================== */

    function getPlayGameId(play) {

        if (!play) {
            return "";
        }


        return (
            play.gameId ||
            play.game_id ||
            play.game ||
            play.gameID ||
            ""
        );

    }


    function renderAnalyticsGames(gameCounts) {

        const container =
            document.querySelector(
                "#analyticsGames"
            );


        if (!container) {
            return;
        }


        const entries =
            Object.entries(gameCounts);


        entries.sort(
            (a, b) =>
                b[1] - a[1]
        );


        if (!entries.length) {

            container.innerHTML = `
                <div class="analytics-loading">
                    Chưa có lượt chơi nào.
                </div>
            `;

            return;

        }


        container.innerHTML = "";


        entries.forEach(
            ([gameId, count]) => {

                const row =
                    document.createElement("div");


                row.className =
                    "analytics-game-row";


                row.innerHTML = `

                    <div class="analytics-game-icon">
                        ${getGameIcon(gameId)}
                    </div>

                    <div class="analytics-game-name">

                        <strong>
                            ${getGameName(gameId)}
                        </strong>

                        <span>
                            Lượt chơi đã ghi nhận
                        </span>

                    </div>

                    <strong class="analytics-game-count">
                        ${formatNumber(count)}
                    </strong>

                `;


                container.appendChild(row);

            }
        );

    }


    function renderAnalyticsChart(dailyResults) {

        const chart =
            document.querySelector(
                "#analyticsChart"
            );


        if (!chart) {
            return;
        }


        const max =
            Math.max(
                ...dailyResults.map(
                    item =>
                        item.plays
                ),
                1
            );


        chart.innerHTML = "";


        dailyResults.forEach(
            item => {

                const column =
                    document.createElement("div");


                column.className =
                    "analytics-bar-column";


                const value =
                    document.createElement("span");


                value.className =
                    "analytics-bar-value";

                value.textContent =
                    formatNumber(
                        item.plays
                    );


                const bar =
                    document.createElement("div");


                bar.className =
                    "analytics-bar";


                bar.style.height =
                    Math.max(
                        4,
                        Math.round(
                            (
                                item.plays /
                                max
                            ) * 150
                        )
                    ) + "px";


                const date =
                    document.createElement("span");


                date.className =
                    "analytics-bar-date";

                date.textContent =
                    formatShortDate(
                        item.date
                    );


                column.appendChild(value);
                column.appendChild(bar);
                column.appendChild(date);


                chart.appendChild(column);

            }
        );

    }


    /* =====================================================
       PUBLIC ANALYTICS
    ===================================================== */

    async function setupPublicAnalytics() {

        if (!firebaseReady) {
            return;
        }


        try {

            const snapshot =
                await database
                    .ref("analytics/daily")
                    .once("value");


            const dailyData =
                snapshot.val() || {};


            let totalPlays = 0;

            const gameCounts = {};


            Object.keys(dailyData).forEach(
                date => {

                    const day =
                        dailyData[date] || {};

                    const plays =
                        day.plays || {};


                    Object.values(plays).forEach(
                        play => {

                            totalPlays++;


                            const gameId =
                                getPlayGameId(play);


                            if (!gameId) {
                                return;
                            }


                            gameCounts[gameId] =
                                (
                                    gameCounts[gameId] ||
                                    0
                                ) + 1;

                        }
                    );

                }
            );


            const totalElement =
                document.querySelector(
                    "#analyticsTotalPlays"
                );


            if (totalElement) {

                totalElement.textContent =
                    formatNumber(
                        totalPlays
                    );

            }


            renderAnalyticsGames(
                gameCounts
            );


            const dates =
                getLastSevenDates();


            renderAnalyticsChart(
                dates.map(
                    date => {

                        const plays =
                            (
                                dailyData[date] || {}
                            ).plays || {};


                        return {

                            date,

                            plays:
                                Object.keys(
                                    plays
                                ).length

                        };

                    }
                )
            );

        } catch (error) {

            console.error(
                "TienHuB Analytics ERROR:",
                error
            );


            const chart =
                document.querySelector(
                    "#analyticsChart"
                );

            const games =
                document.querySelector(
                    "#analyticsGames"
                );


            if (chart) {

                chart.innerHTML = `
                    <div class="analytics-error">
                        Không thể tải dữ liệu thống kê.
                    </div>
                `;

            }


            if (games) {

                games.innerHTML = `
                    <div class="analytics-error">
                        Không thể tải dữ liệu Firebase.
                    </div>
                `;

            }

        }

    }


    /* =====================================================
       GAME STATS
    ===================================================== */

    function setupGameStats() {

        if (!firebaseReady) {
            return;
        }


        database
            .ref("gameStats")
            .on(
                "value",
                snapshot => {

                    const data =
                        snapshot.val() || {};


                    Object.keys(data).forEach(
                        gameId => {

                            document
                                .querySelectorAll(
                                    `.game-card[data-game-id="${gameId}"]`
                                )
                                .forEach(
                                    card => {

                                        const value =
                                            data[gameId];


                                        if (
                                            typeof value === "object" &&
                                            value.playCount !== undefined
                                        ) {

                                            card.dataset.playCount =
                                                value.playCount;

                                        }

                                    }
                                );

                        }
                    );


                    updatePopularBadge();

                }
            );

    }


    /* =====================================================
       FIREBASE START
    ===================================================== */

    async function setupFirebaseStats() {

        const success =
            await initFirebaseDatabase();


        if (!success) {
            return;
        }


        setupPublicAnalytics();

        setupDailyPlayersListener();

        setupAuth();

        setupPresenceListener();

        setupGameStats();

    }


    /* =====================================================
       GAME LIBRARY
    ===================================================== */

    let currentLibraryFilter =
        "all";

    let currentSearch =
        "";

    let currentSort =
        "online";


    function getAllGameCards() {

        const grid =
            document.querySelector(
                "#allGamesGrid"
            );


        if (!grid) {
            return [];
        }


        return [
            ...grid.querySelectorAll(
                ".game-card[data-game-id]"
            )
        ];

    }


    function getHotGameCards() {

        const grid =
            document.querySelector(
                "#hotGamesGrid"
            );


        if (!grid) {
            return [];
        }


        return [
            ...grid.querySelectorAll(
                ".game-card[data-game-id]"
            )
        ];

    }


    function getNewGameCards() {

        const grid =
            document.querySelector(
                "#newGamesGrid"
            );


        if (!grid) {
            return [];
        }


        return [
            ...grid.querySelectorAll(
                ".game-card[data-game-id]"
            )
        ];

    }


    function getCardOnlineCount(card) {

        const gameId =
            card.dataset.gameId;


        if (!gameId) {
            return 0;
        }


        /*
         * Ưu tiên dữ liệu Firebase trực tiếp.
         * Nếu chưa có element thì lấy cache.
         */

        const element =
            card.querySelector(
                `[data-game-online="${gameId}"]`
            );


        if (element) {

            return Number(
                element.textContent || 0
            );

        }


        return (
            gameOnlineCounts[gameId] ||
            0
        );

    }


    function cardMatchesSearch(card) {

        if (!currentSearch) {
            return true;
        }


        const text =
            [
                card.querySelector("h3")?.textContent || "",
                card.querySelector("p")?.textContent || "",
                card.dataset.category || ""
            ]
                .join(" ")
                .toLowerCase();


        return text.includes(
            currentSearch
        );

    }


    function cardMatchesFilter(card) {

        const filter =
            currentLibraryFilter;


        const status =
            card.dataset.game || "";


        const categories =
            String(
                card.dataset.category || ""
            )
                .toLowerCase()
                .split(/\s+/)
                .filter(Boolean);


        if (filter === "all") {
            return true;
        }


        if (filter === "soon") {
            return status === "soon";
        }


        return categories.includes(
            filter
        );

    }


    function sortCards(cards) {

        return cards.sort(
            (a, b) => {

                if (
                    currentSort ===
                    "az"
                ) {

                    const nameA =
                        a.querySelector("h3")
                            ?.textContent
                            .trim()
                            .toLowerCase() || "";

                    const nameB =
                        b.querySelector("h3")
                            ?.textContent
                            .trim()
                            .toLowerCase() || "";


                    return nameA.localeCompare(
                        nameB,
                        "vi"
                    );

                }


                if (
                    currentSort ===
                    "newest"
                ) {

                    const newA =
                        a.dataset.new ===
                        "true"
                            ? 1
                            : 0;

                    const newB =
                        b.dataset.new ===
                        "true"
                            ? 1
                            : 0;


                    if (
                        newA !== newB
                    ) {

                        return newB - newA;

                    }


                    return (
                        Number(
                            b.dataset.playCount ||
                            0
                        ) -
                        Number(
                            a.dataset.playCount ||
                            0
                        )
                    );

                }


                /*
                 * online
                 */

                return (
                    getCardOnlineCount(b) -
                    getCardOnlineCount(a)
                );

            }
        );

    }


    function sortAllGames() {

        const grid =
            document.querySelector(
                "#allGamesGrid"
            );


        if (!grid) {
            return;
        }


        const cards =
            getAllGameCards();


        sortCards(cards)
            .forEach(
                card => {

                    grid.appendChild(
                        card
                    );

                }
            );

    }


    function applyLibraryFilter() {

        const cards =
            getAllGameCards();


        const emptyState =
            document.querySelector(
                "#emptyGameState"
            );


        let visibleCount = 0;


        cards.forEach(
            card => {

                const matchesFilter =
                    cardMatchesFilter(
                        card
                    );

                const matchesSearch =
                    cardMatchesSearch(
                        card
                    );


                const show =
                    matchesFilter &&
                    matchesSearch;


                card.style.display =
                    show
                        ? ""
                        : "none";


                if (show) {
                    visibleCount++;
                }

            }
        );


        if (emptyState) {

            emptyState.style.display =
                visibleCount === 0
                    ? "block"
                    : "none";

        }


        sortAllGames();

    }


    function setupLibraryFilters() {

        const buttons =
            document.querySelectorAll(
                "#libraryFilters .library-filter"
            );


        buttons.forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        currentLibraryFilter =
                            button.dataset.filter ||
                            "all";


                        buttons.forEach(
                            item => {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );


                        button.classList.add(
                            "active"
                        );


                        applyLibraryFilter();

                    }
                );

            }
        );

    }


    function setupLibrarySearch() {

        const input =
            document.querySelector(
                "#gameSearch"
            );


        if (!input) {
            return;
        }


        input.addEventListener(
            "input",
            () => {

                currentSearch =
                    input.value
                        .trim()
                        .toLowerCase();


                applyLibraryFilter();

            }
        );

    }


    function setupLibrarySort() {

        const select =
            document.querySelector(
                "#gameSort"
            );


        if (!select) {
            return;
        }


        currentSort =
            select.value ||
            "online";


        select.addEventListener(
            "change",
            () => {

                currentSort =
                    select.value ||
                    "online";


                sortAllGames();

            }
        );

    }


    /* =====================================================
       HOT GAMES
    ===================================================== */

    function renderHotGames() {

        const grid =
            document.querySelector(
                "#hotGamesGrid"
            );


        if (!grid) {
            return;
        }


        const allCards =
            getAllGameCards();


        const availableCards =
            allCards.filter(
                card =>
                    card.dataset.game ===
                    "available"
            );


        availableCards.sort(
            (a, b) =>
                getCardOnlineCount(b) -
                getCardOnlineCount(a)
        );


        /*
         * Chỉ lấy những game đang có người chơi.
         */

        const hotCards =
            availableCards.filter(
                card =>
                    getCardOnlineCount(card) > 0
            );


        grid.innerHTML = "";


        if (!hotCards.length) {

            grid.innerHTML = `

                <div class="empty-game-state">

                    Hiện chưa có game nào đang có người chơi.

                </div>

            `;

            return;

        }


        hotCards
            .slice(0, 6)
            .forEach(
                originalCard => {

                    /*
                     * Clone để game không bị
                     * di chuyển khỏi Tất cả game.
                     */

                    const clone =
                        originalCard.cloneNode(
                            true
                        );


                    clone.dataset.hotClone =
                        "true";


                    clone.style.display =
                        "";


                    grid.appendChild(
                        clone
                    );

                }
            );

    }


    /* =====================================================
       NEW GAMES
    ===================================================== */

    function setupNewGames() {

        const grid =
            document.querySelector(
                "#newGamesGrid"
            );


        if (!grid) {
            return;
        }


        /*
         * Khu vực này là khu vực riêng.
         * Không áp dụng filter của Tất cả game
         * vào đây.
         */

        const cards =
            getNewGameCards();


        cards.forEach(
            card => {

                card.style.display =
                    "";

            }
        );

    }
    


    /* =====================================================
       LOCAL PLAY COUNT
    ===================================================== */

    // Giữ key ổn định qua lần đổi tên GameHub -> TienHuB.
    // Các key cũ được đọc/migrate để không mất lượt chơi trên máy người dùng.
    const PLAY_COUNT_PREFIX =
        "GameHub_play_count_";

    const LEGACY_PLAY_COUNT_PREFIXES = [
        "TienHuB_play_count_",
        "TienHub_play_count_",
        "GameHub_play_count_"
    ];


    function getGameId(card) {

        return (
            card.dataset.gameId ||
            card.dataset.id ||
            ""
        );

    }


    function getPlayCount(gameId) {

        const currentKey =
            PLAY_COUNT_PREFIX + gameId;

        const currentValue =
            Number(localStorage.getItem(currentKey) || 0);

        let bestValue = currentValue;

        // Đọc các key từ những phiên bản trước khi đổi tên.
        for (const prefix of LEGACY_PLAY_COUNT_PREFIXES) {
            const value = Number(
                localStorage.getItem(prefix + gameId) || 0
            );

            if (value > bestValue) {
                bestValue = value;
            }
        }

        // Chuẩn hóa về key hiện tại để các lần sau tiếp tục tăng đúng.
        if (bestValue !== currentValue) {
            localStorage.setItem(
                currentKey,
                String(bestValue)
            );
        }

        return bestValue;

    }


    function increasePlayCount(gameId) {

        const next =
            getPlayCount(gameId) + 1;


        localStorage.setItem(
            PLAY_COUNT_PREFIX +
            gameId,
            String(next)
        );


        return next;

    }


    function loadPlayCounts() {

        document
            .querySelectorAll(
                ".game-card[data-game-id]"
            )
            .forEach(
                card => {

                    const gameId =
                        getGameId(card);


                    if (!gameId) {
                        return;
                    }


                    card.dataset.playCount =
                        String(
                            getPlayCount(gameId)
                        );

                }
            );

    }


    /* =====================================================
       FIREBASE PLAY RECORD
    ===================================================== */

    async function recordFirebasePlay(gameId) {

        if (
            !firebaseReady ||
            !database ||
            !gameId
        ) {
            return false;
        }

        try {

            const date =
                getVietnamDate();

            const user =
                currentUser ||
                auth?.currentUser ||
                null;

            const playRef =
                database
                    .ref(
                        `analytics/daily/${date}/plays`
                    )
                    .push();

            await playRef.set({

                gameId,

                uid:
                    user?.uid ||
                    "unknown",

                anonymous:
                    user?.isAnonymous === true,

                playedAt:
                    firebase.database.ServerValue.TIMESTAMP,

                source:
                    "tienhub"

            });

            await database
                .ref(
                    `gameStats/${gameId}/playCount`
                )
                .transaction(
                    value =>
                        Number(value || 0) + 1
                );

            return true;

        } catch (error) {

            console.warn(
                "TienHuB Firebase play record lỗi:",
                error
            );

            return false;

        }

    }


    /* =====================================================
       GAME CLICK
    ===================================================== */

    document.addEventListener(
        "click",
        async event => {

            const link =
                event.target.closest("a");

            if (!link) {
                return;
            }

            const card =
                link.closest(
                    ".game-card"
                );

            if (!card) {
                return;
            }

            const gameId =
                getGameId(card);

            if (!gameId) {
                return;
            }

            const href =
                link.getAttribute("href");

            if (
                !href ||
                href === "#"
            ) {
                return;
            }

            /*
             * Đây là lượt chơi được tính khi người dùng
             * thực sự bấm link CHƠI GAME ở TienHuB.
             */
            event.preventDefault();

            increasePlayCount(
                gameId
            );

            card.dataset.playCount =
                String(
                    getPlayCount(gameId)
                );

            document
                .querySelectorAll(
                    `.game-card[data-game-id="${gameId}"]`
                )
                .forEach(
                    item => {

                        item.dataset.playCount =
                            card.dataset.playCount;

                    }
                );

            /*
             * Chờ Firebase ghi xong rồi mới rời Hub,
             * tránh mất event do chuyển trang quá nhanh.
             */
            await recordFirebasePlay(
                gameId
            );

            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.button === 1 ||
                link.target === "_blank"
            ) {

                window.open(
                    link.href,
                    link.target || "_blank"
                );

            } else {

                window.location.href =
                    link.href;

            }

        }
    );


    /* =====================================================
       GAME IMAGES
    ===================================================== */

    const GAME_IMAGES = {

        caro5:
            "./assets/games/caro5.jpg",

        flappy:
            "./assets/games/flappy.jpg",

        chess:
            "./assets/games/chess.jpg",

        snake:
            "./assets/games/snake.jpg",

        ludo:
            "./assets/games/ludo.jpg",

        racing:
            "./assets/games/racing.jpg",

        stickman:
            "./assets/games/stickman.jpg"

    };


    function loadGameImages() {

        Object.keys(
            GAME_IMAGES
        ).forEach(
            gameId => {

                document
                    .querySelectorAll(
                        `.game-card[data-game-id="${gameId}"]`
                    )
                    .forEach(
                        card => {

                            const wrapper =
                                card.querySelector(
                                    ".game-thumbnail-wrap"
                                );


                            if (!wrapper) {
                                return;
                            }


                            if (
                                wrapper.querySelector(
                                    ".game-thumbnail"
                                )
                            ) {

                                return;

                            }


                            const img =
                                document.createElement(
                                    "img"
                                );


                            img.className =
                                "game-thumbnail";


                            img.src =
                                GAME_IMAGES[
                                    gameId
                                ];


                            img.alt =
                                GAME_CONFIG[
                                    gameId
                                ]
                                    ? GAME_CONFIG[
                                        gameId
                                    ].name
                                    : gameId;


                            img.addEventListener(
                                "error",
                                () => {

                                    img.remove();

                                }
                            );


                            wrapper.insertBefore(
                                img,
                                wrapper.firstChild
                            );

                        }
                    );

            }
        );

    }


    /* =====================================================
       GOOGLE ANALYTICS
    ===================================================== */

    function trackHubEvent(
        eventName,
        data = {}
    ) {

        try {

            if (
                typeof window.gtag ===
                "function"
            ) {

                window.gtag(
                    "event",
                    eventName,
                    data
                );

            }

        } catch (error) {

            console.warn(
                "Analytics error:",
                error
            );

        }

    }


    document.addEventListener(
        "click",
        event => {

            const card =
                event.target.closest(
                    ".game-card"
                );


            if (!card) {
                return;
            }


            const gameId =
                getGameId(card);


            if (!gameId) {
                return;
            }


            trackHubEvent(
                "game_click",
                {
                    game_id:
                        gameId
                }
            );

        }
    );


    /* =====================================================
       TOUCH
    ===================================================== */

    document.addEventListener(
        "pointerdown",
        event => {

            const target =
                event.target.closest(
                    "a, button"
                );


            if (!target) {
                return;
            }


            target.classList.add(
                "pressed"
            );


            setTimeout(
                () => {

                    target.classList.remove(
                        "pressed"
                    );

                },
                120
            );

        }
    );


    let lastTouchEnd = 0;


    document.addEventListener(
        "touchend",
        event => {

            const now =
                Date.now();


            if (
                now -
                lastTouchEnd <=
                300
            ) {

                event.preventDefault();

            }


            lastTouchEnd =
                now;

        },
        {
            passive: false
        }
    );


    /* =====================================================
       MOBILE MENU
    ===================================================== */

    function setupMobileMenu() {

        const menuButton =
            document.querySelector(
                ".mobile-menu-button"
            );

        const drawer =
            document.querySelector(
                "#mobileDrawer"
            );

        const overlay =
            document.querySelector(
                ".mobile-menu-overlay"
            );


        if (!menuButton || !drawer) {
            return;
        }


        function openMenu() {

            drawer.classList.add(
                "open"
            );

            if (overlay) {
                overlay.classList.add(
                    "open"
                );
            }


            drawer.setAttribute(
                "aria-hidden",
                "false"
            );


            menuButton.setAttribute(
                "aria-expanded",
                "true"
            );

        }


        function closeMenu() {

            drawer.classList.remove(
                "open"
            );

            if (overlay) {
                overlay.classList.remove(
                    "open"
                );
            }


            drawer.setAttribute(
                "aria-hidden",
                "true"
            );


            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }


        menuButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                if (
                    drawer.classList.contains(
                        "open"
                    )
                ) {

                    closeMenu();

                } else {

                    openMenu();

                }

            }
        );


        document
            .querySelectorAll(
                "[data-mobile-menu-close]"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        closeMenu
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-mobile-nav]"
            )
            .forEach(
                link => {

                    link.addEventListener(
                        "click",
                        closeMenu
                    );

                }
            );


        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Escape"
                ) {

                    closeMenu();

                }

            }
        );

    }


    /* =====================================================
       MUSIC
    ===================================================== */

    const HUB_MUSIC_KEY =
        "TienHuB_music_enabled";


    const HUB_MUSIC_PATH =
        "./assets/sounds/hub-bgm.mp3";


    let hubMusic = null;


    let musicEnabled =
        localStorage.getItem(
            HUB_MUSIC_KEY
        ) !== "false";


    function speakerOnSVG() {

        return `
            <svg
                class="hub-sound-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >

                <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                ></polygon>

                <path
                    d="M15.5 8.5a5 5 0 0 1 0 7"
                ></path>

                <path
                    d="M18.5 5.5a9 9 0 0 1 0 13"
                ></path>

            </svg>
        `;

    }


    function speakerOffSVG() {

        return `
            <svg
                class="hub-sound-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
            >

                <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                ></polygon>

                <line
                    x1="23"
                    y1="9"
                    x2="17"
                    y2="15"
                ></line>

                <line
                    x1="17"
                    y1="9"
                    x2="23"
                    y2="15"
                ></line>

            </svg>
        `;

    }


    function createSoundButtonIfNeeded() {

        let button =
            document.querySelector(
                "[data-hub-sound-toggle]"
            );


        if (button) {
            return button;
        }


        const actions =
            document.querySelector(
                ".topbar-actions"
            );


        if (!actions) {
            return null;
        }


        button =
            document.createElement(
                "button"
            );


        button.type =
            "button";

        button.className =
            "hub-sound-toggle";

        button.setAttribute(
            "data-hub-sound-toggle",
            ""
        );

        button.setAttribute(
            "aria-label",
            "Bật hoặc tắt nhạc"
        );

        button.title =
            "Bật / tắt nhạc";


        actions.appendChild(
            button
        );


        return button;

    }


    function setupHubMusic() {

        const soundButton =
            createSoundButtonIfNeeded();


        if (!soundButton) {
            return;
        }


        hubMusic =
            new Audio(
                HUB_MUSIC_PATH
            );


        hubMusic.loop =
            true;

        hubMusic.volume =
            0.25;


        function updateSoundButton() {

            if (musicEnabled) {

                soundButton.innerHTML =
                    speakerOnSVG();

                soundButton.classList.add(
                    "sound-on"
                );

                soundButton.classList.remove(
                    "sound-off"
                );

                soundButton.setAttribute(
                    "aria-label",
                    "Tắt nhạc"
                );

                soundButton.title =
                    "Tắt nhạc";

            } else {

                soundButton.innerHTML =
                    speakerOffSVG();

                soundButton.classList.add(
                    "sound-off"
                );

                soundButton.classList.remove(
                    "sound-on"
                );

                soundButton.setAttribute(
                    "aria-label",
                    "Bật nhạc"
                );

                soundButton.title =
                    "Bật nhạc";

            }

        }


        async function playMusic() {

            if (
                !musicEnabled ||
                !hubMusic
            ) {
                return;
            }


            try {

                await hubMusic.play();

            } catch (error) {

                // Safari/iPhone chặn autoplay.

            }

        }


        soundButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();
                event.stopPropagation();


                musicEnabled =
                    !musicEnabled;


                localStorage.setItem(
                    HUB_MUSIC_KEY,
                    String(musicEnabled)
                );


                updateSoundButton();


                if (musicEnabled) {

                    await playMusic();

                } else {

                    hubMusic.pause();

                }

            }
        );


        const startAfterInteraction =
            async () => {

                if (musicEnabled) {
                    await playMusic();
                }

            };


        [
            "pointerdown",
            "touchstart",
            "keydown"
        ].forEach(
            eventName => {

                document.addEventListener(
                    eventName,
                    startAfterInteraction,
                    {
                        once: true,
                        passive: true
                    }
                );

            }
        );


        document.addEventListener(
            "visibilitychange",
            () => {

                if (
                    document.visibilityState ===
                    "hidden"
                ) {

                    if (hubMusic) {
                        hubMusic.pause();
                    }

                } else {

                    playMusic();

                }

            }
        );


        window.addEventListener(
            "pagehide",
            () => {

                if (hubMusic) {
                    hubMusic.pause();
                }

            }
        );


        updateSoundButton();

        playMusic();

    }


    /* =====================================================
       INIT
    ===================================================== */

    function initTienHuB() {

        setupAuthUI();

        setupUserProfile();

        setupLibraryFilters();

        setupLibrarySearch();

        setupLibrarySort();

        setupNewGames();

        setupMobileMenu();

        loadPlayCounts();

        updatePopularBadge();

        loadGameImages();

        renderHotGames();

        applyLibraryFilter();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initTienHuB
        );

    } else {

        initTienHuB();

    }


    /* =====================================================
       MUSIC INIT
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            setupHubMusic
        );

    } else {

        setupHubMusic();

    }


    /* =====================================================
       FIREBASE START
    ===================================================== */

    setupFirebaseStats();


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.TienHuB = {

        openAuth:
            openAuthModal,

        closeAuth:
            closeAuthModal,

        getCurrentUser:
            () => currentUser,

        getFirebaseDatabase:
            () => database,

        getGameOnlineCount:
            gameId =>
                gameOnlineCounts[gameId] || 0,

        recordPlay:
            recordFirebasePlay

    };


})();
