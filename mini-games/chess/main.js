(function () {

    "use strict";


    /* =========================================================
       CHECK CHESS CORE
    ========================================================== */

    if (!window.ChessCore) {

        console.error(
            "❌ ChessCore chưa được tải."
        );

        return;
    }


    const Chess =
        window.ChessCore;


    /* =========================================================
       DOM
    ========================================================== */

    const $ = id =>
        document.getElementById(id);


    /* =========================================================
       FILES
    ========================================================== */

    const FILES = [
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h"
    ];


    /* =========================================================
       PIECES
    ========================================================== */

    const PIECE_GLYPHS = {

        w: {
            k: "♚︎",
            q: "♛︎",
            r: "♜︎",
            b: "♝︎",
            n: "♞︎",
            p: "♟︎"
        },

        b: {
            k: "♚︎",
            q: "♛︎",
            r: "♜︎",
            b: "♝︎",
            n: "♞︎",
            p: "♟︎"
        }

    };


    /* =========================================================
       STATE
    ========================================================== */

    let state = null;

    let history = [];

    let selected = null;

    let lastMove = null;

    let flipped = false;

    let mode = "ai";

    let difficulty = "medium";

    /*
     * Thời gian mặc định của game bình thường.
     * KHÔNG phải thời gian của ghép ngẫu nhiên.
     */
    let timeLimit = 300;


    let clocks = {

        w: 300,
        b: 300

    };


    let gameStarted = false;

    let gameFinished = false;

    let aiThinking = false;

    let clockTimer = null;


    /* =========================================================
       ONLINE
    ========================================================== */

    let db = null;

    let auth = null;

    let serverTimestamp = null;

    let databaseApi = null;

    let firebaseDatabaseRaw = null;

    let currentUser = null;

    let roomRef = null;

    let roomListener = null;

    let roomId = null;

    let onlineColor = null;

    let onlineJoined = false;

    let onlineMoveBusy = false;

    let drawBusy = false;

    let onlineResultShown = false;

    let onlineTurnStartedAt = null;

    let lastRemoteMoveKey = null;

    let lastDrawKey = null;


    /* =========================================================
       RANDOM MATCHMAKING
    ========================================================== */

    let matchmakingRef = null;

    let matchmakingListener = null;

    let matchmakingDisconnect = null;

    let matching = false;

    let matchingBusy = false;


    /*
     * QUAN TRỌNG:
     *
     * Ghép ngẫu nhiên luôn cố định 10 phút.
     *
     * 600 giây = 10 phút.
     */
    const RANDOM_MATCH_TIME = 600;


    /* =========================================================
       ANALYTICS
    ========================================================== */

    let analyticsTracked = false;


    /* =========================================================
       LOCAL DRAW
    ========================================================== */

    let localDrawPending = false;


    /* =========================================================
       TIME
    ========================================================== */

    function readTimeControl() {

        const select =
            $("timeControl");


        if (!select) {
            return 300;
        }


        const value =
            Number(
                select.value
            );


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            return 300;
        }


        return value;
    }


    function formatTime(seconds) {

        if (
            timeLimit === 0
        ) {

            return "∞";
        }


        seconds =
            Number(seconds);


        if (
            !Number.isFinite(seconds)
        ) {

            seconds =
                timeLimit;
        }


        seconds =
            Math.max(
                0,
                Math.ceil(seconds)
            );


        return (

            Math.floor(
                seconds / 60
            )

            +

            ":" +

            String(
                seconds % 60
            ).padStart(
                2,
                "0"
            )

        );
    }


    /* =========================================================
       INITIAL STATE
    ========================================================== */

    function initialState() {

        return {

            board:
                Chess.initialBoard(),

            turn:
                "w",

            castling: {

                wK: true,
                wQ: true,

                bK: true,
                bQ: true

            },

            enPassant:
                null
        };
    }


    /* =========================================================
       BASIC UTIL
    ========================================================== */

    function row(index) {

        return Math.floor(
            index / 8
        );
    }


    function col(index) {

        return index % 8;
    }


    function opposite(color) {

        return color === "w"
            ? "b"
            : "w";
    }


    function generateRoomCode() {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


        let result = "";


        for (
            let i = 0;
            i < 6;
            i++
        ) {

            result +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];
        }


        return result;
    }


    /* =========================================================
       MESSAGE
    ========================================================== */

    function setMessage(
        text
    ) {

        const element =
            $("message");


        if (
            element
        ) {

            element.textContent =
                text;
        }
    }


    function setRoomMessage(
        text
    ) {

        const element =
            $("roomMessage");


        if (
            element
        ) {

            element.textContent =
                text;
        }
    }


    /* =========================================================
       RANDOM MATCHMAKING UI
    ========================================================== */

    function setMatchmakingStatus(
        text,
        visible = true
    ) {

        const element =
            $("matchmakingStatus");


        if (!element) {
            return;
        }


        const textElement =
            element.querySelector(
                "span:last-child"
            );


        if (textElement) {

            textElement.textContent =
                text;
        }


        element.classList.toggle(
            "hidden",
            !visible
        );
    }


    function setMatchmakingUI(
        searching
    ) {

        const randomButton =
            $("randomMatchBtn");

        const cancelButton =
            $("cancelMatchBtn");

        const createButton =
            $("createRoomBtn");

        const joinButton =
            $("joinRoomBtn");


        if (randomButton) {

            randomButton.disabled =
                searching;
        }


        if (createButton) {

            createButton.disabled =
                searching;
        }


        if (joinButton) {

            joinButton.disabled =
                searching;
        }


        if (cancelButton) {

            cancelButton.classList.toggle(
                "hidden",
                !searching
            );
        }


        if (searching) {

            setMatchmakingStatus(
                "Đang tìm đối thủ...",
                true
            );

        } else {

            setMatchmakingStatus(
                "",
                false
            );
        }
    }


    function stopMatchmakingListener() {

        if (
            matchmakingListener &&
            matchmakingRef
        ) {

            matchmakingRef.off(
                "value",
                matchmakingListener
            );
        }


        matchmakingListener =
            null;
    }


    async function cleanupMatchmaking(
        removeEntry = true
    ) {

        stopMatchmakingListener();


        if (
            matchmakingDisconnect
        ) {

            try {

                await matchmakingDisconnect
                    .cancel();

            } catch (error) {

                console.warn(
                    "Matchmaking disconnect cancel:",
                    error
                );
            }


            matchmakingDisconnect =
                null;
        }


        if (
            removeEntry &&
            matchmakingRef
        ) {

            try {

                await matchmakingRef.remove();

            } catch (error) {

                console.warn(
                    "Matchmaking cleanup:",
                    error
                );
            }
        }


        matchmakingRef =
            null;


        matching =
            false;


        matchingBusy =
            false;


        setMatchmakingUI(
            false
        );
    }


    /* =========================================================
       AUTO ROOM ID
    ========================================================== */

    function generateAutoRoomId(
        uidA,
        uidB,
        time
    ) {

        const users =
            [
                String(uidA),
                String(uidB)
            ]
            .sort();


        return (
            "auto_" +
            users[0] +
            "_" +
            users[1] +
            "_" +
            String(time)
        );
    }


    /* =========================================================
       RANDOM MATCH
    ========================================================== */

    async function startRandomMatch() {

        /*
         * Nếu đang tìm rồi thì không làm gì.
         */

        if (
            matching ||
            matchingBusy
        ) {

            return;
        }


        /*
         * Đánh dấu NGAY LẬP TỨC.
         *
         * Trước đây code đợi ensureFirebase()
         * xong mới đổi UI nên khi Firebase chậm
         * người dùng tưởng bấm nút không phản hồi.
         */

        matchingBusy =
            true;


        matching =
            true;


        /*
         * Hiện UI ngay.
         */

        setMatchmakingUI(
            true
        );


        setMatchmakingStatus(
            "⏳ Đang kết nối máy chủ...",
            true
        );


        setRoomMessage(
            "🎲 Đang kết nối máy chủ..."
        );


        try {

            /*
             * Kết nối Firebase.
             */

            await ensureFirebase();


            if (
                !currentUser
            ) {

                throw new Error(
                    "Không xác định được người chơi."
                );
            }


            /*
             * QUAN TRỌNG:
             *
             * Ghép ngẫu nhiên KHÔNG lấy
             * thời gian từ #timeControl.
             *
             * Luôn luôn là 600 giây = 10 phút.
             */

            const randomTimeLimit =
                RANDOM_MATCH_TIME;


            /*
             * Gán timeLimit để đồng hồ
             * online dùng đúng 10 phút.
             */

            timeLimit =
                randomTimeLimit;


            setMatchmakingStatus(
                "🔎 Đang tìm đối thủ ...",
                true
            );


            setRoomMessage(
                "🎲 Đang tìm người chơi khác..."
            );


            const uid =
                currentUser.uid;


            /*
             * Entry của chính mình.
             */

            matchmakingRef =
                db.ref(
                    "matchmaking/chess/" +
                    uid
                );


            /*
             * Nếu đóng tab / mất kết nối,
             * Firebase tự xóa entry.
             */

            matchmakingDisconnect =
                matchmakingRef.onDisconnect();


            await matchmakingDisconnect.remove();


            /*
             * Lắng nghe entry của mình.
             */

            matchmakingListener =
                snapshot => {

                    const entry =
                        snapshot.val();


                    if (
                        !entry ||
                        !matching
                    ) {

                        return;
                    }


                    if (
                        entry.status ===
                        "matched"
                    ) {

                        handleRandomMatchFound(
                            entry
                        );
                    }
                };


            matchmakingRef.on(
                "value",
                matchmakingListener
            );


            /*
             * Queue chính.
             *
             * Transaction ở đây cần Firebase
             * cho phép READ + WRITE.
             */

            const queueRef =
                db.ref(
                    "matchmaking/chess"
                );


            const result =
                await queueRef.transaction(

                    current => {

                        const queue =
                            current || {};


                        const now =
                            Date.now();


                        /*
                         * Xóa người chờ quá 2 phút.
                         */

                        Object.keys(queue)
                            .forEach(
                                key => {

                                    const item =
                                        queue[key];


                                    if (
                                        !item
                                    ) {

                                        delete queue[key];

                                        return;
                                    }


                                    if (
                                        item.status ===
                                            "waiting" &&

                                        Number(
                                            item.createdAt
                                        ) <
                                            now - 120000
                                    ) {

                                        delete queue[key];
                                    }
                                }
                            );


                        /*
                         * Nếu mình đã được ghép
                         * thì giữ nguyên.
                         */

                        const mine =
                            queue[uid];


                        if (
                            mine &&
                            mine.status ===
                                "matched"
                        ) {

                            return queue;
                        }


                        /*
                         * Tìm người đang chờ
                         * cùng chế độ 10 phút.
                         */

                        let opponentUid =
                            null;


                        let opponent =
                            null;


                        Object.keys(queue)
                            .forEach(
                                key => {

                                    if (
                                        opponentUid
                                    ) {

                                        return;
                                    }


                                    if (
                                        key === uid
                                    ) {

                                        return;
                                    }


                                    const candidate =
                                        queue[key];


                                    if (
                                        !candidate
                                    ) {

                                        return;
                                    }


                                    if (
                                        candidate.status !==
                                            "waiting"
                                    ) {

                                        return;
                                    }


                                    /*
                                     * Chỉ ghép người
                                     * cũng đang tìm 10 phút.
                                     */

                                    if (
                                        Number(
                                            candidate.timeControl
                                        ) !==
                                        RANDOM_MATCH_TIME
                                    ) {

                                        return;
                                    }


                                    opponentUid =
                                        key;


                                    opponent =
                                        candidate;
                                }
                            );


                        /*
                         * Chưa có đối thủ.
                         * Đưa mình vào queue.
                         */

                        if (
                            !opponentUid
                        ) {

                            queue[uid] = {

                                uid:
                                    uid,

                                status:
                                    "waiting",

                                /*
                                 * Luôn 600.
                                 */

                                timeControl:
                                    RANDOM_MATCH_TIME,

                                createdAt:
                                    now

                            };


                            return queue;
                        }


                        /*
                         * Đã tìm thấy đối thủ.
                         */

                        const roomCode =
                            generateAutoRoomId(
                                uid,
                                opponentUid,
                                RANDOM_MATCH_TIME
                            );


                        const users =
                            [
                                uid,
                                opponentUid
                            ]
                            .sort();


                        const whiteUid =
                            users[0];


                        const blackUid =
                            users[1];


                        queue[uid] = {

                            uid:
                                uid,

                            status:
                                "matched",

                            timeControl:
                                RANDOM_MATCH_TIME,

                            opponentUid:
                                opponentUid,

                            roomId:
                                roomCode,

                            color:
                                uid === whiteUid
                                    ? "w"
                                    : "b"

                        };


                        queue[opponentUid] = {

                            uid:
                                opponentUid,

                            status:
                                "matched",

                            timeControl:
                                RANDOM_MATCH_TIME,

                            opponentUid:
                                uid,

                            roomId:
                                roomCode,

                            color:
                                opponentUid === whiteUid
                                    ? "w"
                                    : "b"

                        };


                        return queue;
                    },

                    undefined,

                    false
                );


            if (
                !result.committed
            ) {

                throw new Error(
                    "Không thể tham gia hàng chờ."
                );
            }


            /*
             * Lấy entry cuối cùng của mình.
             */

            const finalEntry =
                result.snapshot
                    .child(uid)
                    .val();


            if (
                finalEntry &&
                finalEntry.status ===
                    "matched"
            ) {

                await handleRandomMatchFound(
                    finalEntry
                );
            }


        } catch (error) {

            console.error(
                "❌ RANDOM MATCH:",
                error
            );


            await cleanupMatchmaking(
                true
            );


            setRoomMessage(
                "❌ Không thể ghép ngẫu nhiên: " +
                (
                    error?.message ||
                    "Lỗi không xác định"
                )
            );


            setMatchmakingStatus(
                "❌ Không thể ghép trận",
                true
            );


            /*
             * Cho người dùng thấy lỗi một lúc
             * rồi ẩn trạng thái.
             */

            setTimeout(
                () => {

                    if (
                        !matching &&
                        !matchingBusy
                    ) {

                        setMatchmakingStatus(
                            "",
                            false
                        );
                    }

                },
                2500
            );


        } finally {

            matchingBusy =
                false;
        }
    }


    /* =========================================================
       MATCH FOUND
    ========================================================== */

    async function handleRandomMatchFound(
        entry
    ) {

        if (
            !entry ||
            entry.status !==
                "matched"
        ) {

            return;
        }


        if (
            !currentUser
        ) {

            return;
        }


        /*
         * Tránh xử lý nhiều lần.
         */

        if (
            !matching
        ) {

            return;
        }


        matching =
            false;


        /*
         * Ghép ngẫu nhiên luôn 10 phút.
         */

        timeLimit =
            RANDOM_MATCH_TIME;


        setMatchmakingStatus(
            "🎉 Đã tìm thấy đối thủ!",
            true
        );


        setRoomMessage(
            "🎉 Đã tìm thấy đối thủ! Đang vào bàn cờ..."
        );


        const myUid =
            currentUser.uid;


        const opponentUid =
            entry.opponentUid;


        roomId =
            entry.roomId;


        onlineColor =
            entry.color;


        onlineJoined =
            true;


        onlineResultShown =
            false;


        lastRemoteMoveKey =
            null;


        lastDrawKey =
            null;


        analyticsTracked =
            false;


        /*
         * Dừng listener hàng chờ.
         */

        stopMatchmakingListener();


        if (
            matchmakingDisconnect
        ) {

            try {

                await matchmakingDisconnect
                    .cancel();

            } catch (error) {

                console.warn(
                    "Cancel matchmaking disconnect:",
                    error
                );
            }


            matchmakingDisconnect =
                null;
        }


        /*
         * Xóa mình khỏi queue.
         */

        if (
            matchmakingRef
        ) {

            try {

                await matchmakingRef.remove();

            } catch (error) {

                console.warn(
                    "Remove matched queue:",
                    error
                );
            }


            matchmakingRef =
                null;
        }


        setMatchmakingUI(
            false
        );


        updatePlayerNames();


        const reference =
            db.ref(
                "rooms/chess/" +
                roomId
            );


        roomRef =
            reference;


        /*
         * Người Trắng tạo phòng.
         */

        if (
            onlineColor === "w"
        ) {

            await createRandomMatchRoom(
                reference,
                myUid,
                opponentUid,
                RANDOM_MATCH_TIME
            );


            listenRoom();


            return;
        }


        /*
         * Người Đen chờ phòng.
         */

        setRoomMessage(
            "🎉 Đã ghép được đối thủ. Đang vào bàn cờ..."
        );


        const waitForRoom =
            snapshot => {

                const room =
                    snapshot.val();


                if (
                    !room
                ) {

                    return;
                }


                reference.off(
                    "value",
                    waitForRoom
                );


                roomRef =
                    reference;


                listenRoom();
            };


        reference.on(
            "value",
            waitForRoom
        );
    }


    /* =========================================================
       CREATE RANDOM ROOM
    ========================================================== */

    async function createRandomMatchRoom(
        reference,
        whiteUid,
        blackUid,
        time
    ) {

        /*
         * Ghép ngẫu nhiên luôn dùng 600.
         */

        time =
            RANDOM_MATCH_TIME;


        const start =
            initialState();


        await reference.set({

            gameName:
                "chess",

            matchmaking:
                true,

            timeControl:
                time,

            status:
                "playing",

            hostUid:
                whiteUid,

            whiteUid:
                whiteUid,

            blackUid:
                blackUid,

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp(),

            game: {

                status:
                    "playing",

                board:
                    start.board,

                turn:
                    "w",

                castling:
                    start.castling,

                enPassant:
                    null,

                history:
                    [],

                lastMove:
                    null,

                clocks: {

                    w:
                        time,

                    b:
                        time

                },

                turnStartedAt:
                    serverTimestamp(),

                result:
                    null,

                winner:
                    null,

                drawOffer:
                    null
            }
        });


        setRoomMessage(
            "🎉 Đã ghép được đối thủ!"
        );
    }


    /* =========================================================
       CANCEL RANDOM MATCH
    ========================================================== */

    async function cancelRandomMatch() {

        if (
            !matching &&
            !matchingBusy
        ) {

            return;
        }


        matching =
            false;


        matchingBusy =
            false;


        setMatchmakingStatus(
            "",
            false
        );


        await cleanupMatchmaking(
            true
        );


        setRoomMessage(
            "Đã hủy tìm trận."
        );
    }


    /* =========================================================
       SOUND
    ========================================================== */

    function playSound(
        file,
        volume = .6
    ) {

        if (
            window.GameSound &&
            typeof window.GameSound.play ===
                "function"
        ) {

            window.GameSound.play(
                file,
                volume
            );
        }
    }


    function soundClick() {

        playSound(
            "./chess_click.mp3",
            .4
        );
    }


    function soundMove() {

        playSound(
            "./chess_move.mp3",
            .55
        );
    }


    function soundCapture() {

        playSound(
            "./chess_capture.mp3",
            .6
        );
    }


    function soundCheck() {

        playSound(
            "./chess_check.mp3",
            .6
        );
    }


    function soundCheckmate() {

        playSound(
            "./chess_checkmate.mp3",
            .7
        );
    }


    function soundWin() {

        playSound(
            "./chess_win.mp3",
            .7
        );
    }


    function soundLose() {

        playSound(
            "./chess_lose.mp3",
            .7
        );
    }


    /* =========================================================
       GAMEHUB / FIREBASE
    ========================================================== */

    function createDatabaseFacade(database) {

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
        } = databaseApi;

        return {

            ref(path) {
                const databaseRef = ref(database, path);

                return {
                    once(event) {
                        if (event !== "value") {
                            throw new Error("Chess chỉ hỗ trợ once('value').");
                        }
                        return get(databaseRef);
                    },

                    set(value) {
                        return set(databaseRef, value);
                    },

                    update(value) {
                        return update(databaseRef, value);
                    },

                    remove() {
                        return remove(databaseRef);
                    },

                    on(event, callback) {
                        if (event !== "value") {
                            throw new Error("Chess chỉ hỗ trợ on('value').");
                        }
                        return onValue(databaseRef, callback);
                    },

                    off(event, callback) {
                        if (event && event !== "value") {
                            return;
                        }
                        return off(
                            databaseRef,
                            event || "value",
                            callback
                        );
                    },

                    transaction(updateFn) {
                        return runTransaction(
                            databaseRef,
                            updateFn
                        );
                    },

                    onDisconnect() {
                        const disconnectRef = onDisconnect(databaseRef);
                        return {
                            remove() {
                                return disconnectRef.remove();
                            },
                            cancel() {
                                return disconnectRef.cancel();
                            }
                        };
                    }
                };
            }
        };
    }


    async function ensureFirebase() {

        if (currentUser && auth && db) {
            return currentUser;
        }

        try {
            const core =
                await import("../../src/core/firebase.js");

            auth = core.auth;
            const firebaseDatabase = core.db;
            firebaseDatabaseRaw = firebaseDatabase;

            if (!auth || !firebaseDatabase) {
                throw new Error(
                    "Không lấy được Firebase Auth/Database của TienHub."
                );
            }

            databaseApi =
                await import(
                    "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
                );

            serverTimestamp =
                databaseApi.serverTimestamp;

            db =
                createDatabaseFacade(
                    firebaseDatabase
                );

            // Trên mobile, Firebase Auth có thể cần một chút thời gian
            // để khôi phục persistence sau khi trang vừa mở.
            if (typeof auth.authStateReady === "function") {
                await auth.authStateReady();
            } else {
                await new Promise(resolve => {
                    let done = false;
                    const unsubscribe = auth.onAuthStateChanged(user => {
                        if (done) return;
                        done = true;
                        try { unsubscribe(); } catch (_) {}
                        resolve(user);
                    });
                });
            }

            currentUser = auth.currentUser;

            if (!currentUser) {
                throw new Error(
                    "Bạn chưa đăng nhập TienHub. Vui lòng đăng nhập trước khi chơi online."
                );
            }

            if (currentUser.isAnonymous) {
                throw new Error(
                    "Chess không hỗ trợ tài khoản khách."
                );
            }

            return currentUser;

        } catch (error) {
            console.error(
                "Chess Firebase init error:",
                error
            );
            throw error;
        }
    }

    async function trackStart() {

        if (
            analyticsTracked
        ) {
            return;
        }


        analyticsTracked =
            true;


        try {

            await window.GameHub
                ?.startRound?.({

                    mode:
                        mode,

                    timeControl:
                        timeLimit,

                    difficulty:
                        mode === "ai"
                            ? difficulty
                            : null

                });

        } catch (error) {

            console.warn(
                "Analytics start:",
                error
            );
        }
    }


    async function trackEnd(
        result,
        winner
    ) {

        if (
            !analyticsTracked
        ) {
            return;
        }


        analyticsTracked =
            false;


        try {

            await window.GameHub
                ?.endRound?.({

                    result:
                        result,

                    winner:
                        winner || null,

                    mode:
                        mode

                });

        } catch (error) {

            console.warn(
                "Analytics end:",
                error
            );
        }
    }


    /* =========================================================
       CLOCK
    ========================================================== */

    function stopClock() {

        if (
            clockTimer
        ) {

            clearInterval(
                clockTimer
            );

            clockTimer =
                null;
        }
    }


    function getOnlineRemaining(
        color
    ) {

        if (
            timeLimit === 0
        ) {

            return 0;
        }


        const base =
            Number(
                clocks[color]
            );


        if (
            !Number.isFinite(base)
        ) {

            return 0;
        }


        if (
            !onlineTurnStartedAt ||
            !state ||
            state.turn !== color
        ) {

            return base;
        }


        const elapsed =
            (
                Date.now() -
                Number(
                    onlineTurnStartedAt
                )
            ) / 1000;


        return Math.max(
            0,
            base - elapsed
        );
    }


    function updateClockUI() {

        if (
            !state
        ) {
            return;
        }


        let white =
            Number(
                clocks.w
            );


        let black =
            Number(
                clocks.b
            );


        if (
            mode === "online" &&
            onlineTurnStartedAt
        ) {

            if (
                state.turn === "w"
            ) {

                white =
                    getOnlineRemaining(
                        "w"
                    );

            } else {

                black =
                    getOnlineRemaining(
                        "b"
                    );
            }
        }


        $("whiteClock")
            .textContent =
            formatTime(
                white
            );


        $("blackClock")
            .textContent =
            formatTime(
                black
            );


        $("whiteStatus")
            .textContent =
            state.turn === "w"
                ? "Đang đi"
                : "Chờ lượt";


        $("blackStatus")
            .textContent =
            state.turn === "b"
                ? "Đang đi"
                : "Chờ lượt";


        $("turnPill")
            .textContent =
            state.turn === "w"
                ? "Lượt Trắng"
                : "Lượt Đen";


        $("whitePlayer")
            ?.classList
            .toggle(
                "active-clock",
                state.turn === "w"
            );


        $("blackPlayer")
            ?.classList
            .toggle(
                "active-clock",
                state.turn === "b"
            );
    }


    function startClock() {

        stopClock();


        updateClockUI();


        if (
            timeLimit === 0
        ) {
            return;
        }


        clockTimer =
            setInterval(
                () => {

                    if (
                        !gameStarted ||
                        gameFinished ||
                        !state
                    ) {

                        return;
                    }


                    if (
                        mode === "online"
                    ) {

                        const color =
                            state.turn;


                        const remaining =
                            getOnlineRemaining(
                                color
                            );


                        updateClockUI();


                        if (
                            remaining <= 0 &&
                            onlineColor === color
                        ) {

                            publishOnlineFinish(
                                "time",
                                opposite(
                                    color
                                )
                            );
                        }


                        return;
                    }


                    /*
                     * LOCAL
                     */

                    clocks[
                        state.turn
                    ] -= .1;


                    if (
                        clocks[
                            state.turn
                        ] <= 0
                    ) {

                        clocks[
                            state.turn
                        ] = 0;


                        const winner =
                            opposite(
                                state.turn
                            );


                        finishLocal(
                            "time",
                            winner
                        );


                        return;
                    }


                    updateClockUI();

                },
                100
            );
    }


    /* =========================================================
       RENDER BOARD
    ========================================================== */

    function render() {

        const board =
            $("board");


        if (
            !board ||
            !state
        ) {
            return;
        }


        board.innerHTML =
            "";


        let legalTargets = [];


        if (
            selected !== null
        ) {

            legalTargets =
                Chess
                    .legalMovesFrom(
                        state,
                        selected
                    )
                    .map(
                        move =>
                            move.to
                    );
        }


        const king =
            Chess.kingIndex(
                state.board,
                state.turn
            );


        const checkedKing =
            king >= 0 &&
            Chess.inCheck(
                state.board,
                state.turn
            )
                ? king
                : -1;


        for (
            let visual = 0;
            visual < 64;
            visual++
        ) {

            const index =
                flipped
                    ? 63 - visual
                    : visual;


            const square =
                document.createElement(
                    "button"
                );


            square.type =
                "button";


            square.className =
                "square " +
                (
                    (
                        row(visual) +
                        col(visual)
                    ) % 2 === 0
                        ? "light"
                        : "dark"
                );


            if (
                index === selected
            ) {

                square.classList.add(
                    "selected"
                );
            }


            if (
                lastMove &&
                (
                    index ===
                        lastMove.from ||
                    index ===
                        lastMove.to
                )
            ) {

                square.classList.add(
                    "last"
                );
            }


            if (
                index === checkedKing
            ) {

                square.classList.add(
                    "check"
                );
            }


            const piece =
                state.board[index];


            if (
                piece
            ) {

                const element =
                    document.createElement(
                        "span"
                    );


                element.className =
                    "piece " +
                    (
                        piece.c === "w"
                            ? "white-piece"
                            : "black-piece"
                    );


                element.textContent =
                    PIECE_GLYPHS[
                        piece.c
                    ][
                        piece.t
                    ];


                element.style.setProperty(
                    "opacity",
                    "1",
                    "important"
                );


                element.style.setProperty(
                    "color",
                    piece.c === "w"
                        ? "#ffffff"
                        : "#111111",
                    "important"
                );


                element.style.setProperty(
                    "-webkit-text-fill-color",
                    piece.c === "w"
                        ? "#ffffff"
                        : "#111111",
                    "important"
                );


                element.style.setProperty(
                    "-webkit-text-stroke",
                    piece.c === "w"
                        ? "1.2px #111111"
                        : "1.2px #000000",
                    "important"
                );


                element.style.setProperty(
                    "filter",
                    "none",
                    "important"
                );


                element.style.setProperty(
                    "text-shadow",
                    piece.c === "w"
                        ? "0 2px 3px rgba(0,0,0,.55)"
                        : "0 2px 3px rgba(0,0,0,.45)",
                    "important"
                );


                square.appendChild(
                    element
                );
            }


            /*
             * FILE
             */

            if (
                visual >= 56
            ) {

                const coord =
                    document.createElement(
                        "span"
                    );


                coord.className =
                    "coord file";


                coord.textContent =
                    FILES[
                        col(index)
                    ];


                square.appendChild(
                    coord
                );
            }


            /*
             * RANK
             */

            if (
                col(visual) === 0
            ) {

                const coord =
                    document.createElement(
                        "span"
                    );


                coord.className =
                    "coord rank";


                coord.textContent =
                    8 -
                    row(index);


                square.appendChild(
                    coord
                );
            }


            /*
             * MOVE INDICATOR
             */

            if (
                legalTargets.includes(
                    index
                )
            ) {

                if (
                    state.board[index]
                ) {

                    square.style.boxShadow =
                        "inset 0 0 0 4px rgba(239,68,68,.85)";

                } else {

                    square.style.boxShadow =
                        "inset 0 0 0 7px rgba(250,204,21,.42)";
                }
            }


            square.addEventListener(
                "click",
                () => {

                    handleSquare(
                        index
                    );
                }
            );


            board.appendChild(
                square
            );
        }


        renderMoves();

        updateClockUI();
    }


    /* =========================================================
       MOVES
    ========================================================== */

    function renderMoves() {

        const element =
            $("moves");


        if (
            !element
        ) {
            return;
        }


        element.innerHTML =
            "";


        for (
            let i = 0;
            i < history.length;
            i++
        ) {

            const rowElement =
                document.createElement(
                    "div"
                );


            rowElement.className =
                "move-row";


            const number =
                i % 2 === 0
                    ? Math.floor(i / 2) + "."
                    : "";


            const numberElement =
                document.createElement(
                    "span"
                );


            numberElement.className =
                "move-no";


            numberElement.textContent =
                number;


            const textElement =
                document.createElement(
                    "span"
                );


            textElement.textContent =
                history[i];


            rowElement.appendChild(
                numberElement
            );


            rowElement.appendChild(
                textElement
            );


            element.appendChild(
                rowElement
            );
        }


        element.scrollTop =
            element.scrollHeight;


        $("moveCount")
            .textContent =
            history.length;
    }


    /* =========================================================
       MOVE TEXT
    ========================================================== */

    function moveText(
        currentState,
        move
    ) {

        const piece =
            currentState.board[
                move.from
            ];


        if (
            !piece
        ) {
            return "";
        }


        if (
            move.castle
        ) {

            return move.castle === "K"
                ? "O-O"
                : "O-O-O";
        }


        const captured =
            currentState.board[
                move.to
            ] ||
            move.enPassant;


        let text =
            piece.t === "p"
                ? ""
                : piece.t.toUpperCase();


        if (
            piece.t === "p" &&
            captured
        ) {

            text +=
                FILES[
                    col(
                        move.from
                    )
                ] +
                "x";

        } else if (
            captured
        ) {

            text +=
                "x";
        }


        text +=
            Chess.squareName(
                move.to
            );


        if (
            piece.t === "p" &&
            (
                row(move.to) === 0 ||
                row(move.to) === 7
            )
        ) {

            text +=
                "=" +
                (
                    move.promotion ||
                    "q"
                ).toUpperCase();
        }


        return text;
    }


    /* =========================================================
       CHECK END
    ========================================================== */

    function checkEnd(
        currentState
    ) {

        const legal =
            Chess.legalMoves(
                currentState
            );


        if (
            legal.length > 0
        ) {

            return null;
        }


        if (
            Chess.inCheck(
                currentState.board,
                currentState.turn
            )
        ) {

            return {

                reason:
                    "checkmate",

                winner:
                    opposite(
                        currentState.turn
                    )

            };
        }


        return {

            reason:
                "stalemate",

            winner:
                null
        };
    }


    /* =========================================================
       LOCAL MOVE
    ========================================================== */

    function makeLocalMove(
        move
    ) {

        if (
            gameFinished
        ) {
            return;
        }


        const notation =
            moveText(
                state,
                move
            );


        const captured =
            state.board[
                move.to
            ];


        state =
            Chess.applyMove(
                state,
                move
            );


        history.push(
            notation
        );


        lastMove = {

            from:
                move.from,

            to:
                move.to
        };


        selected =
            null;


        if (
            captured ||
            move.enPassant
        ) {

            soundCapture();

        } else {

            soundMove();
        }


        render();


        const end =
            checkEnd(
                state
            );


        if (
            end
        ) {

            finishLocal(
                end.reason,
                end.winner
            );

            return;
        }


        if (
            Chess.inCheck(
                state.board,
                state.turn
            )
        ) {

            soundCheck();
        }


        if (
            mode === "ai" &&
            state.turn === "b"
        ) {

            aiMove();
        }
    }


    /* =========================================================
       BOARD INPUT
    ========================================================== */

    function handleSquare(
        index
    ) {

        if (
            !gameStarted ||
            gameFinished
        ) {

            return;
        }


        if (
            mode === "online"
        ) {

            handleOnlineSquare(
                index
            );

            return;
        }


        if (
            mode === "ai" &&
            state.turn === "b"
        ) {

            return;
        }


        const piece =
            state.board[index];


        if (
            selected !== null
        ) {

            const move =
                Chess
                    .legalMovesFrom(
                        state,
                        selected
                    )
                    .find(
                        item =>
                            item.to ===
                            index
                    );


            if (
                move
            ) {

                makeLocalMove(
                    move
                );

                return;
            }
        }


        if (
            piece &&
            piece.c ===
                state.turn
        ) {

            selected =
                index;


            soundClick();


            render();


            return;
        }


        selected =
            null;


        render();
    }


    /* =========================================================
       START LOCAL GAME
    ========================================================== */

    function startLocalGame() {

        timeLimit =
            readTimeControl();


        stopClock();


        state =
            initialState();


        history =
            [];


        selected =
            null;


        lastMove =
            null;


        clocks = {

            w:
                timeLimit,

            b:
                timeLimit

        };


        gameStarted =
            true;


        gameFinished =
            false;


        aiThinking =
            false;


        onlineJoined =
            false;


        onlineColor =
            null;


        onlineTurnStartedAt =
            null;


        analyticsTracked =
            false;


        $("setup")
            .classList
            .add("hidden");


        $("game")
            .classList
            .remove("hidden");


        $("onlineGameBar")
            .classList
            .add("hidden");


        $("resultOverlay")
            .classList
            .add("hidden");


        $("drawOverlay")
            .classList
            .add("hidden");


        $("startBtn")
            .classList
            .remove("hidden");


        updatePlayerNames();

        updateModeText();


        trackStart();


        if (
            mode === "ai"
        ) {

            setMessage(
                "Bạn cầm Trắng. Chọn quân cờ để đi."
            );

        } else {

            setMessage(
                "Trắng đi trước."
            );
        }


        startClock();

        render();
    }


    /* =========================================================
       PLAYER NAMES
    ========================================================== */

    function updatePlayerNames() {

        if (
            mode === "ai"
        ) {

            $("whiteName")
                .textContent =
                "Bạn";


            $("blackName")
                .textContent =
                "Máy";


        } else if (
            mode === "local"
        ) {

            $("whiteName")
                .textContent =
                "Trắng";


            $("blackName")
                .textContent =
                "Đen";


        } else {

            $("whiteName")
                .textContent =
                onlineColor === "w"
                    ? "Bạn • Trắng"
                    : "Đối thủ • Trắng";


            $("blackName")
                .textContent =
                onlineColor === "b"
                    ? "Bạn • Đen"
                    : "Đối thủ • Đen";
        }
    }


    function updateModeText() {

        if (
            mode === "ai"
        ) {

            $("sideModeText")
                .textContent =
                "Đấu với máy";

        } else if (
            mode === "local"
        ) {

            $("sideModeText")
                .textContent =
                "2 người";

        } else {

            $("sideModeText")
                .textContent =
                "Chơi online";
        }
    }


    /* =========================================================
       LOCAL DRAW
    ========================================================== */

    function requestLocalDraw() {

        if (
            localDrawPending
        ) {
            return;
        }


        localDrawPending =
            true;


        $("drawOverlay")
            .classList
            .remove("hidden");
    }


    function acceptLocalDraw() {

        localDrawPending =
            false;


        $("drawOverlay")
            .classList
            .add("hidden");


        finishLocal(
            "draw",
            null
        );
    }


    function rejectLocalDraw() {

        localDrawPending =
            false;


        $("drawOverlay")
            .classList
            .add("hidden");


        setMessage(
            "Đã từ chối yêu cầu hòa."
        );
    }


    /* =========================================================
       CREATE ROOM
    ========================================================== */

    async function createRoom() {

        const button =
            $("createRoomBtn");


        timeLimit =
            readTimeControl();


        try {

            await ensureFirebase();


            button.disabled =
                true;


            setRoomMessage(
                "⏳ Đang tạo phòng..."
            );


            let code =
                null;

            let reference =
                null;


            for (
                let i = 0;
                i < 20;
                i++
            ) {

                const candidate =
                    generateRoomCode();


                const testRef =
                    db.ref(
                        "rooms/chess/" +
                        candidate
                    );


                const snapshot =
                    await testRef.once(
                        "value"
                    );


                if (
                    !snapshot.exists()
                ) {

                    code =
                        candidate;

                    reference =
                        testRef;

                    break;
                }
            }


            if (
                !reference
            ) {

                throw new Error(
                    "Không tạo được mã phòng."
                );
            }


            const start =
                initialState();


            await reference.set({

                gameName:
                    "chess",

                timeControl:
                    timeLimit,

                status:
                    "waiting",

                hostUid:
                    currentUser.uid,

                whiteUid:
                    currentUser.uid,

                blackUid:
                    null,

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp(),

                game: {

                    status:
                        "waiting",

                    board:
                        start.board,

                    turn:
                        "w",

                    castling:
                        start.castling,

                    enPassant:
                        null,

                    history:
                        [],

                    lastMove:
                        null,

                    clocks: {

                        w:
                            timeLimit,

                        b:
                            timeLimit
                    },

                    turnStartedAt:
                        null,

                    result:
                        null,

                    winner:
                        null,

                    drawOffer:
                        null
                }
            });


            roomId =
                code;


            roomRef =
                reference;


            onlineColor =
                "w";


            onlineJoined =
                true;


            onlineResultShown =
                false;


            $("roomCode")
                .textContent =
                code;


            $("createdRoom")
                .classList
                .remove("hidden");


            $("startBtn")
                .classList
                .add("hidden");


            setRoomMessage(
                "✅ Đã tạo phòng. Gửi mã cho đối thủ."
            );


            listenRoom();


        } catch (error) {

            console.error(
                "CREATE ROOM:",
                error
            );


            setRoomMessage(
                "❌ Không thể tạo phòng: " +
                error.message
            );


        } finally {

            button.disabled =
                false;
        }
    }


    /* =========================================================
       JOIN ROOM
    ========================================================== */

    async function joinRoom() {

        const button =
            $("joinRoomBtn");


        try {

            await ensureFirebase();


            const code =
                $("roomInput")
                    .value
                    .trim()
                    .toUpperCase();


            if (
                !/^[A-Z0-9]{6}$/.test(
                    code
                )
            ) {

                setRoomMessage(
                    "❌ Mã phòng phải gồm 6 ký tự."
                );

                return;
            }


            button.disabled =
                true;


            setRoomMessage(
                "⏳ Đang tìm phòng..."
            );


            const reference =
                db.ref(
                    "rooms/chess/" +
                    code
                );


            const snapshot =
                await reference.once(
                    "value"
                );


            const room =
                snapshot.val();


            console.log(
                "JOIN ROOM:",
                code,
                room
            );


            if (
                !room
            ) {

                setRoomMessage(
                    "❌ Không tìm thấy phòng."
                );

                return;
            }


            if (
                room.status !==
                "waiting"
            ) {

                setRoomMessage(
                    "❌ Phòng đã bắt đầu hoặc đã đóng."
                );

                return;
            }


            if (
                room.hostUid ===
                currentUser.uid
            ) {

                setRoomMessage(
                    "❌ Đây là phòng bạn vừa tạo."
                );

                return;
            }


            if (
                room.blackUid
            ) {

                setRoomMessage(
                    "❌ Phòng đã đủ người."
                );

                return;
            }


            if (
                Number.isFinite(
                    Number(
                        room.timeControl
                    )
                )
            ) {

                timeLimit =
                    Number(
                        room.timeControl
                    );


                $("timeControl")
                    .value =
                    String(
                        timeLimit
                    );
            }


            await reference.update({

                blackUid:
                    currentUser.uid,

                status:
                    "playing",

                "game/status":
                    "playing",

                "game/turnStartedAt":
                    serverTimestamp(),

                "game/clocks/w":
                    timeLimit,

                "game/clocks/b":
                    timeLimit,

                updatedAt:
                    serverTimestamp()
            });


            roomId =
                code;


            roomRef =
                reference;


            onlineColor =
                "b";


            onlineJoined =
                true;


            onlineResultShown =
                false;


            lastRemoteMoveKey =
                null;


            lastDrawKey =
                null;


            setRoomMessage(
                "✅ Đã vào phòng!"
            );


            listenRoom();


        } catch (error) {

            console.error(
                "JOIN ROOM:",
                error
            );


            setRoomMessage(
                "❌ Không thể vào phòng: " +
                error.message
            );


        } finally {

            button.disabled =
                false;
        }
    }


    /* =========================================================
       LISTEN ROOM
    ========================================================== */

    function listenRoom() {

        if (
            !roomRef
        ) {
            return;
        }


        if (
            roomListener
        ) {

            roomListener();

            roomListener =
                null;
        }


        const reference =
            roomRef;


        const callback =
            snapshot => {

                const room =
                    snapshot.val();


                handleRoom(
                    room
                );
            };


        reference.on(
            "value",
            callback
        );


        roomListener =
            () => {

                reference.off(
                    "value",
                    callback
                );
            };
    }


    /* =========================================================
       HANDLE ROOM
    ========================================================== */

    function handleRoom(
        room
    ) {

        if (
            !room
        ) {

            setRoomMessage(
                "❌ Phòng không còn tồn tại."
            );

            return;
        }


        if (
            Number.isFinite(
                Number(
                    room.timeControl
                )
            )
        ) {

            timeLimit =
                Number(
                    room.timeControl
                );
        }


        if (
            currentUser
        ) {

            if (
                room.whiteUid ===
                currentUser.uid
            ) {

                onlineColor =
                    "w";

            } else if (
                room.blackUid ===
                currentUser.uid
            ) {

                onlineColor =
                    "b";
            }
        }


        updatePlayerNames();


        if (
            room.status ===
            "waiting"
        ) {

            $("setup")
                .classList
                .remove("hidden");


            $("game")
                .classList
                .add("hidden");


            $("createdRoom")
                .classList
                .remove("hidden");


            $("roomCode")
                .textContent =
                roomId;


            $("waitingText")
                .textContent =
                "⏳ Đang chờ đối thủ...";


            return;
        }


        if (
            room.status ===
            "playing" ||
            room.status ===
            "finished"
        ) {

            openOnlineGame(
                room
            );

            return;
        }


        if (
            room.status ===
            "closed"
        ) {

            setMessage(
                "Phòng đã đóng."
            );
        }
    }


    /* =========================================================
       OPEN ONLINE
    ========================================================== */

    function openOnlineGame(
        room
    ) {

        $("setup")
            .classList
            .add("hidden");


        $("game")
            .classList
            .remove("hidden");


        $("onlineGameBar")
            .classList
            .remove("hidden");


        $("gameRoomCode")
            .textContent =
            roomId;


        $("createdRoom")
            .classList
            .add("hidden");


        $("startBtn")
            .classList
            .add("hidden");


        updateModeText();

        updatePlayerNames();


        if (
            room.game
        ) {

            applyOnlineGame(
                room.game
            );
        }
    }


    /* =========================================================
       APPLY ONLINE GAME
    ========================================================== */
    function applyOnlineGame(
    remote
) {

    if (
        !remote
    ) {
        return;
    }


    /* =====================================================
       CLOCK
    ====================================================== */

    const remoteWhite =
        Number(
            remote.clocks?.w
        );

    const remoteBlack =
        Number(
            remote.clocks?.b
        );


    if (
        Number.isFinite(remoteWhite) &&
        Number.isFinite(remoteBlack)
    ) {

        clocks = {

            w:
                Math.max(
                    0,
                    remoteWhite
                ),

            b:
                Math.max(
                    0,
                    remoteBlack
                )

        };

    } else {

        console.warn(
            "⚠️ Clock Firebase không hợp lệ:",
            remote.clocks
        );

        return;
    }


    /* =====================================================
       BOARD
       Firebase có thể trả array thành object.
       Phải khôi phục đúng thứ tự 0 → 63.
    ====================================================== */

    let remoteBoard;


    if (
        Array.isArray(
            remote.board
        )
    ) {

        remoteBoard =
            remote.board.slice();

    } else if (
        remote.board &&
        typeof remote.board === "object"
    ) {

        remoteBoard =
            new Array(64).fill(null);


        Object.keys(
            remote.board
        )
        .forEach(
            key => {

                const index =
                    Number(key);


                if (
                    Number.isInteger(index) &&
                    index >= 0 &&
                    index < 64
                ) {

                    remoteBoard[index] =
                        remote.board[key];
                }
            }
        );

    } else {

        console.error(
            "❌ Board Firebase không hợp lệ:",
            remote.board
        );

        return;
    }


    if (
        remoteBoard.length !== 64
    ) {

        console.error(
            "❌ Board phải có đúng 64 ô:",
            remoteBoard
        );

        return;
    }


    /* =====================================================
       STATE
    ====================================================== */

    state = {

        board:
            remoteBoard,

        turn:
            remote.turn === "b"
                ? "b"
                : "w",

        castling:
            remote.castling || {

                wK: false,
                wQ: false,
                bK: false,
                bQ: false

            },

        enPassant:
            remote.enPassant ?? null

    };


    /* =====================================================
       HISTORY
    ====================================================== */

    history =
        Array.isArray(
            remote.history
        )
            ? remote.history
            : [];


    lastMove =
        remote.lastMove ||
        null;


    onlineTurnStartedAt =
        Number(
            remote.turnStartedAt
        ) || null;


    /* =====================================================
       START ONLINE GAME
    ====================================================== */

    if (
        !gameStarted
    ) {

        gameStarted =
            true;

        gameFinished =
            false;

        selected =
            null;

        trackStart();
    }


    /* =====================================================
       REMOTE MOVE SOUND
    ====================================================== */

    if (
        remote.lastMove
    ) {

        const moveKey =
            history.length +
            ":" +
            remote.lastMove.from +
            ":" +
            remote.lastMove.to;


        if (
            moveKey !==
            lastRemoteMoveKey
        ) {

            lastRemoteMoveKey =
                moveKey;


            if (
                history.length > 0
            ) {

                soundMove();
            }
        }
    }


    /* =====================================================
       DRAW
    ====================================================== */

    processDrawOffer(
        remote.drawOffer
    );


    /* =====================================================
       FINISHED
    ====================================================== */

    if (
        remote.status ===
        "finished"
    ) {

        gameFinished =
            true;

        stopClock();

        render();

        showOnlineResult(
            remote.result,
            remote.winner
        );

        return;
    }


    gameFinished =
        false;


    startClock();

    updateOnlineMessage();

    render();
}


    /* =========================================================
       ONLINE MESSAGE
    ========================================================== */

    function updateOnlineMessage() {

        if (
            !state
        ) {
            return;
        }


        if (
            state.turn ===
            onlineColor
        ) {

            setMessage(
                "🟢 Đến lượt bạn."
            );

        } else {

            setMessage(
                "🟡 Đang chờ đối thủ đi..."
            );
        }
    }


    /* =========================================================
       ONLINE INPUT
    ========================================================== */

    function handleOnlineSquare(
        index
    ) {

        if (
            !onlineJoined ||
            !state ||
            gameFinished
        ) {

            return;
        }


        if (
            state.turn !==
            onlineColor
        ) {

            setMessage(
                "Chưa đến lượt bạn."
            );

            return;
        }


        const piece =
            state.board[index];


        if (
            selected !== null
        ) {

            const move =
                Chess
                    .legalMovesFrom(
                        state,
                        selected
                    )
                    .find(
                        item =>
                            item.to ===
                            index
                    );


            if (
                move
            ) {

                sendOnlineMove(
                    move
                );

                return;
            }
        }


        if (
            piece &&
            piece.c ===
                onlineColor
        ) {

            selected =
                index;


            soundClick();


            render();


            return;
        }


        selected =
            null;


        render();
    }


    /* =========================================================
       SEND ONLINE MOVE
    ========================================================== */
    async function sendOnlineMove(
    move
) {

    if (
        onlineMoveBusy ||
        !roomRef ||
        !state ||
        gameFinished
    ) {

        return;
    }


    if (
        state.turn !==
        onlineColor
    ) {

        return;
    }


    onlineMoveBusy =
        true;


    try {

        /* =================================================
           KIỂM TRA THỜI GIAN
        ================================================== */

        const remaining =
            getOnlineRemaining(
                state.turn
            );


        if (
            timeLimit > 0 &&
            remaining <= 0
        ) {

            await publishOnlineFinish(
                "time",
                opposite(
                    state.turn
                )
            );

            return;
        }


        /* =================================================
           SNAPSHOT TRẠNG THÁI HIỆN TẠI
        ================================================== */

        const current = {

            board:
                state.board,

            turn:
                state.turn,

            castling:
                state.castling,

            enPassant:
                state.enPassant

        };


        /* =================================================
           KIỂM TRA LẠI NƯỚC ĐI
        ================================================== */

        const legal =
            Chess.legalMovesFrom(
                current,
                move.from
            );


        const valid =
            legal.find(
                item =>
                    item.to ===
                        move.to &&

                    (
                        item.promotion ||
                        null
                    ) ===
                    (
                        move.promotion ||
                        null
                    )
            );


        if (
            !valid
        ) {

            console.warn(
                "⚠️ Nước đi không hợp lệ:",
                move
            );

            return;
        }


        /* =================================================
           GHI CHÚ NƯỚC ĐI
        ================================================== */

        const notation =
            moveText(
                current,
                valid
            );


        /* =================================================
           APPLY MOVE

           Dùng TRỰC TIẾP current.
           Không Object.values().
           Không tự chuyển board.
        ================================================== */

        const next =
            Chess.applyMove(
                current,
                valid
            );


        if (
            !next ||
            !Array.isArray(next.board) ||
            next.board.length !== 64
        ) {

            console.error(
                "❌ ChessCore trả về state không hợp lệ:",
                next
            );

            throw new Error(
                "Trạng thái bàn cờ sau nước đi không hợp lệ."
            );
        }


        /* =================================================
           HISTORY
        ================================================== */

        const newHistory =
            [
                ...history,
                notation
            ];


        /* =================================================
           CHECK END
        ================================================== */

        const end =
            checkEnd(
                next
            );


        /* =================================================
           CLOCK

           Giữ nguyên thời gian còn lại của người
           vừa đi.
        ================================================== */

        const newClocks = {

            w:
                Math.max(
                    0,
                    Number(
                        clocks.w
                    ) || 0
                ),

            b:
                Math.max(
                    0,
                    Number(
                        clocks.b
                    ) || 0
                )

        };


        if (
            timeLimit > 0
        ) {

            newClocks[
                current.turn
            ] =
                Math.max(
                    0,
                    remaining
                );
        }


        /* =================================================
           GỬI NƯỚC ĐI FIREBASE
        ================================================== */

        if (!firebaseDatabaseRaw || !databaseApi?.ref || !databaseApi?.update) {
            throw new Error("Firebase Database chưa sẵn sàng để gửi nước đi.");
        }

        const gameRef =
            databaseApi.ref(
                firebaseDatabaseRaw,
                `rooms/chess/${roomId}/game`
            );

        await databaseApi.update(
            gameRef,
            {
                status:
                    end
                        ? "finished"
                        : "playing",

                board:
                    next.board,

                turn:
                    next.turn,

                castling:
                    next.castling,

                enPassant:
                    next.enPassant,

                history:
                    newHistory,

                lastMove: {

                    from:
                        valid.from,

                    to:
                        valid.to
                },

                clocks:
                    newClocks,

                turnStartedAt:
                    end
                        ? null
                        : serverTimestamp(),

                result:
                    end
                        ? end.reason
                        : null,

                winner:
                    end
                        ? end.winner
                        : null,

                drawOffer:
                    null,

                updatedAt:
                    serverTimestamp()
            }
        );


        /* =================================================
           XÓA QUÂN ĐANG CHỌN
        ================================================== */

        selected =
            null;


    } catch (error) {

        console.error(
            "ONLINE MOVE:",
            error
        );

        const code =
            error?.code
                ? ` [${error.code}]`
                : "";

        const detail =
            error?.message
                ? ` ${error.message}`
                : "";

        setMessage(
            `❌ Không thể gửi nước đi.${code}${detail}`
        );

    } finally {

        onlineMoveBusy =
            false;
    }
}


    /* =========================================================
       DRAW ONLINE
    ========================================================== */

    async function requestOnlineDraw() {

        if (
            !roomRef ||
            !state ||
            gameFinished ||
            drawBusy
        ) {

            return;
        }


        drawBusy =
            true;


        try {

            const snapshot =
                await roomRef
                    .child("game")
                    .once("value");


            const game =
                snapshot.val();


            if (
                !game ||
                game.status !==
                    "playing"
            ) {

                return;
            }


            if (
                game.drawOffer
            ) {

                setMessage(
                    "Đang có yêu cầu hòa."
                );

                return;
            }


            await roomRef
                .child("game/drawOffer")
                .set({

                    uid:
                        currentUser.uid,

                    from:
                        onlineColor,

                    timestamp:
                        serverTimestamp()
                });


            setMessage(
                "🤝 Đã gửi yêu cầu hòa."
            );


        } catch (error) {

            console.error(
                "DRAW:",
                error
            );


            setMessage(
                "❌ Không thể gửi yêu cầu hòa."
            );


        } finally {

            drawBusy =
                false;
        }
    }


    function processDrawOffer(
        offer
    ) {

        if (
            !offer
        ) {

            $("drawOverlay")
                .classList
                .add("hidden");

            return;
        }


        if (
            offer.from ===
            onlineColor
        ) {

            setMessage(
                "🤝 Đang chờ đối thủ trả lời yêu cầu hòa."
            );

            return;
        }


        const key =
            String(
                offer.uid
            ) +
            "-" +
            String(
                offer.timestamp
            );


        if (
            key ===
            lastDrawKey
        ) {

            return;
        }


        lastDrawKey =
            key;


        $("drawOverlay")
            .classList
            .remove("hidden");
    }


    async function respondOnlineDraw(
        accept
    ) {

        if (
            !roomRef ||
            drawBusy
        ) {

            return;
        }


        drawBusy =
            true;


        try {

            const snapshot =
                await roomRef
                    .child("game")
                    .once("value");


            const game =
                snapshot.val();


            if (
                !game ||
                !game.drawOffer
            ) {

                $("drawOverlay")
                    .classList
                    .add("hidden");

                return;
            }


            if (
                game.drawOffer.from ===
                onlineColor
            ) {

                return;
            }


            if (
                accept
            ) {

                await roomRef
                    .child("game")
                    .update({

                        status:
                            "finished",

                        result:
                            "draw",

                        winner:
                            null,

                        drawOffer:
                            null,

                        turnStartedAt:
                            null,

                        updatedAt:
                            serverTimestamp()
                    });

            } else {

                await roomRef
                    .child(
                        "game/drawOffer"
                    )
                    .remove();


                setMessage(
                    "Đã từ chối yêu cầu hòa."
                );
            }


            $("drawOverlay")
                .classList
                .add("hidden");


        } catch (error) {

            console.error(
                "DRAW RESPONSE:",
                error
            );

        } finally {

            drawBusy =
                false;
        }
    }


    /* =========================================================
       ONLINE FINISH
    ========================================================== */

    async function publishOnlineFinish(
        reason,
        winner
    ) {

        if (
            !roomRef
        ) {
            return;
        }


        try {

            await roomRef
                .child("game")
                .update({

                    status:
                        "finished",

                    result:
                        reason,

                    winner:
                        winner,

                    drawOffer:
                        null,

                    turnStartedAt:
                        null,

                    updatedAt:
                        serverTimestamp()
                });

        } catch (error) {

            console.error(
                "ONLINE FINISH:",
                error
            );
        }
    }


    /* =========================================================
       ONLINE RESULT
    ========================================================== */

    async function showOnlineResult(
        reason,
        winner
    ) {

        if (
            onlineResultShown
        ) {

            return;
        }


        onlineResultShown =
            true;


        let title =
            "Hòa cờ";


        let text =
            "Ván cờ kết thúc với kết quả hòa.";


        let icon =
            "🤝";


        let analyticsResult =
            "draw";


        if (
            reason ===
            "checkmate"
        ) {

            title =
                "Chiếu hết!";


            icon =
                "♛";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng.";


            analyticsResult =
                winner ===
                    onlineColor
                    ? "win"
                    : "loss";


        } else if (
            reason ===
            "time"
        ) {

            title =
                "Hết giờ!";


            icon =
                "⏱️";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng do đối thủ hết thời gian.";


            analyticsResult =
                winner ===
                    onlineColor
                    ? "win"
                    : "loss";


        } else if (
            reason ===
            "resign"
        ) {

            title =
                "Xin thua";


            icon =
                "🏳️";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng.";


            analyticsResult =
                winner ===
                    onlineColor
                    ? "win"
                    : "loss";
        }


        if (
            analyticsResult ===
            "win"
        ) {

            soundWin();

        } else if (
            analyticsResult ===
            "loss"
        ) {

            soundLose();
        }


        $("resultIcon")
            .textContent =
            icon;


        $("resultTitle")
            .textContent =
            title;


        $("resultText")
            .textContent =
            text;


        $("drawOverlay")
            .classList
            .add("hidden");


        $("resultOverlay")
            .classList
            .remove("hidden");


        await trackEnd(
            analyticsResult,
            winner
        );
    }


    /* =========================================================
       LOCAL FINISH
    ========================================================== */

    async function finishLocal(
        reason,
        winner
    ) {

        if (
            gameFinished
        ) {

            return;
        }


        gameFinished =
            true;


        stopClock();


        let title =
            "Hòa cờ";


        let text =
            "Ván cờ hòa.";


        let icon =
            "🤝";


        let result =
            "draw";


        if (
            reason ===
            "checkmate"
        ) {

            title =
                "Chiếu hết!";


            icon =
                "♛";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng.";


            if (
                mode === "ai"
            ) {

                result =
                    winner === "w"
                        ? "win"
                        : "loss";

            } else {

                result =
                    "win";
            }


            soundCheckmate();


        } else if (
            reason ===
            "time"
        ) {

            title =
                "Hết giờ!";


            icon =
                "⏱️";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng.";


            if (
                mode === "ai"
            ) {

                result =
                    winner === "w"
                        ? "win"
                        : "loss";

            } else {

                result =
                    "win";
            }


        } else if (
            reason ===
            "resign"
        ) {

            title =
                "Xin thua";


            icon =
                "🏳️";


            text =
                (
                    winner === "w"
                        ? "Trắng"
                        : "Đen"
                ) +
                " thắng.";


            if (
                mode === "ai"
            ) {

                result =
                    winner === "w"
                        ? "win"
                        : "loss";

            } else {

                result =
                    "win";
            }
        }


        if (
            result ===
            "win"
        ) {

            soundWin();

        } else if (
            result ===
            "loss"
        ) {

            soundLose();
        }


        $("resultIcon")
            .textContent =
            icon;


        $("resultTitle")
            .textContent =
            title;


        $("resultText")
            .textContent =
            text;


        $("resultOverlay")
            .classList
            .remove("hidden");


        await trackEnd(
            result,
            winner
        );
    }


    /* =========================================================
       RESIGN ONLINE
    ========================================================== */

    async function resignOnline() {

        if (
            !roomRef ||
            gameFinished
        ) {

            return;
        }


        await publishOnlineFinish(
            "resign",
            opposite(
                onlineColor
            )
        );
    }


    /* =========================================================
       LEAVE ROOM
    ========================================================== */

    async function leaveRoom() {

        if (
            matching ||
            matchingBusy
        ) {

            await cancelRandomMatch();
        }


        stopClock();


        if (
            roomListener
        ) {

            roomListener();

            roomListener =
                null;
        }


        const reference =
            roomRef;


        roomRef =
            null;


        if (
            reference &&
            currentUser
        ) {

            try {

                const snapshot =
                    await reference.once(
                        "value"
                    );


                const room =
                    snapshot.val();


                if (
                    room
                ) {

                    if (
                        room.hostUid ===
                        currentUser.uid
                    ) {

                        await reference.update({

                            status:
                                "closed",

                            updatedAt:
                                serverTimestamp()

                        });

                    } else {

                        await reference.update({

                            blackUid:
                                null,

                            status:
                                "waiting",

                            "game/status":
                                "waiting",

                            "game/turnStartedAt":
                                null,

                            "game/drawOffer":
                                null,

                            updatedAt:
                                serverTimestamp()
                        });
                    }
                }

            } catch (error) {

                console.warn(
                    "Leave room:",
                    error
                );
            }
        }


        roomId =
            null;


        onlineColor =
            null;


        onlineJoined =
            false;


        onlineTurnStartedAt =
            null;


        gameStarted =
            false;


        gameFinished =
            false;


        state =
            null;


        history =
            [];


        selected =
            null;


        lastMove =
            null;


        $("game")
            .classList
            .add("hidden");


        $("setup")
            .classList
            .remove("hidden");


        $("onlineGameBar")
            .classList
            .add("hidden");


        $("createdRoom")
            .classList
            .add("hidden");


        $("resultOverlay")
            .classList
            .add("hidden");


        $("drawOverlay")
            .classList
            .add("hidden");


        $("startBtn")
            .classList
            .remove("hidden");


        setRoomMessage(
            "Đã rời phòng."
        );
    }


    /* =========================================================
   AI ENGINE
========================================================= */

