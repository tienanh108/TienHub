"use strict";

(() => {
    // =========================================================
    // CARO 5 - MAIN.JS
    // =========================================================

    // =========================================================
    // 1. CONFIG
    // =========================================================

    const WIN_COUNT = 5;
    const DEFAULT_BOARD_SIZE = 15;
    const MIN_BOARD_SIZE = 15;
    const MAX_BOARD_SIZE = 25;

    const MOVE_TIME = 30;
    const MATCHMAKING_TIMEOUT = 30000;

    const ROOM_LENGTH = 6;

    // =========================================================
    // 2. STATE
    // =========================================================

    let boardSize = DEFAULT_BOARD_SIZE;
    let board = [];

    let currentPlayer = "X";
    let gameOver = false;

    let gameMode = "ai";
    let aiDifficulty = "medium";

    let timerValue = MOVE_TIME;
    let timerInterval = null;

    let scoreX = 0;
    let scoreO = 0;

    let lastMoveIndex = -1;

    let analyticsGameTracked = false;

    // ---------------------------------------------------------
    // Online
    // ---------------------------------------------------------

    let isOnline = false;
    let roomCode = "";
    let onlinePlayer = "";

    let firebaseApp = null;
    let firebaseAuth = null;
    let firebaseDB = null;
    let firebaseUser = null;

    let roomRef = null;
    let playerRef = null;

    let roomListener = null;
    let playerListener = null;

    let onlineHadTwoPlayers = false;
    let leavingRoom = false;
    let lastOnlineWinner = null;

    // ---------------------------------------------------------
    // Matchmaking
    // ---------------------------------------------------------

    let matchmakingRef = null;
    let matchmakingListener = null;
    let matchmakingTimeout = null;

    let matchmakingActive = false;
    let matchmakingProcessing = false;

    let randomMatchButton = null;

    // ---------------------------------------------------------
    // Sound
    // ---------------------------------------------------------

    let caroSoundEnabled = true;

    // =========================================================
    // 3. DOM HELPERS
    // =========================================================

    const $ = (id) => document.getElementById(id);

    const menuScreen = $("menuScreen");
    const gameScreen = $("gameScreen");

    const gameHubButton = $("gameHubButton") || $("TienHuBButton");
    const backMenuButton = $("backMenuButton");

    const aiModeBtn = $("aiModeBtn");
    const pvpModeBtn = $("pvpModeBtn");

    const boardSizeSelect = $("boardSizeSelect");
    const difficultySelect = $("difficultySelect");
    const difficultySection = $("difficultySection");

    const playButton = $("playButton");

    const createRoomButton = $("createRoomButton");
    const joinRoomButton = $("joinRoomButton");
    const roomInput = $("roomInput");

    const firebaseStatus = $("firebaseStatus");

    const boardElement = $("board");

    const turnText = $("turnText");
    const timerElement = $("timer");

    const scoreXElement = $("scoreX");
    const scoreOElement = $("scoreO");

    const roomInfo = $("roomInfo");

    const onlineNotice = $("onlineNotice");

    const resultBox = $("resultBox");
    const resultText = $("resultText");

    const playAgainButton = $("playAgainButton");
    const exitMenuButton = $("exitMenuButton");

    const copyRoomButton = $("copyRoomButton");
    const copyLinkButton = $("copyLinkButton");

    const caroSoundButton = $("caroSoundButton");

    // =========================================================
    // 4. SMALL HELPERS
    // =========================================================

    function clampBoardSize(value) {
        const n = Number(value);

        if (!Number.isFinite(n)) {
            return DEFAULT_BOARD_SIZE;
        }

        return Math.min(
            MAX_BOARD_SIZE,
            Math.max(MIN_BOARD_SIZE, Math.round(n))
        );
    }

    function normalizeRoomCode(value) {
        return String(value || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, ROOM_LENGTH);
    }

    function generateRoomCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let result = "";

        for (let i = 0; i < ROOM_LENGTH; i++) {
            result += chars.charAt(
                Math.floor(Math.random() * chars.length)
            );
        }

        return result;
    }

    function generateMatchRoomCode(uidA, uidB) {
        const a = String(uidA || "");
        const b = String(uidB || "");

        const combined = [a, b].sort().join("_");

        let hash = 0;

        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash |= 0;
        }

        hash = Math.abs(hash);

        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        let code = "";

        for (let i = 0; i < ROOM_LENGTH; i++) {
            code += chars[(hash + i * 17) % chars.length];
        }

        return code;
    }

    function getOpponentPlayer(player) {
        return player === "X" ? "O" : "X";
    }

    function showElement(element) {
        if (element) {
            element.classList.remove("hidden");
        }
    }

    function hideElement(element) {
        if (element) {
            element.classList.add("hidden");
        }
    }

    function setStatus(text) {
        if (firebaseStatus) {
            firebaseStatus.textContent = text;
        }
    }

    function setOnlineNotice(text, visible = true) {
        if (!onlineNotice) {
            return;
        }

        onlineNotice.textContent = text;

        if (visible) {
            onlineNotice.classList.remove("hidden");
        } else {
            onlineNotice.classList.add("hidden");
        }
    }

    // =========================================================
    // 5. SOUND
    // =========================================================

    function updateSoundButton() {
        if (!caroSoundButton) {
            return;
        }

        caroSoundButton.textContent = caroSoundEnabled
            ? "🔊"
            : "🔇";

        caroSoundButton.setAttribute(
            "aria-label",
            caroSoundEnabled
                ? "Tắt âm thanh"
                : "Bật âm thanh"
        );

        caroSoundButton.classList.toggle(
            "muted",
            !caroSoundEnabled
        );
    }

    function playSound(name) {
        if (!caroSoundEnabled) {
            return;
        }

        try {
            if (
                window.GameSound &&
                typeof window.GameSound.play === "function"
            ) {
                window.GameSound.play(name);
                return;
            }

            if (
                window.GameSound &&
                typeof window.GameSound.playSfx === "function"
            ) {
                window.GameSound.playSfx(name);
                return;
            }
        } catch (error) {
            console.warn("Không thể phát âm thanh:", error);
        }
    }

    if (caroSoundButton) {
        caroSoundButton.addEventListener("click", () => {
            caroSoundEnabled = !caroSoundEnabled;
            updateSoundButton();
        });

        updateSoundButton();
    }

    // =========================================================
    // 6. SCORE
    // =========================================================

    function updateScoreUI() {
        if (scoreXElement) {
            scoreXElement.textContent = String(scoreX);
        }

        if (scoreOElement) {
            scoreOElement.textContent = String(scoreO);
        }
    }

    function resetScore() {
        scoreX = 0;
        scoreO = 0;

        updateScoreUI();
    }

    function addScore(player) {
        if (player === "X") {
            scoreX++;
        } else if (player === "O") {
            scoreO++;
        }

        updateScoreUI();
    }

    // =========================================================
    // 7. TIMER
    // =========================================================

    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerUI() {
        if (timerElement) {
            timerElement.textContent = String(timerValue);
        }
    }

    function resetTimer() {
        stopTimer();

        timerValue = MOVE_TIME;

        updateTimerUI();

        if (gameOver) {
            return;
        }

        timerInterval = setInterval(() => {
            if (gameOver) {
                stopTimer();
                return;
            }

            timerValue--;

            if (timerValue < 0) {
                timerValue = 0;
            }

            updateTimerUI();

            if (timerValue <= 0) {
                stopTimer();
                handleTimeOut();
            }
        }, 1000);
    }

    function handleTimeOut() {
        if (gameOver) {
            return;
        }

        playSound("timeout");

        const loser = currentPlayer;
        const winner = getOpponentPlayer(loser);

        finishGame(
            winner,
            `${winner} thắng! ${loser} đã hết thời gian.`
        );
    }

    // =========================================================
    // 8. TURN UI
    // =========================================================

    function updateTurnUI() {
        if (!turnText) {
            return;
        }

        if (gameOver) {
            return;
        }

        if (isOnline) {
            if (onlinePlayer === currentPlayer) {
                turnText.textContent = `Lượt của ${currentPlayer} — Bạn`;
            } else {
                turnText.textContent = `Lượt của ${currentPlayer}`;
            }
        } else {
            if (
                gameMode === "ai" &&
                currentPlayer === "O"
            ) {
                turnText.textContent = "Lượt của máy";
            } else {
                turnText.textContent = `Lượt của ${currentPlayer}`;
            }
        }
    }

    // =========================================================
    // 9. BOARD SIZE / RESIZE
    // =========================================================

    function calculateCellSize() {
        if (!boardElement || !gameScreen) {
            return;
        }

        if (gameScreen.classList.contains("hidden")) {
            return;
        }

        const boardScroll = document.querySelector(".board-scroll");

        if (!boardScroll) {
            return;
        }

        const rect = boardScroll.getBoundingClientRect();

        const style = window.getComputedStyle(boardScroll);

        const paddingX =
            (parseFloat(style.paddingLeft) || 0) +
            (parseFloat(style.paddingRight) || 0);

        const paddingY =
            (parseFloat(style.paddingTop) || 0) +
            (parseFloat(style.paddingBottom) || 0);

        const availableWidth = Math.max(
            1,
            rect.width - paddingX - 6
        );

        const availableHeight = Math.max(
            1,
            rect.height - paddingY - 6
        );

        let cellSize = Math.floor(
            Math.min(
                availableWidth / boardSize,
                availableHeight / boardSize
            )
        );

        cellSize = Math.max(12, cellSize);

        boardElement.style.setProperty(
            "--cell-size",
            `${cellSize}px`
        );

        boardElement.style.setProperty(
            "--board-size",
            String(boardSize)
        );
    }

    let resizeFrame = null;

    function scheduleBoardResize() {
        if (resizeFrame !== null) {
            cancelAnimationFrame(resizeFrame);
        }

        resizeFrame = requestAnimationFrame(() => {
            resizeFrame = null;
            calculateCellSize();
        });
    }

    window.addEventListener("resize", scheduleBoardResize);

    window.addEventListener(
        "orientationchange",
        () => {
            setTimeout(scheduleBoardResize, 100);
            setTimeout(scheduleBoardResize, 400);
        }
    );

    if (window.visualViewport) {
        window.visualViewport.addEventListener(
            "resize",
            scheduleBoardResize
        );

        window.visualViewport.addEventListener(
            "scroll",
            scheduleBoardResize
        );
    }

    document.addEventListener(
        "fullscreenchange",
        () => {
            setTimeout(scheduleBoardResize, 100);
            setTimeout(scheduleBoardResize, 400);
        }
    );

    // =========================================================
    // 10. BOARD
    // =========================================================

    function createEmptyBoard() {
        board = Array(boardSize * boardSize).fill("");
    }

    function getRow(index) {
        return Math.floor(index / boardSize);
    }

    function getCol(index) {
        return index % boardSize;
    }

    function getIndex(row, col) {
        return row * boardSize + col;
    }

    function isInside(row, col) {
        return (
            row >= 0 &&
            row < boardSize &&
            col >= 0 &&
            col < boardSize
        );
    }

    function renderBoard() {
        if (!boardElement) {
            return;
        }

        boardElement.innerHTML = "";

        boardElement.style.setProperty(
            "--board-size",
            String(boardSize)
        );

        for (let i = 0; i < board.length; i++) {
            const cell = document.createElement("button");

            cell.type = "button";
            cell.className = "cell";

            cell.dataset.index = String(i);

            const value = board[i];

            if (value) {
                cell.textContent = value;
                cell.classList.add(
                    value === "X" ? "x" : "o"
                );
            }

            if (i === lastMoveIndex) {
                cell.classList.add("last-move");
            }

            cell.addEventListener("click", () => {
                handleCellClick(i);
            });

            boardElement.appendChild(cell);
        }

        scheduleBoardResize();
    }

    function updateSingleCell(index) {
        if (!boardElement) {
            return;
        }

        const cell = boardElement.children[index];

        if (!cell) {
            return;
        }

        const value = board[index];

        cell.textContent = value || "";

        cell.classList.remove("x", "o");

        if (value) {
            cell.classList.add(
                value === "X" ? "x" : "o"
            );
        }
    }

    function markLastMove(index) {
        if (!boardElement) {
            return;
        }

        const cells = boardElement.children;

        for (let i = 0; i < cells.length; i++) {
            cells[i].classList.remove("last-move");
        }

        if (cells[index]) {
            cells[index].classList.add("last-move");
        }
    }

    // =========================================================
    // 11. WIN CHECK
    // =========================================================

    function countDirection(
        row,
        col,
        rowDirection,
        colDirection,
        player
    ) {
        let count = 0;

        let r = row + rowDirection;
        let c = col + colDirection;

        while (
            isInside(r, c) &&
            board[getIndex(r, c)] === player
        ) {
            count++;

            r += rowDirection;
            c += colDirection;
        }

        return count;
    }

    function checkWin(index, player) {
        const row = getRow(index);
        const col = getCol(index);

        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
        ];

        for (const [dr, dc] of directions) {
            const count =
                1 +
                countDirection(
                    row,
                    col,
                    dr,
                    dc,
                    player
                ) +
                countDirection(
                    row,
                    col,
                    -dr,
                    -dc,
                    player
                );

            if (count >= WIN_COUNT) {
                return true;
            }
        }

        return false;
    }

    function checkDraw() {
        return board.every(Boolean);
    }

    // =========================================================
    // 12. FINISH GAME
    // =========================================================

    function showResult(text) {
        if (!resultBox || !resultText) {
            return;
        }

        resultText.textContent = text;

        resultBox.classList.remove("hidden");
    }

    function hideResult() {
        if (resultBox) {
            resultBox.classList.add("hidden");
        }
    }

    function finishGame(winner, message) {
        if (gameOver) {
            return;
        }

        gameOver = true;

        stopTimer();

        addScore(winner);

        playSound("win");

        updateTurnUI();

        showResult(message);

        if (isOnline) {
            lastOnlineWinner = winner;

            updateOnlineRoomAfterGame(winner);
        }
    }

    function finishDraw() {
        if (gameOver) {
            return;
        }

        gameOver = true;

        stopTimer();

        playSound("draw");

        showResult("🤝 Hòa! Bàn cờ đã kín.");

        if (isOnline) {
            updateOnlineRoomAfterGame(null);
        }
    }

    // =========================================================
    // 13. MAKE MOVE
    // =========================================================

    function makeLocalMove(index, player) {
        if (gameOver) {
            return false;
        }

        if (board[index]) {
            return false;
        }

        board[index] = player;

        lastMoveIndex = index;

        updateSingleCell(index);
        markLastMove(index);

        playSound(
            player === "X"
                ? "moveX"
                : "moveO"
        );

        if (checkWin(index, player)) {
            finishGame(
                player,
                `🎉 ${player} thắng!`
            );

            return true;
        }

        if (checkDraw()) {
            finishDraw();
            return true;
        }

        currentPlayer = getOpponentPlayer(player);

        updateTurnUI();

        resetTimer();

        return true;
    }

    // =========================================================
    // 14. CELL CLICK
    // =========================================================

    function handleCellClick(index) {
        if (gameOver) {
            return;
        }

        if (board[index]) {
            return;
        }

        // -----------------------------------------------------
        // Online
        // -----------------------------------------------------

        if (isOnline) {
            if (!onlinePlayer) {
                return;
            }

            if (currentPlayer !== onlinePlayer) {
                return;
            }

            makeOnlineMove(index);

            return;
        }

        // -----------------------------------------------------
        // Offline AI
        // -----------------------------------------------------

        if (gameMode === "ai") {
            if (currentPlayer !== "X") {
                return;
            }

            const moved = makeLocalMove(index, "X");

            if (!moved || gameOver) {
                return;
            }

            setTimeout(() => {
                if (!gameOver && currentPlayer === "O") {
                    makeAIMove();
                }
            }, 220);

            return;
        }

        // -----------------------------------------------------
        // Offline PvP
        // -----------------------------------------------------

        makeLocalMove(
            index,
            currentPlayer
        );
    }

    // =========================================================
    // 15. AI
    // =========================================================

    function findWinningMove(player) {
        for (let i = 0; i < board.length; i++) {
            if (board[i]) {
                continue;
            }

            board[i] = player;

            const wins = checkWin(i, player);

            board[i] = "";

            if (wins) {
                return i;
            }
        }

        return -1;
    }

    function getCenterIndex() {
        const center = Math.floor(boardSize / 2);

        return getIndex(center, center);
    }

    function getEmptyCells() {
        const result = [];

        for (let i = 0; i < board.length; i++) {
            if (!board[i]) {
                result.push(i);
            }
        }

        return result;
    }

    function getNearbyEmptyCells() {
        const result = [];

        const occupied = [];

        for (let i = 0; i < board.length; i++) {
            if (board[i]) {
                occupied.push(i);
            }
        }

        if (occupied.length === 0) {
            return [];
        }

        const used = new Set();

        for (const index of occupied) {
            const row = getRow(index);
            const col = getCol(index);

            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = row + dr;
                    const c = col + dc;

                    if (!isInside(r, c)) {
                        continue;
                    }

                    const nextIndex = getIndex(r, c);

                    if (
                        !board[nextIndex] &&
                        !used.has(nextIndex)
                    ) {
                        used.add(nextIndex);
                        result.push(nextIndex);
                    }
                }
            }
        }

        return result;
    }

    function evaluateMove(index, player) {
        const row = getRow(index);
        const col = getCol(index);

        let score = 0;

        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
        ];

        for (const [dr, dc] of directions) {
            const own =
                countDirection(
                    row,
                    col,
                    dr,
                    dc,
                    player
                ) +
                countDirection(
                    row,
                    col,
                    -dr,
                    -dc,
                    player
                );

            const opponent =
                countDirection(
                    row,
                    col,
                    dr,
                    dc,
                    getOpponentPlayer(player)
                ) +
                countDirection(
                    row,
                    col,
                    -dr,
                    -dc,
                    getOpponentPlayer(player)
                );

            score += own * 10;
            score += opponent * 6;
        }

        const center = Math.floor(boardSize / 2);

        const distance =
            Math.abs(row - center) +
            Math.abs(col - center);

        score += Math.max(
            0,
            boardSize - distance
        );

        return score;
    }

    function findBestMove() {
        const nearby = getNearbyEmptyCells();

        const candidates =
            nearby.length > 0
                ? nearby
                : getEmptyCells();

        if (candidates.length === 0) {
            return -1;
        }

        // -----------------------------------------------------
        // Easy
        // -----------------------------------------------------

        if (aiDifficulty === "easy") {
            return candidates[
                Math.floor(
                    Math.random() *
                    candidates.length
                )
            ];
        }

        // -----------------------------------------------------
        // Medium / Hard / Extreme
        // -----------------------------------------------------

        let bestIndex = candidates[0];
        let bestScore = -Infinity;

        for (const index of candidates) {
            board[index] = "O";

            const attackScore =
                evaluateMove(index, "O");

            board[index] = "X";

            const defenseScore =
                evaluateMove(index, "X");

            board[index] = "";

            let score =
                attackScore * 1.2 +
                defenseScore;

            if (
                index === getCenterIndex()
            ) {
                score += 100;
            }

            if (
                aiDifficulty === "hard"
            ) {
                score += Math.random() * 10;
            }

            if (
                aiDifficulty === "extreme"
            ) {
                score += Math.random() * 2;
            }

            if (score > bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }

        return bestIndex;
    }

    function makeAIMove() {
        if (gameOver) {
            return;
        }

        if (currentPlayer !== "O") {
            return;
        }

        let move = -1;

        // -----------------------------------------------------
        // 1. AI can win
        // -----------------------------------------------------

        move = findWinningMove("O");

        // -----------------------------------------------------
        // 2. Block player
        // -----------------------------------------------------

        if (move === -1) {
            move = findWinningMove("X");
        }

        // -----------------------------------------------------
        // 3. Center
        // -----------------------------------------------------

        if (
            move === -1 &&
            !board[getCenterIndex()]
        ) {
            move = getCenterIndex();
        }

        // -----------------------------------------------------
        // 4. Difficulty
        // -----------------------------------------------------

        if (move === -1) {
            move = findBestMove();
        }

        // -----------------------------------------------------
        // 5. Fallback
        // -----------------------------------------------------

        if (move === -1) {
            const empty = getEmptyCells();

            if (empty.length > 0) {
                move =
                    empty[
                        Math.floor(
                            Math.random() *
                            empty.length
                        )
                    ];
            }
        }

        if (move !== -1) {
            makeLocalMove(move, "O");
        }
    }

    // =========================================================
    // 16. AI DIFFICULTY
    // =========================================================

    function setAIDifficulty(value) {
        const allowed = [
            "easy",
            "medium",
            "hard",
            "extreme"
        ];

        if (!allowed.includes(value)) {
            value = "medium";
        }

        aiDifficulty = value;

        if (difficultySelect) {
            difficultySelect.value = value;
        }
    }

    function updateDifficultyVisibility() {
        if (!difficultySection) {
            return;
        }

        if (gameMode === "ai") {
            difficultySection.classList.remove("hidden");

            if (difficultySelect) {
                difficultySelect.disabled = false;
            }
        } else {
            difficultySection.classList.add("hidden");

            if (difficultySelect) {
                difficultySelect.disabled = true;
            }
        }
    }

    // =========================================================
    // 17. GAME MODE
    // =========================================================

    function setGameMode(mode) {
        if (
            mode !== "ai" &&
            mode !== "pvp"
        ) {
            mode = "ai";
        }

        gameMode = mode;

        if (aiModeBtn) {
            aiModeBtn.classList.toggle(
                "active",
                mode === "ai"
            );
        }

        if (pvpModeBtn) {
            pvpModeBtn.classList.toggle(
                "active",
                mode === "pvp"
            );
        }

        updateDifficultyVisibility();
    }

    if (aiModeBtn) {
        aiModeBtn.addEventListener(
            "click",
            () => {
                setGameMode("ai");
            }
        );
    }

    if (pvpModeBtn) {
        pvpModeBtn.addEventListener(
            "click",
            () => {
                setGameMode("pvp");
            }
        );
    }

    if (difficultySelect) {
        difficultySelect.addEventListener(
            "change",
            () => {
                setAIDifficulty(
                    difficultySelect.value
                );
            }
        );
    }

    if (boardSizeSelect) {
        boardSizeSelect.addEventListener(
            "change",
            () => {
                boardSize =
                    clampBoardSize(
                        boardSizeSelect.value
                    );
            }
        );
    }

    // =========================================================
    // 18. START OFFLINE GAME
    // =========================================================

    function startOfflineGame() {
        isOnline = false;

        roomCode = "";
        onlinePlayer = "";

        lastOnlineWinner = null;

        boardSize = clampBoardSize(
            boardSizeSelect
                ? boardSizeSelect.value
                : DEFAULT_BOARD_SIZE
        );

        gameOver = false;

        currentPlayer = "X";

        lastMoveIndex = -1;

        createEmptyBoard();

        hideResult();

        setOnlineNotice("", false);

        if (roomInfo) {
            roomInfo.textContent = "";
        }

        hideElement(copyRoomButton);
        hideElement(copyLinkButton);

        updateTurnUI();

        resetTimer();

        renderBoard();

        showGame();

        if (gameMode === "ai") {
            playSound("start");
        } else {
            playSound("start");
        }
    }

    function startNewRound() {

        trackGameStart();
        if (isOnline) {
            startNewOnlineRound();

            return;
        }

        gameOver = false;

        currentPlayer = "X";

        lastMoveIndex = -1;

        createEmptyBoard();

        hideResult();

        updateTurnUI();

        renderBoard();

        resetTimer();

        playSound("start");
    }

    // =========================================================
    // 19. SHOW / HIDE SCREENS
    // =========================================================

    function showGame() {
        if (menuScreen) {
            menuScreen.classList.add("hidden");
        }

        if (gameScreen) {
            gameScreen.classList.remove("hidden");
        }

        setTimeout(() => {
            scheduleBoardResize();
        }, 50);

        setTimeout(() => {
            scheduleBoardResize();
        }, 250);
    }

    function showMenu() {
        stopTimer();

        if (matchmakingActive) {
            cancelMatchmaking();
        }

        if (isOnline) {
            leaveRoom();
        }

        isOnline = false;

        roomCode = "";
        onlinePlayer = "";

        if (gameScreen) {
            gameScreen.classList.add("hidden");
        }

        if (menuScreen) {
            menuScreen.classList.remove("hidden");
        }

        hideResult();

        setOnlineNotice("", false);

        if (roomInfo) {
            roomInfo.textContent = "";
        }

        hideElement(copyRoomButton);
        hideElement(copyLinkButton);

        setTimeout(() => {
            updateDifficultyVisibility();
        }, 0);
    }

    // =========================================================
    // 20. MENU BUTTONS
    // =========================================================

    if (playButton) {
        playButton.addEventListener(
            "click",
            () => {
                startOfflineGame();
            }
        );
    }

    if (gameHubButton) {
        gameHubButton.addEventListener(
            "click",
            () => {
                window.location.href =
                    "../../index.html";
            }
        );
    }

    if (backMenuButton) {
        backMenuButton.addEventListener(
            "click",
            () => {
                showMenu();
            }
        );
    }

    if (exitMenuButton) {
        exitMenuButton.addEventListener(
            "click",
            () => {
                showMenu();
            }
        );
    }

    if (playAgainButton) {
        playAgainButton.addEventListener(
            "click",
            () => {
                startNewRound();
            }
        );
    }

    // =========================================================
    // 21. FIREBASE
    // =========================================================

    const firebaseConfig = {
        apiKey: "AIzaSyA2uJ2-lHYjNeA40kFoS1-VsCaqhjYszdw",
        authDomain: "caro-3460d.firebaseapp.com",
        databaseURL:
            "https://caro-3460d-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "caro-3460d",
        storageBucket: "caro-3460d.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    /*
     * Nếu file gamehub.js của bạn đã có Firebase config,
     * phần init bên dưới sẽ ưu tiên dùng GameHub.
     */

    async function initFirebase() {
        try {
            if (
                window.GameHub &&
                window.GameHub.ready
            ) {
                await window.GameHub.ready;

                if (
                    typeof window.GameHub.getAuth ===
                    "function"
                ) {
                    firebaseAuth =
                        window.GameHub.getAuth();
                }

                if (
                    typeof window.GameHub.getDatabase ===
                    "function"
                ) {
                    firebaseDB =
                        window.GameHub.getDatabase();
                }

                if (
                    typeof window.GameHub.getUser ===
                    "function"
                ) {
                    firebaseUser =
                        window.GameHub.getUser();
                }
            }

            // -------------------------------------------------
            // Fallback nếu GameHub không cung cấp
            // -------------------------------------------------

            if (
                !firebaseApp &&
                window.firebase
            ) {
                try {
                    if (
                        firebase.apps &&
                        firebase.apps.length > 0
                    ) {
                        firebaseApp =
                            firebase.apps[0];
                    } else {
                        firebaseApp =
                            firebase.initializeApp(
                                firebaseConfig,
                                "Caro5"
                            );
                    }
                } catch (error) {
                    console.warn(
                        "Firebase app init:",
                        error
                    );

                    try {
                        firebaseApp =
                            firebase.app();
                    } catch (_) {}
                }
            }

            if (
                !firebaseAuth &&
                firebaseApp &&
                window.firebase
            ) {
                firebaseAuth =
                    firebase.auth(firebaseApp);
            }

            if (
                !firebaseDB &&
                firebaseApp &&
                window.firebase
            ) {
                firebaseDB =
                    firebase.database(firebaseApp);
            }

            // -------------------------------------------------
            // Chờ anonymous auth
            // -------------------------------------------------

            if (
                firebaseAuth &&
                !firebaseUser
            ) {
                if (firebaseAuth.currentUser) {
                    firebaseUser =
                        firebaseAuth.currentUser;
                } else {
                    const result =
                        await firebaseAuth.signInAnonymously();

                    firebaseUser =
                        result.user;
                }
            }

            if (
                !firebaseDB ||
                !firebaseUser
            ) {
                throw new Error(
                    "Không lấy được Firebase Database hoặc User."
                );
            }

            // =================================================
            // GLOBAL PRESENCE — CARO 5
            // Để TienHub homepage biết chính xác ai đang ở Caro.
            // =================================================
            try {
                const presenceSessionId =
                    `caro5_${Date.now()}_${Math.random().toString(36).slice(2)}`;

                const presenceRef = firebaseDB.ref(
                    `presence/${firebaseUser.uid}/${presenceSessionId}`
                );

                await presenceRef.set({
                    game: "caro5",
                    online: true,
                    updatedAt: firebase.database.ServerValue.TIMESTAMP
                });

                await presenceRef.onDisconnect().remove();

                window.addEventListener("beforeunload", () => {
                    presenceRef.remove().catch(() => {});
                });
            } catch (presenceError) {
                console.warn("Caro5 presence error:", presenceError);
            }

            setStatus("🟢 Đã kết nối online");

            return true;
        } catch (error) {
            console.error(
                "Firebase initialization error:",
                error
            );

            setStatus(
                "🔴 Chưa kết nối online"
            );

            return false;
        }
    }

    // =========================================================
    // 22. ROOM PATHS
    // =========================================================

    function getRoomRef(code = roomCode) {
    if (!firebaseDB || !code) {
        return null;
    }

    return firebaseDB.ref(
        `rooms/caro5/${code}`
    );
}

    function getPlayerRef(
        code = roomCode,
        player = onlinePlayer
    ) {
        const ref = getRoomRef(code);

        if (!ref || !player) {
            return null;
        }

        return ref.child(
            `players/${player}`
        );
    }

    // =========================================================
    // 23. CREATE ROOM
    // =========================================================

    async function createRoom() {
        if (matchmakingActive) {
            cancelMatchmaking();
        }

        if (!firebaseDB || !firebaseUser) {
            const ok = await initFirebase();

            if (!ok) {
                alert(
                    "Không thể kết nối Firebase."
                );

                return;
            }
        }

        let code = generateRoomCode();

        let ref = getRoomRef(code);

        let attempts = 0;

        while (attempts < 10) {
            attempts++;

            try {
                const snapshot =
                    await ref.once("value");

                if (!snapshot.exists()) {
                    break;
                }

                code = generateRoomCode();
                ref = getRoomRef(code);
            } catch (error) {
                console.error(error);
                break;
            }
        }

        roomCode = code;
        onlinePlayer = "X";

        isOnline = true;

        boardSize = clampBoardSize(
            boardSizeSelect
                ? boardSizeSelect.value
                : DEFAULT_BOARD_SIZE
        );

        board = Array(
            boardSize * boardSize
        ).fill("");

        currentPlayer = "X";
        gameOver = false;
        lastMoveIndex = -1;
        onlineHadTwoPlayers = false;
        leavingRoom = false;

        roomRef = getRoomRef(roomCode);
        playerRef = getPlayerRef(
            roomCode,
            onlinePlayer
        );

        try {
            await roomRef.set({
                status: "waiting",
                createdAt:
                    firebase.database.ServerValue.TIMESTAMP,

                boardSize,

                currentPlayer: "X",

                board: board,

                winner: null,

                players: {
                    X: {
                        uid: firebaseUser.uid,
                        joinedAt:
                            firebase.database.ServerValue.TIMESTAMP
                    }
                }
            });

            await playerRef.onDisconnect().remove();

            await roomRef
                .child("players")
                .child("X")
                .onDisconnect()
                .remove();

            showGame();

            updateOnlineUI();

            listenRoom();

            hideResult();

            renderBoard();

            resetTimer();

            setOnlineNotice(
                `Phòng ${roomCode} đang chờ người chơi O...`,
                true
            );

            playSound("start");

            if (copyRoomButton) {
                showElement(copyRoomButton);
            }

            if (copyLinkButton) {
                showElement(copyLinkButton);
            }
        } catch (error) {
            console.error(
                "Create room error:",
                error
            );

            isOnline = false;

            alert(
                "Không thể tạo phòng. Vui lòng thử lại."
            );
        }
    }

    // =========================================================
    // 24. JOIN ROOM
    // =========================================================

    async function joinRoom(code) {
        code = normalizeRoomCode(code);

        if (!code) {
            alert("Hãy nhập mã phòng.");

            return;
        }

        if (!firebaseDB || !firebaseUser) {
            const ok = await initFirebase();

            if (!ok) {
                alert(
                    "Không thể kết nối Firebase."
                );

                return;
            }
        }

        if (matchmakingActive) {
            cancelMatchmaking();
        }

        const ref = getRoomRef(code);

        if (!ref) {
            return;
        }

        try {
            const snapshot =
                await ref.once("value");

            if (!snapshot.exists()) {
                alert(
                    "Không tìm thấy phòng này."
                );

                return;
            }

            const data = snapshot.val() || {};

            const players =
                data.players || {};

            if (players.O) {
                alert(
                    "Phòng đã đủ 2 người."
                );

                return;
            }

            roomCode = code;
            onlinePlayer = "O";

            isOnline = true;

            boardSize = clampBoardSize(
                data.boardSize ||
                (boardSizeSelect
                    ? boardSizeSelect.value
                    : DEFAULT_BOARD_SIZE)
            );

            board =
                Array.isArray(data.board)
                    ? data.board.slice()
                    : Array(
                        boardSize *
                        boardSize
                    ).fill("");

            while (
                board.length <
                boardSize * boardSize
            ) {
                board.push("");
            }

            board.length =
                boardSize * boardSize;

            currentPlayer =
                data.currentPlayer ||
                "X";

            gameOver = false;
            lastMoveIndex = -1;
            onlineHadTwoPlayers = true;
            leavingRoom = false;

            roomRef = ref;

            playerRef =
                getPlayerRef(
                    roomCode,
                    onlinePlayer
                );

            await playerRef.set({
                uid: firebaseUser.uid,
                joinedAt:
                    firebase.database.ServerValue.TIMESTAMP
            });

            await playerRef.onDisconnect().remove();

            await roomRef
                .child("status")
                .set("playing");

            showGame();

            updateOnlineUI();

            listenRoom();

            hideResult();

            renderBoard();

            resetTimer();

            setOnlineNotice(
                "🟢 Đã vào phòng. Chờ lượt của bạn.",
                true
            );

            playSound("join");

            if (copyRoomButton) {
                showElement(copyRoomButton);
            }

            if (copyLinkButton) {
                showElement(copyLinkButton);
            }
        } catch (error) {
            console.error(
                "Join room error:",
                error
            );

            isOnline = false;

            alert(
                "Không thể vào phòng."
            );
        }
    }

    // =========================================================
    // 25. ROOM LISTENER
    // =========================================================

    function removeRoomListeners() {
        if (roomRef && roomListener) {
            roomRef.off(
                "value",
                roomListener
            );
        }

        if (playerRef && playerListener) {
            playerRef.off(
                "value",
                playerListener
            );
        }

        roomListener = null;
        playerListener = null;
    }

    function listenRoom() {
        removeRoomListeners();

        if (!roomRef) {
            return;
        }

        roomListener = (snapshot) => {
            const data =
                snapshot.val();

            if (!data) {
                if (
                    isOnline &&
                    !leavingRoom
                ) {
                    handleOpponentLeft();
                }

                return;
            }

            applyOnlineRoomData(data);
        };

        roomRef.on(
            "value",
            roomListener
        );
    }

    function applyOnlineRoomData(data) {
        if (!isOnline) {
            return;
        }

        // -----------------------------------------------------
        // Board size
        // -----------------------------------------------------

        if (data.boardSize) {
            const nextSize =
                clampBoardSize(
                    data.boardSize
                );

            if (
                nextSize !== boardSize
            ) {
                boardSize = nextSize;

                if (boardSizeSelect) {
                    boardSizeSelect.value =
                        String(boardSize);
                }
            }
        }

        // -----------------------------------------------------
        // Board
        // -----------------------------------------------------

        if (Array.isArray(data.board)) {
            board =
                data.board.slice();

            while (
                board.length <
                boardSize * boardSize
            ) {
                board.push("");
            }

            board.length =
                boardSize * boardSize;
        } else {
            board =
                Array(
                    boardSize *
                    boardSize
                ).fill("");
        }

        currentPlayer =
            data.currentPlayer ||
            "X";

        // -----------------------------------------------------
        // Winner
        // -----------------------------------------------------

        if (
            data.winner &&
            !gameOver
        ) {
            const winner =
                data.winner;

            gameOver = true;

            stopTimer();

            if (
                winner === onlinePlayer
            ) {
                addScore(winner);

                showResult(
                    `🎉 ${winner} thắng!`
                );
            } else {
                showResult(
                    `😔 ${winner} thắng.`
                );
            }

            updateTurnUI();

            renderBoard();

            return;
        }

        // -----------------------------------------------------
        // Draw
        // -----------------------------------------------------

        if (
            data.status === "draw" &&
            !gameOver
        ) {
            gameOver = true;

            stopTimer();

            showResult(
                "🤝 Ván đấu hòa!"
            );

            renderBoard();

            return;
        }

        // -----------------------------------------------------
        // Players
        // -----------------------------------------------------

        const players =
            data.players || {};

        const hasX =
            !!players.X;

        const hasO =
            !!players.O;

        if (hasX && hasO) {
            onlineHadTwoPlayers = true;

            if (
                data.status !== "finished"
            ) {
                setOnlineNotice(
                    currentPlayer === onlinePlayer
                        ? `🟢 Đến lượt bạn (${onlinePlayer})`
                        : `⏳ Đang chờ ${currentPlayer} đi...`,
                    true
                );
            }
        } else if (hasX && !hasO) {
            setOnlineNotice(
                `Phòng ${roomCode} đang chờ người chơi O...`,
                true
            );
        } else if (!hasX && hasO) {
            setOnlineNotice(
                `Phòng ${roomCode} đang chờ người chơi X...`,
                true
            );
        }

        // -----------------------------------------------------
        // Render
        // -----------------------------------------------------

        renderBoard();

        updateTurnUI();

        // -----------------------------------------------------
        // Timer
        // -----------------------------------------------------

        if (
            !gameOver &&
            hasX &&
            hasO
        ) {
            resetTimer();
        }
    }

    // =========================================================
    // 26. ONLINE UI
    // =========================================================

    function updateOnlineUI() {
        if (roomInfo) {
            if (roomCode) {
                roomInfo.textContent =
                    ` • Phòng ${roomCode} • ${onlinePlayer}`;
            } else {
                roomInfo.textContent = "";
            }
        }

        if (copyRoomButton) {
            if (isOnline) {
                showElement(copyRoomButton);
            } else {
                hideElement(copyRoomButton);
            }
        }

        if (copyLinkButton) {
            if (isOnline) {
                showElement(copyLinkButton);
            } else {
                hideElement(copyLinkButton);
            }
        }

        updateTurnUI();
    }

    // =========================================================
    // 27. ONLINE MOVE
    // =========================================================

    async function makeOnlineMove(index) {
        if (!isOnline) {
            return;
        }

        if (!roomRef) {
            return;
        }

        if (gameOver) {
            return;
        }

        if (
            currentPlayer !== onlinePlayer
        ) {
            return;
        }

        if (board[index]) {
            return;
        }

        const nextBoard =
            board.slice();

        nextBoard[index] =
            onlinePlayer;

        let winner = null;
        let draw = false;

        if (
            checkWinOnBoard(
                nextBoard,
                index,
                onlinePlayer,
                boardSize
            )
        ) {
            winner = onlinePlayer;
        } else if (
            nextBoard.every(Boolean)
        ) {
            draw = true;
        }

        const nextPlayer =
            winner || draw
                ? currentPlayer
                : getOpponentPlayer(
                    onlinePlayer
                );

        try {
            const updates = {
                board: nextBoard,
                currentPlayer: nextPlayer
            };

            if (winner) {
                updates.winner =
                    winner;

                updates.status =
                    "finished";
            } else if (draw) {
                updates.winner = null;

                updates.status =
                    "draw";
            } else {
                updates.status =
                    "playing";
            }

            await roomRef.update(
                updates
            );
        } catch (error) {
            console.error(
                "Online move error:",
                error
            );
        }
    }

    function checkWinOnBoard(
        targetBoard,
        index,
        player,
        size
    ) {
        const getR = (i) =>
            Math.floor(i / size);

        const getC = (i) =>
            i % size;

        const inside = (r, c) =>
            r >= 0 &&
            r < size &&
            c >= 0 &&
            c < size;

        const count = (
            row,
            col,
            dr,
            dc
        ) => {
            let total = 0;

            let r = row + dr;
            let c = col + dc;

            while (
                inside(r, c) &&
                targetBoard[
                    r * size + c
                ] === player
            ) {
                total++;

                r += dr;
                c += dc;
            }

            return total;
        };

        const row = getR(index);
        const col = getC(index);

        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1]
        ];

        for (
            const [dr, dc]
            of directions
        ) {
            const total =
                1 +
                count(
                    row,
                    col,
                    dr,
                    dc
                ) +
                count(
                    row,
                    col,
                    -dr,
                    -dc
                );

            if (
                total >= WIN_COUNT
            ) {
                return true;
            }
        }

        return false;
    }

    // =========================================================
    // 28. ONLINE GAME FINISH
    // =========================================================

    async function updateOnlineRoomAfterGame(
        winner
    ) {
        if (!roomRef) {
            return;
        }

        try {
            if (winner) {
                await roomRef.update({
                    winner,
                    status: "finished"
                });
            } else {
                await roomRef.update({
                    winner: null,
                    status: "draw"
                });
            }
        } catch (error) {
            console.error(
                "Update online result error:",
                error
            );
        }
    }

    // =========================================================
    // 29. NEW ONLINE ROUND
    // =========================================================

    async function startNewOnlineRound() {
        if (!isOnline || !roomRef) {
            return;
        }

        gameOver = false;

        currentPlayer = "X";

        lastMoveIndex = -1;

        const newBoard =
            Array(
                boardSize *
                boardSize
            ).fill("");

        board =
            newBoard.slice();

        hideResult();

        try {
            await roomRef.update({
                board: newBoard,
                currentPlayer: "X",
                winner: null,
                status: "playing",
                boardSize
            });

            resetTimer();

            updateTurnUI();

            renderBoard();

            setOnlineNotice(
                "🔄 Ván mới bắt đầu!",
                true
            );

            playSound("start");
        } catch (error) {
            console.error(
                "Start new online round error:",
                error
            );
        }
    }

    // =========================================================
    // 30. OPPONENT LEFT
    // =========================================================

    function handleOpponentLeft() {
        if (!isOnline) {
            return;
        }

        stopTimer();

        gameOver = true;

        setOnlineNotice(
            "⚠️ Người chơi còn lại đã rời phòng.",
            true
        );

        showResult(
            "Người chơi còn lại đã rời phòng."
        );
    }

    // =========================================================
    // 31. LEAVE ROOM
    // =========================================================

    async function leaveRoom() {
        if (!isOnline) {
            return;
        }

        leavingRoom = true;

        stopTimer();

        removeRoomListeners();

        try {
            if (playerRef) {
                await playerRef.remove();
            }

            if (
                roomRef &&
                onlinePlayer
            ) {
                const snapshot =
                    await roomRef.once(
                        "value"
                    );

                const data =
                    snapshot.val();

                if (data) {
                    const players =
                        data.players ||
                        {};

                    delete players[
                        onlinePlayer
                    ];

                    const remaining =
                        Object.keys(
                            players
                        ).length;

                    if (remaining === 0) {
                        await roomRef.remove();
                    } else {
                        await roomRef.update({
                            players,
                            status:
                                "waiting"
                        });
                    }
                }
            }
        } catch (error) {
            console.warn(
                "Leave room error:",
                error
            );
        }

        roomRef = null;
        playerRef = null;

        isOnline = false;

        roomCode = "";
        onlinePlayer = "";

        onlineHadTwoPlayers = false;

        leavingRoom = false;

        updateOnlineUI();
    }

    // =========================================================
    // 32. COPY ROOM CODE
    // =========================================================

    async function copyText(text) {
        try {
            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {
                await navigator.clipboard.writeText(
                    text
                );

                return true;
            }
        } catch (_) {}

        try {
            const textarea =
                document.createElement(
                    "textarea"
                );

            textarea.value = text;

            textarea.style.position =
                "fixed";

            textarea.style.opacity = "0";

            document.body.appendChild(
                textarea
            );

            textarea.focus();
            textarea.select();

            const success =
                document.execCommand(
                    "copy"
                );

            textarea.remove();

            return success;
        } catch (_) {
            return false;
        }
    }

    if (copyRoomButton) {
        copyRoomButton.addEventListener(
            "click",
            async () => {
                if (!roomCode) {
                    return;
                }

                const success =
                    await copyText(
                        roomCode
                    );

                const oldText =
                    copyRoomButton.textContent;

                copyRoomButton.textContent =
                    success
                        ? "✅ Đã sao chép!"
                        : "❌ Không thể sao chép";

                setTimeout(() => {
                    copyRoomButton.textContent =
                        oldText;
                }, 1200);
            }
        );
    }

    if (copyLinkButton) {
        copyLinkButton.addEventListener(
            "click",
            async () => {
                if (!roomCode) {
                    return;
                }

                const url =
                    new URL(
                        window.location.href
                    );

                url.searchParams.set(
                    "room",
                    roomCode
                );

                const success =
                    await copyText(
                        url.toString()
                    );

                const oldText =
                    copyLinkButton.textContent;

                copyLinkButton.textContent =
                    success
                        ? "✅ Đã sao chép!"
                        : "❌ Không thể sao chép";

                setTimeout(() => {
                    copyLinkButton.textContent =
                        oldText;
                }, 1200);
            }
        );
    }

    // =========================================================
    // 33. CREATE / JOIN BUTTONS
    // =========================================================

    if (createRoomButton) {
        createRoomButton.addEventListener(
            "click",
            () => {
                createRoom();
            }
        );
    }

    if (joinRoomButton) {
        joinRoomButton.addEventListener(
            "click",
            () => {
                joinRoom(
                    roomInput
                        ? roomInput.value
                        : ""
                );
            }
        );
    }

    if (roomInput) {
        roomInput.addEventListener(
            "input",
            () => {
                roomInput.value =
                    normalizeRoomCode(
                        roomInput.value
                    );
            }
        );

        roomInput.addEventListener(
            "keydown",
            (event) => {
                if (
                    event.key === "Enter"
                ) {
                    event.preventDefault();

                    joinRoom(
                        roomInput.value
                    );
                }
            }
        );
    }

    // =========================================================
    // 34. RANDOM MATCHMAKING BUTTON
    // =========================================================

    function createRandomMatchButton() {
        if (randomMatchButton) {
            return;
        }

        randomMatchButton =
            document.createElement(
                "button"
            );

        randomMatchButton.id =
            "randomMatchButton";

        randomMatchButton.type =
            "button";

        randomMatchButton.className =
            "online-btn";

        randomMatchButton.textContent =
            "🎲 Tìm người chơi ngẫu nhiên";

        randomMatchButton.addEventListener(
            "click",
            () => {
                startRandomMatch();
            }
        );

        if (
            createRoomButton &&
            createRoomButton.parentElement
        ) {
            createRoomButton.parentElement.insertBefore(
                randomMatchButton,
                createRoomButton
            );
        }
    }

       // =========================================================
