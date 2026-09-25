/* =========================================================
   FLAPPY BIRD — MAX PERFORMANCE + GAMEHUB
   ---------------------------------------------------------
   - Canvas background cache
   - Pipe object pooling
   - Không tạo object trong game loop
   - Không splice array trong game loop
   - Audio Web Audio API
   - Audio decode/preload một lần
   - Không cloneNode()
   - Không setTimeout()
   - DPR giới hạn
   - Delta time ổn định
   - R = restart
   - Space / Touch = flap

   GAMEHUB:
   - Firebase presence
   - Daily player
   - Game start
   - Game end
   - Score tracking
========================================================= */

(() => {
    "use strict";


    /* =====================================================
       DOM
    ===================================================== */

    const canvas =
        document.getElementById("gameCanvas");

    const ctx =
        canvas.getContext("2d", {
            alpha: false,
            desynchronized: true
        });


    const startScreen =
        document.getElementById("startScreen");

    const gameOverScreen =
        document.getElementById("gameOverScreen");

    const startButton =
        document.getElementById("startButton");

    const restartButton =
        document.getElementById("restartButton");

    const backButton =
        document.getElementById("backButton");

    const backMenuButton =
        document.getElementById("backMenuButton");

    const gameOverMenuButton =
        document.getElementById(
            "gameOverMenuButton"
        );


    const scoreElement =
        document.getElementById("score");

    const highScoreElement =
        document.getElementById("highScore");

    const finalScoreElement =
        document.getElementById("finalScore");

    const finalHighScoreElement =
        document.getElementById(
            "finalHighScore"
      
        );
    // ==========================================
// FLAPPY PROFILE + FIREBASE LEADERBOARD
// ==========================================

let leaderboardDatabase = null;
let leaderboardAuth = null;
let leaderboardLoaded = false;
let leaderboardFirebaseReady = null;
let leaderboardAuthReady = null;

let leaderboardPlayers = [];
let leaderboardExpanded = false;

let currentUsername = "Người chơi";

/* =====================================================
   TienHub Firebase — MODULAR ONLY
   -----------------------------------------------------
   Flappy uses the exact Auth + Database instances
   exported by src/core/firebase.js.

   Không initialize Firebase lần nữa.
   Không tạo anonymous user.
===================================================== */

async function initFlappyFirebase() {
    if (leaderboardFirebaseReady) {
        return leaderboardFirebaseReady;
    }

    leaderboardFirebaseReady = (async () => {
        const core = await import("../../src/core/firebase.js");

        const databaseApi = await import(
            "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
        );

        leaderboardAuth = core.auth;
        leaderboardDatabase = core.db;

        if (!leaderboardAuth || !leaderboardDatabase) {
            throw new Error(
                "Không lấy được Firebase Auth/Database của TienHub."
            );
        }

        const {
            ref,
            get,
            set,
            query,
            orderByChild
        } = databaseApi;

        // Firebase Auth LOCAL persistence is set by TienHub login.
        // authStateReady() waits for Safari to finish restoring it.
        leaderboardAuthReady = (async () => {
            if (
                typeof leaderboardAuth.authStateReady ===
                "function"
            ) {
                await leaderboardAuth.authStateReady();
            }

            return leaderboardAuth.currentUser || null;
        })();

        return {
            ref,
            get,
            set,
            query,
            orderByChild
        };
    })();

    try {
        return await leaderboardFirebaseReady;
    } catch (error) {
        leaderboardFirebaseReady = null;
        leaderboardAuthReady = null;
        leaderboardAuth = null;
        leaderboardDatabase = null;
        throw error;
    }
}

async function getFlappyAuthUser() {
    await initFlappyFirebase();

    if (leaderboardAuthReady) {
        await leaderboardAuthReady;
    }

    const user = leaderboardAuth?.currentUser || null;

    if (user && !user.isAnonymous) {
        return user;
    }

    return null;
}

async function ensureFlappyUserRecord(user, username) {
    if (!user || user.isAnonymous) {
        throw new Error("Chưa có tài khoản TienHub hợp lệ.");
    }

    const { ref, get, set } = await initFlappyFirebase();
    const userRef = ref(
        leaderboardDatabase,
        `users/${user.uid}`
    );

    const snapshot = await get(userRef);
    const existing = snapshot.val() || {};

    const cleanUsername = String(
        existing.username ||
        username ||
        user.displayName ||
        localStorage.getItem("tienhub_username") ||
        ""
    ).trim();

    if (!cleanUsername) {
        throw new Error(
            "Không xác định được username của tài khoản."
        );
    }

    await set(userRef, {
        username: cleanUsername,
        usernameNormalized: cleanUsername.toLowerCase(),
        createdAt:
            typeof existing.createdAt === "number"
                ? existing.createdAt
                : Date.now()
    });

    return cleanUsername;
}

async function getFlappyUsername(user) {
    if (!user || user.isAnonymous) {
        return null;
    }

    const { ref, get } = await initFlappyFirebase();

    const snapshot = await get(
        ref(
            leaderboardDatabase,
            `users/${user.uid}/username`
        )
    );

    const username = snapshot.val();

    if (typeof username === "string" && username.trim()) {
        return username.trim();
    }

    return ensureFlappyUserRecord(
        user,
        localStorage.getItem("tienhub_username") ||
        user.displayName ||
        ""
    );
}

async function getFlappyAuthUser() {
    await initFlappyFirebase();

    const immediateUser = leaderboardAuth?.currentUser;

    if (immediateUser && !immediateUser.isAnonymous) {
        return immediateUser;
    }

    if (leaderboardAuthReady) {
        const user = await leaderboardAuthReady;

        if (user && !user.isAnonymous) {
            return user;
        }
    }

    const finalUser = leaderboardAuth?.currentUser || null;

    if (finalUser && !finalUser.isAnonymous) {
        return finalUser;
    }

    return null;
}

async function getFlappyUsername(user) {
    if (!user || user.isAnonymous) {
        return null;
    }

    const { ref, get } = await initFlappyFirebase();

    const snapshot = await get(
        ref(leaderboardDatabase, `users/${user.uid}/username`)
    );

    const username = snapshot.val();

    if (typeof username !== "string" || !username.trim()) {
        throw new Error("Không tìm thấy users/$uid/username.");
    }

    return username.trim();
}

/* =====================================================
   PROFILE PANEL
===================================================== */

const profilePanel =
    document.createElement("aside");

profilePanel.className =
    "side-panel profile-panel";


profilePanel.innerHTML = `
    <h2 class="side-title">👤 Hồ sơ</h2>

    <div class="profile-user">

        <div class="profile-avatar">🐦</div>

        <div class="profile-name">

            <strong id="flappyProfileName">
                Khách
            </strong>

            <div
                class="profile-status"
                id="flappyProfileStatus"
            >
                Chơi khách
            </div>

        </div>

    </div>


    <div class="profile-stat">
        <span>🏆 Best</span>
        <strong id="flappyProfileBest">0</strong>
    </div>


    <div class="profile-stat">
        <span>🎮 Đã chơi</span>
        <strong id="flappyProfileGames">0</strong>
    </div>


    <div class="profile-stat">
        <span>⭐ Điểm hiện tại</span>
        <strong id="flappyProfileScore">0</strong>
    </div>
    <div class="profile-stat">
    <span>🏅 Xếp hạng</span>
    <strong id="flappyProfileRank">—</strong>
</div>

<div class="profile-stat">
    <span>⬆️ Cần thêm</span>
    <strong id="flappyProfileNeed">—</strong>
</div>
`;


/* =====================================================
   LEADERBOARD PANEL
===================================================== */

const leaderboardPanel =
    document.createElement("aside");

leaderboardPanel.className =
    "side-panel leaderboard-panel";


leaderboardPanel.innerHTML = `
    <h2 class="side-title">🏆 BXH Flappy</h2>

    <div id="flappyLeaderboardList" class="leaderboard-list"></div>

    <!-- BXH hiển thị 10 người cùng lúc, tối đa 50 người có thể cuộn -->
`;

const moreButton =
    leaderboardPanel.querySelector(
        "#flappyLeaderboardMore"
    );

moreButton?.addEventListener(
    "click",
    () => {
        leaderboardExpanded =
            !leaderboardExpanded;

        renderFlappyLeaderboard();
    }
);


/* =====================================================
   LAYOUT
===================================================== */

function setupFlappyLayout() {

    const gameArea =
        document.querySelector(
            ".game-area"
        );

    if (!gameArea) {
        return;
    }


    const wrapper =
        document.querySelector(
            ".game-wrapper"
        );

    const topbar =
        document.querySelector(
            ".topbar"
        );

    if (!wrapper || !topbar) {
        return;
    }


    if (
        document.querySelector(
            ".flappy-layout"
        )
    ) {
        return;
    }


    const layout =
        document.createElement("div");

    layout.className =
        "flappy-layout";


    const gameColumn =
        document.createElement("div");

    gameColumn.className =
        "game-column";


    const hint =
        document.querySelector(".hint");


    gameColumn.appendChild(
        gameArea
    );


    if (hint) {

        gameColumn.appendChild(
            hint
        );

    }


    layout.appendChild(
        profilePanel
    );

    layout.appendChild(
        gameColumn
    );

    layout.appendChild(
        leaderboardPanel
    );


    wrapper.appendChild(
        layout
    );

}


/* =====================================================
   UPDATE PROFILE UI
===================================================== */

function updateFlappyProfileName(
    name,
    status
) {

    const nameElement =
        document.getElementById(
            "flappyProfileName"
        );

    const statusElement =
        document.getElementById(
            "flappyProfileStatus"
        );


    if (nameElement) {

        nameElement.textContent =
            name;

    }


    if (statusElement) {

        statusElement.textContent =
            status;

    }

}


/* =====================================================
   PROFILE BEST
===================================================== */

function updateFlappyProfileBest(
    value
) {

    const element =
        document.getElementById(
            "flappyProfileBest"
        );


    if (element) {

        element.textContent =
            String(
                Number(value) || 0
            );

    }

}


/* =====================================================
   PROFILE CURRENT SCORE
===================================================== */

function updateFlappyProfileScore(
    value
) {

    const element =
        document.getElementById(
            "flappyProfileScore"
        );


    if (element) {

        element.textContent =
            String(
                Number(value) || 0
            );

    }

}


/* =====================================================
   PROFILE GAMES
===================================================== */

function updateFlappyProfileGames() {

    const element =
        document.getElementById(
            "flappyProfileGames"
        );


    if (!element) {
        return;
    }


    const games =
        Number(
            localStorage.getItem(
                "flappy_games_played"
            ) || 0
        );


    element.textContent =
        String(games);

}


function increaseFlappyGamesPlayed() {

    const games =
        Number(
            localStorage.getItem(
                "flappy_games_played"
            ) || 0
        ) + 1;


    localStorage.setItem(
        "flappy_games_played",
        String(games)
    );


    updateFlappyProfileGames();

}


/* =====================================================
   LOAD CURRENT USER
===================================================== */

async function loadFlappyUser() {
    try {
        await initFlappyFirebase();

        const user = await getFlappyAuthUser();

        if (!user || user.isAnonymous) {
            const savedUsername = localStorage.getItem("tienhub_username");

            if (savedUsername && savedUsername.trim()) {
                currentUsername = savedUsername.trim();
                updateFlappyProfileName(
                    currentUsername,
                    "Đang chờ tài khoản"
                );
            } else {
                currentUsername = "Khách";
                updateFlappyProfileName("Khách", "Chưa đăng nhập");
            }

            /* Không xóa highScore ở đây.
             * Auth có thể hoàn tất sau lần callback đầu tiên.
             */
            updateScore();
            updateFlappyProfileBest(highScore);
            return;
        }

        currentUsername = await getFlappyUsername(user);

        updateFlappyProfileName(
            currentUsername,
            "Đã đăng nhập"
        );

        const { ref, get } = await initFlappyFirebase();
        const scoreSnapshot = await get(
            ref(leaderboardDatabase, `leaderboards/flappy/${user.uid}`)
        );

        const data = scoreSnapshot.val();

        highScore =
            data && typeof data.score === "number"
                ? data.score
                : 0;

        updateScore();
        updateFlappyProfileBest(highScore);

        console.log(
            "FLAPPY ACCOUNT LOADED:",
            currentUsername,
            "BEST:",
            highScore
        );
    } catch (error) {
        console.error("FLAPPY LOAD USER ERROR:", error);

        const savedUsername = localStorage.getItem("tienhub_username");
        if (savedUsername && savedUsername.trim()) {
            currentUsername = savedUsername.trim();
            updateFlappyProfileName(
                currentUsername,
                "Không xác minh được tài khoản"
            );
        } else {
            updateFlappyProfileName(
                "Lỗi",
                "Không tải được tài khoản"
            );
        }

        updateScore();
        updateFlappyProfileBest(highScore);
    }
}


/* =====================================================
   SETUP FIREBASE LEADERBOARD
===================================================== */

async function setupFlappyLeaderboard() {
    try {
        await initFlappyFirebase();
    } catch (error) {
        console.error("FLAPPY LEADERBOARD INIT ERROR:", error);
    }

    /* Hồ sơ và BXH phải được thử độc lập. */
    await loadFlappyUser();
    await loadFlappyLeaderboard();
}

function isFlappyScorePlausible(submittedScore) {
    if (!Number.isFinite(submittedScore) || submittedScore < 0) {
        return false;
    }

    if (!roundStartTime || !Number.isFinite(roundStartTime)) {
        return true;
    }

    const elapsedSeconds = Math.max(
        0,
        (performance.now() - roundStartTime) / 1000
    );

    const allowedScore = Math.floor(elapsedSeconds) + 2;

    if (submittedScore > allowedScore) {
        console.warn(
            "FLAPPY: score không hợp lệ.",
            { score: submittedScore, elapsed: elapsedSeconds, allowed: allowedScore }
        );
        return false;
    }

    return true;
}

/* =====================================================
   SAVE SCORE — FIREBASE DIRECT
===================================================== */

async function saveFlappyLeaderboardScore(newScore) {
    try {
        newScore = Number(newScore);

        if (!Number.isFinite(newScore) || newScore < 0) {
            return;
        }

        if (!isFlappyScorePlausible(newScore)) {
            return;
        }

        await initFlappyFirebase();

        const user = await getFlappyAuthUser();

        if (!user || user.isAnonymous) {
            console.warn("FLAPPY: chưa có tài khoản TienHub.");
            return;
        }

        const { ref, get, set } = await initFlappyFirebase();
        const scoreRef = ref(
            leaderboardDatabase,
            `leaderboards/flappy/${user.uid}`
        );

        const existingSnapshot = await get(scoreRef);
        const existing = existingSnapshot.val();
        const existingScore =
            existing && typeof existing.score === "number"
                ? existing.score
                : null;

        // Rules yêu cầu chỉ tăng Best.
        // Nếu chưa có bản ghi, tạo bản ghi kể cả score = 0.
        if (existingScore !== null && newScore <= existingScore) {
            highScore = existingScore;
            updateScore();
            updateFlappyProfileBest(existingScore);
            await loadFlappyLeaderboard();
            return;
        }

        const username = await getFlappyUsername(user);

        const payload = {
            username,
            score: newScore,
            updatedAt: Date.now()
        };

        await set(scoreRef, payload);

        // Đọc lại ngay sau khi ghi. Nếu đọc được đúng dữ liệu,
        // ta biết chắc Best/BXH đã đi vào Firebase.
        const verifySnapshot = await get(scoreRef);
        const verified = verifySnapshot.val();

        if (
            !verified ||
            verified.username !== username ||
            typeof verified.score !== "number" ||
            verified.score !== newScore
        ) {
            throw new Error("Firebase ghi điểm nhưng không xác minh được dữ liệu.");
        }

        currentUsername = username;
        highScore = newScore;

        updateScore();
        updateFlappyProfileBest(newScore);

        await loadFlappyLeaderboard();

        console.log(
            "FLAPPY SCORE SAVED:",
            username,
            newScore
        );
    } catch (error) {
        console.error("FLAPPY SAVE SCORE ERROR:", error);
    }
}



/* =====================================================
   LOAD LEADERBOARD
===================================================== */
async function loadFlappyLeaderboard() {
    const listElement = document.getElementById("flappyLeaderboardList");

    if (!listElement) return;

    try {
        await initFlappyFirebase();

        const { ref, get, query, orderByChild } = await initFlappyFirebase();

        const leaderboardQuery = query(
            ref(leaderboardDatabase, "leaderboards/flappy"),
            orderByChild("score")
        );

        const snapshot = await get(leaderboardQuery);
        const players = [];

        snapshot.forEach(child => {
            const data = child.val();
            if (!data || typeof data !== "object") return;

            players.push({
                uid: child.key,
                username: typeof data.username === "string"
                    ? data.username
                    : "Người chơi",
                score: typeof data.score === "number"
                    ? data.score
                    : Number(data.score) || 0
            });
        });

        players.sort((a, b) => b.score - a.score);
        leaderboardPlayers = players;

        updateFlappyRank(players);
        renderFlappyLeaderboard();
    } catch (error) {
        console.error("FLAPPY LOAD LEADERBOARD ERROR:", error);

        listElement.innerHTML = `
            <div class="leaderboard-empty">
                Không tải được BXH
            </div>
        `;
    }
}

function renderFlappyLeaderboard() {
    const listElement = document.getElementById("flappyLeaderboardList");
    const moreButton = document.getElementById("flappyLeaderboardMore");

    if (!listElement) return;

    // Chỉ giữ tối đa 50 người trong BXH.
    // CSS giới hạn chiều cao để khoảng 10 người hiện cùng lúc,
    // người dùng có thể cuộn xuống để xem từ hạng 11 đến hạng 50.
    const visibleCount = 50;
    const visiblePlayers = leaderboardPlayers.slice(0, visibleCount);

    if (visiblePlayers.length === 0) {
        listElement.innerHTML = `
            <div class="leaderboard-empty">
                Chưa có người chơi
            </div>
        `;

        if (moreButton) {
            moreButton.style.display = "none";
        }

        return;
    }

    listElement.innerHTML = visiblePlayers.map((player, index) => {
        const rank = index + 1;

        let rankClass = "";

        if (rank === 1) rankClass = "rank-first";
        else if (rank === 2) rankClass = "rank-second";
        else if (rank === 3) rankClass = "rank-third";

        let rankIcon = rank;

        if (rank === 1) rankIcon = "🥇";
        else if (rank === 2) rankIcon = "🥈";
        else if (rank === 3) rankIcon = "🥉";

        const currentUser = leaderboardAuth?.currentUser;

        const isMe =
            currentUser &&
            !currentUser.isAnonymous &&
            currentUser.uid === player.uid;

        return `
            <div class="leaderboard-row ${rankClass} ${isMe ? "leaderboard-me" : ""}">
                <span class="leaderboard-rank">${rankIcon}</span>

                <span class="leaderboard-name">
                    @${escapeLeaderboardText(player.username)}
                    ${isMe ? '<small>Bạn</small>' : ""}
                </span>

                <strong class="leaderboard-score">
                    ${player.score}
                </strong>
            </div>
        `;
    }).join("");

    if (moreButton) {
        moreButton.style.display = "none";
    }
}

/* =====================================================
   FLAPPY RANK
===================================================== */

function updateFlappyRank(
    players
) {

    const rankElement =
        document.getElementById(
            "flappyProfileRank"
        );

    const needElement =
        document.getElementById(
            "flappyProfileNeed"
        );


    if (
        !rankElement ||
        !needElement
    ) {

        return;

    }


    const user = leaderboardAuth?.currentUser;


    /*
     * Guest không có BXH
     */

    if (
        !user ||
        user.isAnonymous
    ) {

        rankElement.textContent =
            "—";

        needElement.textContent =
            "Đăng nhập";

        return;

    }


    const myScore =
        Number(highScore) || 0;


    /*
     * Sắp xếp điểm cao → thấp
     */

    const sorted =
        [...players].sort(
            (a, b) =>
                b.score - a.score
        );


    /*
     * Tìm vị trí của tài khoản hiện tại.
     *
     * Nếu chưa có trong BXH thì vẫn tính
     * hạng dựa trên số người có điểm cao hơn.
     */

    let rank =
        1;


    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {

        if (
            sorted[i].score >
            myScore
        ) {

            rank++;

        }

    }


    rankElement.textContent =
        `#${rank}`;


    /*
     * Tìm người ngay phía trên.
     */

    let playerAbove =
        null;


    for (
        let i = 0;
        i < sorted.length;
        i++
    ) {

        if (
            sorted[i].score >
            myScore
        ) {

            playerAbove =
                sorted[i];

            break;

        }

    }


    /*
     * Đang đứng đầu
     */

    if (!playerAbove) {

        needElement.textContent =
            "🥇 Đang đứng đầu";

        return;

    }


    /*
     * Số điểm cần thêm để vượt người phía trên.
     */

    const need =
        Math.max(
            1,
            playerAbove.score -
            myScore +
            1
        );


    needElement.textContent =
        `+${need} điểm`;

}

/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeLeaderboardText(
    value
) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}    
 

    /* =====================================================
       GAME CONFIG
    ===================================================== */

    const GRAVITY = 1450;

    const FLAP_POWER = -470;

    const PIPE_SPEED = 220;

    const PIPE_WIDTH = 64;

    const PIPE_GAP = 170;

    const PIPE_INTERVAL = 1.45;

    const BIRD_RADIUS = 15;

    const GROUND_HEIGHT = 55;


    /*
       Không cho 1 frame bị tính quá lâu.
    */

    const MAX_DELTA = 0.032;


    /* =====================================================
       CANVAS
    ===================================================== */

    let width = 320;

    let height = 500;

    let dpr = 1;


    /*
       Background cache.
    */

    const backgroundCanvas =
        document.createElement(
            "canvas"
        );

    const backgroundCtx =
        backgroundCanvas.getContext(
            "2d"
        );


    /* =====================================================
       GAME STATE
    ===================================================== */

    let state = "ready";

    let score = 0;


    let highScore = 0;

    let lastTime = 0;

    let roundStartTime = 0;

    let rafId = 0;

    let pipeTimer = 0;


    /* =====================================================
       GAMEHUB STATE
    ===================================================== */

    let gameHubReady = false;

    let roundTrackingStarted = false;


    /* =====================================================
       BIRD
    ===================================================== */

    const bird = {
        x: 0,
        y: 0,
        velocity: 0,
        rotation: 0
    };


    /* =====================================================
       PIPE POOL
       -----------------------------------------------------
       Không tạo object mới trong game loop.
    ===================================================== */

    const MAX_PIPES = 8;

    const pipePool =
        new Array(MAX_PIPES);

    let activePipeCount = 0;


    for (
        let i = 0;
        i < MAX_PIPES;
        i++
    ) {

        pipePool[i] = {

            x: 0,

            top: 0,

            passed: false,

            active: false

        };
    }


    /* =====================================================
       AUDIO ENGINE
       -----------------------------------------------------
       Decode MP3 → AudioBuffer.
    ===================================================== */

    let audioContext = null;

    let audioReady = false;


    const audioBuffers = {

        flap: null,

        score: null,

        hit: null,

        die: null

    };


    const audioFiles = {

        flap:
            "./flappy_flap.mp3",

        score:
            "./flappy_score.mp3",

        hit:
            "./flappy_hit.mp3",

        die:
            "./flappy_die.mp3"

    };


    function ensureAudioContext() {

        if (audioContext) {

            return audioContext;

        }


        try {

            audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();

        } catch (error) {

            audioContext = null;

        }


        return audioContext;
    }


    async function loadAudio() {

        const ac =
            ensureAudioContext();


        if (!ac) {

            return;

        }


        try {

            const names =
                Object.keys(
                    audioFiles
                );


            await Promise.all(

                names.map(
                    async (name) => {

                        const response =
                            await fetch(
                                audioFiles[name]
                            );


                        const arrayBuffer =
                            await response.arrayBuffer();


                        audioBuffers[name] =
                            await ac.decodeAudioData(
                                arrayBuffer
                            );

                    }
                )

            );


            audioReady = true;


        } catch (error) {

            /*
               Audio lỗi thì game vẫn chạy.
            */

            audioReady = false;

        }
    }


    function resumeAudio() {

        const ac =
            ensureAudioContext();


        if (!ac) {

            return;

        }


        if (
            ac.state ===
            "suspended"
        ) {

            ac.resume().catch(
                () => {}
            );

        }
    }


    function isSoundEnabled() {

        if (

            window.GameSound &&

            typeof window.GameSound.isEnabled ===
                "function"

        ) {

            return window.GameSound.isEnabled();

        }


        return true;
    }


    function playSound(
        name,
        volume = 0.5
    ) {

        if (!audioReady) {

            return;

        }


        if (!isSoundEnabled()) {

            return;

        }


        const ac =
            audioContext;


        const buffer =
            audioBuffers[name];


        if (
            !ac ||
            !buffer
        ) {

            return;

        }


        try {

            const source =
                ac.createBufferSource();


            const gain =
                ac.createGain();


            source.buffer =
                buffer;


            gain.gain.value =
                volume;


            source.connect(
                gain
            );


            gain.connect(
                ac.destination
            );


            source.start(0);


        } catch (error) {

            // Không làm crash game

        }
    }


    /*
       Load audio song song.
    */

    loadAudio();


    /* =====================================================
       GAMEHUB
       ===================================================== */

    async function initGameHub() {

        if (
            !window.GameHub
        ) {

            console.warn(
                "Flappy: GameHub không tồn tại."
            );

            return false;
        }


        if (
            !window.GameHub.ready
        ) {

            console.warn(
                "Flappy: GameHub.ready không tồn tại."
            );

            return false;
        }


        try {

            /*
               Chờ Firebase anonymous auth +
               presence + daily player.
            */

            await window.GameHub.ready;


            gameHubReady = true;


            /*
               Đảm bảo Flappy được ghi
               là đang online.
            */

            if (
                typeof window.GameHub.updatePresence ===
                "function"
            ) {

                await window.GameHub.updatePresence();

            }


            console.log(
                "Flappy GameHub READY"
            );


            return true;


        } catch (error) {

            console.warn(
                "Flappy GameHub init lỗi:",
                error
            );


            return false;

        }
    }


    /*
       Khởi tạo Firebase song song.
       Không chặn việc render game.
    */

    initGameHub();


    /* =====================================================
       GAMEHUB — START ROUND
       ===================================================== */

    async function startGameHubRound() {

        if (
            !gameHubReady
        ) {

            return;

        }


        if (
            roundTrackingStarted
        ) {

            return;

        }


        if (
            !window.GameHub
        ) {

            return;

        }


        try {

            roundTrackingStarted =
                true;


            /*
               Ghi game_start.
            */

            if (
                typeof window.GameHub.start ===
                "function"
            ) {

                await window.GameHub.start({

                    device:
                        window.innerWidth <= 768
                            ? "mobile"
                            : "desktop",

                    score:
                        0

                });

            }


            /*
               Refresh presence.
            */

            if (
                typeof window.GameHub.updatePresence ===
                "function"
            ) {

                window.GameHub.updatePresence();

            }


            console.log(
                "Flappy game_start tracked"
            );


        } catch (error) {

            roundTrackingStarted =
                false;


            console.warn(
                "Flappy game_start lỗi:",
                error
            );

        }
    }


    /* =====================================================
       GAMEHUB — END ROUND
       ===================================================== */

    async function endGameHubRound() {

        if (
            !gameHubReady
        ) {

            return;

        }


        if (
            !roundTrackingStarted
        ) {

            return;

        }


        if (
            !window.GameHub
        ) {

            return;

        }


        try {

            /*
               GameHub.end() sẽ ghi:
               game_end
               với result = loss
            */

            if (
                typeof window.GameHub.end ===
                "function"
            ) {

                await window.GameHub.end({

                    result:
                        "loss",

                    score:
                        score

                });

            }


            console.log(
                "Flappy game_end tracked:",
                score
            );


        } catch (error) {

            console.warn(
                "Flappy game_end lỗi:",
                error
            );

        }


        roundTrackingStarted =
            false;
    }


    /* =====================================================
       RESIZE
    ===================================================== */

    function resizeCanvas() {

        const rect =
            canvas.getBoundingClientRect();


        width =
            Math.max(
                320,
                rect.width
            );


        height =
            Math.max(
                400,
                rect.height
            );


        /*
           Retina nhưng giới hạn DPR.
        */

        dpr =
            Math.min(
                window.devicePixelRatio ||
                    1,
                1.5
            );


        canvas.width =
            Math.floor(
                width * dpr
            );


        canvas.height =
            Math.floor(
                height * dpr
            );


        ctx.setTransform(

            dpr,

            0,

            0,

            dpr,

            0,

            0

        );


        /*
           Background cache.
        */

        backgroundCanvas.width =
            Math.floor(
                width * dpr
            );


        backgroundCanvas.height =
            Math.floor(
                height * dpr
            );


        backgroundCtx.setTransform(

            dpr,

            0,

            0,

            dpr,

            0,

            0

        );


        backgroundCtx.imageSmoothingEnabled =
            true;


        createBackground();


        resetBird();

    }


    window.addEventListener(

        "resize",

        resizeCanvas,

        {
            passive: true
        }

    );


    /* =====================================================
       STATIC BACKGROUND
    ===================================================== */

    function createBackground() {

        const c =
            backgroundCtx;


        /*
           Sky
        */

        c.fillStyle =
            "#70c5ce";


        c.fillRect(

            0,

            0,

            width,

            height

        );


        /*
           Clouds
        */

        drawCloud(

            c,

            width * 0.18,

            height * 0.20,

            32

        );


        drawCloud(

            c,

            width * 0.72,

            height * 0.12,

            26

        );


        drawCloud(

            c,

            width * 0.55,

            height * 0.35,

            20

        );

    }


    function drawCloud(

        c,

        x,

        y,

        size

    ) {

        c.fillStyle =
            "rgba(255,255,255,0.65)";


        c.beginPath();


        c.arc(

            x,

            y,

            size * 0.55,

            0,

            Math.PI * 2

        );


        c.arc(

            x + size * 0.6,

            y + 3,

            size * 0.4,

            0,

            Math.PI * 2

        );


        c.arc(

            x - size * 0.55,

            y + 5,

            size * 0.38,

            0,

            Math.PI * 2

        );


        c.fill();

    }


    /* =====================================================
       BIRD
    ===================================================== */

    function resetBird() {

        bird.x =
            width * 0.28;


        bird.y =
            height * 0.42;


        bird.velocity =
            0;


        bird.rotation =
            0;

    }


    /* =====================================================
       PIPE POOL
    ===================================================== */

    function clearPipes() {

        for (

            let i = 0;

            i < MAX_PIPES;

            i++

        ) {

            pipePool[i].active =
                false;


            pipePool[i].passed =
                false;

        }


        activePipeCount =
            0;

    }


    function spawnPipe() {

        if (

            activePipeCount >=
            MAX_PIPES

        ) {

            return;

        }


        /*
           Tìm pipe inactive.
        */

        let pipe =
            null;


        for (

            let i = 0;

            i < MAX_PIPES;

            i++

        ) {

            if (
                !pipePool[i].active
            ) {

                pipe =
                    pipePool[i];

                break;

            }

        }


        if (!pipe) {

            return;

        }


        const topMargin =
            70;


        const bottomMargin =
            GROUND_HEIGHT + 70;


        const available =

            height -

            GROUND_HEIGHT -

            PIPE_GAP -

            topMargin -

            bottomMargin;


        pipe.x =
            width + PIPE_WIDTH;


        pipe.top =

            topMargin +

            Math.random() *

            Math.max(

                0,

                available

            );


        pipe.passed =
            false;


        pipe.active =
            true;


        activePipeCount++;

    }


    function recyclePipe(
        pipe
    ) {

        pipe.active =
            false;


        pipe.passed =
            false;


        activePipeCount--;

    }


    /* =====================================================
       COLLISION
    ===================================================== */

    function circleRectCollision(

        cx,

        cy,

        radius,

        rx,

        ry,

        rw,

        rh

    ) {

        const closestX =

            cx < rx

                ? rx

                : cx > rx + rw

                    ? rx + rw

                    : cx;


        const closestY =

            cy < ry

                ? ry

                : cy > ry + rh

                    ? ry + rh

                    : cy;


        const dx =
            cx - closestX;


        const dy =
            cy - closestY;


        return (

            dx * dx +

            dy * dy <

            radius * radius

        );

    }


    function checkCollision() {

        /*
           Ceiling
        */

        if (

            bird.y -
            BIRD_RADIUS <=
            0

        ) {

            return true;

        }


        /*
           Ground
        */

        const groundY =

            height -
            GROUND_HEIGHT;


        if (

            bird.y +
            BIRD_RADIUS >=
            groundY

        ) {

            return true;

        }


        /*
           Pipes
        */

        for (

            let i = 0;

            i < MAX_PIPES;

            i++

        ) {

            const pipe =
                pipePool[i];


            if (!pipe.active) {

                continue;

            }


            const bottomY =

                pipe.top +
                PIPE_GAP;


            /*
               Top pipe
            */

            if (

                circleRectCollision(

                    bird.x,

                    bird.y,

                    BIRD_RADIUS,

                    pipe.x,

                    0,

                    PIPE_WIDTH,

                    pipe.top

                )

            ) {

                return true;

            }


            /*
               Bottom pipe
            */

            if (

                circleRectCollision(

                    bird.x,

                    bird.y,

                    BIRD_RADIUS,

                    pipe.x,

                    bottomY,

                    PIPE_WIDTH,

                    groundY -
                    bottomY

                )

            ) {

                return true;

            }

        }


        return false;

    }


    /* =====================================================
       SCORE
    ===================================================== */

    function updateScore() {

        scoreElement.textContent =
            score;


        highScoreElement.textContent =
            highScore;

    }


    function addScore() {

    score++;


    if (score > highScore) {

        highScore =
            score;


        /*
         * Nếu Guest:
         * lưu local.
         *
         * Nếu tài khoản:
         * Firebase sẽ lưu khi Game Over.
         */

        const user = leaderboardAuth?.currentUser || null;


        if (
            !user ||
            user.isAnonymous
        ) {

            localStorage.setItem(
                "flappy_high_score",
                String(highScore)
            );

        }



        updateFlappyProfileBest(
            highScore
        );

    }


    updateScore();

    updateFlappyProfileScore(
        score
    );


    playSound(
        "score",
        0.4
    );
}

    /* =====================================================
       START
    ===================================================== */

    async function startGame() {

    resumeAudio();

    /*
       Nếu đang chơi thì không tạo ván mới.
    */
    if (state === "playing") {
        return;
    }

    state = "playing";

    score = 0;

    pipeTimer = 0;

    roundStartTime = performance.now();

    clearPipes();

    resetBird();

    updateScore();

    increaseFlappyGamesPlayed();

    updateFlappyProfileScore(0);

    startScreen.classList.add(
        "hidden"
    );

    gameOverScreen.classList.add(
        "hidden"
    );

    playSound(
        "flap",
        0.35
    );

    /*
       Ghi lượt chơi vào GameHub.
    */
    startGameHubRound();

    lastTime =
        performance.now();

    if (!rafId) {
        rafId =
            requestAnimationFrame(
                gameLoop
            );
    }
} 


    /* =====================================================
       RESTART
    ===================================================== */

    function restartGame() {

        resumeAudio();


        startGame();

    }


    /* =====================================================
       GAME OVER
    ===================================================== */

    function gameOver() {

        if (

            state !==
            "playing"

        ) {

            return;

        }
        updateFlappyProfileScore(score);

        // Chuyển trạng thái ngay lập tức để vòng game không gọi gameOver() lặp lại.
        state = "gameover";

        if (isFlappyScorePlausible(score)) {
            // Không cần chặn giao diện chờ Firebase; hàm tự xử lý lỗi.
            void saveFlappyLeaderboardScore(score);
        } else {
            console.warn(
                "FLAPPY: score bị từ chối:",
                score
            );
        }


        /*
           Âm thanh va chạm.
        */

        playSound(

            "hit",

            0.55

        );


        /*
           Âm thanh chết.
        */

        playSound(

            "die",

            0.35

        );


        finalScoreElement.textContent =
            score;


        finalHighScoreElement.textContent =
            highScore;


        gameOverScreen.classList.remove(
            "hidden"
        );


        /*
           Ghi game_end.

           Chạy ngoài game loop,
           không ảnh hưởng FPS.
        */

        endGameHubRound();

    }


    /* =====================================================
       FLAP
    ===================================================== */

    function flap() {

        resumeAudio();


        /*
           Nếu đang ở màn hình READY,
           chạm màn hình sẽ bắt đầu game.
        */

        if (

            state ===
            "ready"

        ) {

            startGame();

            return;

        }


        /*
           Game over thì không flap.
        */

        if (

            state ===
            "gameover"

        ) {

            return;

        }


        bird.velocity =
            FLAP_POWER;


        playSound(

            "flap",

            0.35

        );

    }


    /* =====================================================
       UPDATE
    ===================================================== */

    function update(
        delta
    ) {

        if (

            state !==
            "playing"

        ) {

            return;

        }


        /*
           Bird physics
        */

        bird.velocity +=

            GRAVITY *
            delta;


        bird.y +=

            bird.velocity *
            delta;


        bird.rotation =

            Math.max(

                -0.45,

                Math.min(

                    1.25,

                    bird.velocity /
                    650

                )

            );


        /*
           Pipe spawn
        */

        pipeTimer +=
            delta;


        if (

            pipeTimer >=
            PIPE_INTERVAL

        ) {

            pipeTimer -=
                PIPE_INTERVAL;


            spawnPipe();

        }


        /*
           Pipe movement
        */

        for (

            let i = 0;

            i < MAX_PIPES;

            i++

        ) {

            const pipe =
                pipePool[i];


            if (!pipe.active) {

                continue;

            }


            pipe.x -=

                PIPE_SPEED *
                delta;


            /*
               Score
            */

            if (

                !pipe.passed &&

                pipe.x +
                PIPE_WIDTH <
                bird.x

            ) {

                pipe.passed =
                    true;


                addScore();

            }


            /*
               Recycle
            */

            if (

                pipe.x +
                PIPE_WIDTH <
                -20

            ) {

                recyclePipe(
                    pipe
                );

            }

        }


        /*
           Collision
        */

        if (

            checkCollision()

        ) {

            gameOver();

        }

    }


    /* =====================================================
       DRAW
    ===================================================== */

    function draw() {

        /*
           Background cached.
        */

        ctx.drawImage(

            backgroundCanvas,

            0,

            0,

            width,

            height

        );


        drawPipes();


        drawGround();


        drawBird();

    }


    /* =====================================================
       DRAW PIPES
    ===================================================== */

    function drawPipes() {

        const groundY =

            height -
            GROUND_HEIGHT;


        for (

            let i = 0;

            i < MAX_PIPES;

            i++

        ) {

            const pipe =
                pipePool[i];


            if (!pipe.active) {

                continue;

            }


            const x =
                pipe.x;


            const top =
                pipe.top;


            const bottomY =

                top +
                PIPE_GAP;


            /*
               Top pipe
            */

            ctx.fillStyle =
                "#58be42";


            ctx.fillRect(

                x,

                0,

                PIPE_WIDTH,

                top

            );


            ctx.fillStyle =
                "#3d9632";


            ctx.fillRect(

                x,

                0,

                5,

                top

            );


            ctx.fillRect(

                x +
                PIPE_WIDTH -
                5,

                0,

                5,

                top

            );


            /*
               Top cap
            */

            ctx.fillStyle =
                "#69d34d";


            ctx.fillRect(

                x - 5,

                top - 26,

                PIPE_WIDTH + 10,

                26

            );


            ctx.fillStyle =
                "#3d9632";


            ctx.fillRect(

                x - 5,

                top - 26,

                5,

                26

            );


            ctx.fillRect(

                x +
                PIPE_WIDTH,

                top - 26,

                5,

                26

            );


            /*
               Bottom pipe
            */

            ctx.fillStyle =
                "#58be42";


            ctx.fillRect(

                x,

                bottomY,

                PIPE_WIDTH,

                groundY -
                bottomY

            );


            ctx.fillStyle =
                "#3d9632";


            ctx.fillRect(

                x,

                bottomY,

                5,

                groundY -
                bottomY

            );


            ctx.fillRect(

                x +
                PIPE_WIDTH -
                5,

                bottomY,

                5,

                groundY -
                bottomY

            );


            /*
               Bottom cap
            */

            ctx.fillStyle =
                "#69d34d";


            ctx.fillRect(

                x - 5,

                bottomY,

                PIPE_WIDTH + 10,

                26

            );


            ctx.fillStyle =
                "#3d9632";


            ctx.fillRect(

                x - 5,

                bottomY,

                5,

                26

            );


            ctx.fillRect(

                x +
                PIPE_WIDTH,

                bottomY,

                5,

                26

            );

        }

    }


    /* =====================================================
       DRAW GROUND
    ===================================================== */

    function drawGround() {

        const groundY =

            height -
            GROUND_HEIGHT;


        ctx.fillStyle =
            "#ded895";


        ctx.fillRect(

            0,

            groundY,

            width,

            GROUND_HEIGHT

        );


        ctx.fillStyle =
            "#79c850";


        ctx.fillRect(

            0,

            groundY,

            width,

            9

        );


        /*
           Không tạo array/object.
        */

        ctx.fillStyle =
            "#c9bd73";


        for (

            let x = 0;

            x < width;

            x += 40

        ) {

            ctx.fillRect(

                x,

                groundY + 17,

                16,

                4

            );

        }

    }


    /* =====================================================
       DRAW BIRD
    ===================================================== */

    function drawBird() {

        ctx.save();


        ctx.translate(

            bird.x,

            bird.y

        );


        ctx.rotate(

            bird.rotation

        );


        /*
           Body
        */

        ctx.fillStyle =
            "#f8d84a";


        ctx.beginPath();


        ctx.arc(

            0,

            0,

            BIRD_RADIUS,

            0,

            Math.PI * 2

        );


        ctx.fill();


        /*
           Wing
        */

        ctx.fillStyle =
            "#e9b83f";


        ctx.beginPath();


        ctx.ellipse(

            -5,

            6,

            9,

            5,

            -0.25,

            0,

            Math.PI * 2

        );


        ctx.fill();


        /*
           Eye
        */

        ctx.fillStyle =
            "#fff";


        ctx.beginPath();


        ctx.arc(

            6,

            -6,

            5,

            0,

            Math.PI * 2

        );


        ctx.fill();


        ctx.fillStyle =
            "#111";


        ctx.beginPath();


        ctx.arc(

            7,

            -6,

            2,

            0,

            Math.PI * 2

        );


        ctx.fill();


        /*
           Beak
        */

        ctx.fillStyle =
            "#f28c28";


        ctx.beginPath();


        ctx.moveTo(

            13,

            0

        );


        ctx.lineTo(

            24,

            4

        );


        ctx.lineTo(

            13,

            8

        );


        ctx.closePath();


        ctx.fill();


        ctx.restore();

    }


    /* =====================================================
       GAME LOOP
    ===================================================== */

    function gameLoop(
        timestamp
    ) {

        rafId =
            0;


        let delta =

            (
                timestamp -
                lastTime
            ) / 1000;


        lastTime =
            timestamp;


        /*
           Giới hạn delta.
        */

        if (

            delta >
            MAX_DELTA

        ) {

            delta =
                MAX_DELTA;

        }


        /*
           Nếu delta âm.
        */

        if (

            delta <
            0

        ) {

            delta =
                0;

        }


        update(
            delta
        );


        draw();


        rafId =

            requestAnimationFrame(
                gameLoop
            );

    }


    /* =====================================================
       KEYBOARD
    ===================================================== */

    function handleKeyDown(
        event
    ) {

        const key =
            event.key.toLowerCase();


        /*
           R = RESTART
        */

        if (

            key === "r" &&

            state ===
            "gameover"

        ) {

            event.preventDefault();


            restartGame();


            return;

        }


        /*
           SPACE = FLAP
        */

        if (

            event.code ===
            "Space"

        ) {

            event.preventDefault();


            flap();

        }

    }


    window.addEventListener(

        "keydown",

        handleKeyDown

    );


    /* =====================================================
       TOUCH / MOUSE
    ===================================================== */

    canvas.addEventListener(

        "pointerdown",

        (event) => {

            event.preventDefault();


            flap();

        },

        {
            passive: false
        }

    );


    /* =====================================================
       BUTTONS
    ===================================================== */

    startButton?.addEventListener(

        "click",

        () => {

            resumeAudio();


            startGame();

        }

    );


    restartButton?.addEventListener(

        "click",

        () => {

            resumeAudio();


            restartGame();

        }

    );


    /* =====================================================
       BACK TO HUB
    ===================================================== */

    function goBack() {

        window.location.href =
            "../../index.html";

    }


    backButton?.addEventListener(

        "click",

        goBack

    );


    backMenuButton?.addEventListener(

        "click",

        goBack

    );


    gameOverMenuButton?.addEventListener(

        "click",

        goBack

    );


    /* =====================================================
       INIT
    ===================================================== */

resizeCanvas();

updateScore();

setupFlappyLayout();

updateFlappyProfileGames();

updateFlappyProfileBest(highScore);

updateFlappyProfileScore(0);

draw();

/*
   Firebase leaderboard.
   Dùng trực tiếp Firebase Auth + Database của TienHub.
*/
setupFlappyLeaderboard();

})();