const VALUES = {

    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000

};


/*
 * Điểm vị trí.
 *
 * Bàn cờ:
 *
 * 0  1  2  3  4  5  6  7
 * a8 b8 c8 d8 e8 f8 g8 h8
 *
 * AI là Đen nên sẽ đảo bảng khi đánh giá vị trí.
 */

const PST = {

    p: [
         0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0
    ],

    n: [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ],

    b: [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20
    ],

    r: [
         0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0
    ],

    q: [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
         -5,  0,  5,  5,  5,  5,  0, -5,
          0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20
    ],

    k: [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
         20, 20,  0,  0,  0,  0, 20, 20,
         20, 30, 10,  0,  0, 10, 30, 20
    ]

};


/* =========================================================
   AI THINKING
========================================================= */

function aiMove() {

    if (
        aiThinking ||
        gameFinished ||
        mode !== "ai" ||
        !state ||
        state.turn !== "b"
    ) {
        return;
    }


    aiThinking = true;


    setMessage(
        "🤖 Máy đang suy nghĩ..."
    );


    /*
     * Độ sâu theo difficulty.
     *
     * easy    = random
     * medium  = nhìn 2 ply
     * hard    = nhìn 3 ply
     * extreme = nhìn 4 ply
     */

    const depthMap = {

        easy: 0,

        medium: 2,

        hard: 3,

        extreme: 4

    };


    const depth =
        depthMap[difficulty] ?? 2;


    const delay =
        difficulty === "extreme"
            ? 900
            : difficulty === "hard"
                ? 650
                : 350;


    setTimeout(
        () => {

            try {

                if (
                    gameFinished ||
                    mode !== "ai" ||
                    !state ||
                    state.turn !== "b"
                ) {

                    return;
                }


                const legal =
                    Chess.legalMoves(
                        state
                    );


                if (
                    legal.length === 0
                ) {

                    return;
                }


                let move;


                /*
                 * EASY
                 *
                 * Hoàn toàn ngẫu nhiên.
                 * Không tối ưu.
                 */

                if (
                    difficulty === "easy"
                ) {

                    move =
                        legal[
                            Math.floor(
                                Math.random() *
                                legal.length
                            )
                        ];

                } else {

                    move =
                        searchBestMove(
                            state,
                            legal,
                            depth
                        );
                }


                if (
                    move
                ) {

                    makeLocalMove(
                        move
                    );
                }

            } finally {

                aiThinking =
                    false;
            }

        },
        delay
    );
}