// 35. MATCHMAKING
// =========================================================

function getMatchmakingRoot() {
    if (!firebaseDB) {
        return null;
    }

    return firebaseDB.ref(
        "matchmaking/caro5"
    );
}

function getOwnMatchmakingRef() {
    if (
        !firebaseDB ||
        !firebaseUser
    ) {
        return null;
    }

    return firebaseDB.ref(
        `matchmaking/caro5/${firebaseUser.uid}`
    );
}

// ---------------------------------------------------------
// Bắt đầu tìm trận
// ---------------------------------------------------------

async function startRandomMatch() {
    if (matchmakingActive) {
        cancelMatchmaking();
        return;
    }

    if (
        !firebaseDB ||
        !firebaseUser
    ) {
        const ok = await initFirebase();

        if (!ok) {
            alert(
                "Không thể kết nối Firebase."
            );

            return;
        }
    }

    if (isOnline) {
        alert(
            "Bạn đang ở trong một phòng."
        );

        return;
    }

    matchmakingActive = true;
    matchmakingProcessing = false;

    if (randomMatchButton) {
        randomMatchButton.textContent =
            "⏹ Hủy tìm trận";
    }

    if (createRoomButton) {
        createRoomButton.disabled = true;
    }

    if (joinRoomButton) {
        joinRoomButton.disabled = true;
    }

    setStatus(
        "🔎 Đang tìm người chơi..."
    );

    const ownRef =
        getOwnMatchmakingRef();

    if (!ownRef) {
        cancelMatchmaking();
        return;
    }

    try {
        // -----------------------------------------------------
        // Đưa bản thân vào hàng chờ
        // -----------------------------------------------------

        await ownRef.set({
            uid: firebaseUser.uid,

            status: "waiting",

            boardSize:
                clampBoardSize(
                    boardSizeSelect
                        ? boardSizeSelect.value
                        : DEFAULT_BOARD_SIZE
                ),

            joinedAt:
                firebase.database.ServerValue.TIMESTAMP
        });

        // Nếu đóng tab / mất kết nối
        // Firebase tự xóa người này khỏi queue.
        await ownRef
            .onDisconnect()
            .remove();

        listenForMatch();

        if (matchmakingTimeout) {
            clearTimeout(
                matchmakingTimeout
            );
        }

        matchmakingTimeout =
            setTimeout(() => {
                if (
                    matchmakingActive &&
                    !matchmakingProcessing
                ) {
                    setStatus(
                        "⏳ Chưa tìm thấy đối thủ."
                    );
                }
            }, MATCHMAKING_TIMEOUT);

    } catch (error) {
        console.error(
            "Matchmaking start error:",
            error
        );

        cancelMatchmaking();

        alert(
            "Không thể bắt đầu tìm trận."
        );
    }
}

