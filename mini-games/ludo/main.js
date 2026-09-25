/* =========================================================

   CỜ CÁ NGỰA — MAIN.JS

   - Không hỏi nhập tên.

   - Tài khoản TienHub -> dùng tên tài khoản.

   - Khách -> dùng "Khách".

   - Tạo phòng -> vào lobby ngay.

   - Vào phòng -> chỉ nhập mã.

   - Lobby: mã phòng -> 4 slot -> bắt đầu.

========================================================= */



"use strict";



/* ================= FIREBASE ================= */

let auth = null;
let db = null;
let serverTimestamp = null;

let currentUser = null;
let currentUsername = "Khách";
let currentRoomCode = null;
let roomListener = null;
let startedRoomCode = null;

let authReadyPromise = Promise.resolve(null);

/*
 * Ludo dùng chung Firebase instance của TienHub.
 * Không khởi tạo Firebase Compat riêng trong game.
 *
 * Phần dưới tạo một lớp tương thích nhỏ để giữ nguyên
 * room logic cũ đang dùng db.ref(...).once()/set()/update()...
 */

function createDatabaseFacade(firebaseDatabase, api) {
    const {
        ref,
        get,
        set,
        update,
        remove,
        onValue,
        off,
        runTransaction,
        onDisconnect
    } = api;

    function wrap(databaseRef) {
        return {
            async once(eventType) {
                if (eventType !== "value") {
                    throw new Error(`Ludo chỉ hỗ trợ once("value").`);
                }
                return await get(databaseRef);
            },

            async set(value) {
                return await set(databaseRef, value);
            },

            async update(values) {
                return await update(databaseRef, values);
            },

            async remove() {
                return await remove(databaseRef);
            },

            child(path) {
                return wrap(ref(databaseRef, String(path)));
            },

            async transaction(updateFn) {
                return await runTransaction(databaseRef, updateFn);
            },

            on(eventType, callback) {
                if (eventType !== "value") {
                    throw new Error(`Ludo chỉ hỗ trợ on("value", ...).`);
                }
                return onValue(databaseRef, callback);
            },

            off() {
                off(databaseRef);
            },

            onDisconnect() {
                return {
                    async remove() {
                        return await onDisconnect(databaseRef).remove();
                    }
                };
            }
        };
    }

    return {
        ref(path) {
            return wrap(ref(firebaseDatabase, String(path)));
        }
    };
}

(async () => {
    try {
        const core = await import("../../src/core/firebase.js");
        auth = core.auth;
        const firebaseDatabase = core.db;

        if (!auth) {
            throw new Error("Không lấy được Firebase Auth của TienHub.");
        }

        if (!firebaseDatabase) {
            throw new Error("Không lấy được Firebase Database của TienHub.");
        }

        const databaseApi = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
        );

        db = createDatabaseFacade(firebaseDatabase, databaseApi);
        serverTimestamp = databaseApi.serverTimestamp;

        const { onAuthStateChanged } = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"
        );

        authReadyPromise = new Promise(resolve => {
            let resolved = false;

            onAuthStateChanged(auth, async user => {
                currentUser = user;

                if (user && !user.isAnonymous) {
                    try {
                        const snap = await databaseApi.get(
                            databaseApi.ref(firebaseDatabase, `users/${user.uid}`)
                        );
                        const data = snap.val() || {};

                        currentUsername =
                            data.username ||
                            data.displayName ||
                            user.displayName ||
                            user.email?.split("@")[0] ||
                            localStorage.getItem("tienhub_username") ||
                            "Người chơi";
                    } catch (error) {
                        console.warn("LUDO LOAD USERNAME ERROR:", error);
                        currentUsername =
                            user.displayName ||
                            user.email?.split("@")[0] ||
                            localStorage.getItem("tienhub_username") ||
                            "Người chơi";
                    }
                } else {
                    currentUsername = "Khách";
                }

                console.log(
                    "LUDO AUTH:",
                    user ? user.uid : "none",
                    currentUsername,
                    user?.isAnonymous ? "anonymous" : "account"
                );

                if (!resolved) {
                    resolved = true;
                    resolve(user || null);
                }
            });
        });
    } catch (error) {
        console.error("LUDO FIREBASE INIT ERROR:", error);
        authReadyPromise = Promise.reject(error);
    }
})();