/* =========================================================
   SEARCH
========================================================= */

function searchBestMove(
    rootState,
    legal,
    depth
) {

    let bestMove =
        legal[0];


    let bestScore =
        -Infinity;


    /*
     * Đảo thứ tự nước đi để AI
     * xét nước ăn / chiếu trước.
     */

    const ordered =
        orderMoves(
            rootState,
            legal
        );


    for (
        const move of ordered
    ) {

        const next =
            Chess.applyMove(
                rootState,
                move
            );


        if (
            !next
        ) {
            continue;
        }


        const score =
            minimax(
                next,
                depth - 1,
                -Infinity,
                Infinity
            );


        if (
            score > bestScore
        ) {

            bestScore =
                score;

            bestMove =
                move;

        }

    }


    return bestMove;
}


/* =========================================================
   MINIMAX + ALPHA BETA
========================================================= */

function minimax(
    currentState,
    depth,
    alpha,
    beta
) {

    const legal =
        Chess.legalMoves(
            currentState
        );


    /*
     * CHECKMATE / STALEMATE
     */

    if (
        legal.length === 0
    ) {

        if (
            Chess.inCheck(
                currentState.board,
                currentState.turn
            )
        ) {

            /*
             * Nếu Đen bị chiếu hết:
             * điểm cực thấp.
             *
             * Nếu Trắng bị chiếu hết:
             * điểm cực cao.
             */

            return currentState.turn === "b"
                ? -1000000 - depth
                : 1000000 + depth;
        }


        return 0;
    }


    /*
     * Đạt độ sâu.
     */

    if (
        depth <= 0
    ) {

        return evaluatePosition(
            currentState
        );
    }


    const ordered =
        orderMoves(
            currentState,
            legal
        );


    /*
     * ĐEN = MAX
     */

    if (
        currentState.turn === "b"
    ) {

        let value =
            -Infinity;


        for (
            const move of ordered
        ) {

            const next =
                Chess.applyMove(
                    currentState,
                    move
                );


            if (
                !next
            ) {
                continue;
            }


            value =
                Math.max(
                    value,
                    minimax(
                        next,
                        depth - 1,
                        alpha,
                        beta
                    )
                );


            alpha =
                Math.max(
                    alpha,
                    value
                );


            if (
                alpha >= beta
            ) {

                break;
            }
        }


        return value;
    }


    /*
     * TRẮNG = MIN
     */

    let value =
        Infinity;


    for (
        const move of ordered
    ) {

        const next =
            Chess.applyMove(
                currentState,
                move
            );


        if (
            !next
        ) {
            continue;
        }


        value =
            Math.min(
                value,
                minimax(
                    next,
                    depth - 1,
                    alpha,
                    beta
                )
            );


        beta =
            Math.min(
                beta,
                value
            );


        if (
            alpha >= beta
        ) {

            break;
        }
    }


    return value;
}


