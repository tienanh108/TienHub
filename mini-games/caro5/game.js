/* =========================================================
   CARO 5 - GAME ENGINE
   ========================================================= */
"use strict";
/* =========================================================
   GLOBAL STATE
   ========================================================= */
let boardSize = 15;
let board = [];
let currentPlayer = "X";
let gameOver = false;
let gameMode = "ai";
let aiDifficulty = "medium";
let timer = 30;
let timerInterval = null;
let scoreX = 0;
let scoreO = 0;
let lastMoveIndex = -1;
/*
 * true khi đang chơi online.
 * Firebase.js sẽ thay đổi biến này.
 */
let isOnlineGame = false;
/*
 * =========================================================
 * DOM
 * =========================================================
 */
const menuScreen =
    document.getElementById("menuScreen");
const gameScreen =
    document.getElementById("gameScreen");
const boardElement =
    document.getElementById("board");
const boardSizeSelect =
    document.getElementById("boardSizeSelect");
const turnText =
    document.getElementById("turnText");
const timerElement =
    document.getElementById("timer");
const scoreXElement =
    document.getElementById("scoreX");
const scoreOElement =
    document.getElementById("scoreO");
const resultBox =
    document.getElementById("resultBox");
const resultText =
    document.getElementById("resultText");
const aiModeButton =
    document.getElementById("aiModeBtn");
const pvpModeButton =
    document.getElementById("pvpModeBtn");
/*
 * Một số phần tử có thể chưa tồn tại nếu HTML
 * chưa được cập nhật. Vì vậy không được giả định
 * chúng luôn tồn tại.
 */
const aiDifficultyContainer =
    document.getElementById("aiDifficultyContainer");
/* =========================================================
   HELPER
   ========================================================= */
function getBoardSize() {
    const value = Number(boardSize);
    if (
        value === 15 ||
        value === 20 ||
        value === 25
    ) {
        return value;
    }
    return 15;
}
function getCellIndex(row, col) {
    return row * boardSize + col;
}
function isInsideBoard(row, col) {
    return (
        row >= 0 &&
        row < boardSize &&
        col >= 0 &&
        col < boardSize
    );
}
function getCell(row, col) {
    if (!isInsideBoard(row, col)) {
        return null;
    }
    return board[
        getCellIndex(row, col)
    ];
}
/* =========================================================
   START OFFLINE GAME
   ========================================================= */
function startOfflineGame(mode) {
    /*
     * Đảm bảo không còn trạng thái online.
     */
    isOnlineGame = false;
    gameMode =
        mode === "pvp"
            ? "pvp"
            : "ai";
    /*
     * Lấy kích thước từ select.
     */
    if (boardSizeSelect) {
        const selectedSize =
            Number(boardSizeSelect.value);
        if (
            selectedSize === 15 ||
            selectedSize === 20 ||
            selectedSize === 25
        ) {
            boardSize = selectedSize;
        }
    }
    /*
     * Reset bàn.
     */
    resetBoard();
    /*
     * Hiện game.
     */
    showGame();
    /*
     * Hiện / ẩn độ khó AI.
     */
    updateAIDifficultyVisibility();
    /*
     * Bắt đầu lượt X.
     */
    currentPlayer = "X";
    gameOver = false;
    updateTurnDisplay();
    updateScoreDisplay();
    startTimer();
}
/* =========================================================
   RESET BOARD
   ========================================================= */
function resetBoard() {
    stopTimer();
    const size = getBoardSize();
    boardSize = size;
    board =
        new Array(size * size).fill("");
    currentPlayer = "X";
    gameOver = false;
    lastMoveIndex = -1;
    hideResultBox();
    renderBoard();
    updateTurnDisplay();
    updateTimerDisplay();
}
/* =========================================================
   RENDER BOARD
   ========================================================= */
function renderBoard() {
    if (!boardElement) {
        return;
    }
    /*
     * Xóa hoàn toàn bàn cũ.
     * Điều này rất quan trọng khi bấm Chơi lại.
     */
    boardElement.innerHTML = "";
    /*
     * Cho CSS biết bàn có bao nhiêu ô.
     */
    boardElement.style.setProperty(
        "--board-size",
        String(boardSize)
    );
    /*
     * Tính kích thước ô.
     */
    const cellSize =
        calculateCellSize();
    boardElement.style.setProperty(
        "--cell-size",
        `${cellSize}px`
    );
    /*
     * Tạo từng ô.
     */
    const fragment =
        document.createDocumentFragment();
    for (
        let index = 0;
        index < board.length;
        index++
    ) {
        const cell =
            document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.index =
            String(index);
        const value =
            board[index];
        if (value === "X") {
            cell.textContent = "X";
            cell.classList.add("x");
        } else if (value === "O") {
            cell.textContent = "O";
            cell.classList.add("o");
        }
        if (index === lastMoveIndex) {
            cell.classList.add("last-move");
        }
        cell.addEventListener(
            "click",
            handleCellClick
        );
        fragment.appendChild(cell);
    }
    boardElement.appendChild(fragment);
}
/* =========================================================
   RESPONSIVE CELL SIZE
   ========================================================= */