/* ================= ONLINE GAME SYNC ================= */

let onlineGameRef = null;
let onlineGameListener = null;
let onlineGameEventsBound = false;
let applyingRemoteGameState = false;

/* ================= AUTH HELPER ================= */

async function ensureUser() {
    await authReadyPromise;

    const user = currentUser || auth?.currentUser;

    if (!user) {
        throw new Error(
            "Bạn chưa đăng nhập TienHub. Vui lòng đăng nhập trước khi chơi Ludo."
        );
    }

    currentUser = user;

    if (!currentUsername || currentUsername === "Khách") {
        currentUsername =
            user.displayName ||
            user.email?.split("@")[0] ||
            localStorage.getItem("tienhub_username") ||
            "Người chơi";
    }

    return user;
}

/* ================= BASIC HELPERS ================= */

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}

function formatRoomCode(code) {
    return String(code || "").toUpperCase();
}

function showScreen(screenId) {
    document
        .querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.remove("active");
        });

    const screen = document.getElementById(screenId);

    if (screen) {
        screen.classList.add("active");
    }
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ================= MENU ================= */



document

    .getElementById("singleButton")

    ?.addEventListener("click", async () => {

        let user = null;

        try {

            user = await ensureUser();

        } catch (error) {

            console.warn(error);

            alert(error.message);

            return;

        }



        const started = window.startLudoSolo?.({

            id: user.uid,

            name: currentUsername

        });



        if (started) {

            showScreen("gameScreen");

            renderGamePlayers(LudoGame.players);

        }

    });



document

    .getElementById("createRoomButton")

    ?.addEventListener("click", async () => {



        try {

            await createRoom();

        } catch (error) {

            console.error(error);



            alert(

                "Không thể tạo phòng.\n\n" +

                error.message

            );

        }

    });



document

    .getElementById("joinRoomButton")

    ?.addEventListener("click", () => {



        document.getElementById(

            "joinRoomCodeInput"

        ).value = "";



        showScreen("joinScreen");



        setTimeout(() => {

            document

                .getElementById("joinRoomCodeInput")

                ?.focus();

        }, 80);

    });



/* ================= CREATE ROOM ================= */



async function createRoom() {

    

    const user = await ensureUser();



    if (!db) {

        throw new Error(

            "Firebase Database chưa khởi tạo."

        );

    }



    let roomCode = generateRoomCode();



    for (;;) {

        const snap = await db

            .ref(`ludoRooms/${roomCode}`)

            .once("value");



        if (!snap.exists()) break;



        roomCode = generateRoomCode();

    }



    currentRoomCode = roomCode;



    const room = {

        host: user.uid,

        hostName: currentUsername,

        status: "waiting",

        maxPlayers: 4,

        createdAt:

            serverTimestamp(),

        players: {

            [user.uid]: {

                uid: user.uid,

                name: currentUsername,

                color: randomColor(),

                type: "human",

                host: true,

                ready: true,

                joinedAt:

                    serverTimestamp()

            }

        }

    };



    await db

        .ref(`ludoRooms/${roomCode}`)

        .set(room);



    await setPlayerDisconnect(

        roomCode,

        user.uid

    );



    document.getElementById(

        "roomCode"

    ).textContent = formatRoomCode(roomCode);



    showScreen("lobbyScreen");

    listenRoom(roomCode);

}



/* ================= JOIN ROOM ================= */



const joinInput =

    document.getElementById(

        "joinRoomCodeInput"

    );



joinInput?.addEventListener("input", () => {

    joinInput.value = joinInput.value

        .toUpperCase()

        .replace(/[^A-Z0-9]/g, "")

        .slice(0, 6);

});



joinInput?.addEventListener(

    "keydown",

    event => {

        if (event.key === "Enter") {

            event.preventDefault();

            joinRoom();

        }

    }

);



document

    .getElementById("joinRoomConfirm")

    ?.addEventListener(

        "click",

        joinRoom

    );



