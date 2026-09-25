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
