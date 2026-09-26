const displayNameInput = document.getElementById("displayName");

const usernameInput = document.getElementById("username");

const headerName = document.getElementById("headerName");

const headerAvatar = document.getElementById("headerAvatar");

const largeAvatar = document.getElementById("largeAvatar");

const previewAvatar = document.getElementById("previewAvatar");

const previewName = document.getElementById("previewName");

const avatarGrid = document.getElementById("avatarGrid");

const toast = document.getElementById("toast");

const avatarUpload = document.getElementById("avatarUpload");

const avatarUploadBtn = document.getElementById("avatarUploadBtn");



let currentUser = null;

let selectedAvatar = "T";

let selectedPhotoURL = "";

let original = { displayName: "", avatar: selectedAvatar, photoURL: "" };



function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);

}



function setAvatarElement(element, photoURL, fallback) {

    if (!element) return;

    if (photoURL) {

        element.style.backgroundImage = `url("${photoURL}")`;

        element.classList.add("has-image");

        element.textContent = "";

    } else {

        element.style.backgroundImage = "";

        element.classList.remove("has-image");

        element.textContent = fallback;

    }

}



function updatePreview() {

    const name = displayNameInput.value.trim() || "Người chơi";

    const fallback = selectedAvatar || name.charAt(0).toUpperCase() || "T";

    setAvatarElement(largeAvatar, selectedPhotoURL, fallback);

    setAvatarElement(previewAvatar, selectedPhotoURL, fallback);

    previewName.textContent = name;

    headerName.textContent = name;

    setAvatarElement(headerAvatar, selectedPhotoURL, fallback);

}



function getUsername(user) {

    const email = user?.email || "";

    const technicalSuffix = "@auth.tienhub.vn";

    if (email.endsWith(technicalSuffix)) {

        return email.slice(0, -technicalSuffix.length);

    }

    return localStorage.getItem("tienhub_login_username") || email.split("@")[0] || "Người chơi";

}


function getAvatarStorageKey(user) {
    return user?.uid ? `tienhub_avatar_${user.uid}` : "tienhub_avatar";
}

function getAvatarUrlStorageKey(user) {
    return user?.uid ? `tienhub_avatar_url_${user.uid}` : "tienhub_avatar_url";
}


async function initProfile() {

    try {

        const core = await import("../src/core/firebase.js");

        const auth = core.auth;



        if (typeof auth.authStateReady === "function") {

            await auth.authStateReady();

        }



        currentUser = auth.currentUser;



        if (!currentUser || currentUser.isAnonymous) {

            window.location.replace("/pages/auth.html");

            return;

        }



        const username = getUsername(currentUser);

        const displayName = (currentUser.displayName || localStorage.getItem("tienhub_username") || username).trim();



        usernameInput.value = username;

        displayNameInput.value = displayName;

        headerName.textContent = displayName;

        selectedAvatar = localStorage.getItem(getAvatarStorageKey(currentUser)) || displayName.charAt(0).toUpperCase() || "T";

        selectedPhotoURL = currentUser.photoURL || localStorage.getItem(getAvatarUrlStorageKey(currentUser)) || "";

        // Shared profile source for hub and games.
        try {
            const { ref, get } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );

            const profileSnapshot = await get(
                ref(core.db, `users/${currentUser.uid}`)
            );

            const profileData = profileSnapshot.val() || {};

            if (typeof profileData.displayName === "string" && profileData.displayName.trim()) {
                displayNameInput.value = profileData.displayName.trim();
                headerName.textContent = profileData.displayName.trim();
            }

            if (typeof profileData.avatarUrl === "string" && profileData.avatarUrl) {
                selectedPhotoURL = profileData.avatarUrl;
            }
        } catch (profileReadError) {
            console.warn("TienHub profile database read skipped:", profileReadError);
        }



        const avatarOption = [...document.querySelectorAll(".avatar-option")]

            .find(el => el.dataset.letter === selectedAvatar);

        if (avatarOption) {

            document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));

            avatarOption.classList.add("selected");

        } else {

            selectedAvatar = "T";

        }



        original = { displayName, avatar: selectedAvatar, photoURL: selectedPhotoURL };

        updatePreview();

    } catch (error) {

        console.error("TienHub profile init error:", error);

        showToast("Không thể tải thông tin hồ sơ.");

    }

}



avatarGrid.addEventListener("click", event => {

    const option = event.target.closest(".avatar-option");

    if (!option) return;



    document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));

    option.classList.add("selected");

    selectedAvatar = option.dataset.letter;

    updatePreview();

});



displayNameInput.addEventListener("input", updatePreview);



avatarUploadBtn?.addEventListener("click", () => avatarUpload?.click());