async function joinRoom() {

    try {

        const user = await ensureUser();



        if (!db) {

            throw new Error(

                "Firebase Database chưa khởi tạo."

            );

        }



        const roomCode = String(

            joinInput?.value || ""

        )

            .trim()

            .toUpperCase();



        if (!/^[A-Z0-9]{6}$/.test(roomCode)) {

            alert(

                "Mã phòng phải gồm đúng 6 ký tự."

            );

            return;

        }



        const roomRef = db.ref(

            `ludoRooms/${roomCode}`

        );



        const snap = await roomRef.once(

            "value"

        );



        const room = snap.val();



        if (!room) {

            alert(

                "Không tìm thấy phòng này."

            );

            return;

        }



        if (room.status !== "waiting") {

            alert(

                "Trận đấu trong phòng đã bắt đầu."

            );

            return;

        }



        const players = Object.values(

            room.players || {}

        );



        if (

            players.some(

                player =>

                    player.uid === user.uid

            )

        ) {

            currentRoomCode = roomCode;

            await setPlayerDisconnect(

                roomCode,

                user.uid

            );

            updateLobby(room);

            showScreen("lobbyScreen");

            listenRoom(roomCode);

            return;

        }



        if (players.length >= 4) {

            alert(

                "Phòng đã đủ 4 người."

            );

            return;

        }



        /*

         * QUAN TRỌNG:

         * Chọn màu và thêm người chơi trong cùng một transaction trên

         * node players. Như vậy 2 người vào cùng lúc cũng không thể lấy

         * trùng màu và không còn lỗi "Không thể nhận màu" do transaction

         * trên toàn bộ room bị xung đột.

         */



        const colors = [

            "red",

            "green",

            "yellow",

            "blue"

        ];



        let joinedPlayer = null;

        let lastTransaction = null;



        for (

            let attempt = 0;

            attempt < 5;

            attempt++

        ) {

            const playersRef =

                roomRef.child("players");



            const result =

                await playersRef.transaction(

                    currentPlayers => {

                        const nextPlayers =

                            currentPlayers || {};



                        if (

                            nextPlayers[user.uid]

                        ) {

                            return nextPlayers;

                        }



                        if (

                            Object.keys(

                                nextPlayers

                            ).length >= 4

                        ) {

                            return;

                        }



                        const used = new Set(

                            Object.values(

                                nextPlayers

                            )

                                .map(

                                    player =>

                                        player?.color

                                )

                                .filter(

                                    color =>

                                        colors.includes(

                                            color

                                        )

                                )

                        );



                        const available =

                            colors.filter(

                                color =>

                                    !used.has(

                                        color

                                    )

                            );



                        if (

                            available.length === 0

                        ) {

                            return;

                        }



                        const color =

                            available[

                                Math.floor(

                                    Math.random() *

                                    available.length

                                )

                            ];



                        nextPlayers[user.uid] = {

                            uid: user.uid,

                            name:

                                currentUsername ||

                                "Khách",

                            color,

                            type: "human",

                            host: false,

                            ready: true,

                            joinedAt:

                                serverTimestamp()

                        };



                        return nextPlayers;

                    }

                );



            lastTransaction = result;



            if (result.committed) {

                const playersAfter =

                    result.snapshot.val() || {};



                joinedPlayer =

                    playersAfter[user.uid] ||

                    null;



                if (joinedPlayer?.color) {

                    break;

                }

            }



            // Có người khác vừa cập nhật phòng. Đọc lại rồi thử lại.

            await new Promise(

                resolve =>

                    setTimeout(

                        resolve,

                        150

                    )

            );

        }



        if (!joinedPlayer?.color) {

            const latestSnap =

                await roomRef.once(

                    "value"

                );



            const latest = latestSnap.val();



            if (!latest) {

                throw new Error(

                    "Phòng không còn tồn tại."

                );

            }



            if (latest.status !== "waiting") {

                throw new Error(

                    "Trận đấu đã bắt đầu."

                );

            }



            const latestPlayers =

                Object.values(

                    latest.players || {}

                );



            const me =

                latestPlayers.find(

                    player =>

                        player.uid ===

                        user.uid

                );



            // Trường hợp transaction đã thêm người chơi nhưng client

            // không nhận được snapshot ngay lập tức.

            if (me?.color) {

                joinedPlayer = me;

            } else if (

                latestPlayers.length >= 4

            ) {

                throw new Error(

                    "Phòng đã đủ 4 người."

                );

            } else {

                console.error(

                    "LUDO JOIN TRANSACTION FAILED",

                    {

                        committed:

                            lastTransaction

                                ?.committed,

                        roomCode,

                        uid: user.uid,

                        latestPlayers

                    }

                );



                throw new Error(

                    "Không thể nhận màu. Hãy thử lại."

                );

            }

        }



        const joinedColor =

            joinedPlayer.color;



        console.log(

            "LUDO JOIN SUCCESS:",

            roomCode,

            user.uid,

            currentUsername,

            joinedColor

        );



        currentRoomCode = roomCode;



        await setPlayerDisconnect(

            roomCode,

            user.uid

        );



        document.getElementById(

            "roomCode"

        ).textContent =

            formatRoomCode(roomCode);



        showScreen("lobbyScreen");

        listenRoom(roomCode);



    } catch (error) {

        console.error(

            "JOIN ROOM ERROR:",

            error

        );



        alert(

            "Không thể vào phòng.\n\n" +

            error.message

        );

    }

}
/* ================= ROOM LISTENER ================= */



