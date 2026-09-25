/* =========================================================
   LUDO CONTROLS
   Điều khiển game Cá Ngựa

   Phụ trách:
   - Nút xúc xắc
   - Nút chơi lại
   - Nút menu
   - Chọn quân
   - Khóa/mở điều khiển
   - Keyboard
   - Âm thanh
   - Hiển thị trạng thái
   - Chuẩn bị cho AI / multiplayer

   Firebase KHÔNG nằm trong file này.
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

const LudoControls = {

    initialized: false,

    locked: false,

    gameStarted: false,

    soundEnabled: true,

    selectedPiece: null,

    lastAction: null,

    timers: []

};


/* =========================================================
   DOM REFERENCES
========================================================= */

const LudoControlElements = {

    diceButton: null,

    dice: null,

    resetButton: null,

    menuButton: null,

    gameHubButton: null,

    turn: null,

    message: null,

    rollStatus: null,

    gameScreen: null

};


/* =========================================================
   INIT
========================================================= */

function initLudoControls() {

    if (LudoControls.initialized) {
        return;
    }

    cacheElements();

    bindEvents();

    setupKeyboard();

    setupBoardEvents();

    LudoControls.initialized = true;

    updateAll();

    console.log(
        "Ludo Controls initialized"
    );

}


/* =========================================================
   CACHE ELEMENTS
========================================================= */

function cacheElements() {

    LudoControlElements.diceButton =
        document.getElementById(
            "rollDiceButton"
        ) || document.getElementById(
            "rollButton"
        );

    LudoControlElements.dice =
        document.getElementById(
            "ludoDice"
        ) || document.getElementById(
            "dice"
        );

    LudoControlElements.resetButton =
        document.getElementById(
            "resetLudoButton"
        );

    LudoControlElements.menuButton =
        document.getElementById(
            "ludoMenuButton"
        );

    LudoControlElements.gameHubButton =
        document.getElementById(
            "gameHubButton"
        );

    LudoControlElements.turn =
        document.getElementById(
            "ludoTurn"
        ) || document.getElementById(
            "turnBadge"
        );

    LudoControlElements.message =
        document.getElementById(
            "ludoBoardMessage"
        );

    LudoControlElements.rollStatus =
        document.getElementById(
            "ludoRollStatus"
        );

    LudoControlElements.gameScreen =
        document.getElementById(
            "gameScreen"
        );

}


/* =========================================================
   BIND EVENTS
========================================================= */

function bindEvents() {

    if (
        LudoControlElements.diceButton
    ) {

        LudoControlElements.diceButton
            .addEventListener(
                "click",
                onDiceClick
            );

    }


    if (
        LudoControlElements.resetButton
    ) {

        LudoControlElements.resetButton
            .addEventListener(
                "click",
                onResetClick
            );

    }


    if (
        LudoControlElements.menuButton
    ) {

        LudoControlElements.menuButton
            .addEventListener(
                "click",
                onMenuClick
            );

    }


    if (
        LudoControlElements.gameHubButton
    ) {

        LudoControlElements.gameHubButton
            .addEventListener(
                "click",
                onGameHubClick
            );

    }

}


/* =========================================================
   BOARD EVENTS
========================================================= */

function setupBoardEvents() {

    document.addEventListener(
        "ludo:diceRolled",
        event => {

            const detail =
                event.detail || {};

            setRollStatus(
                `Đã đổ: ${detail.value ?? "?"}`
            );

            updateDiceButton();

        }
    );


    document.addEventListener(
        "ludo:turnChanged",
        () => {

            clearSelection();

            updateTurn();

            updateDiceButton();

        }
    );


    document.addEventListener(
        "ludo:gameWon",
        event => {

            const player =
                event.detail?.player;

            setLocked(true);

            if (player) {

                showMessage(
                    `🎉 ${player.name} đã thắng!`
                );

            }

        }
    );


    document.addEventListener(
        "ludo:aiTakeover",
        event => {

            const player =
                event.detail?.player;

            if (!player) {
                return;
            }

            showMessage(
                `${player.name} đã được AI tiếp quản.`
            );

        }
    );


    document.addEventListener(
        "ludo:playerReconnected",
        event => {

            const player =
                event.detail?.player;

            if (!player) {
                return;
            }

            showMessage(
                `${player.name} đã quay lại!`
            );

        }
    );

}