avatarUpload?.addEventListener("change", event => {

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) { showToast("Vui lòng chọn một file ảnh."); return; }

    if (file.size > 5 * 1024 * 1024) { showToast("Ảnh tối đa 5MB."); avatarUpload.value = ""; return; }

    const reader = new FileReader();

    reader.onload = () => {

        const img = new Image();

        img.onload = () => {

            const size = 256, canvas = document.createElement("canvas");

            canvas.width = size; canvas.height = size;

            const ctx = canvas.getContext("2d");

            const scale = Math.max(size / img.width, size / img.height);

            const w = img.width * scale, h = img.height * scale;

            ctx.drawImage(img, (size-w)/2, (size-h)/2, w, h);

            selectedPhotoURL = canvas.toDataURL("image/webp", 0.78);

            selectedAvatar = "";

            document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));

            updatePreview();

            showToast("Đã chọn ảnh avatar. Nhấn Lưu thay đổi để lưu.");

        };

        img.src = reader.result;

    };

    reader.readAsDataURL(file);

});



document.getElementById("focusAvatar").addEventListener("click", () => {

    avatarGrid.scrollIntoView({ behavior: "smooth", block: "center" });

});



function getDisplayNameKey(name) {
    // Keep case sensitivity: "acedia" and "Acedia" are different names.
    // Encode characters that are not safe in Realtime Database keys.
    return encodeURIComponent(name).replace(/\./g, "%2E");
}



document.getElementById("saveBtn").addEventListener("click", async () => {

    const name = displayNameInput.value.trim();

    if (!name) {
        displayNameInput.focus();
        showToast("Vui lòng nhập tên hiển thị.");
        return;
    }

    if (!currentUser) {
        showToast("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.");
        return;
    }

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;

    try {
        const core = await import("../src/core/firebase.js");
        const { updateProfile } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"
        );
        const { ref, get, set, remove, update } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
        );

        // Check the exact displayName in the reservation table.
        // Case-sensitive by design: "acedia" !== "Acedia".
        const nameKey = getDisplayNameKey(name);
        const reservationRef = ref(core.db, `displayNames/${nameKey}`);
        const reservationSnapshot = await get(reservationRef);
        const reservation = reservationSnapshot.val();

        if (reservation && reservation.uid !== currentUser.uid) {
            showToast("Tên này đã tồn tại.");
            return;
        }

        // Reserve the new name first. The Rules only allow the owner of an
        // existing reservation to keep it, so two users cannot claim it.
        await set(reservationRef, {
            uid: currentUser.uid,
            displayName: name
        });

        const oldName = String(original.displayName || "").trim();
        const oldKey = oldName ? getDisplayNameKey(oldName) : "";

        // Release the old name when the user changes it.
        if (oldKey && oldKey !== nameKey) {
            const oldRef = ref(core.db, `displayNames/${oldKey}`);
            const oldSnapshot = await get(oldRef);
            if (oldSnapshot.val()?.uid === currentUser.uid) {
                await remove(oldRef);
            }
        }

        // Keep Auth, the user's private profile record, and the public profile
        // used by games in sync. Username/login is never changed here.
        await updateProfile(currentUser, { displayName: name });

        await update(ref(core.db, `users/${currentUser.uid}`), {
            displayName: name
        });

        await update(ref(core.db, `publicProfiles/${currentUser.uid}`), {
            displayName: name,
            avatarUrl: selectedPhotoURL || ""
        });

        localStorage.setItem("tienhub_username", name);
        localStorage.setItem(
            getAvatarStorageKey(currentUser),
            selectedAvatar || name.charAt(0).toUpperCase() || "T"
        );

        if (selectedPhotoURL) {
            localStorage.setItem(getAvatarUrlStorageKey(currentUser), selectedPhotoURL);
        } else {
            localStorage.removeItem(getAvatarUrlStorageKey(currentUser));
        }

        original = {
            displayName: name,
            avatar: selectedAvatar,
            photoURL: selectedPhotoURL
        };

        updatePreview();
        showToast("Đã lưu thay đổi.");

    } catch (error) {
        console.error("TienHub profile save error:", error);
        const code = error?.code || "";
        console.error("TienHub profile save error code:", code);

        if (code === "PERMISSION_DENIED" || code === "database/permission-denied") {
            showToast("Không có quyền lưu. Hãy kiểm tra Firebase Rules.");
        } else if (code === "auth/requires-recent-login") {
            showToast("Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại rồi thử lại.");
        } else {
            showToast("Không thể lưu thay đổi. Vui lòng thử lại.");
        }
    } finally {
        saveBtn.disabled = false;
    }
});


document.getElementById("cancelBtn").addEventListener("click", () => {

    displayNameInput.value = original.displayName;

    selectedAvatar = original.avatar;

    selectedPhotoURL = original.photoURL || "";



    document.querySelectorAll(".avatar-option").forEach(el => {

        el.classList.toggle("selected", el.dataset.letter === selectedAvatar);

    });



    updatePreview();

    showToast("Đã hủy thay đổi.");

});



