const displayNameInput = document.getElementById("displayName");

const usernameInput = document.getElementById("username");

const headerName = document.getElementById("headerName");

const headerAvatar = document.getElementById("headerAvatar");

const largeAvatar = document.getElementById("largeAvatar");

const previewAvatar = document.getElementById("previewAvatar");

const previewName = document.getElementById("previewName");

const avatarGrid = document.getElementById("avatarGrid");

const toast = document.getElementById("toast");



let currentUser = null;

let selectedAvatar = "T";

let original = { displayName: "", avatar: selectedAvatar };



function showToast(message) {

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);

}



function setAvatarElement(element, fallback) {

    if (!element) return;

    element.style.backgroundImage = "";
    element.classList.remove("has-image");
    element.textContent = fallback;

}

function updatePreview() {

    const name = displayNameInput.value.trim() || "Người chơi";

    const fallback = selectedAvatar || name.charAt(0).toUpperCase() || "T";

    setAvatarElement(largeAvatar, fallback);

    setAvatarElement(previewAvatar, fallback);

    previewName.textContent = name;

    headerName.textContent = name;

    setAvatarElement(headerAvatar, fallback);

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

        // Shared profile source for hub and games.
        try {
            const { ref, get } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );

            const profileSnapshot = await get(
                ref(core.db, `users/${currentUser.uid}`)
            );

            const profileData = profileSnapshot.val() || {};
            if (typeof profileData.username === "string" && profileData.username.trim()) {
                usernameInput.value = profileData.username.trim();
            }


            if (typeof profileData.displayName === "string" && profileData.displayName.trim()) {
                displayNameInput.value = profileData.displayName.trim();
                headerName.textContent = profileData.displayName.trim();
            }
            if (typeof profileData.avatar === "string" && profileData.avatar.trim()) {
    selectedAvatar = profileData.avatar.trim();
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



        original = { displayName, avatar: selectedAvatar };

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
    displayName: name,
    avatar: selectedAvatar || name.charAt(0).toUpperCase() || "T"
});

        await update(ref(core.db, `publicProfiles/${currentUser.uid}`), {
            displayName: name,
            avatar: selectedAvatar || name.charAt(0).toUpperCase() || "T"
        });

        localStorage.setItem("tienhub_username", name);
        localStorage.setItem(
            getAvatarStorageKey(currentUser),
            selectedAvatar || name.charAt(0).toUpperCase() || "T"
        );


        original = {
            displayName: name,
            avatar: selectedAvatar
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

        // Use the actual Firebase email: legacy technical email or verified Gmail.
        const signInEmail = currentUser.email;
        if (!signInEmail) throw new Error("Tài khoản không có email để xác thực lại.");
        const credential = EmailAuthProvider.credential(signInEmail, currentPassword);





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




// Contact email is stored by TienHub Backend after a server-verified OTP.
// It does NOT replace the legacy Firebase @auth.tienhub.vn sign-in email.
const emailModal = document.getElementById("emailModal");
const contactEmail = document.getElementById("contactEmail");
const contactCode = document.getElementById("contactCode");
const emailLinkMessage = document.getElementById("emailLinkMessage");
const contactSendCode = document.getElementById("contactSendCode");
const emailLinkSubmit = document.getElementById("emailLinkSubmit");
const linkedEmailStatus = document.getElementById("linkedEmailStatus");
const emailAccountLabel = document.getElementById("emailAccountLabel");
const emailAccountStatus = document.getElementById("emailAccountStatus");
const emailLinkForm = document.getElementById("emailLinkForm");
let verifiedLinkedEmail = null;
function updateLinkedEmailUI(email) {
    verifiedLinkedEmail = email || null;
    if (emailAccountLabel) emailAccountLabel.textContent = email ? "Đã liên kết" : "Liên kết email";
    if (emailAccountStatus) emailAccountStatus.textContent = email || "Thêm email liên hệ đã xác minh";
    if (linkedEmailStatus) linkedEmailStatus.textContent = email
        ? `Đã liên kết: ${email}` : "Chưa có email liên kết.";
    if (emailLinkForm) emailLinkForm.hidden = Boolean(email);
    if (email && contactEmail) contactEmail.value = email;
}
async function refreshLinkedEmail() {
    if (!currentUser) return;
    const data = await emailApi("status");
    updateLinkedEmailUI(data.linkedEmail || null);
}

const CONTACT_API = "https://tienhub-api.tienhub-api.workers.dev";
let contactTimer = null;
function setEmailMessage(value, failed = false) {
    emailLinkMessage.textContent = value;
    emailLinkMessage.className = `password-message ${failed ? "error" : "success"}`;
}
function closeEmailModal() {
    emailModal.classList.remove("show");
    emailModal.setAttribute("aria-hidden", "true");
    clearInterval(contactTimer);
}
async function emailApi(action, payload=null) {
    if (!currentUser) throw new Error("Vui lòng đăng nhập lại.");
    const response = await fetch(`${CONTACT_API}/api/v1/email/${action}`, {
        method: payload ? "POST" : "GET",
        headers: {
            "Authorization": `Bearer ${await currentUser.getIdToken()}`,
            ...(payload ? { "Content-Type":"application/json" } : {})
        },
        ...(payload ? { body:JSON.stringify(payload) } : {}),
        cache:"no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Dịch vụ email chưa sẵn sàng.");
    return data;
}
document.getElementById("emailBtn")?.addEventListener("click", async () => {
    // The row itself identifies already-linked emails. No second linking flow.
    if (verifiedLinkedEmail) {
        showToast(`Email đã liên kết: ${verifiedLinkedEmail}`);
        return;
    }
    // Recheck on the server to avoid working with stale state between tabs.
    try {
        await refreshLinkedEmail();
    } catch (_) {
        showToast("Chưa kiểm tra được email hiện tại. Hãy thử lại.");
        return;
    }
    if (verifiedLinkedEmail) {
        showToast(`Email đã liên kết: ${verifiedLinkedEmail}`);
        return;
    }
    emailModal.classList.add("show");
    emailModal.setAttribute("aria-hidden", "false");
    if (emailLinkForm) emailLinkForm.hidden = false;
    setEmailMessage("");
    contactEmail.focus();
});
document.getElementById("emailCloseBtn")?.addEventListener("click",closeEmailModal);
document.getElementById("emailCancelBtn")?.addEventListener("click",closeEmailModal);
document.querySelector("[data-close-email]")?.addEventListener("click",closeEmailModal);
contactSendCode?.addEventListener("click",async () => {
    const email = contactEmail?.value.trim().toLowerCase() || "";
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailMessage("Hãy nhập email hợp lệ.",true); return;
    }
    contactSendCode.disabled = true;
    try {
        await emailApi("send", {email,purpose:"link"});
        setEmailMessage("Mã 6 số đã gửi đến email. Hãy kiểm tra hộp thư và Spam.");
        const until=Date.now()+60000;
        clearInterval(contactTimer);
        const update=()=>{
            const remain=Math.max(0,Math.ceil((until-Date.now())/1000));
            contactSendCode.disabled=remain>0;
            contactSendCode.textContent=remain?`Gửi lại (${remain}s)`:"Gửi lại mã";
            if(!remain)clearInterval(contactTimer);
        };
        update(); contactTimer=setInterval(update,1000);
    } catch(error) {
        contactSendCode.disabled=false;
        setEmailMessage(error.message,true);
    }
});
document.getElementById("emailLinkForm")?.addEventListener("submit",async (event)=>{
    event.preventDefault();
    const email=contactEmail?.value.trim().toLowerCase() || "";
    const code=contactCode?.value.trim() || "";
    if(!/^\d{6}$/.test(code)) {setEmailMessage("Mã xác minh gồm 6 số.",true);return;}
    emailLinkSubmit.disabled=true;
    try {
        await emailApi("claim",{email,purpose:"link",code});
        updateLinkedEmailUI(email);
        setEmailMessage("Đã xác minh và liên kết email thành công!");
        showToast("Đã liên kết email.");
    }catch(error){setEmailMessage(error.message,true);}
    finally{emailLinkSubmit.disabled=false;}
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



initProfile().then(() => {
    if (!currentUser) return;
    refreshLinkedEmail().catch(() => {
        if (emailAccountLabel) emailAccountLabel.textContent = "Liên kết email";
        if (emailAccountStatus) emailAccountStatus.textContent = "Không tải được trạng thái email";
    });
});