/* =========================================================
   DICE CLICK
========================================================= */

/* =========================================================
   ONLINE CONTROL OWNERSHIP
========================================================= */

function canLocalControlCurrentPlayer() {

    if (
        !window.LudoGame ||
        LudoGame.mode !== "online"
    ) {
        return true;
    }

    const current =
        LudoBoard?.players?.[LudoBoard.currentPlayer];

    if (!current) {
        return false;
    }

    if (current.type === "ai") {
        return (
            LudoGame.localPlayerId ===
            LudoGame.hostPlayerId
        );
    }

    const owner =
        LudoGame.players?.find(
            player =>
                player.color === current.id
        );

    return (
        owner &&
        owner.id ===
        LudoGame.localPlayerId
    );
}

function onDiceClick(event) {

    event?.preventDefault();

    if (LudoControls.locked) {
        return;
    }

    if (!window.LudoBoard) {
        return;
    }

    if (!LudoBoard.started) {
        return;
    }

    if (!canLocalControlCurrentPlayer()) {
        showMessage("Chờ đến lượt của bạn.");
        return;
    }

    if (
        LudoBoard.rolling ||
        LudoBoard.animationLock
    ) {
        return;
    }

    if (
        LudoBoard.diceValue !== 0
    ) {

        showMessage(
            "Hãy chọn quân để di chuyển."
        );

        return;
    }


    LudoControls.lastAction =
        "roll";


    setDiceButtonEnabled(false);

    window.rollLudoDice?.();

}


/* =========================================================
   RESET
========================================================= */

function onResetClick(event) {

    event?.preventDefault();

    if (LudoControls.locked) {
        return;
    }


    const confirmed =
        window.confirm(
            "Bạn có chắc muốn chơi lại từ đầu?"
        );


    if (!confirmed) {
        return;
    }


    LudoControls.lastAction =
        "reset";


    clearTimers();

    clearSelection();


    window.resetLudoBoard?.();


    LudoControls.gameStarted =
        true;


    setLocked(false);

    setDiceButtonEnabled(true);


    showMessage(
        "Ván mới đã bắt đầu."
    );

}


/* =========================================================
   MENU
========================================================= */

function onMenuClick(event) {

    event?.preventDefault();

    if (LudoControls.locked) {
        return;
    }


    LudoControls.lastAction =
        "menu";


    dispatchControlEvent(
        "ludo:menu"
    );

}


/* =========================================================
   GAME HUB
========================================================= */

function onGameHubClick(event) {

    event?.preventDefault();

    if (LudoControls.locked) {
        return;
    }


    LudoControls.lastAction =
        "gamehub";


    dispatchControlEvent(
        "ludo:gamehub"
    );

}


/* =========================================================
   PIECE CLICK
========================================================= */

