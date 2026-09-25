/* =========================================================
   TIENHUB — PROFILE
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const profileWrap =
        document.querySelector(".profile-wrap");

    const profileButton =
        document.querySelector(".profile");

    const profileName =
        document.querySelector(".profile-name");

    const profileAvatar =
        document.querySelector(".profile-avatar");

    const menuUsername =
        document.querySelector(".profile-menu-username");

    const logoutButton =
        document.querySelector(".profile-logout");


    /* Không có Profile thì dừng */
    if (!profileWrap || !profileButton) {
        return;
    }


    /* =====================================================
       USERNAME
    ====================================================== */

    const savedUsername =
        localStorage.getItem("tienhub_username");

    const username =
        savedUsername && savedUsername.trim()
            ? savedUsername.trim()
            : "Khách";


    /* Lấy chữ cái đầu */

    const firstLetter =
        username.charAt(0).toUpperCase() || "T";


    /* Hiển thị username */

    if (profileName) {
        profileName.textContent = username;
    }


    /* Hiển thị avatar */

    if (profileAvatar) {
        profileAvatar.textContent = firstLetter;
    }


    /* Username trong menu */

    if (menuUsername) {
        menuUsername.textContent = username;
    }


    /* =====================================================
       OPEN / CLOSE
    ====================================================== */

    function openProfile() {

        profileWrap.classList.add("open");

        profileButton.setAttribute(
            "aria-expanded",
            "true"
        );
    }


    function closeProfile() {

        profileWrap.classList.remove("open");

        profileButton.setAttribute(
            "aria-expanded",
            "false"
        );
    }


    function toggleProfile() {

        const isOpen =
            profileWrap.classList.contains("open");


        if (isOpen) {
            closeProfile();
        } else {
            openProfile();
        }
    }


    /* =====================================================
       CLICK PROFILE
    ====================================================== */

    profileButton.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            toggleProfile();
        }
    );


    /* =====================================================
       CLICK TRONG MENU
    ====================================================== */

    const profileMenu =
        profileWrap.querySelector(".profile-menu");


    if (profileMenu) {

        profileMenu.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();
            }
        );
    }


    /* =====================================================
       CLICK RA NGOÀI
    ====================================================== */

    document.addEventListener(
        "click",
        (event) => {

            if (!profileWrap.contains(event.target)) {
                closeProfile();
            }
        }
    );


    /* =====================================================
       ESC
    ====================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {
                closeProfile();
            }
        }
    );


    /* =====================================================
       LOGOUT
    ====================================================== */

    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            async () => {

                /*
                 * Khóa nút để tránh click nhiều lần
                 */
                logoutButton.disabled = true;

                try {

                    /*
                     * Dùng Firebase Auth mới của TienHub
                     */
                    const { auth } =
                        await import("../src/core/firebase.js");

                    /*
                     * Đăng xuất Firebase
                     */
                    await auth.signOut();

                } catch (error) {

                    console.error(
                        "TienHub logout error:",
                        error
                    );

                } finally {

                    /*
                     * Xóa trạng thái local
                     */
                    localStorage.removeItem(
                        "tienhub_username"
                    );

                    localStorage.removeItem(
                        "tienhub_logged_in"
                    );

                    /*
                     * Đóng menu
                     */
                    closeProfile();

                    /*
                     * Về màn hình đăng nhập
                     */
                    window.location.replace(
                        "pages/auth.html"
                    );
                }
            }
        );
    }

});