function stopRoomListener() {

    if (roomListener && db) {

        db.ref(`ludoRooms/${roomListener}`).off();

    }



    roomListener = null;

}



function listenRoom(roomCode) {

    stopRoomListener();



    roomListener = roomCode;



    db.ref(`ludoRooms/${roomCode}`).on(

        "value",

        snapshot => {

            const room = snapshot.val();



            if (!room) {

                stopRoomListener();

                currentRoomCode = null;

                showScreen("menuScreen");

                return;

            }



            updateLobby(room);



            if (

                room.status === "playing" &&

                startedRoomCode !== roomCode

            ) {

                startedRoomCode = roomCode;

                startGame(

                    Object.values(

                        room.players || {}

                    )

                );

            }

        },

        error => {

            console.error(

                "ROOM LISTENER ERROR:",

                error

            );

        }

    );

}



/* ================= DISCONNECT ================= */



async function setPlayerDisconnect(

    roomCode,

    uid

) {

    if (!db || !roomCode || !uid) return;



    try {

        await db

            .ref(

                `ludoRooms/${roomCode}/players/${uid}`

            )

            .onDisconnect()

            .remove();

    } catch (error) {

        console.warn(

            "onDisconnect:",

            error

        );

    }

}



/* ================= LOBBY ================= */



const SLOT_COLORS = [

    "red",

    "yellow",

    "green",

    "blue"

];



function updateLobby(room) {

    const players = Object.values(

        room.players || {}

    );



    const roomCodeElement =

        document.getElementById(

            "roomCode"

        );



    if (roomCodeElement) {

        roomCodeElement.textContent =

            formatRoomCode(

                currentRoomCode

            );

    }



    const count =

        document.getElementById(

            "playerCount"

        );



    if (count) {

        count.textContent =

            `${players.length}/4`;

    }



    const slots =

        document.getElementById(

            "playerSlots"

        );



    if (!slots) return;



    slots.innerHTML = "";



    for (let i = 0; i < 4; i++) {

        const player = players[i];



        const card =

            document.createElement(

                "div"

            );



        if (player) {

            const color =

                player.color ||

                SLOT_COLORS[i];



            card.className =

                `player-card ${color}-player`;



            card.innerHTML = `

                <span class="slot-number">

                    ${String(i + 1).padStart(2, "0")}

                </span>



                <div class="player-avatar">

                    ${

                        player.type === "ai"

                            ? "🤖"

                            : "🐴"

                    }

                </div>



                <strong>

                    ${escapeHTML(

                        player.name ||

                        "Khách"

                    )}

                </strong>



                <small>

                    ${

                        player.host

                            ? "CHỦ PHÒNG"

                            : player.type === "ai"

                                ? "MÁY"

                                : "NGƯỜI CHƠI"

                    }

                </small>



                <div class="ready">

                    ✓ ${

                        player.host

                            ? "CHỦ PHÒNG"

                            : "ĐÃ SẴN SÀNG"

                    }

                </div>

            `;

        } else {

            card.className =

                "player-card empty-slot";



            card.innerHTML = `

                <span class="slot-number">

                    ${String(i + 1).padStart(2, "0")}

                </span>



                <div class="empty-plus">

                    +

                </div>



                <strong>

                    Đang chờ...

                </strong>



                <small>

                    CHỜ NGƯỜI CHƠI

                </small>

            `;

        }



        slots.appendChild(card);

    }



    const status =

        document.getElementById(

            "lobbyStatusText"

        );



    if (status) {

        status.textContent =

            players.length >= 4

                ? "Phòng đã đủ 4 người."

                : "Đang chờ người chơi...";

    }



    const startButton =

        document.getElementById(

            "startRoomButton"

        );



    if (startButton) {

        const isHost =

            currentUser &&

            room.host ===

                currentUser.uid;



        startButton.disabled =

            !isHost ||

            room.status !== "waiting";



        startButton.style.opacity =

            startButton.disabled

                ? ".45"

                : "1";



        startButton.style.cursor =

            startButton.disabled

                ? "not-allowed"

                : "pointer";

    }

}