// ---------------------------------------------------------
// Lắng nghe hàng chờ
// ---------------------------------------------------------

function listenForMatch() {
    if (
        matchmakingListener ||
        !firebaseDB ||
        !firebaseUser
    ) {
        return;
    }

    const root =
        getMatchmakingRoot();

    if (!root) {
        return;
    }

    matchmakingListener =
        (snapshot) => {

            if (
                !matchmakingActive ||
                matchmakingProcessing
            ) {
                return;
            }

            const data =
                snapshot.val();

            if (!data) {
                return;
            }

            const ownEntry =
                data[firebaseUser.uid];

            if (!ownEntry) {
                return;
            }

            // =================================================
            // Trường hợp mình đã được người khác ghép
            // =================================================

            if (
                ownEntry.status === "matched" &&
                ownEntry.roomCode &&
                ownEntry.opponentUid
            ) {
                matchmakingProcessing = true;

                const opponentEntry =
                    data[
                        ownEntry.opponentUid
                    ] || {};

                enterMatchedRoom(
                    ownEntry.roomCode,
                    ownEntry.opponentUid,
                    opponentEntry
                );

                return;
            }

            // =================================================
            // Chỉ tìm người đang WAITING
            // =================================================

            if (
                ownEntry.status !== "waiting"
            ) {
                return;
            }

            const candidates = [];

            Object.keys(data)
                .forEach((uid) => {

                    if (
                        uid ===
                        firebaseUser.uid
                    ) {
                        return;
                    }

                    const entry =
                        data[uid];

                    if (
                        entry &&
                        entry.status ===
                        "waiting"
                    ) {
                        candidates.push({
                            uid,
                            entry
                        });
                    }
                });

            if (
                candidates.length === 0
            ) {
                return;
            }

            // Người vào queue trước được ưu tiên.
            candidates.sort(
                (a, b) => {

                    const aTime =
                        Number(
                            a.entry.joinedAt ||
                            0
                        );

                    const bTime =
                        Number(
                            b.entry.joinedAt ||
                            0
                        );

                    if (
                        aTime !==
                        bTime
                    ) {
                        return (
                            aTime -
                            bTime
                        );
                    }

                    return a.uid.localeCompare(
                        b.uid
                    );
                }
            );

            tryMatchCandidate(
                candidates[0]
            );
        };

    root.on(
        "value",
        matchmakingListener
    );
}