const passwordModal = document.getElementById("passwordModal");

const passwordForm = document.getElementById("passwordForm");

const passwordMessage = document.getElementById("passwordMessage");

const passwordSubmitBtn = document.getElementById("passwordSubmitBtn");



function setPasswordMessage(message, type = "") {

    if (!passwordMessage) return;

    passwordMessage.textContent = message;

    passwordMessage.className = `password-message${type ? ` ${type}` : ""}`;

}



function closePasswordModal() {

    if (!passwordModal) return;

    passwordModal.classList.remove("show");

    passwordModal.setAttribute("aria-hidden", "true");

    passwordForm?.reset();

    setPasswordMessage("");

}



function openPasswordModal() {

    if (!passwordModal) return;

    passwordModal.classList.add("show");

    passwordModal.setAttribute("aria-hidden", "false");

    setPasswordMessage("");

    setTimeout(() => document.getElementById("currentPassword")?.focus(), 50);

}



document.getElementById("passwordBtn").addEventListener("click", openPasswordModal);

document.getElementById("passwordCloseBtn")?.addEventListener("click", closePasswordModal);

document.getElementById("passwordCancelBtn")?.addEventListener("click", closePasswordModal);

document.querySelector("[data-close-password]")?.addEventListener("click", closePasswordModal);



passwordForm?.addEventListener("submit", async (event) => {

    event.preventDefault();



    const currentPassword = document.getElementById("currentPassword")?.value || "";

    const newPassword = document.getElementById("newPassword")?.value || "";

    const confirmPassword = document.getElementById("confirmNewPassword")?.value || "";



    setPasswordMessage("");



    if (!currentUser || currentUser.isAnonymous) {

        setPasswordMessage("Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.", "error");

        return;

    }



    if (currentPassword.length < 6) {

        setPasswordMessage("Mật khẩu hiện tại phải có ít nhất 6 ký tự.", "error");

        return;

    }



    if (newPassword.length < 6) {

        setPasswordMessage("Mật khẩu mới phải có ít nhất 6 ký tự.", "error");

        return;

    }



    if (newPassword !== confirmPassword) {

        setPasswordMessage("Mật khẩu mới và xác nhận mật khẩu không khớp.", "error");

        return;

    }



    if (currentPassword === newPassword) {

        setPasswordMessage("Mật khẩu mới phải khác mật khẩu hiện tại.", "error");

        return;

    }



    passwordSubmitBtn.disabled = true;

    passwordSubmitBtn.textContent = "Đang đổi...";



    try {

        const {

            EmailAuthProvider,

            reauthenticateWithCredential,

            updatePassword

        } = await import(

            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"

        );



        const username = getUsername(currentUser);

        const technicalEmail = `${username.trim().toLowerCase()}@auth.tienhub.vn`;

        const credential = EmailAuthProvider.credential(technicalEmail, currentPassword);



        await reauthenticateWithCredential(currentUser, credential);

        await updatePassword(currentUser, newPassword);



        setPasswordMessage("Đổi mật khẩu thành công.", "success");

        passwordForm.reset();

        showToast("Đã đổi mật khẩu thành công.");



        setTimeout(closePasswordModal, 900);

    } catch (error) {

        console.error("TienHub password change error:", error);



        let message = "Không thể đổi mật khẩu. Vui lòng thử lại.";

        switch (error?.code) {

            case "auth/wrong-password":

            case "auth/invalid-credential":

            case "auth/invalid-login-credentials":

                message = "Mật khẩu hiện tại không đúng.";

                break;

            case "auth/weak-password":

                message = "Mật khẩu mới phải có ít nhất 6 ký tự.";

                break;

            case "auth/too-many-requests":

                message = "Có quá nhiều lần thử. Hãy thử lại sau.";

                break;

            case "auth/network-request-failed":

                message = "Không thể kết nối mạng.";

                break;

            case "auth/requires-recent-login":

                message = "Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại rồi thử đổi mật khẩu.";

                break;

        }



        setPasswordMessage(message, "error");

    } finally {

        passwordSubmitBtn.disabled = false;

        passwordSubmitBtn.textContent = "Đổi mật khẩu";

    }

});



document.getElementById("emailBtn").addEventListener("click", () => {

    showToast("Liên kết email sẽ được bổ sung sau.");

});



document.getElementById("logoutBtn").addEventListener("click", async () => {

    try {

        const core = await import("../src/core/firebase.js");

        await core.auth.signOut();

        localStorage.removeItem("tienhub_logged_in");

        localStorage.removeItem("tienhub_username");

    
        window.location.replace("/pages/auth.html");

    } catch (error) {

        console.error("TienHub profile logout error:", error);

        showToast("Không thể đăng xuất.");

    }

});



document.getElementById("accountTrigger").addEventListener("click", () => {

    // Already on the profile page; keep the button harmless.

});



initProfile();