function calculateCellSize() {
    /*
     * Desktop:
     * giữ bàn dễ nhìn.
     */
    if (window.innerWidth >= 768) {
        if (boardSize === 15) {
            return 38;
        }
        if (boardSize === 20) {
            return 32;
        }
        return 27;
    }
    /*
     * Mobile:
     * cố gắng để toàn bộ bàn vừa chiều ngang.
     *
     * 15x15 -> lớn hơn
     * 20x20 -> vừa
     * 25x25 -> nhỏ hơn
     */
    const availableWidth =
        Math.max(
            260,
            window.innerWidth - 20
        );
    let size =
        Math.floor(
            availableWidth / boardSize
        );
    /*
     * Giới hạn để ô không quá nhỏ.
     */
    if (boardSize === 15) {
        size = Math.max(
            23,
            Math.min(38, size)
        );
    } else if (boardSize === 20) {
        size = Math.max(
            20,
            Math.min(32, size)
        );
    } else {
        size = Math.max(
            16,
            Math.min(27, size)
        );
    }
    return size;
}
/* =========================================================
   CELL CLICK
   ========================================================= */
function handleCellClick(event) {
    if (gameOver) {
        return;
    }
    const cell =
        event.currentTarget;
    const index =
        Number(cell.dataset.index);
    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= board.length
    ) {
        return;
    }
    /*
     * Ô đã có quân.
     */
    if (board[index] !== "") {
        return;
    }
    /*
     * ONLINE
     *
     * Firebase.js chịu trách nhiệm kiểm tra
     * người chơi nào được phép đi.
     */
    if (isOnlineGame) {
        if (
            typeof makeOnlineMove ===
            "function"
        ) {
            makeOnlineMove(index);
        }
        return;
    }
    /*
     * AI:
     * Người chơi là X.
     * Không cho người dùng click khi O đang suy nghĩ.
     */
    if (
        gameMode === "ai" &&
        currentPlayer !== "X"
    ) {
        return;
    }
    makeMove(index);
}
/* =========================================================
   MAKE OFFLINE MOVE
   ========================================================= */
function makeMove(index) {
    if (gameOver) {
        return false;
    }
    if (
        index < 0 ||
        index >= board.length
    ) {
        return false;
    }
    if (board[index] !== "") {
        return false;
    }
    const player =
        currentPlayer;
    /*
     * Đặt quân.
     */
    board[index] = player;
    lastMoveIndex = index;
    /*
     * Vẽ lại ô vừa đi.
     */
    renderBoard();
    /*
     * Kiểm tra thắng.
     */
    const row =
        Math.floor(index / boardSize);
    const col =
        index % boardSize;
    const winningCells =
        checkWin(
            row,
            col,
            player
        );
    if (winningCells) {
        gameOver = true;
        stopTimer();
        /*
         * Tăng điểm.
         */
        if (player === "X") {
            scoreX++;
        } else {
            scoreO++;
        }
        updateScoreDisplay();
        highlightWinningCells(
            winningCells
        );
        showResult(
            `${player} thắng!`
        );
        return true;
    }
    /*
     * Kiểm tra hòa.
     */
    if (
        board.every(
            cell => cell !== ""
        )
    ) {
        gameOver = true;
        stopTimer();
        showResult("Hòa!");
        return true;
    }
    /*
     * Chuyển lượt.
     */
    currentPlayer =
        player === "X"
            ? "O"
            : "X";
    updateTurnDisplay();
    resetTimer();
    /*
     * Nếu đang chơi AI,
     * O sẽ tự đi.
     */
    if (
        gameMode === "ai" &&
        currentPlayer === "O"
    ) {
        scheduleAIMove();
    }
    return true;
}
/* =========================================================
   AI MOVE
   ========================================================= */
