import { auth, db } from "../../src/core/firebase.js";
import { ref, get, runTransaction, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

let tienHubUser = null;
let firebaseLeaderboard = [];
let firebaseUsername = null;

const SNAKE_LEADERBOARD_PATH = "leaderboards/snake";

function isTienHubLoggedIn() {
    return !!tienHubUser && !tienHubUser.isAnonymous;
}

function snakeLeaderboardRef() {
    return ref(db, SNAKE_LEADERBOARD_PATH);
}

function formatSnakeRecord(record) {
    if (!record) return null;
    return {
        uid: record.uid || "",
        name: record.username || "Người chơi",
        score: Number(record.score || 0),
        timeMs: Number(record.timeMs || 0),
        achievedAt: Number(record.updatedAt || 0)
    };
}

function sortLeaderboard(data) {
    return [...data].sort((a, b) => {
        const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
        if (scoreDiff) return scoreDiff;
        const timeDiff = Number(a.timeMs || Infinity) - Number(b.timeMs || Infinity);
        if (timeDiff) return timeDiff;
        return Number(a.achievedAt || Infinity) - Number(b.achievedAt || Infinity);
    });
}

function refreshSnakeLeaderboard(snapshotValue) {
    const raw = snapshotValue && typeof snapshotValue === "object" ? snapshotValue : {};
    firebaseLeaderboard = Object.entries(raw)
        .map(([uid, record]) => formatSnakeRecord({ ...record, uid }))
        .filter(Boolean);

    if (typeof window.__snakeRenderFirebaseState === "function") {
        window.__snakeRenderFirebaseState();
    }
}

// BXH Snake is public to read, but only authenticated accounts can write.
onValue(snakeLeaderboardRef(), (snapshot) => {
    refreshSnakeLeaderboard(snapshot.val());
}, (error) => {
    console.error("[Snake] Không thể đọc BXH Firebase:", error);
    firebaseLeaderboard = [];
    if (typeof window.__snakeRenderFirebaseState === "function") {
        window.__snakeRenderFirebaseState();
    }
});

async function loadSnakeUsername(user) {
    if (!user || user.isAnonymous) {
        firebaseUsername = null;
        return null;
    }

    try {
        const snapshot = await get(ref(db, `users/${user.uid}`));
        const username = snapshot.val()?.username;
        firebaseUsername = typeof username === "string" && username.trim() ? username.trim() : null;
        return firebaseUsername;
    } catch (error) {
        console.error("[Snake] Không thể đọc username:", error);
        firebaseUsername = null;
        return null;
    }
}

async function saveSnakeScore(score, timeMs) {
    if (!isTienHubLoggedIn() || score <= 0) return false;

    const username = firebaseUsername || await loadSnakeUsername(tienHubUser);
    if (!username) {
        console.warn("[Snake] Tài khoản chưa có username trong /users.");
        return false;
    }

    const userRef = ref(db, `${SNAKE_LEADERBOARD_PATH}/${tienHubUser.uid}`);
    const achievedAt = Date.now();

    try {
        const result = await runTransaction(userRef, (current) => {
            if (!current) {
                return {
                    username,
                    score,
                    timeMs,
                    updatedAt: achievedAt
                };
            }

            const oldScore = Number(current.score || 0);
            const oldTime = Number(current.timeMs || Infinity);
            const isBetter = score > oldScore || (score === oldScore && timeMs < oldTime);

            return isBetter ? {
                username,
                score,
                timeMs,
                updatedAt: achievedAt
            } : current;
        });

        return result.committed;
    } catch (error) {
        console.error("[Snake] Không thể lưu điểm Firebase:", error);
        return false;
    }
}

auth.onAuthStateChanged(async (user) => {
    tienHubUser = user && !user.isAnonymous ? user : null;
    firebaseUsername = null;

    if (tienHubUser) {
        await loadSnakeUsername(tienHubUser);
    }

    if (typeof window.__snakeRefreshAccountState === "function") {
        window.__snakeRefreshAccountState();
    }
});

(() => {

    "use strict";



    const canvas = document.getElementById("gameCanvas");

    const ctx = canvas.getContext("2d");



    const scoreEl = document.getElementById("score");

    const highScoreEl = document.getElementById("highScore");

    const gameTimeEl = document.getElementById("gameTime");

    const overlay = document.getElementById("overlay");

    const overlayIcon = document.getElementById("overlayIcon");

    const overlayTitle = document.getElementById("overlayTitle");

    const overlayText = document.getElementById("overlayText");

    const mainBtn = document.getElementById("mainBtn");

    const pauseBtn = document.getElementById("pauseBtn");

    const restartBtn = document.getElementById("restartBtn");

    const soundBtn = document.getElementById("soundBtn");

    const leaderboardList = document.getElementById("leaderboardList");

    const myHighScoreEl = document.getElementById("myHighScore");

    const myBestTimeEl = document.getElementById("myBestTime");

    const myRankEl = document.getElementById("myRank");



    const GRID = 24;

    const CELL = canvas.width / GRID;



    let snake = [];

    let food = { x: 10, y: 10 };

    let goldFood = null;

    let goldFoodExpiresAt = 0;

    let direction = { x: 1, y: 0 };

    let nextDirection = { x: 1, y: 0 };

    let score = 0;

    let highScore = 0;

    let running = false;

    let paused = false;

    let gameOver = false;

    let loopId = null;

    let lastTick = 0;

    let stepMs = 135;

    let gameStartedAt = 0;

    let accumulatedPlayMs = 0;

    let lastResumeAt = 0;





    const GOLD_SPAWN_CHANCE = 0.22;

    const GOLD_LIFETIME_MS = 5000;

    const GOLD_SCORE = 50;



    let goldExpireTimer = null;

    let audioCtx = null;

    let soundEnabled = localStorage.getItem("tienhub_snake_sound") !== "off";



    function getAudioContext() {

        if (!soundEnabled) return null;



        if (!audioCtx) {

            const AudioContext = window.AudioContext || window.webkitAudioContext;

            if (!AudioContext) return null;

            try {

                audioCtx = new AudioContext();

            } catch (error) {

                console.warn("[Snake] Không thể tạo AudioContext:", error);

                return null;

            }

        }



        if (audioCtx.state === "suspended") {

            audioCtx.resume().catch(() => {});

        }



        return audioCtx;

    }



    function tone(frequency, duration, type = "square", volume = 0.12, endFrequency = null, delay = 0) {

        if (!soundEnabled) return;



        const ctxAudio = getAudioContext();

        if (!ctxAudio) return;



        const now = ctxAudio.currentTime + delay;

        const osc = ctxAudio.createOscillator();

        const gain = ctxAudio.createGain();



        osc.type = type;

        osc.frequency.setValueAtTime(frequency, now);



        if (endFrequency !== null) {

            osc.frequency.exponentialRampToValueAtTime(

                Math.max(30, endFrequency),

                now + duration

            );

        }



        gain.gain.setValueAtTime(0.0001, now);

        gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);

        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);



        osc.connect(gain);

        gain.connect(ctxAudio.destination);



        osc.start(now);

        osc.stop(now + duration + 0.02);

    }



    const Sound = {

        unlock() {

            const ctxAudio = getAudioContext();

            if (!ctxAudio) return;

            if (ctxAudio.state === "suspended") {

                ctxAudio.resume().catch(() => {});

            }

        },



        start() {

            this.unlock();

            tone(420, 0.09, "square", 0.11, 620);

            tone(650, 0.12, "square", 0.10, 900, 0.09);

        },



        eatRed() {

            tone(520, 0.08, "square", 0.14, 780);

        },



        eatGold() {

            tone(700, 0.09, "triangle", 0.15, 1000);

            tone(1000, 0.12, "triangle", 0.12, 1350, 0.08);

        },



        goldAppear() {

            tone(880, 0.07, "sine", 0.08, 1120);

        },



        goldExpire() {

            tone(430, 0.12, "sine", 0.07, 260);

        },



        pause() {

            tone(330, 0.12, "triangle", 0.10, 230);

        },



        gameOver() {

            tone(330, 0.16, "sawtooth", 0.13, 210);

            tone(210, 0.30, "sawtooth", 0.11, 65, 0.13);

        },



        newRecord() {

            tone(520, 0.10, "square", 0.12, 700);

            tone(700, 0.10, "square", 0.12, 900, 0.10);

            tone(900, 0.18, "square", 0.12, 1250, 0.20);

        }

    };



    highScoreEl.textContent = highScore;

    updateSoundButton();

    resetGame();

 
    renderLeaderboard();



    function resetGame() {

        snake = [

            { x: 12, y: 12 },

            { x: 11, y: 12 },

            { x: 10, y: 12 },

            { x: 9, y: 12 }

        ];



        direction = { x: 1, y: 0 };

        nextDirection = { x: 1, y: 0 };

        score = 0;

        stepMs = 135;

        clearGoldFood();

        running = false;

        paused = false;

        gameOver = false;

        lastTick = 0;

        gameStartedAt = 0;

        accumulatedPlayMs = 0;

        lastResumeAt = 0;



        scoreEl.textContent = "0";

        gameTimeEl.textContent = "00:00";

        pauseBtn.textContent = "⏸ Tạm dừng";

        placeFood();

        draw();



        showOverlay(

            "🐍",

            "Snake",

            "Sẵn sàng chưa?",

            "▶ Chơi"

        );

    }



    function startGame() {

        Sound.unlock();

        if (gameOver) {

            resetGame();

        }



        running = true;

        paused = false;

        gameOver = false;

        hideOverlay();

        pauseBtn.textContent = "⏸ Tạm dừng";

        Sound.start();



        cancelAnimationFrame(loopId);

        lastTick = performance.now();

        if (!gameStartedAt) gameStartedAt = lastTick;

        lastResumeAt = lastTick;

        loopId = requestAnimationFrame(gameLoop);

    }



    function gameLoop(timestamp) {

        if (!running) return;



        if (!paused) {

            if (timestamp - lastTick >= stepMs) {

                update();

                lastTick = timestamp;

            }

        }



        updateGameTimeDisplay();

        draw();

        loopId = requestAnimationFrame(gameLoop);

    }



    function update() {

        direction = nextDirection;



        if (goldFood && performance.now() >= goldFoodExpiresAt) {

            expireGoldFood();

        }



        const rawHead = {

            x: snake[0].x + direction.x,

            y: snake[0].y + direction.y

        };



        // Wrap around the board:

        // left -> right, right -> left, top -> bottom, bottom -> top.

        const head = {

            x: (rawHead.x + GRID) % GRID,

            y: (rawHead.y + GRID) % GRID

        };



        const eatRed = head.x === food.x && head.y === food.y;

        const eatGold = goldFood && head.x === goldFood.x && head.y === goldFood.y;

        const willEat = eatRed || eatGold;



        const bodyToCheck = willEat ? snake : snake.slice(0, -1);



        const hitSelf = bodyToCheck.some(

            segment => segment.x === head.x && segment.y === head.y

        );



        if (hitSelf) {

            endGame();

            return;

        }



        snake.unshift(head);



        if (eatRed) {

            // Red apple: +10 points AND grows the snake.

            score += 10;

            scoreEl.textContent = score;

            Sound.eatRed();



            const newSpeed = Math.max(58, 135 - Math.floor(score / 40) * 7);

            stepMs = newSpeed;



            if (score > highScore) {

                highScore = score;

                highScoreEl.textContent = highScore;

                

     
            }



            placeFood();

            maybeSpawnGoldFood();

        } else if (eatGold) {

            // Gold apple: +50 points but DOES NOT grow the snake.

            score += GOLD_SCORE;

            scoreEl.textContent = score;

            Sound.eatGold();



            if (score > highScore) {

                highScore = score;

                highScoreEl.textContent = highScore;

                

     
            }



            clearGoldFood();

            // Gold points do not increase length and do not directly increase speed.

        } else {

            snake.pop();

        }

    }



    function endGame() {
        running = false;
        gameOver = true;

        if (lastResumeAt) {
            accumulatedPlayMs += performance.now() - lastResumeAt;
            lastResumeAt = 0;
        }

        updateGameTimeDisplay();
        const timeMs = Math.round(getCurrentPlayTimeMs());
        const isNewRecord = score > 0 && score >= highScore;

        if (isNewRecord) {
            highScore = score;
            highScoreEl.textContent = highScore;
            Sound.newRecord();
        } else {
            Sound.gameOver();
        }

        if (score > 0 && isTienHubLoggedIn()) {
            saveSnakeScore(score, timeMs).then(() => {
                renderLeaderboard();
            });
        }

        renderLeaderboard();

        showOverlay(
            isNewRecord ? "🏆" : "💥",
            isNewRecord ? "Kỷ lục mới!" : "Game Over",
            `Điểm của bạn: ${score}`,
            "↻ Chơi lại"
        );
    }


    function togglePause() {

        if (!running && !paused) return;



        paused = !paused;



        if (paused) {

            const now = performance.now();

            if (lastResumeAt) accumulatedPlayMs += now - lastResumeAt;

            lastResumeAt = 0;

            pauseBtn.textContent = "▶ Tiếp tục";

            showOverlay("⏸", "Tạm dừng", "Nhấn tiếp tục để chơi.", "▶ Tiếp tục");

            Sound.pause();

        } else {

            pauseBtn.textContent = "⏸ Tạm dừng";

            hideOverlay();

            lastResumeAt = performance.now();

            lastTick = lastResumeAt;

            Sound.start();

        }

    }



    function setDirection(x, y) {

        if (!running || paused) return;



        // Không cho quay đầu 180 độ.

        if (x === -direction.x && y === -direction.y) return;



        nextDirection = { x, y };

    }



    function isOccupiedBySnake(point) {

        return snake.some(

            segment => segment.x === point.x && segment.y === point.y

        );

    }



    function maybeSpawnGoldFood() {

        if (goldFood) return;



        if (Math.random() > GOLD_SPAWN_CHANCE) return;



        let candidate;

        let attempts = 0;



        do {

            candidate = {

                x: Math.floor(Math.random() * GRID),

                y: Math.floor(Math.random() * GRID)

            };

            attempts++;

        } while (

            attempts < 100 &&

            (

                isOccupiedBySnake(candidate) ||

                (candidate.x === food.x && candidate.y === food.y)

            )

        );



        if (

            isOccupiedBySnake(candidate) ||

            (candidate.x === food.x && candidate.y === food.y)

        ) {

            return;

        }



        goldFood = candidate;

        goldFoodExpiresAt = performance.now() + GOLD_LIFETIME_MS;



        clearTimeout(goldExpireTimer);

        goldExpireTimer = setTimeout(() => {

            if (goldFood) expireGoldFood();

        }, GOLD_LIFETIME_MS);



        Sound.goldAppear();

    }



    function clearGoldFood() {

        goldFood = null;

        goldFoodExpiresAt = 0;



        if (goldExpireTimer) {

            clearTimeout(goldExpireTimer);

            goldExpireTimer = null;

        }

    }



    function expireGoldFood() {

        if (!goldFood) return;



        clearGoldFood();

        Sound.goldExpire();

    }



    function placeFood() {

        let candidate;



        do {

            candidate = {

                x: Math.floor(Math.random() * GRID),

                y: Math.floor(Math.random() * GRID)

            };

        } while (

            snake.some(

                segment => segment.x === candidate.x && segment.y === candidate.y

            )

        );



        food = candidate;

    }



    function showOverlay(icon, title, text, buttonText) {

        overlayIcon.textContent = icon;

        overlayTitle.textContent = title;

        overlayText.textContent = text;

        mainBtn.textContent = buttonText;

        overlay.classList.remove("hidden");

    }



    function hideOverlay() {

        overlay.classList.add("hidden");

    }



    function updateGameTimeDisplay() {

        if (!gameTimeEl) return;

        gameTimeEl.textContent = formatClock(getCurrentPlayTimeMs());

    }



    function formatClock(ms) {

        const totalSeconds = Math.max(0, Math.floor(ms / 1000));

        const hours = Math.floor(totalSeconds / 3600);

        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const seconds = totalSeconds % 60;



        if (hours > 0) {

            return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        }

        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    }



    function getCurrentPlayTimeMs() {

        if (!gameStartedAt) return 0;

        const live = lastResumeAt ? performance.now() - lastResumeAt : 0;

        return accumulatedPlayMs + live;

    }



    function formatTime(ms) {

        if (!Number.isFinite(ms) || ms <= 0) return "—";

        const totalSeconds = Math.floor(ms / 1000);

        const minutes = Math.floor(totalSeconds / 60);

        const seconds = totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;

    }



    function getLeaderboardData() {
        return firebaseLeaderboard;
    }

    function renderLeaderboard() {
        const data = sortLeaderboard(getLeaderboardData()).slice(0, 10);

        if (!data.length) {
            leaderboardList.innerHTML = isTienHubLoggedIn()
                ? '<div class="leaderboard-empty">Chưa có dữ liệu BXH.</div>'
                : '<div class="leaderboard-empty">Chưa có dữ liệu BXH.</div>';
            myRankEl.textContent = "—";
            return;
        }

        leaderboardList.innerHTML = data.map((player, index) => `
            <div class="leaderboard-row">
                <span class="rank-number ${index < 3 ? "top" : ""}">${index + 1}</span>
                <div>
                    <span class="player-name">${escapeHtml(player.name || "Người chơi")}</span>
                    <span class="player-time">${formatTime(player.timeMs)}</span>
                </div>
                <strong class="player-score">${Number(player.score || 0).toLocaleString("vi-VN")}</strong>
            </div>
        `).join("");

        updateMyRank();
    }

    function updateMyRank() {
        if (!isTienHubLoggedIn()) {
            myRankEl.textContent = "—";
            return;
        }

        const data = sortLeaderboard(getLeaderboardData());
        const index = data.findIndex(item => item.uid === tienHubUser.uid);
        myRankEl.textContent = index >= 0 ? `#${index + 1}` : "—";

        const mine = index >= 0 ? data[index] : null;
        myHighScoreEl.textContent = mine ? mine.score : highScore;
        myBestTimeEl.textContent = mine ? formatTime(mine.timeMs) : "—";
    }

    function escapeHtml(value) {

        return String(value)

            .replaceAll("&", "&amp;")

            .replaceAll("<", "&lt;")

            .replaceAll(">", "&gt;")

            .replaceAll('"', "&quot;")

            .replaceAll("'", "&#039;");

    }



    function updateSoundButton() {

        soundBtn.textContent = soundEnabled ? "🔊" : "🔇";

        soundBtn.setAttribute(

            "aria-label",

            soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"

        );

    }



    function toggleSound() {

        soundEnabled = !soundEnabled;

        localStorage.setItem(

            "tienhub_snake_sound",

            soundEnabled ? "on" : "off"

        );

        updateSoundButton();



        if (soundEnabled) {

            Sound.start();

        }

    }



    function roundedRect(x, y, width, height, radius) {

        const r = Math.min(radius, width / 2, height / 2);

        ctx.beginPath();

        ctx.moveTo(x + r, y);

        ctx.arcTo(x + width, y, x + width, y + height, r);

        ctx.arcTo(x + width, y + height, x, y + height, r);

        ctx.arcTo(x, y + height, x, y, r);

        ctx.arcTo(x, y, x + width, y, r);

        ctx.closePath();

    }



    function draw() {

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);

        gradient.addColorStop(0, "#07101f");

        gradient.addColorStop(1, "#030711");



        ctx.fillStyle = gradient;

        ctx.fillRect(0, 0, canvas.width, canvas.height);



        drawGrid();

        drawFood();

        drawGoldFood();

        drawSnake();

    }



    function drawGrid() {

        ctx.strokeStyle = "rgba(100, 140, 210, .08)";

        ctx.lineWidth = 1;



        for (let i = 1; i < GRID; i++) {

            const p = i * CELL;



            ctx.beginPath();

            ctx.moveTo(p, 0);

            ctx.lineTo(p, canvas.height);

            ctx.stroke();



            ctx.beginPath();

            ctx.moveTo(0, p);

            ctx.lineTo(canvas.width, p);

            ctx.stroke();

        }

    }



    function drawGoldFood() {

        if (!goldFood) return;



        const centerX = goldFood.x * CELL + CELL / 2;

        const centerY = goldFood.y * CELL + CELL / 2;

        const radius = CELL * .28;



        // Gentle pulsing so the temporary apple is visually distinct.

        const pulse = 1 + Math.sin(performance.now() / 120) * 0.08;



        ctx.save();

        ctx.translate(centerX, centerY);

        ctx.scale(pulse, pulse);



        ctx.shadowBlur = 22;

        ctx.shadowColor = "rgba(255, 205, 48, .9)";



        const goldGradient = ctx.createRadialGradient(

            -radius * .35,

            -radius * .4,

            1,

            0,

            0,

            radius * 1.4

        );

        goldGradient.addColorStop(0, "#fff6a0");

        goldGradient.addColorStop(.35, "#ffd84a");

        goldGradient.addColorStop(1, "#f19b16");



        ctx.fillStyle = goldGradient;

        ctx.beginPath();

        ctx.arc(0, 2, radius, 0, Math.PI * 2);

        ctx.fill();



        ctx.shadowBlur = 0;



        ctx.strokeStyle = "#9bea72";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(1, -radius + 2);

        ctx.quadraticCurveTo(6, -radius - 7, 10, -radius - 4);

        ctx.stroke();



        // Small sparkle.

        ctx.fillStyle = "#fff8cf";

        ctx.beginPath();

        ctx.arc(-radius * .35, -radius * .38, radius * .13, 0, Math.PI * 2);

        ctx.fill();



        ctx.restore();

    }



    function drawSnake() {

        snake.forEach((segment, index) => {

            const padding = index === 0 ? 3 : 4;

            const x = segment.x * CELL + padding;

            const y = segment.y * CELL + padding;

            const size = CELL - padding * 2;



            const isHead = index === 0;



            ctx.shadowBlur = isHead ? 14 : 8;

            ctx.shadowColor = isHead

                ? "rgba(109, 255, 180, .55)"

                : "rgba(50, 230, 161, .28)";



            const bodyGradient = ctx.createLinearGradient(x, y, x + size, y + size);

            bodyGradient.addColorStop(0, isHead ? "#7affba" : "#35e99e");

            bodyGradient.addColorStop(1, isHead ? "#27cf86" : "#159d68");



            ctx.fillStyle = bodyGradient;

            roundedRect(x, y, size, size, isHead ? 7 : 5);

            ctx.fill();



            ctx.shadowBlur = 0;



            if (isHead) {

                drawEyes(x, y, size);

            }

        });

    }



    function drawEyes(x, y, size) {

        ctx.fillStyle = "#06100c";



        let eyes;



        if (direction.x !== 0) {

            eyes = [

                { x: x + size * .68, y: y + size * .28 },

                { x: x + size * .68, y: y + size * .72 }

            ];

        } else {

            eyes = [

                { x: x + size * .28, y: y + size * .68 },

                { x: x + size * .72, y: y + size * .68 }

            ];

        }



        eyes.forEach(eye => {

            ctx.beginPath();

            ctx.arc(eye.x, eye.y, Math.max(2, size * .075), 0, Math.PI * 2);

            ctx.fill();

        });

    }



    function drawFood() {

        const centerX = food.x * CELL + CELL / 2;

        const centerY = food.y * CELL + CELL / 2;

        const radius = CELL * .27;



        ctx.shadowBlur = 18;

        ctx.shadowColor = "rgba(255, 92, 111, .65)";

        ctx.fillStyle = "#ff5f73";



        ctx.beginPath();

        ctx.arc(centerX, centerY + 2, radius, 0, Math.PI * 2);

        ctx.fill();



        ctx.shadowBlur = 0;



        ctx.strokeStyle = "#7cf0a9";

        ctx.lineWidth = 3;

        ctx.beginPath();

        ctx.moveTo(centerX + 1, centerY - radius + 2);

        ctx.quadraticCurveTo(centerX + 6, centerY - radius - 7, centerX + 10, centerY - radius - 4);

        ctx.stroke();

    }



    window.__snakeRenderFirebaseState = function () {
       if (isTienHubLoggedIn()) {
           const mine = firebaseLeaderboard.find(item => item.uid === tienHubUser.uid);
           highScore = mine ? mine.score : 0;
           highScoreEl.textContent = highScore;
           myHighScoreEl.textContent = mine ? mine.score : 0;
           myBestTimeEl.textContent = mine ? formatTime(mine.timeMs) : "—";
       }

       renderLeaderboard();
   };

   window.__snakeRefreshAccountState = function () {
       if (isTienHubLoggedIn()) {
           const mine = firebaseLeaderboard.find(item => item.uid === tienHubUser.uid);
           highScore = mine ? mine.score : 0;
           highScoreEl.textContent = highScore;
           myHighScoreEl.textContent = mine ? mine.score : 0;
           myBestTimeEl.textContent = mine ? formatTime(mine.timeMs) : "—";
       } else {
           highScore = 0;
           highScoreEl.textContent = "0";
           myHighScoreEl.textContent = "0";
           myBestTimeEl.textContent = "—";
           myRankEl.textContent = "—";
       }

       renderLeaderboard();
   };

   mainBtn.addEventListener("click", () => {

        Sound.unlock();



        if (paused) {

            togglePause();

        } else {

            startGame();

        }

    });



    pauseBtn.addEventListener("click", () => {

        Sound.unlock();

        togglePause();

    });



    restartBtn.addEventListener("click", () => {

        Sound.unlock();

        resetGame();

        startGame();

    });



    soundBtn.addEventListener("click", () => {

        if (!soundEnabled) {

            soundEnabled = true;

            localStorage.setItem("tienhub_snake_sound", "on");

            updateSoundButton();

            Sound.start();

        } else {

            toggleSound();

        }

    });



    document.querySelectorAll("[data-dir]").forEach(button => {

        button.addEventListener("click", () => {

            Sound.unlock();

            const dir = button.dataset.dir;



            if (dir === "up") setDirection(0, -1);

            if (dir === "down") setDirection(0, 1);

            if (dir === "left") setDirection(-1, 0);

            if (dir === "right") setDirection(1, 0);

        });

    });



    window.addEventListener("keydown", event => {

        const key = event.key.toLowerCase();



        if (

            ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)

        ) {

            event.preventDefault();

        }



        if (key === "arrowup" || key === "w") setDirection(0, -1);

        if (key === "arrowdown" || key === "s") setDirection(0, 1);

        if (key === "arrowleft" || key === "a") setDirection(-1, 0);

        if (key === "arrowright" || key === "d") setDirection(1, 0);



        if (key === " ") togglePause();



        if (key === "r") {

            resetGame();

            startGame();

        }

    });

})();
