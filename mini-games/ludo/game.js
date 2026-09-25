/* =========================================================
   LUDO GAME ENGINE
   CỜ CÁ NGỰA

   Phụ trách:
   - Quản lý trạng thái ván
   - Bắt đầu / kết thúc game
   - Single player
   - Online mode
   - Quản lý player
   - Host
   - AI slots
   - Disconnect / reconnect
   - Chuyển quyền điều khiển
   - Đồng bộ board state thông qua event
   - Chuẩn bị cho Firebase trong main.js

   Firebase KHÔNG nằm trong file này.
========================================================= */

"use strict";


/* =========================================================
   GAME CONFIG
========================================================= */

const LUDO_GAME_CONFIG = {

    MAX_PLAYERS: 4,

    MIN_PLAYERS: 2,

    DEFAULT_AI_COUNT: 3,

    DISCONNECT_GRACE_PERIOD: 30000,

    GAME_MODES: {

        SOLO: "solo",

        ONLINE: "online"

    },

    GAME_STATES: {

        IDLE: "idle",

        LOBBY: "lobby",

        PLAYING: "playing",

        PAUSED: "paused",

        FINISHED: "finished"

    }

};


/* =========================================================
   GAME STATE
========================================================= */

const LudoGame = {

    initialized: false,

    mode: null,

    state:
        LUDO_GAME_CONFIG.GAME_STATES.IDLE,

    roomId: null,

    localPlayerId: null,

    hostPlayerId: null,

    players: [],

    startedAt: null,

    finishedAt: null,

    winnerId: null,

    paused: false,

    disconnectTimers: {},

    lastState: null

};


/* =========================================================
   INIT
========================================================= */

function initLudoGame() {

    if (
        LudoGame.initialized
    ) {

        return;

    }


    setupGameEvents();


    LudoGame.initialized =
        true;


    console.log(
        "Ludo Game initialized"
    );

}


/* =========================================================
   SETUP EVENTS
========================================================= */

function setupGameEvents() {

    /*
        Khi board đổi lượt.
    */

    document.addEventListener(
        "ludo:turnChanged",
        event => {

            handleTurnChanged(
                event.detail
            );

        }
    );


    /*
        Khi có người thắng.
    */

    document.addEventListener(
        "ludo:gameWon",
        event => {

            handleGameWon(
                event.detail
            );

        }
    );


    /*
        Khi AI tiếp quản.
    */

    document.addEventListener(
        "ludo:aiTakeover",
        event => {

            handleAITakeover(
                event.detail
            );

        }
    );


    /*
        Khi người chơi quay lại.
    */

    document.addEventListener(
        "ludo:playerReconnected",
        event => {

            handlePlayerReconnected(
                event.detail
            );

        }
    );


    /*
        Khi quay về menu.
    */

    document.addEventListener(
        "ludo:menu",
        () => {

            leaveGame();

        }
    );


    /*
        Khi về GameHub.
    */

    document.addEventListener(
        "ludo:gamehub",
        () => {

            leaveGame();

        }
    );

}


/* =========================================================
   START SOLO GAME
========================================================= */

/*
    Chơi đơn:

    Người chơi
       +
    3 AI

    Không cần lobby.
*/

function startSoloGame(
    playerInfo = {}
) {

    resetGameState();


    LudoGame.mode =
        LUDO_GAME_CONFIG.GAME_MODES.SOLO;


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING;


    /*
        Người chơi chính.
    */

    const soloColors = shuffleColors(["red", "green", "yellow", "blue"]);

    const human =
        createPlayer({

            id:
                playerInfo.id ||
                "local-player",

            name:
                playerInfo.name ||
                "Bạn",

            color:
                soloColors[0],

            type:
                "human",

            connected:
                true,

            isHost:
                true

        });


    LudoGame.localPlayerId =
        human.id;


    LudoGame.hostPlayerId =
        human.id;


    LudoGame.players.push(
        human
    );


    /*
        3 AI.
    */

    const aiPlayers = soloColors.slice(1).map(color => ({
        id: `ai-${color}`,
        name: `Máy ${soloColors.indexOf(color) + 1}`,
        color
    }));


    aiPlayers.forEach(
        ai => {

            LudoGame.players.push(
                createPlayer({

                    ...ai,

                    type:
                        "ai",

                    connected:
                        false,

                    isHost:
                        false

                })
            );

        }
    );


    applyPlayersToBoard();


    LudoGame.startedAt =
        Date.now();


    emitGameEvent(
        "ludo:gameStarted",
        getGameState()
    );


    startBoard();


    return true;

}