function scheduleAIMove() {
    if (gameOver) {
        return;
    }
    /*
     * Đợi một chút để người chơi nhìn thấy
     * nước X vừa đánh.
     */
    window.setTimeout(
        function () {
            if (gameOver) {
                return;
            }
            if (
                gameMode !== "ai" ||
                currentPlayer !== "O"
            ) {
                return;
            }
            if (
                typeof getAIMove !==
                "function"
            ) {
                console.error(
                    "Không tìm thấy getAIMove(). Kiểm tra ai.js."
                );
                return;
            }
            const move =
                getAIMove(
                    aiDifficulty
                );
            if (!move) {
                /*
                 * Trường hợp bàn đã đầy.
                 */
                return;
            }
            const row =
                Number(move.row);
            const col =
                Number(move.col);
            if (
                !Number.isInteger(row) ||
                !Number.isInteger(col)
            ) {
                return;
            }
            if (
                !isInsideBoard(
                    row,
                    col
                )
            ) {
                return;
            }
            const index =
                getCellIndex(
                    row,
                    col
                );
            if (
                board[index] !== ""
            ) {
                return;
            }
            makeMove(index);
        },
        250
    );
}
/* =========================================================
   CHECK WIN
   ========================================================= */
function checkWin(
    row,
    col,
    player
) {
    const directions = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
    ];
    for (
        const [dr, dc]
        of directions
    ) {
        const cells = [
            [row, col]
        ];
        /*
         * Hướng dương.
         */
        let r =
            row + dr;
        let c =
            col + dc;
        while (
            isInsideBoard(r, c) &&
            getCell(r, c) === player
        ) {
            cells.push([r, c]);
            r += dr;
            c += dc;
        }
        /*
         * Hướng âm.
         */
        r =
            row - dr;
        c =
            col - dc;
        while (
            isInsideBoard(r, c) &&
            getCell(r, c) === player
        ) {
            cells.unshift([r, c]);
            r -= dr;
            c -= dc;
        }
        if (
            cells.length >= 5
        ) {
            return cells;
        }
    }
    return null;
}
/* =========================================================
   COUNT DIRECTION
   =========================================================
   AI và Firebase có thể dùng hàm này.
   ========================================================= */
function countDirection(
    row,
    col,
    dr,
    dc,
    player
) {
    let count = 0;
    let r =
        row + dr;
    let c =
        col + dc;
    while (
        isInsideBoard(r, c) &&
        getCell(r, c) === player
    ) {
        count++;
        r += dr;
        c += dc;
    }
    return count;
}
/* =========================================================
   HIGHLIGHT WIN
   ========================================================= */
function highlightWinningCells(
    cells
) {
    if (!Array.isArray(cells)) {
        return;
    }
    for (
        const position of cells
    ) {
        if (
            !Array.isArray(position) ||
            position.length < 2
        ) {
            continue;
        }
        const row =
            Number(position[0]);
        const col =
            Number(position[1]);
        if (
            !isInsideBoard(
                row,
                col
            )
        ) {
            continue;
        }
        const index =
            getCellIndex(
                row,
                col
            );
        const cell =
            boardElement?.querySelector(
                `[data-index="${index}"]`
            );
        if (cell) {
            cell.classList.add(
                "win"
            );
        }
    }
}
/* =========================================================
   RESULT
   ========================================================= */
function showResult(message) {
    if (!resultBox) {
        return;
    }
    if (resultText) {
        resultText.textContent =
            message;
    }
    resultBox.classList.remove(
        "hidden"
    );
}
function hideResultBox() {
    if (!resultBox) {
        return;
    }
    resultBox.classList.add(
        "hidden"
    );
    if (resultText) {
        resultText.textContent = "";
    }
}
/* =========================================================
   TIMER
   ========================================================= */
function startTimer() {
    stopTimer();
    if (gameOver) {
        return;
    }
    timer = 30;
    updateTimerDisplay();
    timerInterval =
        window.setInterval(
            function () {
                if (gameOver) {
                    stopTimer();
                    return;
                }
                timer--;
                if (timer < 0) {
                    timer = 0;
                }
                updateTimerDisplay();
                if (timer <= 0) {
                    handleTimeOut();
                }
            },
            1000
        );
}
function resetTimer() {
    stopTimer();
    timer = 30;
    updateTimerDisplay();
    if (!gameOver) {
        timerInterval =
            window.setInterval(
                function () {
                    if (gameOver) {
                        stopTimer();
                        return;
                    }
                    timer--;
                    if (timer < 0) {
                        timer = 0;
                    }
                    updateTimerDisplay();
                    if (timer <= 0) {
                        handleTimeOut();
                    }
                },
                1000
            );
    }
}
function stopTimer() {
    if (
        timerInterval !== null
    ) {
        window.clearInterval(
            timerInterval
        );
        timerInterval = null;
    }
}
function handleTimeOut() {
    if (gameOver) {
        return;
    }
    stopTimer();
    /*
     * Người hết giờ thua.
     */
    const loser =
        currentPlayer;
    const winner =
        loser === "X"
            ? "O"
            : "X";
    gameOver = true;
    if (winner === "X") {
        scoreX++;
    } else {
        scoreO++;
    }
    updateScoreDisplay();
    showResult(
        `${loser} hết giờ — ${winner} thắng!`
    );
}
function updateTimerDisplay() {
    if (!timerElement) {
        return;
    }
    timerElement.textContent =
        String(
            Math.max(
                0,
                timer
            )
        );
}
/* =========================================================
   TURN DISPLAY
   ========================================================= */