/* ================= START ROOM ================= */



document

    .getElementById(

        "startRoomButton"

    )

    ?.addEventListener(

        "click",

        startRoomGame

    );



async function startRoomGame() {

    if (

        !currentRoomCode ||

        !db ||

        !currentUser

    ) {

        return;

    }



    try {

        const roomRef =

            db.ref(

                `ludoRooms/${currentRoomCode}`

            );



        const snap =

            await roomRef.once(

                "value"

            );



        const room = snap.val();



        if (!room) return;



        if (

            room.host !==

            currentUser.uid

        ) {

            alert(

                "Chỉ chủ phòng mới có thể bắt đầu."

            );

            return;

        }



        if (

            room.status !==

            "waiting"

        ) {

            return;

        }



        const players =

            Object.values(

                room.players || {}

            );



        const filled = [

            ...players

        ];



        const colors = [

            "red",

            "yellow",

            "green",

            "blue"

        ];



        let aiIndex = 1;



        while (filled.length < 4) {

            const used =

                new Set(

                    filled.map(

                        player =>

                            player.color

                    )

                );



            const color =

                colors.find(

                    item =>

                        !used.has(item)

                ) ||

                colors[filled.length];



            filled.push({

                uid:

                    `ai-${currentRoomCode}-${aiIndex}`,

                name:

                    `Máy ${aiIndex}`,

                color,

                type: "ai",

                host: false,

                ready: true

            });



            aiIndex++;

        }



        const playersObject = {};



        filled.forEach(player => {

            playersObject[player.uid] =

                player;

        });



        await roomRef.update({

            status: "playing",

            players: playersObject,

            startedAt:

                serverTimestamp()

        });



    } catch (error) {

        console.error(

            "START ROOM ERROR:",

            error

        );



        alert(

            "Không thể bắt đầu trận.\n\n" +

            error.message

        );

    }

}



/* ================= COPY ================= */



async function copyRoomCode() {

    if (!currentRoomCode) return;



    try {

        await navigator.clipboard.writeText(

            currentRoomCode

        );



        const button =

            document.getElementById(

                "copyLobbyCode"

            );



        if (button) {

            const old =

                button.textContent;



            button.textContent =

                "✓ ĐÃ SAO CHÉP";



            setTimeout(() => {

                button.textContent =

                    old;

            }, 1200);

        }



    } catch {

        alert(

            `Mã phòng: ${currentRoomCode}`

        );

    }

}



document

    .getElementById(

        "copyLobbyCode"

    )

    ?.addEventListener(

        "click",

        copyRoomCode

    );



/* ================= LEAVE ROOM ================= */