/* =========================================================
   CREATE ONLINE GAME
========================================================= */

function createOnlineGame(
    hostInfo = {},
    roomId = null
) {

    resetGameState();


    LudoGame.mode =
        LUDO_GAME_CONFIG.GAME_MODES.ONLINE;


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.LOBBY;


    LudoGame.roomId =
        roomId;


    const host =
        createPlayer({

            id:
                hostInfo.id ||
                "local-host",

            name:
                hostInfo.name ||
                "Khách",

            color:
                "red",

            type:
                "human",

            connected:
                true,

            isHost:
                true

        });


    LudoGame.localPlayerId =
        host.id;


    LudoGame.hostPlayerId =
        host.id;


    LudoGame.players.push(
        host
    );


    applyPlayersToBoard();


    emitGameEvent(
        "ludo:roomCreated",
        getGameState()
    );


    return true;

}


/* =========================================================
   JOIN ONLINE GAME
========================================================= */

function joinOnlineGame(
    roomId,
    playerInfo = {}
) {

    if (!roomId) {

        console.warn(
            "Không có roomId."
        );

        return false;

    }


    LudoGame.mode =
        LUDO_GAME_CONFIG.GAME_MODES.ONLINE;


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.LOBBY;


    LudoGame.roomId =
        roomId;


    const player =
        createPlayer({

            id:
                playerInfo.id ||
                `player-${Date.now()}`,

            name:
                playerInfo.name ||
                "Khách",

            color:
                randomAvailableColor(LudoGame.players.map(player => player.color)),

            type:
                "human",

            connected:
                true,

            isHost:
                false

        });


    LudoGame.localPlayerId =
        player.id;


    /*
        main.js sau này sẽ lấy
        danh sách người chơi thật
        từ Firebase.

        Ở đây chỉ chuẩn bị
        local state.
    */

    LudoGame.players.push(
        player
    );


    applyPlayersToBoard();


    emitGameEvent(
        "ludo:roomJoined",
        getGameState()
    );


    return true;

}


/* =========================================================
   COLOR HELPERS
========================================================= */