function updateTurnDisplay() {
    if (!turnText) {
        return;
    }
    if (gameOver) {
        return;
    }
    if (
        gameMode === "ai" &&
        currentPlayer === "O"
    ) {
        turnText.textContent =
            "Máy đang đi...";
    } else {
        turnText.textContent =
            `Lượt của ${currentPlayer}`;
    }
}
/* =========================================================
   SCORE
   ========================================================= */
function updateScoreDisplay() {
    if (scoreXElement) {
        scoreXElement.textContent =
            String(scoreX);
    }
    if (scoreOElement) {
        scoreOElement.textContent =
            String(scoreO);
    }
}
/* =========================================================
   NEW OFFLINE GAME
   ========================================================= */
function startNewOfflineGame() {
    /*
     * Nếu online thì giao cho Firebase.
     */
    if (isOnlineGame) {
        if (
            typeof startNewOnlineGame ===
            "function"
        ) {
            startNewOnlineGame();
        }
        return;
    }
    /*
     * Tạo bàn hoàn toàn mới.
     *
     * Không reset điểm.
     */
    resetBoard();
    currentPlayer = "X";
    gameOver = false;
    updateTurnDisplay();
    startTimer();
}
/* =========================================================
   SHOW GAME
   ========================================================= */
function showGame() {
    if (menuScreen) {
        menuScreen.classList.add(
            "hidden"
        );
    }
    if (gameScreen) {
        gameScreen.classList.remove(
            "hidden"
        );
    }
}
/* =========================================================
   SHOW MENU
   ========================================================= */
function showMenu() {
    stopTimer();
    /*
     * Nếu đang online thì để Firebase
     * xử lý việc rời phòng trước.
     */
    if (
        isOnlineGame &&
        typeof leaveOnlineRoom ===
            "function"
    ) {
        leaveOnlineRoom();
    }
    isOnlineGame = false;
    if (gameScreen) {
        gameScreen.classList.add(
            "hidden"
        );
    }
    if (menuScreen) {
        menuScreen.classList.remove(
            "hidden"
        );
    }
    hideResultBox();
}
/* =========================================================
   AI DIFFICULTY
   ========================================================= */
function updateAIDifficultyVisibility() {
    /*
     * Nếu HTML có container riêng.
     */
    if (aiDifficultyContainer) {
        if (
            gameMode === "ai"
        ) {
            aiDifficultyContainer.classList.remove(
                "hidden"
            );
        } else {
            aiDifficultyContainer.classList.add(
                "hidden"
            );
        }
        return;
    }
    /*
     * Nếu chưa có container,
     * tìm select AI bằng một số ID phổ biến.
     */
    const difficultySelect =
        document.getElementById(
            "aiDifficulty"
        );
    if (difficultySelect) {
        const parent =
            difficultySelect.parentElement;
        if (parent) {
            if (
                gameMode === "ai"
            ) {
                parent.classList.remove(
                    "hidden"
                );
            } else {
                parent.classList.add(
                    "hidden"
                );
            }
        }
    }
}
/* =========================================================
   CREATE AI DIFFICULTY SELECT
   ========================================================= */