async function leaveRoom() {

    if (

        !currentRoomCode ||

        !db ||

        !currentUser

    ) {

        return;

    }



    stopOnlineGameSync();



    const code =

        currentRoomCode;



    try {

        const ref = db.ref(

            `ludoRooms/${code}`

        );



        const snap =

            await ref.once(

                "value"

            );



        const room = snap.val();



        if (!room) return;



        if (

            room.host ===

            currentUser.uid

        ) {

            await ref.remove();

        } else {

            await ref

                .child(

                    `players/${currentUser.uid}`

                )

                .remove();

        }



    } catch (error) {

        console.warn(

            "Leave room:",

            error

        );

    }



    stopRoomListener();

    currentRoomCode = null;

    startedRoomCode = null;

}



/* ================= BACK BUTTONS ================= */



document

    .querySelectorAll(

        "[data-back]"

    )

    .forEach(button => {

        button.addEventListener(

            "click",

            async () => {



                if (currentRoomCode) {

                    await leaveRoom();

                }



                showScreen(

                    button.dataset.back

                );

            }

        );

    });



document

    .getElementById(

        "backToGameMenu"

    )

    ?.addEventListener(

        "click",

        async () => {



            if (currentRoomCode) {

                await leaveRoom();

            }



            showScreen(

                "menuScreen"

            );

        }

    );



/* ================= POLISHED VISUAL BOARD ================= */



const BOARD_SIZE = 15;



function cellKey(r, c) {

    return `${r}-${c}`;

}



const pathCells = new Set();

const laneCells = new Map();

const entryCells = new Map();

const specialCircleCells = new Map([

    [

        cellKey(6, 6),

        "yellow"

    ],

    [

        cellKey(6, 8),

        "green"

    ],

    [

        cellKey(8, 8),

        "red"

    ],

    [

        cellKey(8, 6),

        "blue"

    ]

]);



function addCell(r, c) {

    pathCells.add(

        cellKey(r, c)

    );

}



for (

    let r = 0;

    r <= 5;

    r++

) {

    for (

        let c = 6;

        c <= 8;

        c++

    ) {

        addCell(r, c);

    }

}



for (

    let r = 6;

    r <= 8;

    r++

) {

    for (

        let c = 0;

        c <= 5;

        c++

    ) {

        addCell(r, c);

    }



    for (

        let c = 9;

        c <= 14;

        c++

    ) {

        addCell(r, c);

    }

}



for (

    let r = 9;

    r <= 14;

    r++

) {

    for (

        let c = 6;

        c <= 8;

        c++

    ) {

        addCell(r, c);

    }

}



for (

    let r = 0;

    r <= 5;

    r++

) {

    laneCells.set(

        cellKey(r, 7),

        "yellow"

    );

}



for (

    let c = 0;

    c <= 5;

    c++

) {

    laneCells.set(

        cellKey(7, c),

        "blue"

    );

}



for (

    let c = 9;

    c <= 14;

    c++

) {

    laneCells.set(

        cellKey(7, c),

        "green"

    );

}



for (

    let r = 9;

    r <= 14;

    r++

) {

    laneCells.set(

        cellKey(r, 7),

        "red"

    );

}



entryCells.set(

    cellKey(0, 7),

    "yellow"

);



entryCells.set(

    cellKey(7, 14),

    "green"

);



entryCells.set(

    cellKey(14, 7),

    "red"

);



entryCells.set(

    cellKey(7, 0),

    "blue"

);



function armRingColor(

    row,

    col

) {

    if (

        row <= 5 &&

        col === 6

    )

        return "yellow";



    if (

        row <= 5 &&

        col === 8

    )

        return "green";



    if (

        col <= 5 &&

        row === 6

    )

        return "yellow";



    if (

        col <= 5 &&

        row === 8

    )

        return "blue";



    if (

        col >= 9 &&

        row === 6

    )

        return "green";



    if (

        col >= 9 &&

        row === 8

    )

        return "red";



    if (

        row >= 9 &&

        col === 6

    )

        return "blue";



    if (

        row >= 9 &&

        col === 8

    )

        return "red";



    return null;

}



function addHomeCard(

    board,

    color,

    title,

    position

) {

    const card =

        document.createElement(

            "div"

        );



    card.className =

        `home-zone ${color} ${position}`;



    card.innerHTML = `

        <span class="home-tick tl"></span>

        <span class="home-tick tr"></span>

        <span class="home-tick bl"></span>

        <span class="home-tick br"></span>

        <div class="home-title">

            CỜ CÁ NGỰA

        </div>

        <div class="home-sub">

            ${escapeHTML(title)}

        </div>

    `;



    board.appendChild(card);

}