function shuffleColors(colors) {
    const result = [...colors];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function randomAvailableColor(usedColors = []) {
    const available = ["red", "green", "yellow", "blue"]
        .filter(color => !usedColors.includes(color));
    return available.length
        ? available[Math.floor(Math.random() * available.length)]
        : "red";
}


/* =========================================================
   CREATE PLAYER
========================================================= */

function createPlayer(
    data = {}
) {

    return {

        id:
            data.id ||
            `player-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,

        name:
            data.name ||
            "Khách",

        color:
            data.color ||
            getAvailableColor(),

        type:
            data.type ||
            "human",

        connected:
            data.connected !== false,

        isHost:
            !!data.isHost,

        joinedAt:
            Date.now(),

        disconnectedAt:
            null,

        disconnectTimer:
            null

    };

}


/* =========================================================
   ADD PLAYER
========================================================= */

function addPlayer(
    playerData = {}
) {

    if (
        LudoGame.players.length >=
        LUDO_GAME_CONFIG.MAX_PLAYERS
    ) {

        return false;

    }


    /*
        Không cho duplicate ID.
    */

    const exists =
        LudoGame.players.some(
            player =>
                player.id ===
                playerData.id
        );


    if (exists) {

        return false;

    }


    const player =
        createPlayer(
            playerData
        );


    LudoGame.players.push(
        player
    );


    applyPlayersToBoard();


    emitGameEvent(
        "ludo:playerJoined",
        {
            player,
            game:
                getGameState()
        }
    );


    return true;

}


/* =========================================================
   REMOVE PLAYER FROM LOBBY
========================================================= */

function removePlayer(
    playerId
) {

    const index =
        LudoGame.players.findIndex(
            player =>
                player.id ===
                playerId
        );


    if (index === -1) {

        return false;

    }


    const player =
        LudoGame.players[index];


    /*
        Nếu game đã bắt đầu:
        KHÔNG xóa player khỏi mảng.

        Chuyển sang AI thay thế.
    */

    if (
        LudoGame.state ===
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING
    ) {

        disconnectPlayer(
            playerId
        );

        return true;

    }


    LudoGame.players.splice(
        index,
        1
    );


    /*
        Nếu host rời lobby
        thì chọn host mới.
    */

    if (
        player.id ===
        LudoGame.hostPlayerId
    ) {

        assignNewHost();

    }


    applyPlayersToBoard();


    emitGameEvent(
        "ludo:playerLeft",
        {
            playerId,

            game:
                getGameState()
        }
    );


    return true;

}


/* =========================================================
   DISCONNECT PLAYER
========================================================= */

/*
    Người chơi mất kết nối:

    0s
      ↓
    disconnected

    30s
      ↓
    AI takeover
*/

function disconnectPlayer(
    playerId
) {

    const player =
        getPlayer(
            playerId
        );


    if (!player) {
        return false;
    }


    player.connected =
        false;


    player.disconnectedAt =
        Date.now();


    emitGameEvent(
        "ludo:playerDisconnected",
        {
            playerId,

            player,

            gracePeriod:
                LUDO_GAME_CONFIG
                    .DISCONNECT_GRACE_PERIOD

        }
    );


    /*
        Nếu đang tới lượt,
        AI sẽ tiếp quản sau 30 giây.
    */

    clearDisconnectTimer(
        playerId
    );


    LudoGame.disconnectTimers[
        playerId
    ] =
        setTimeout(
            () => {

                /*
                    Nếu vẫn offline
                    thì AI tiếp quản.
                */

                const current =
                    getPlayer(
                        playerId
                    );


                if (
                    !current ||
                    current.connected
                ) {

                    return;

                }


                convertPlayerToAI(
                    playerId
                );

            },
            LUDO_GAME_CONFIG
                .DISCONNECT_GRACE_PERIOD
        );


    return true;

}


/* =========================================================
   RECONNECT PLAYER
========================================================= */

function reconnectPlayer(
    playerId
) {

    const player =
        getPlayer(
            playerId
        );


    if (!player) {
        return false;
    }


    clearDisconnectTimer(
        playerId
    );


    /*
        Nếu AI đã tiếp quản rồi
        thì không giành slot lại
        trong cùng ván.

        Có thể thay đổi luật này
        sau này nếu muốn.
    */

    if (
        player.type === "ai"
    ) {

        return false;

    }


    player.connected =
        true;


    player.disconnectedAt =
        null;


    player.disconnectTimer =
        null;


    if (
        window.restoreLudoHumanPlayer
    ) {

        window.restoreLudoHumanPlayer(
            playerId
        );

    }


    emitGameEvent(
        "ludo:playerReconnected",
        {
            playerId,

            player
        }
    );


    return true;

}


/* =========================================================
   CONVERT TO AI
========================================================= */

function convertPlayerToAI(
    playerId
) {

    const player =
        getPlayer(
            playerId
        );


    if (!player) {
        return false;
    }


    /*
        Không reset state.

        board.js giữ nguyên 4 quân.
    */

    player.type =
        "ai";

    player.connected =
        false;


    player.disconnectedAt =
        Date.now();


    clearDisconnectTimer(
        playerId
    );


    if (
        window.convertLudoPlayerToAI
    ) {

        window.convertLudoPlayerToAI(
            playerId
        );

    }


    emitGameEvent(
        "ludo:aiTakeover",
        {
            playerId,

            player
        }
    );


    /*
        Nếu đúng lượt người vừa out,
        AI lập tức được lên lịch.
    */

    if (
        isCurrentPlayer(
            playerId
        )
    ) {

        window.forceLudoAITurn?.();

    }


    return true;

}


/* =========================================================
   ASSIGN NEW HOST
========================================================= */

function assignNewHost() {

    /*
        Ưu tiên người đang connected.
    */

    const candidate =
        LudoGame.players.find(
            player =>
                player.connected &&
                player.type === "human"
        );


    if (!candidate) {

        /*
            Nếu không còn human,
            chọn bất kỳ player.
        */

        const fallback =
            LudoGame.players.find(
                player =>
                    player.type === "ai"
            );


        if (fallback) {

            LudoGame.hostPlayerId =
                fallback.id;

            fallback.isHost =
                true;

        }

        return;

    }


    LudoGame.players.forEach(
        player => {

            player.isHost =
                false;

        }
    );


    candidate.isHost =
        true;


    LudoGame.hostPlayerId =
        candidate.id;


    emitGameEvent(
        "ludo:hostChanged",
        {
            hostId:
                candidate.id,

            player:
                candidate
        }
    );

}


/* =========================================================
   START ONLINE GAME
========================================================= */

function startOnlineGame() {

    if (
        LudoGame.mode !==
        LUDO_GAME_CONFIG.GAME_MODES.ONLINE
    ) {

        return false;

    }


    if (
        LudoGame.state !==
        LUDO_GAME_CONFIG.GAME_STATES.LOBBY
    ) {

        return false;

    }


    /*
        Phải có ít nhất 2 người.
    */

    if (
        LudoGame.players.length <
        LUDO_GAME_CONFIG.MIN_PLAYERS
    ) {

        emitGameEvent(
            "ludo:startDenied",
            {
                reason:
                    "Cần ít nhất 2 người chơi."
            }
        );

        return false;

    }


    /*
        Chỉ host được start.
    */

    if (
        LudoGame.localPlayerId !==
        LudoGame.hostPlayerId
    ) {

        emitGameEvent(
            "ludo:startDenied",
            {
                reason:
                    "Chỉ chủ phòng mới được bắt đầu."
            }
        );

        return false;

    }


    /*
        Điền AI vào slot còn thiếu.
    */

    fillMissingSlotsWithAI();


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING;


    LudoGame.startedAt =
        Date.now();


    LudoGame.paused =
        false;


    applyPlayersToBoard();


    emitGameEvent(
        "ludo:gameStarted",
        getGameState()
    );


    startBoard();


    return true;

}


/* =========================================================
   FILL MISSING SLOTS
========================================================= */

function fillMissingSlotsWithAI() {
    const used = new Set(LudoGame.players.map(player => player.color));
    const remaining = shuffleColors(["red", "green", "yellow", "blue"]
        .filter(color => !used.has(color)));

    while (LudoGame.players.length < LUDO_GAME_CONFIG.MAX_PLAYERS) {
        const color = remaining.shift();
        if (!color) break;
        LudoGame.players.push(createPlayer({
            id: `ai-${color}`,
            name: `Máy ${aiIndex}`,
            color,
            type: "ai",
            connected: false,
            isHost: false
        }));
    }
}

function normalizePlayerColors() {
    const valid = new Set(["red", "green", "yellow", "blue"]);
    const seen = new Set();
    return LudoGame.players.every(player => {
        if (!valid.has(player.color) || seen.has(player.color)) return false;
        seen.add(player.color);
        return true;
    });
}

function applyPlayersToBoard() {
    if (!window.LudoBoard) return;

    const meta = Object.fromEntries(LUDO_PLAYERS.map(player => [player.id, player]));

    LudoBoard.players = LudoGame.players.map(player => {
        const colorMeta = meta[player.color];
        return {
            id: player.color,
            name: player.name,
            color: getColorHex(player.color),
            start: colorMeta?.start ?? 0,
            type: player.type,
            connected: player.connected !== false,
            isHost: player.isHost === true,
            pieces: [0, 1, 2, 3].map(id => createPiece(id))
        };
    });

    LudoBoard.currentPlayer = 0;

    // main.js renders the polished board; board.js keeps state + movement.
    window.renderLudoVisualBoard?.();
    window.renderLudoPieces?.();
    updateBoardUI();
}


/* =========================================================
   UPDATE BOARD REFERENCE
========================================================= */

function updateBoardReference() {

    if (
        !window.LudoBoard
    ) {

        return;

    }


    /*
        Board dùng màu làm ID.

        Đây là lý do player ID online
        và board color được tách riêng.
    */

}


/* =========================================================
   START BOARD
========================================================= */

function startBoard() {

    if (
        !window.LudoBoard
    ) {

        return;

    }


    LudoBoard.started =
        true;


    LudoBoard.currentPlayer =
        0;


    LudoBoard.diceValue =
        0;


    LudoBoard.winner =
        null;


    LudoBoard.turnNumber =
        1;


    LudoBoard.animationLock =
        false;


    window.startLudoControls?.();


    window.forceLudoAITurn?.();


    emitGameEvent(
        "ludo:boardStarted",
        getGameState()
    );

}


/* =========================================================
   PAUSE
========================================================= */

function pauseGame() {

    if (
        LudoGame.state !==
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING
    ) {

        return false;

    }


    LudoGame.paused =
        true;


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.PAUSED;


    window.clearLudoAITimer?.();


    emitGameEvent(
        "ludo:gamePaused",
        getGameState()
    );


    return true;

}


/* =========================================================
   RESUME
========================================================= */

function resumeGame() {

    if (
        LudoGame.state !==
        LUDO_GAME_CONFIG.GAME_STATES.PAUSED
    ) {

        return false;

    }


    LudoGame.paused =
        false;


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING;


    emitGameEvent(
        "ludo:gameResumed",
        getGameState()
    );


    /*
        Nếu đang tới lượt AI
        thì tiếp tục.
    */

    window.forceLudoAITurn?.();


    return true;

}


/* =========================================================
   TURN CHANGED
========================================================= */

function handleTurnChanged(
    detail = {}
) {

    if (
        LudoGame.state !==
        LUDO_GAME_CONFIG.GAME_STATES.PLAYING
    ) {

        return;

    }


    const player =
        detail.player;


    if (!player) {
        return;
    }


    emitGameEvent(
        "ludo:gameTurn",
        {
            playerId:
                player.id,

            game:
                getGameState()
        }
    );


    /*
        Nếu là AI
        → AI.js xử lý.
    */

    if (
        player.type === "ai"
    ) {

        window.forceLudoAITurn?.();

    }

}


/* =========================================================
   GAME WON
========================================================= */

function handleGameWon(
    detail = {}
) {

    const player =
        detail.player;


    if (!player) {
        return;
    }


    LudoGame.winnerId =
        player.id;


    LudoGame.finishedAt =
        Date.now();


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.FINISHED;


    window.clearLudoAITimer?.();


    emitGameEvent(
        "ludo:finished",
        getGameState()
    );

}


/* =========================================================
   AI TAKEOVER EVENT
========================================================= */

function handleAITakeover(
    detail = {}
) {

    const player =
        detail.player;


    if (!player) {
        return;
    }


    /*
        Game engine giữ player state.
    */

    const gamePlayer =
        getPlayerByColor(
            player.id
        );


    if (gamePlayer) {

        gamePlayer.type =
            "ai";

        gamePlayer.connected =
            false;

    }

}


/* =========================================================
   PLAYER RECONNECTED
========================================================= */

function handlePlayerReconnected(
    detail = {}
) {

    const player =
        detail.player;


    if (!player) {
        return;
    }


    const gamePlayer =
        getPlayerByColor(
            player.id
        );


    if (gamePlayer) {

        gamePlayer.connected =
            true;

    }

}


/* =========================================================
   GET PLAYER
========================================================= */

function getPlayer(
    playerId
) {

    return LudoGame.players.find(
        player =>
            player.id ===
            playerId
    );

}


/* =========================================================
   GET PLAYER BY COLOR
========================================================= */

function getPlayerByColor(
    color
) {

    return LudoGame.players.find(
        player =>
            player.color ===
            color
    );

}


/* =========================================================
   CURRENT PLAYER
========================================================= */

function isCurrentPlayer(
    playerId
) {

    const player =
        getPlayer(
            playerId
        );


    if (!player) {
        return false;
    }


    const boardPlayer =
        LudoBoard?.players?.[
            LudoBoard.currentPlayer
        ];


    if (!boardPlayer) {
        return false;
    }


    return (
        boardPlayer.id ===
        player.color
    );

}


/* =========================================================
   AVAILABLE COLOR
========================================================= */

function getAvailableColor() {

    const colors = [

        "red",
        "green",
        "yellow",
        "blue"

    ];


    const used =
        new Set(
            LudoGame.players.map(
                player =>
                    player.color
            )
        );


    return (
        colors.find(
            color =>
                !used.has(color)
        ) ||
        colors[0]
    );

}


/* =========================================================
   COLOR NAME
========================================================= */

function getColorName(
    color
) {

    const names = {

        red:
            "Đỏ",

        green:
            "Xanh lá",

        yellow:
            "Vàng",

        blue:
            "Xanh dương"

    };


    return (
        names[color] ||
        color
    );

}


/* =========================================================
   COLOR HEX
========================================================= */

function getColorHex(
    color
) {

    const colors = {

        red:
            "#ef4444",

        green:
            "#22c55e",

        yellow:
            "#facc15",

        blue:
            "#3b82f6"

    };


    return (
        colors[color] ||
        "#64748b"
    );

}


/* =========================================================
   LEAVE GAME
========================================================= */

function leaveGame() {

    /*
        Dừng AI.
    */

    window.clearLudoAITimer?.();


    /*
        Xóa disconnect timers.
    */

    Object.keys(
        LudoGame.disconnectTimers
    ).forEach(
        playerId => {

            clearDisconnectTimer(
                playerId
            );

        }
    );


    /*
        Không xóa Firebase room ở đây.

        main.js sẽ xử lý việc đó.
    */

    emitGameEvent(
        "ludo:leaveGame",
        {
            roomId:
                LudoGame.roomId,

            playerId:
                LudoGame.localPlayerId
        }
    );


    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.IDLE;


    LudoGame.mode =
        null;


    LudoGame.roomId =
        null;


    LudoGame.localPlayerId =
        null;


    LudoGame.hostPlayerId =
        null;


    LudoGame.players =
        [];


    LudoGame.winnerId =
        null;


    LudoGame.startedAt =
        null;


    LudoGame.finishedAt =
        null;


    return true;

}


/* =========================================================
   RESET
========================================================= */

function resetGameState() {

    window.clearLudoAITimer?.();


    Object.keys(
        LudoGame.disconnectTimers
    ).forEach(
        playerId => {

            clearDisconnectTimer(
                playerId
            );

        }
    );


    LudoGame.mode =
        null;

    LudoGame.state =
        LUDO_GAME_CONFIG.GAME_STATES.IDLE;

    LudoGame.roomId =
        null;

    LudoGame.localPlayerId =
        null;

    LudoGame.hostPlayerId =
        null;

    LudoGame.players =
        [];

    LudoGame.startedAt =
        null;

    LudoGame.finishedAt =
        null;

    LudoGame.winnerId =
        null;

    LudoGame.paused =
        false;

}


/* =========================================================
   DISCONNECT TIMER
========================================================= */

function clearDisconnectTimer(
    playerId
) {

    const timer =
        LudoGame.disconnectTimers[
            playerId
        ];


    if (
        timer
    ) {

        clearTimeout(
            timer
        );

    }


    delete LudoGame.disconnectTimers[
        playerId
    ];

}


/* =========================================================
   GET GAME STATE
========================================================= */

function getGameState() {

    return {

        mode:
            LudoGame.mode,

        state:
            LudoGame.state,

        roomId:
            LudoGame.roomId,

        localPlayerId:
            LudoGame.localPlayerId,

        hostPlayerId:
            LudoGame.hostPlayerId,

        startedAt:
            LudoGame.startedAt,

        finishedAt:
            LudoGame.finishedAt,

        winnerId:
            LudoGame.winnerId,

        paused:
            LudoGame.paused,

        players:
            LudoGame.players.map(
                player => ({

                    id:
                        player.id,

                    name:
                        player.name,

                    color:
                        player.color,

                    type:
                        player.type,

                    connected:
                        player.connected,

                    isHost:
                        player.isHost,

                    joinedAt:
                        player.joinedAt,

                    disconnectedAt:
                        player.disconnectedAt

                })
            ),

        board:
            window.getLudoState?.() ||
            null

    };

}


/* =========================================================
   LOAD GAME STATE
========================================================= */

function loadGameState(
    state
) {

    if (!state) {
        return false;
    }


    if (
        state.mode
    ) {

        LudoGame.mode =
            state.mode;

    }


    if (
        state.state
    ) {

        LudoGame.state =
            state.state;

    }


    if (
        state.roomId
    ) {

        LudoGame.roomId =
            state.roomId;

    }


    if (
        state.localPlayerId
    ) {

        LudoGame.localPlayerId =
            state.localPlayerId;

    }


    if (
        state.hostPlayerId
    ) {

        LudoGame.hostPlayerId =
            state.hostPlayerId;

    }


    if (
        Array.isArray(
            state.players
        )
    ) {

        LudoGame.players =
            state.players.map(
                player =>
                    createPlayer(
                        player
                    )
            );

    }


    if (
        state.board &&
        window.loadLudoState
    ) {

        window.loadLudoState(
            state.board
        );

    }


    return true;

}


/* =========================================================
   EMIT GAME EVENT
========================================================= */

function emitGameEvent(
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
   PUBLIC API
========================================================= */

window.LudoGame =
    LudoGame;

window.initLudoGame =
    initLudoGame;

window.startLudoSolo =
    startSoloGame;

window.createLudoOnlineGame =
    createOnlineGame;

window.joinLudoOnlineGame =
    joinOnlineGame;

window.startLudoOnlineGame =
    startOnlineGame;

window.addLudoPlayer =
    addPlayer;

window.removeLudoPlayer =
    removePlayer;

window.disconnectLudoPlayer =
    disconnectPlayer;

window.reconnectLudoPlayer =
    reconnectPlayer;

window.convertLudoPlayerToAI =
    convertPlayerToAI;

window.pauseLudoGame =
    pauseGame;

window.resumeLudoGame =
    resumeGame;

window.leaveLudoGame =
    leaveGame;

window.getLudoGameState =
    getGameState;

window.loadLudoGameState =
    loadGameState;


/* =========================================================
   AUTO INIT
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initLudoGame
    );

} else {

    initLudoGame();

}