function handlePieceClick(
    playerId,
    pieceId
) {

    if (LudoControls.locked) {
        return;
    }


    if (!window.LudoBoard) {
        return;
    }


    if (
        !LudoBoard.started
    ) {
        return;
    }


    const player =
        LudoBoard.players.find(
            p =>
                p.id === playerId
        );


    if (!player) {
        return;
    }


    const currentPlayer =
        LudoBoard.players[
            LudoBoard.currentPlayer
        ];


    if (!currentPlayer) {
        return;
    }

    if (!canLocalControlCurrentPlayer()) {
        showMessage("Bạn không điều khiển quân của người chơi này.");
        return;
    }


    /*
        Chỉ người đang tới lượt
        mới được chọn quân.
    */

    if (
        currentPlayer.id !==
        playerId
    ) {

        showMessage(
            "Chưa tới lượt của người này."
        );

        return;
    }


    /*
        Chưa tung xúc xắc.
    */

    if (
        LudoBoard.diceValue === 0
    ) {

        showMessage(
            "Hãy tung xúc xắc trước."
        );

        return;
    }


    /*
        Kiểm tra quân.
    */

    const piece =
        player.pieces.find(
            p =>
                p.id === pieceId
        );


    if (!piece) {
        return;
    }


    const canMove =
        typeof window.LudoBoardCanMovePiece ===
        "function"
            ? window.LudoBoardCanMovePiece(
                player,
                piece,
                LudoBoard.diceValue
            )
            : canMoveFallback(
                player,
                piece
            );


    if (!canMove) {

        showMessage(
            "Quân này không thể đi với số vừa đổ."
        );

        return;
    }


    selectPieceVisual(
        playerId,
        pieceId
    );


    LudoControls.selectedPiece = {

        playerId,

        pieceId

    };


    LudoControls.lastAction =
        "piece";


    /*
        board.js đã có logic chọn quân.
    */

    if (
        typeof window.selectLudoPiece ===
        "function"
    ) {

        window.selectLudoPiece(
            playerId,
            pieceId
        );

    }

}


/* =========================================================
   FALLBACK MOVE CHECK
========================================================= */

function canMoveFallback(player, piece) {
    const dice = LudoBoard.diceValue;
    if (typeof window.LudoBoardCanMovePiece === "function") {
        return window.LudoBoardCanMovePiece(player, piece, dice);
    }
    return false;
}


/* =========================================================
   SELECT VISUAL
========================================================= */

function selectPieceVisual(
    playerId,
    pieceId
) {

    clearSelection();


    const element =
        document.querySelector(
            `.ludo-piece[data-player="${playerId}"][data-piece="${pieceId}"]`
        );


    if (!element) {
        return;
    }


    element.classList.add(
        "selected"
    );

}


/* =========================================================
   CLEAR SELECTION
========================================================= */

function clearSelection() {

    LudoControls.selectedPiece =
        null;


    document
        .querySelectorAll(
            ".ludo-piece.selected"
        )
        .forEach(
            element => {

                element.classList.remove(
                    "selected"
                );

            }
        );

}


/* =========================================================
   SET LOCKED
========================================================= */

function setLocked(
    locked
) {

    LudoControls.locked =
        !!locked;


    updateDiceButton();


    document
        .querySelectorAll(
            ".ludo-piece"
        )
        .forEach(
            piece => {

                piece.classList.toggle(
                    "controls-locked",
                    LudoControls.locked
                );

            }
        );

}


/* =========================================================
   DICE BUTTON
========================================================= */