function createAIDifficultySelector() {
    /*
     * Nếu đã có thì không tạo lần nữa.
     */
    if (
        document.getElementById(
            "aiDifficulty"
        )
    ) {
        return;
    }
    /*
     * Chỉ tạo nếu đang có khu vực section
     * trong menu.
     */
    if (!menuScreen) {
        return;
    }
    const card =
        menuScreen.querySelector(
            ".menu-card"
        );
    if (!card) {
        return;
    }
    const section =
        document.createElement(
            "div"
        );
    section.className =
        "section ai-difficulty";
    section.id =
        "aiDifficultyContainer";
    const label =
        document.createElement(
            "label"
        );
    label.htmlFor =
        "aiDifficulty";
    label.textContent =
        "Độ khó";
    const select =
        document.createElement(
            "select"
        );
    select.id =
        "aiDifficulty";
    const levels = [
        {
            value: "easy",
            text: "🟢 Dễ"
        },
        {
            value: "medium",
            text: "🟡 Trung bình"
        },
        {
            value: "hard",
            text: "🔴 Khó"
        },
        {
            value: "extreme",
            text: "🔥 Siêu khó"
        }
    ];
    for (
        const level of levels
    ) {
        const option =
            document.createElement(
                "option"
            );
        option.value =
            level.value;
        option.textContent =
            level.text;
        if (
            level.value ===
            aiDifficulty
        ) {
            option.selected =
                true;
        }
        select.appendChild(
            option
        );
    }
    select.addEventListener(
        "change",
        function () {
            aiDifficulty =
                select.value;
        }
    );
    section.appendChild(
        label
    );
    section.appendChild(
        select
    );
    /*
     * Đặt ngay sau phần kích thước
     * nếu tìm thấy.
     */
    if (
        boardSizeSelect &&
        boardSizeSelect.parentElement
    ) {
        const sizeSection =
            boardSizeSelect.parentElement;
        sizeSection.insertAdjacentElement(
            "afterend",
            section
        );
    } else {
        /*
         * Fallback:
         * chèn trước nút Chơi.
         */
        const playButton =
            document.getElementById(
                "playButton"
            );
        if (playButton) {
            playButton.insertAdjacentElement(
                "beforebegin",
                section
            );
        } else {
            card.appendChild(
                section
            );
        }
    }
}
/* =========================================================
   MODE BUTTONS
   ========================================================= */
function setGameMode(mode) {
    gameMode =
        mode === "pvp"
            ? "pvp"
            : "ai";
    if (aiModeButton) {
        aiModeButton.classList.toggle(
            "active",
            gameMode === "ai"
        );
    }
    if (pvpModeButton) {
        pvpModeButton.classList.toggle(
            "active",
            gameMode === "pvp"
        );
    }
    updateAIDifficultyVisibility();
}
/* =========================================================
   WINDOW RESIZE
   ========================================================= */
function handleResize() {
    if (
        !boardElement ||
        gameScreen?.classList.contains(
            "hidden"
        )
    ) {
        return;
    }
    const cellSize =
        calculateCellSize();
    boardElement.style.setProperty(
        "--cell-size",
        `${cellSize}px`
    );
}
/* =========================================================
   INIT GAME
   ========================================================= */
function initGame() {
    /*
     * Tạo selector độ khó nếu HTML chưa có.
     */
    /*
     * Mode buttons.
     */
    if (aiModeButton) {
        aiModeButton.addEventListener(
            "click",
            function () {
                setGameMode("ai");
            }
        );
    }
    if (pvpModeButton) {
        pvpModeButton.addEventListener(
            "click",
            function () {
                setGameMode("pvp");
            }
        );
    }
    /*
     * Select độ khó.
     */
    const difficultySelect =
        document.getElementById(
            "aiDifficulty"
        );
    if (difficultySelect) {
        aiDifficulty =
            difficultySelect.value ||
            "medium";
    }
    /*
     * Resize.
     */
    window.addEventListener(
        "resize",
        handleResize
    );
    /*
     * Trạng thái ban đầu.
     */
    setGameMode(
        gameMode
    );
    updateScoreDisplay();
    updateTimerDisplay();
}
/* =========================================================
   STARTUP
   ========================================================= */
if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initGame
    );
} else {
    initGame();
}
/* =========================================================
   GLOBAL EXPORT
   =========================================================
   Firebase.js / main.js / ai.js có thể sử dụng.
   ========================================================= */
window.boardSize = boardSize;
Object.defineProperty(
    window,
    "caroBoardSize",
    {
        get() {
            return boardSize;
        },
        set(value) {
            const number =
                Number(value);
            if (
                number === 15 ||
                number === 20 ||
                number === 25
            ) {
                boardSize =
                    number;
            }
        }
    }
);
window.startOfflineGame =
    startOfflineGame;
window.startNewOfflineGame =
    startNewOfflineGame;
window.resetBoard =
    resetBoard;
window.renderBoard =
    renderBoard;
window.makeMove =
    makeMove;
window.checkWin =
    checkWin;
window.countDirection =
    countDirection;
window.showGame =
    showGame;
window.showMenu =
    showMenu;
window.showResult =
    showResult;
window.hideResultBox =
    hideResultBox;
window.startTimer =
    startTimer;
window.stopTimer =
    stopTimer;
window.resetTimer =
    resetTimer;
window.updateTurnDisplay =
    updateTurnDisplay;
window.updateScoreDisplay =
    updateScoreDisplay;
window.getCellIndex =
    getCellIndex;