// ---------------------------------------------------------
// Ghép 2 người bằng TRANSACTION ở toàn bộ queue
// ---------------------------------------------------------

async function tryMatchCandidate(
    candidate
) {
    if (
        matchmakingProcessing ||
        !matchmakingActive ||
        !firebaseUser
    ) {
        return;
    }

    const root =
        getMatchmakingRoot();

    if (!root) {
        return;
    }

    const ownUid =
        firebaseUser.uid;

    const opponentUid =
        candidate.uid;

    // Không tự ghép chính mình.
    if (
        ownUid === opponentUid
    ) {
        return;
    }

    const room =
        generateMatchRoomCode(
            ownUid,
            opponentUid
        );

    matchmakingProcessing = true;

    try {
        // =====================================================
        // TRANSACTION TOÀN BỘ QUEUE
        //
        // Hai người cùng tranh nhau sẽ không thể
        // cùng ghép một người.
        // =====================================================

        const transaction =
            await root.transaction(
                (current) => {

                    if (!current) {
                        return;
                    }

                    const own =
                        current[ownUid];

                    const opponent =
                        current[opponentUid];

                    // Cả hai phải vẫn đang WAITING.
                    if (
                        !own ||
                        own.status !==
                            "waiting"
                    ) {
                        return;
                    }

                    if (
                        !opponent ||
                        opponent.status !==
                            "waiting"
                    ) {
                        return;
                    }

                    // Đánh dấu CẢ HAI là matched
                    // trong cùng một transaction.

                    current[ownUid] = {
                        ...own,

                        status: "matched",

                        opponentUid:
                            opponentUid,

                        roomCode:
                            room,

                        matchedAt:
                            Date.now()
                    };

                    current[opponentUid] = {
                        ...opponent,

                        status: "matched",

                        opponentUid:
                            ownUid,

                        roomCode:
                            room,

                        matchedAt:
                            Date.now()
                    };

                    return current;
                }
            );

        if (
            !transaction.committed
        ) {
            matchmakingProcessing =
                false;

            return;
        }

        // =====================================================
        // Transaction thành công
        // =====================================================

        const result =
            transaction.snapshot.val();

        const ownResult =
            result &&
            result[ownUid];

        if (
            !ownResult ||
            ownResult.status !==
                "matched"
        ) {
            matchmakingProcessing =
                false;

            return;
        }

        const opponentResult =
            result[opponentUid] || {};

        // =====================================================
        // Vào phòng
        // =====================================================

        await enterMatchedRoom(
            ownResult.roomCode,
            opponentUid,
            opponentResult
        );

    } catch (error) {

        console.error(
            "Matchmaking transaction error:",
            error
        );

        matchmakingProcessing = false;
    }
}