/* =========================================================
   MOVE ORDERING
========================================================= */

function orderMoves(
    currentState,
    moves
) {

    return moves
        .map(
            move => {

                let score = 0;


                const target =
                    currentState.board[
                        move.to
                    ];


                /*
                 * Ăn quân.
                 */

                if (
                    target
                ) {

                    score +=
                        10000 +
                        (
                            VALUES[
                                target.t
                            ] || 0
                        ) * 10;

                }


                /*
                 * En passant.
                 */

                if (
                    move.enPassant
                ) {

                    score +=
                        10500;
                }


                /*
                 * Phong cấp.
                 */

                if (
                    move.promotion
                ) {

                    score +=
                        9000;
                }


                /*
                 * Nhập thành.
                 */

                if (
                    move.castle
                ) {

                    score +=
                        300;
                }


                /*
                 * Kiểm tra xem nước đi
                 * có chiếu vua đối thủ không.
                 */

                const next =
                    Chess.applyMove(
                        currentState,
                        move
                    );


                if (
                    next &&
                    Chess.inCheck(
                        next.board,
                        next.turn
                    )
                ) {

                    score +=
                        5000;
                }


                /*
                 * Ưu tiên trung tâm.
                 */

                const r =
                    row(move.to);

                const c =
                    col(move.to);


                if (
                    (
                        r === 3 ||
                        r === 4
                    ) &&
                    (
                        c === 3 ||
                        c === 4
                    )
                ) {

                    score +=
                        150;
                }


                /*
                 * Một chút ngẫu nhiên để
                 * các nước bằng điểm không
                 * luôn giống hệt nhau.
                 */

                score +=
                    Math.random() * 0.5;


                return {
                    move,
                    score
                };

            }
        )
        .sort(
            (
                a,
                b
            ) =>
                b.score -
                a.score
        )
        .map(
            item =>
                item.move
        );
}