function buildVisualBoard() {

    const board =

        document.getElementById(

            "board"

        ) ||

        document.getElementById(

            "ludoBoard"

        );



    if (!board) return null;



    board.innerHTML = "";

    board.className = "board";



    for (

        let row = 0;

        row < BOARD_SIZE;

        row++

    ) {

        for (

            let col = 0;

            col < BOARD_SIZE;

            col++

        ) {

            const cell =

                document.createElement(

                    "div"

                );



            cell.className =

                "cell";



            const key =

                cellKey(

                    row,

                    col

                );



            if (

                entryCells.has(key)

            ) {

                cell.classList.add(

                    "entry",

                    `ring-${entryCells.get(key)}`

                );



            } else if (

                specialCircleCells.has(

                    key

                )

            ) {

                cell.classList.add(

                    "circle",

                    "center-circle",

                    `ring-${specialCircleCells.get(key)}`

                );



            } else if (

                laneCells.has(key)

            ) {

                cell.classList.add(

                    "lane",

                    laneCells.get(key)

                );



            } else if (

                pathCells.has(key)

            ) {

                const ring =

                    armRingColor(

                        row,

                        col

                    );



                cell.classList.add(

                    "path",

                    "circle",

                    `ring-${ring || "neutral"}`

                );

            }



            board.appendChild(cell);

        }

    }



    addHomeCard(

        board,

        "yellow",

        "LUYỆN",

        "top-left"

    );



    addHomeCard(

        board,

        "green",

        "PHI",

        "top-right"

    );



    addHomeCard(

        board,

        "blue",

        "THANH",

        "bottom-left"

    );



    addHomeCard(

        board,

        "red",

        "LIÊN",

        "bottom-right"

    );



    const center =

        document.createElement(

            "div"

        );



    center.className =

        "center-goal";



    center.innerHTML = `

        <span class="tri tri-top"></span>

        <span class="tri tri-right"></span>

        <span class="tri tri-bottom"></span>

        <span class="tri tri-left"></span>

    `;



    board.appendChild(center);



    return board;

}



function renderLudoVisualBoard() {

    const board =

        buildVisualBoard();



    if (!board) return;



    // Recreate engine-controlled pieces after the visual board is rebuilt.

    if (window.LudoBoard) {

        LudoBoard.boardElement =

            board;

    }

}



window.renderLudoVisualBoard =

    renderLudoVisualBoard;



/* ================= WINNER MODAL ================= */



function showLudoWinnerModal(

    detail = {}

) {

    const modal =

        document.getElementById(

            "winnerModal"

        );



    const nameElement =

        document.getElementById(

            "winnerName"

        );



    if (!modal) return;



    const winner =

        detail?.winner ||

        detail?.player ||

        null;



    const winnerId =

        detail?.winnerId ||

        detail?.playerId ||

        LudoGame?.winnerId;



    const boardPlayer =

        window.LudoBoard?.players?.find(

            player =>

                player.id === winnerId

        );



    const winnerName =

        winner?.name ||

        boardPlayer?.name ||

        LudoGame?.players?.find(

            player =>

                player.id === winnerId

        )?.name ||

        "Người chơi";



    if (nameElement) {

        nameElement.textContent =

            winnerName;

    }



    modal.classList.add("show");

    modal.setAttribute(

        "aria-hidden",

        "false"

    );

}



function hideLudoWinnerModal() {

    const modal =

        document.getElementById(

            "winnerModal"

        );



    if (!modal) return;



    modal.classList.remove(

        "show"

    );



    modal.setAttribute(

        "aria-hidden",

        "true"

    );

}



document.addEventListener(

    "ludo:finished",

    event => {

        showLudoWinnerModal(

            event.detail || {}

        );

    }

);