// ---------------------------------------------------------
// Vào phòng sau khi match
// ---------------------------------------------------------

async function enterMatchedRoom(
    code,
    opponentUid,
    opponentEntry
) {
    if (!firebaseUser) {
        return;
    }

    roomCode = code;

    // UID nhỏ hơn làm X.
    const uidA =
        [
            firebaseUser.uid,
            opponentUid
        ].sort()[0];

    onlinePlayer =
        firebaseUser.uid === uidA
            ? "X"
            : "O";

    isOnline = true;

    // =========================================================
    // Board size
    // =========================================================

    const selectedSize =
        clampBoardSize(
            boardSizeSelect
                ? boardSizeSelect.value
                : DEFAULT_BOARD_SIZE
        );

    const opponentSize =
        clampBoardSize(
            opponentEntry &&
            opponentEntry.boardSize
                ? opponentEntry.boardSize
                : selectedSize
        );

    if (
        onlinePlayer === "O"
    ) {
        boardSize =
            opponentSize;
    } else {
        boardSize =
            selectedSize;
    }

    if (boardSizeSelect) {
        boardSizeSelect.value =
            String(boardSize);
    }

    board =
        Array(
            boardSize *
            boardSize
        ).fill("");

    currentPlayer = "X";

    gameOver = false;

    lastMoveIndex = -1;

    onlineHadTwoPlayers = true;

    leavingRoom = false;

    // =========================================================
    // Room refs
    // =========================================================

    roomRef =
        getRoomRef(roomCode);

    playerRef =
        getPlayerRef(
            roomCode,
            onlinePlayer
        );

    if (
        !roomRef ||
        !playerRef
    ) {
        isOnline = false;
        matchmakingProcessing =
            false;

        return;
    }

    try {
        // =====================================================
        // Tạo room bằng TRANSACTION
        //
        // Chỉ người đầu tiên tạo được room.
        // Người thứ hai sẽ lấy room có sẵn.
        // =====================================================

        await roomRef.transaction(
            (current) => {

                if (current) {
                    return;
                }

                return {
                    status: "waiting",

                    createdAt:
                        firebase.database.ServerValue.TIMESTAMP,

                    boardSize:
                        boardSize,

                    currentPlayer: "X",

                    board:
                        board.slice(),

                    winner: null,

                    players: {
                        [onlinePlayer]: {
                            uid:
                                firebaseUser.uid,

                            joinedAt:
                                firebase.database.ServerValue.TIMESTAMP
                        }
                    }
                };
            }
        );

        // =====================================================
        // Đọc room sau transaction
        // =====================================================

        const roomSnapshot =
            await roomRef.once(
                "value"
            );

        if (
            !roomSnapshot.exists()
        ) {
            throw new Error(
                "Không tìm thấy room sau khi tạo."
            );
        }

        let roomData =
            roomSnapshot.val() || {};

        // =====================================================
        // Đồng bộ board size
        // =====================================================

        if (roomData.boardSize) {
            boardSize =
                clampBoardSize(
                    roomData.boardSize
                );

            if (boardSizeSelect) {
                boardSizeSelect.value =
                    String(boardSize);
            }
        }

        // =====================================================
        // Thêm player vào room nếu chưa có
        // =====================================================

        const players =
            roomData.players || {};

        if (
            !players[onlinePlayer] ||
            players[onlinePlayer].uid !==
                firebaseUser.uid
        ) {
            await playerRef.set({
                uid:
                    firebaseUser.uid,

                joinedAt:
                    firebase.database.ServerValue.TIMESTAMP
            });
        }

        // =====================================================
        // Kiểm tra lại số người
        // =====================================================

        const finalSnapshot =
            await roomRef.once(
                "value"
            );

        roomData =
            finalSnapshot.val() || {};

        const finalPlayers =
            roomData.players || {};

        const hasX =
            !!finalPlayers.X;

        const hasO =
            !!finalPlayers.O;

        if (
            hasX &&
            hasO
        ) {
            await roomRef.update({
                status: "playing"
            });
        }

        // =====================================================
        // onDisconnect
        // =====================================================

        await playerRef
            .onDisconnect()
            .remove();

        // =====================================================
        // Dừng matchmaking
        // =====================================================

        const ownMatchRef =
            getOwnMatchmakingRef();

        if (ownMatchRef) {
            await ownMatchRef.remove();
        }

        matchmakingActive = false;

        if (
            matchmakingListener
        ) {
            const root =
                getMatchmakingRoot();

            if (root) {
                root.off(
                    "value",
                    matchmakingListener
                );
            }

            matchmakingListener =
                null;
        }

        if (
            matchmakingTimeout
        ) {
            clearTimeout(
                matchmakingTimeout
            );

            matchmakingTimeout =
                null;
        }

        matchmakingRef = null;

        matchmakingProcessing =
            false;

        // =====================================================
        // Reset buttons
        // =====================================================

        if (randomMatchButton) {
            randomMatchButton.textContent =
                "🎲 Tìm người chơi ngẫu nhiên";
        }

        if (createRoomButton) {
            createRoomButton.disabled =
                false;
        }

        if (joinRoomButton) {
            joinRoomButton.disabled =
                false;
        }

        // =====================================================
        // Vào game
        // =====================================================

        showGame();

        updateOnlineUI();

        listenRoom();

        hideResult();

        renderBoard();

        resetTimer();

        setOnlineNotice(
            `🎲 Đã tìm thấy đối thủ! Bạn là ${onlinePlayer}.`,
            true
        );

        playSound("match");

    } catch (error) {

        console.error(
            "Enter matched room error:",
            error
        );

        isOnline = false;

        roomRef = null;
        playerRef = null;

        matchmakingProcessing =
            false;

        setStatus(
            "❌ Không thể vào trận."
        );
    }
}