/* =========================================================
   POSITION EVALUATION
========================================================= */

function evaluatePosition(
    current
) {

    let score =
        0;


    let whiteMaterial =
        0;


    let blackMaterial =
        0;


    for (
        let i = 0;
        i < 64;
        i++
    ) {

        const piece =
            current.board[i];


        if (
            !piece
        ) {
            continue;
        }


        const value =
            VALUES[
                piece.t
            ] || 0;


        /*
         * Material.
         */

        if (
            piece.c === "b"
        ) {

            blackMaterial +=
                value;

        } else {

            whiteMaterial +=
                value;
        }


        /*
         * Piece-square table.
         */

        const table =
            PST[
                piece.t
            ];


        if (
            table
        ) {

            /*
             * PST được viết theo
             * góc nhìn Trắng.
             *
             * Đen phải đảo index.
             */

            const pstIndex =
                piece.c === "w"
                    ? i
                    : 63 - i;


            const positionValue =
                table[
                    pstIndex
                ] || 0;


            if (
                piece.c === "b"
            ) {

                score +=
                    positionValue;

            } else {

                score -=
                    positionValue;
            }
        }
    }


    /*
     * Material là yếu tố chính.
     */

    score +=
        blackMaterial -
        whiteMaterial;


    /*
     * MOBILITY
     *
     * Quân có nhiều nước đi hơn
     * thường có vị trí linh hoạt hơn.
     */

    let blackMobility =
        0;


    let whiteMobility =
        0;


    const blackState = {

        ...current,

        turn: "b"

    };


    const whiteState = {

        ...current,

        turn: "w"

    };


    blackMobility =
        Chess.legalMoves(
            blackState
        ).length;


    whiteMobility =
        Chess.legalMoves(
            whiteState
        ).length;


    score +=
        (
            blackMobility -
            whiteMobility
        ) * 3;


    /*
     * KIỂM TRA.
     */

    if (
        Chess.inCheck(
            current.board,
            "w"
        )
    ) {

        score +=
            60;
    }


    if (
        Chess.inCheck(
            current.board,
            "b"
        )
    ) {

        score -=
            60;
    }


    return score;
}



    /* =========================================================
       BUTTON EVENTS
    ========================================================== */

    $("startBtn")
        ?.addEventListener(
            "click",
            () => {

                startLocalGame();
            }
        );


    document
        .querySelectorAll(
            ".mode-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        /*
                         * Nếu đang tìm trận mà chuyển
                         * sang chế độ khác thì tự hủy.
                         */

                        if (
                            mode === "online" &&
                            button.dataset.mode !== "online" &&
                            (
                                matching ||
                                matchingBusy
                            )
                        ) {

                            cancelRandomMatch();
                        }


                        mode =
                            button.dataset.mode;


                        document
                            .querySelectorAll(
                                ".mode-btn"
                            )
                            .forEach(
                                item => {

                                    item.classList
                                        .remove(
                                            "active"
                                        );
                                }
                            );


                        button.classList
                            .add(
                                "active"
                            );


                        $("difficultyWrap")
                            .classList
                            .toggle(
                                "hidden",
                                mode !== "ai"
                            );


                        $("onlinePanel")
                            .classList
                            .toggle(
                                "hidden",
                                mode !== "online"
                            );


                        $("startBtn")
                            .classList
                            .toggle(
                                "hidden",
                                mode === "online"
                            );


                        updateModeText();
                    }
                );
            }
        );


    $("difficulty")
        ?.addEventListener(
            "change",
            event => {

                difficulty =
                    event.target.value;
            }
        );


    $("timeControl")
        ?.addEventListener(
            "change",
            event => {

                const value =
                    Number(
                        event.target.value
                    );


                timeLimit =
                    Number.isFinite(
                        value
                    )
                        ? Math.max(
                            0,
                            value
                        )
                        : 300;


                console.log(
                    "Chess time:",
                    timeLimit
                );
            }
        );


    $("createRoomBtn")
        ?.addEventListener(
            "click",
            createRoom
        );


    $("joinRoomBtn")
        ?.addEventListener(
            "click",
            joinRoom
        );


    $("randomMatchBtn")
        ?.addEventListener(
            "click",
            startRandomMatch
        );


    $("cancelMatchBtn")
        ?.addEventListener(
            "click",
            cancelRandomMatch
        );


    $("roomInput")
        ?.addEventListener(
            "input",
            event => {

                event.target.value =
                    event.target.value
                        .replace(
                            /[^a-zA-Z0-9]/g,
                            ""
                        )
                        .toUpperCase()
                        .slice(
                            0,
                            6
                        );
            }
        );


    $("roomInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    joinRoom();
                }
            }
        );


    $("copyRoomBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (
                    !roomId
                ) {
                    return;
                }


                try {

                    await navigator
                        .clipboard
                        .writeText(
                            roomId
                        );


                    setRoomMessage(
                        "✅ Đã copy mã phòng."
                    );

                } catch {

                    setRoomMessage(
                        "Mã phòng: " +
                        roomId
                    );
                }
            }
        );


    $("copyGameRoomBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (
                    !roomId
                ) {
                    return;
                }


                try {

                    await navigator
                        .clipboard
                        .writeText(
                            roomId
                        );


                    setMessage(
                        "✅ Đã copy mã phòng."
                    );

                } catch {

                    setMessage(
                        "Mã phòng: " +
                        roomId
                    );
                }
            }
        );


    $("leaveWaitingBtn")
        ?.addEventListener(
            "click",
            leaveRoom
        );


    $("leaveOnlineBtn")
        ?.addEventListener(
            "click",
            leaveRoom
        );


    $("drawBtn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    !gameStarted ||
                    gameFinished
                ) {
                    return;
                }


                if (
                    mode === "ai"
                ) {

                    setMessage(
                        "Không thể xin hòa khi đấu với máy."
                    );

                    return;
                }


                if (
                    mode === "local"
                ) {

                    requestLocalDraw();

                } else {

                    requestOnlineDraw();
                }
            }
        );


    $("acceptDrawBtn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    mode === "online"
                ) {

                    respondOnlineDraw(
                        true
                    );

                } else {

                    acceptLocalDraw();
                }
            }
        );


    $("rejectDrawBtn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    mode === "online"
                ) {

                    respondOnlineDraw(
                        false
                    );

                } else {

                    rejectLocalDraw();
                }
            }
        );


    $("resignBtn")
        ?.addEventListener(
            "click",
            () => {

                if (
                    !gameStarted ||
                    gameFinished
                ) {
                    return;
                }


                if (
                    mode === "online"
                ) {

                    resignOnline();

                } else {

                    finishLocal(
                        "resign",
                        opposite(
                            state.turn
                        )
                    );
                }
            }
        );


    $("flipBtn")
        ?.addEventListener(
            "click",
            () => {

                flipped =
                    !flipped;


                soundClick();


                render();
            }
        );


    $("newGameTop")
        ?.addEventListener(
            "click",
            () => {

                if (
                    mode === "online"
                ) {

                    setMessage(
                        "Ván online hiện tại đang trong phòng."
                    );

                    return;
                }


                startLocalGame();
            }
        );


    /* =========================================================
       REPLAY
    ========================================================== */

    $("replayBtn")
        ?.addEventListener(
            "click",
            async () => {

                $("resultOverlay")
                    .classList
                    .add("hidden");


                if (
                    mode !== "online"
                ) {

                    startLocalGame();

                    return;
                }


                if (
                    onlineColor !== "w"
                ) {

                    setMessage(
                        "Chỉ chủ phòng có thể bắt đầu ván mới."
                    );

                    return;
                }


                if (
                    !roomRef
                ) {
                    return;
                }


                const start =
                    initialState();


                await roomRef
                    .child("game")
                    .set({

                        status:
                            "playing",

                        board:
                            start.board,

                        turn:
                            "w",

                        castling:
                            start.castling,

                        enPassant:
                            null,

                        history:
                            [],

                        lastMove:
                            null,

                        clocks: {

                            w:
                                timeLimit,

                            b:
                                timeLimit

                        },

                        turnStartedAt:
                            serverTimestamp(),

                        result:
                            null,

                        winner:
                            null,

                        drawOffer:
                            null
                    });


                onlineResultShown =
                    false;
            }
        );


    /* =========================================================
       MENU
    ========================================================== */

    async function goMenu() {

        if (
            roomRef
        ) {

            await leaveRoom();
        }


        location.href =
            "../../index.html";
    }


    $("menuBtn")
        ?.addEventListener(
            "click",
            goMenu
        );


    $("backMenuBtn")
        ?.addEventListener(
            "click",
            goMenu
        );


    /* =========================================================
       INIT
    ========================================================== */

    async function init() {

        try {

            await ensureFirebase();


            updatePlayerNames();

            updateModeText();


            timeLimit =
                readTimeControl();


            updateClockUI();


            console.log(
                "================================"
            );


            console.log(
                "♟️ CHESS READY"
            );


            console.log(
                "UID:",
                currentUser?.uid
            );


            console.log(
                "Time:",
                timeLimit
            );


            console.log(
                "Random Match Time:",
                RANDOM_MATCH_TIME,
                "seconds = 10 minutes"
            );


            console.log(
                "================================"
            );


        } catch (error) {

            console.error(
                "Chess init:",
                error
            );
        }
    }


    init();

})();