document

    .getElementById(

        "winnerMenuButton"

    )

    ?.addEventListener(

        "click",

        async () => {

            hideLudoWinnerModal();



            if (

                typeof leaveRoom ===

                    "function" &&

                currentRoomCode

            ) {

                await leaveRoom();

            }



            window

                .clearLudoAITimer

                ?.();



            window

                .resetLudoBoard

                ?.();



            window

                .resetGameState

                ?.();



            showScreen(

                "menuScreen"

            );

        }

    );



// Test nhanh trong Console mà không cần chơi hết một ván:

// showLudoWinnerModal({ player: { name: "TEST — Người chiến thắng" } });



window.showLudoWinnerModal =

    showLudoWinnerModal;



window.hideLudoWinnerModal =

    hideLudoWinnerModal;

/* ================= GAME ENGINE ================= */



function startGame(

    players,

    mode = "online"

) {

    if (

        !Array.isArray(players) ||

        !players.length

    ) {

        return;

    }



    showScreen("gameScreen");



    renderGamePlayers(

        players

    );



    if (mode === "solo") {

        window.startLudoSolo?.({

            id:

                players[0]?.uid ||

                "local-player",

            name:

                players[0]?.name ||

                "Bạn"

        });



        return;

    }



    resetGameState();



    LudoGame.mode =

        "online";



    LudoGame.state =

        "playing";



    LudoGame.roomId =

        currentRoomCode;



    LudoGame.players =

        players.map(

            player => ({

                id:

                    player.uid ||

                    player.id,



                name:

                    player.name ||

                    "Khách",



                color:

                    player.color,



                type:

                    player.type ||

                    "human",



                connected:

                    player.connected !==

                    false,



                isHost:

                    player.host === true ||

                    player.isHost === true,



                joinedAt:

                    Date.now(),



                disconnectedAt:

                    null,



                disconnectTimer:

                    null

            })

        );



    LudoGame.localPlayerId =

        currentUser?.uid ||

        LudoGame.players[0]?.id;



    LudoGame.hostPlayerId =

        players.find(

            p =>

                p.host ||

                p.isHost

        )?.uid ||

        LudoGame.players[0]?.id;



    applyPlayersToBoard();



    renderLudoVisualBoard();



    window

        .renderLudoPieces

        ?.();



    startBoard();



    if (mode === "online") {

        setupOnlineGameSync();



        setTimeout(

            () => {

                saveOnlineGameState();

            },

            50

        );

    }

}



function getPlayerColorHex(

    color

) {

    const colors = {

        red: "#ef4444",

        green: "#22c55e",

        yellow: "#facc15",

        blue: "#3b82f6"

    };



    return (

        colors[color] ||

        "#94a3b8"

    );

}



function renderGamePlayers(

    players

) {

    const raceInfo =

        document.getElementById(

            "raceInfo"

        );



    const gamePlayers =

        document.getElementById(

            "gamePlayers"

        );



    if (raceInfo)

        raceInfo.innerHTML = "";



    if (gamePlayers)

        gamePlayers.innerHTML = "";



    (players || []).forEach(

        player => {

            const row =

                document.createElement(

                    "div"

                );



            row.className =

                "game-player-row";



            const color =

                getPlayerColorHex(

                    player.color

                );



            row.innerHTML = `

                <span class="game-player-name">

                    <i

                        class="player-color-dot"

                        style="--player-color:${color}"

                    ></i>



                    <span class="player-avatar-mini">

                        ${

                            player.type === "ai"

                                ? "🤖"

                                : "🐴"

                        }

                    </span>



                    <span>

                        ${escapeHTML(

                            player.name ||

                            "Khách"

                        )}

                    </span>

                </span>



                <b>0/4</b>

            `;



            raceInfo?.appendChild(

                row.cloneNode(true)

            );



            gamePlayers?.appendChild(

                row

            );

        }

    );

}



function randomColor() {

    const colors = [

        "red",

        "green",

        "yellow",

        "blue"

    ];



    return colors[

        Math.floor(

            Math.random() *

            colors.length

        )

    ];

}



window.showLudoScreen =

    showScreen;



window.resetGameState =

    resetGameState;



try {

    window.initLudoGame?.();

} catch (error) {

    console.error(

        "LUDO INIT ERROR:",

        error

    );

}



/* Initial visual board */



renderLudoVisualBoard();