function updateDiceButton() {

    if (
        !LudoControlElements.diceButton
    ) {
        return;
    }


    if (
        LudoControls.locked
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    if (
        !window.LudoBoard
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    if (
        !LudoBoard.started
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    if (
        LudoBoard.rolling
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    if (
        LudoBoard.animationLock
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    /*
        Đã đổ nhưng chưa đi.
    */

    if (
        LudoBoard.diceValue !== 0
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    setDiceButtonEnabled(
        true
    );

}


/* =========================================================
   ENABLE / DISABLE DICE
========================================================= */

function setDiceButtonEnabled(
    enabled
) {

    const button =
        LudoControlElements.diceButton;


    if (!button) {
        return;
    }


    button.disabled =
        !enabled;


    button.classList.toggle(
        "disabled",
        !enabled
    );

}


/* =========================================================
   TURN
========================================================= */

function updateTurn() {

    if (
        !window.LudoBoard
    ) {
        return;
    }


    const player =
        LudoBoard.players[
            LudoBoard.currentPlayer
        ];


    if (!player) {
        return;
    }


    if (
        LudoControlElements.turn
    ) {

        LudoControlElements.turn
            .textContent =
            `Lượt của ${player.name}`;

        LudoControlElements.turn.style.color =
            player.color;

    }


    /*
        Nếu đang là AI,
        không cho người click xúc xắc.
    */

    if (
        player.type === "ai"
    ) {

        setDiceButtonEnabled(
            false
        );

        return;

    }


    updateDiceButton();

}


/* =========================================================
   UPDATE ALL
========================================================= */

function updateAll() {

    updateTurn();

    updateDiceButton();

}


/* =========================================================
   MESSAGE
========================================================= */

function showMessage(
    message
) {

    if (
        LudoControlElements.message
    ) {

        LudoControlElements.message
            .textContent =
            message;

    }

}


/* =========================================================
   ROLL STATUS
========================================================= */

function setRollStatus(
    message
) {

    if (
        LudoControlElements.rollStatus
    ) {

        LudoControlElements.rollStatus
            .textContent =
            message;

    }

}


/* =========================================================
   START GAME
========================================================= */

function startLudoControls() {

    LudoControls.gameStarted =
        true;

    LudoControls.locked =
        false;

    clearSelection();

    updateAll();

}


/* =========================================================
   STOP GAME
========================================================= */

function stopLudoControls() {

    LudoControls.gameStarted =
        false;

    clearSelection();

    setLocked(true);

}


/* =========================================================
   SOUND
========================================================= */

function toggleLudoSound() {

    LudoControls.soundEnabled =
        !LudoControls.soundEnabled;


    dispatchControlEvent(
        "ludo:soundChanged",
        {

            enabled:
                LudoControls.soundEnabled

        }
    );


    return LudoControls.soundEnabled;

}


/* =========================================================
   KEYBOARD
========================================================= */

function setupKeyboard() {

    document.addEventListener(
        "keydown",
        event => {

            /*
                Không bắt phím khi nhập text.
            */

            const target =
                event.target;


            if (
                target instanceof
                    HTMLInputElement ||
                target instanceof
                    HTMLTextAreaElement ||
                target instanceof
                    HTMLSelectElement
            ) {

                return;

            }


            /*
                SPACE = xúc xắc
            */

            if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

                onDiceClick();

                return;

            }


            /*
                R = reset
            */

            if (
                event.key.toLowerCase() ===
                "r"
            ) {

                onResetClick();

            }


            /*
                ESC = bỏ chọn quân
            */

            if (
                event.key ===
                "Escape"
            ) {

                clearSelection();

            }

        }
    );

}


/* =========================================================
   CUSTOM EVENT
========================================================= */

function dispatchControlEvent(
    name,
    detail = {}
) {

    document.dispatchEvent(
        new CustomEvent(
            name,
            {
                detail
            }
        )
    );

}


/* =========================================================
   TIMERS
========================================================= */

function addTimer(
    timer
) {

    LudoControls.timers.push(
        timer
    );

}


function clearTimers() {

    LudoControls.timers
        .forEach(
            timer => {

                clearTimeout(timer);

                clearInterval(timer);

            }
        );


    LudoControls.timers = [];

}


/* =========================================================
   STATE
========================================================= */

function getLudoControlsState() {

    return {

        initialized:
            LudoControls.initialized,

        locked:
            LudoControls.locked,

        gameStarted:
            LudoControls.gameStarted,

        soundEnabled:
            LudoControls.soundEnabled,

        selectedPiece:
            LudoControls.selectedPiece,

        lastAction:
            LudoControls.lastAction

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

window.LudoControls =
    LudoControls;


window.initLudoControls =
    initLudoControls;


window.startLudoControls =
    startLudoControls;


window.stopLudoControls =
    stopLudoControls;


window.handleLudoPieceClick =
    handlePieceClick;


window.clearLudoPieceSelection =
    clearSelection;


window.toggleLudoSound =
    toggleLudoSound;


window.getLudoControlsState =
    getLudoControlsState;


window.setLudoControlsLocked =
    setLocked;

// Cho phep board/multiplayer refresh UI ngay khi state tu Firebase ve.
window.updateLudoControls =
    updateAll;


/* =========================================================
   AUTO INIT
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initLudoControls
    );

} else {

    initLudoControls();

}