// ---------------------------------------------------------
// Hủy tìm trận
// ---------------------------------------------------------

function cancelMatchmaking() {
    matchmakingActive = false;
    matchmakingProcessing = false;

    if (
        matchmakingTimeout
    ) {
        clearTimeout(
            matchmakingTimeout
        );

        matchmakingTimeout =
            null;
    }

    if (
        matchmakingListener
    ) {
        try {
            const root =
                getMatchmakingRoot();

            if (root) {
                root.off(
                    "value",
                    matchmakingListener
                );
            }
        } catch (_) {}

        matchmakingListener =
            null;
    }

    if (
        matchmakingRef
    ) {
        matchmakingRef
            .remove()
            .catch(() => {});

        matchmakingRef = null;
    }

    // Xóa luôn queue của chính mình.
    const ownRef =
        getOwnMatchmakingRef();

    if (ownRef) {
        ownRef
            .remove()
            .catch(() => {});
    }

    if (randomMatchButton) {
        randomMatchButton.textContent =
            "🎲 Tìm người chơi ngẫu nhiên";
    }

    if (createRoomButton) {
        createRoomButton.disabled =
            false;
    }

    if (joinRoomButton) {
        joinRoomButton.disabled =
            false;
    }

    setStatus(
        "🟢 Đã kết nối online"
    );
}

    // =========================================================
    // 36. AUTO JOIN ?room=
    // =========================================================

    function getRoomFromURL() {
        try {
            const params =
                new URLSearchParams(
                    window.location.search
                );

            return normalizeRoomCode(
                params.get("room")
            );
        } catch (_) {
            return "";
        }
    }

    // =========================================================
    // 37. ANALYTICS
    // =========================================================

    async function trackGameStart() {

    if (analyticsGameTracked) {
        return;
    }

    if (
        !window.GameHub ||
        typeof window.GameHub.start !== "function"
    ) {
        console.warn(
            "Caro5: GameHub chưa sẵn sàng để ghi lượt chơi."
        );

        return;
    }

    try {

        const eventKey =
            await window.GameHub.start({

                mode:
                    gameMode === "online"
                        ? "online"
                        : gameMode === "ai"
                            ? "ai"
                            : "pvp",

                boardSize:
                    boardSize,

                difficulty:
                    gameMode === "ai"
                        ? difficultySelect?.value || "medium"
                        : null

            });

        if (eventKey) {
            analyticsGameTracked = true;

            console.log(
                "Caro5 game_start tracked:",
                eventKey
            );
        }

    } catch (error) {

        console.warn(
            "Caro5 analytics start lỗi:",
            error
        );

    }
}

    // =========================================================
    // 38. INIT
    // =========================================================

    async function init() {
        // -----------------------------------------------------
        // Default UI
        // -----------------------------------------------------

        boardSize =
            clampBoardSize(
                boardSizeSelect
                    ? boardSizeSelect.value
                    : DEFAULT_BOARD_SIZE
            );

        setGameMode("ai");

        setAIDifficulty(
            difficultySelect
                ? difficultySelect.value
                : "medium"
        );

        updateDifficultyVisibility();

        updateScoreUI();

        updateTimerUI();

        createRandomMatchButton();

        hideResult();

        hideElement(copyRoomButton);
        hideElement(copyLinkButton);

        // -----------------------------------------------------
        // Firebase
        // -----------------------------------------------------

        const firebaseReady =
            await initFirebase();

        if (!firebaseReady) {
            setStatus(
                "🔴 Offline — không dùng được phòng online"
            );
        }

        // -----------------------------------------------------
        // Analytics
        // -----------------------------------------------------

        trackGameStart();

        // -----------------------------------------------------
        // Auto join room
        // -----------------------------------------------------

        const urlRoom =
            getRoomFromURL();

        if (
            urlRoom &&
            firebaseReady
        ) {
            if (roomInput) {
                roomInput.value =
                    urlRoom;
            }

            setTimeout(() => {
                joinRoom(urlRoom);
            }, 250);
        }
    }

    // =========================================================
    // 39. PAGE VISIBILITY
    // =========================================================

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.hidden
            ) {
                if (
                    isOnline
                ) {
                    stopTimer();
                }
            } else {
                if (
                    !gameOver &&
                    isOnline
                ) {
                    resetTimer();
                }
            }
        }
    );

    // =========================================================
    // 40. BEFORE UNLOAD
    // =========================================================

    window.addEventListener(
        "beforeunload",
        () => {
            stopTimer();

            // Firebase onDisconnect sẽ xử lý
            // presence / player khi đóng tab.
        }
    );

    // =========================================================
    // 41. START
    // =========================================================

    init();

})();
