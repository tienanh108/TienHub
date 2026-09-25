/* =========================================================
   LUDO MULTIPLAYER
   CỜ CÁ NGỰA ONLINE

   Phụ trách:
   - Kết nối Firebase Realtime Database
   - Tạo / tham gia room state
   - Đồng bộ game state
   - Đồng bộ lượt
   - Đồng bộ xúc xắc
   - Đồng bộ quân cờ
   - Theo dõi online / offline
   - Disconnect 30 giây
   - AI takeover
   - Host migration
   - Không cho người khác điều khiển quân của mình

   Firebase config sẽ được lấy từ main.js.
   File này KHÔNG chứa API key.
========================================================= */

"use strict";


/* =========================================================
   CONFIG
========================================================= */

const LudoMultiplayer = {

    initialized: false,

    connected: false,

    roomRef: null,

    roomId: null,

    playerId: null,

    playerColor: null,

    isHost: false,

    listening: false,

    writing: false,

    applyingRemoteState: false,

    lastRemoteState: null,

    presenceRef: null,

    disconnectRef: null,

    listeners: [],

    syncTimer: null,

    syncDelay: 80,

    disconnectGracePeriod: 30000

};


/* =========================================================
   FIREBASE REFERENCES
========================================================= */

let ludoDatabase = null;


/* =========================================================
   INIT
========================================================= */

function initLudoMultiplayer(database) {

    if (
        LudoMultiplayer.initialized
    ) {

        return true;

    }


    if (!database) {

        console.error(
            "Ludo Multiplayer: thiếu Firebase Database."
        );

        return false;

    }


    ludoDatabase =
        database;


    LudoMultiplayer.initialized =
        true;


    setupMultiplayerEvents();


    console.log(
        "Ludo Multiplayer initialized"
    );


    return true;

}


/* =========================================================
   SETUP EVENTS
========================================================= */

function setupMultiplayerEvents() {

    /*
        Khi game bắt đầu.
    */

    document.addEventListener(
        "ludo:gameStarted",
        event => {

            if (
                LudoMultiplayer.roomId
            ) {

                scheduleSync();

            }

        }
    );


    /*
        Khi đổi lượt.
    */

    document.addEventListener(
        "ludo:turnChanged",
        () => {

            scheduleSync();

        }
    );


    /*
        Khi xúc xắc.
    */

    document.addEventListener(
        "ludo:diceRolled",
        () => {

            scheduleSync();

        }
    );


    /*
        Khi thắng.
    */

    document.addEventListener(
        "ludo:gameWon",
        () => {

            scheduleSync();

        }
    );


    /*
        Khi AI takeover.
    */

    document.addEventListener(
        "ludo:aiTakeover",
        () => {

            scheduleSync();

        }
    );


    /*
        Khi người chơi reconnect.
    */

    document.addEventListener(
        "ludo:playerReconnected",
        () => {

            scheduleSync();

        }
    );


    /*
        Khi rời game.
    */

    document.addEventListener(
        "ludo:leaveGame",
        () => {

            leaveRoom();

        }
    );

}


/* =========================================================
   CREATE ROOM
========================================================= */

async function createLudoRoom(
    roomId,
    player
) {

    if (
        !ludoDatabase
    ) {

        throw new Error(
            "Firebase Database chưa được khởi tạo."
        );

    }


    if (!roomId) {

        throw new Error(
            "Thiếu mã phòng."
        );

    }


    if (!player?.id) {

        throw new Error(
            "Thiếu player ID."
        );

    }


    LudoMultiplayer.roomId =
        roomId;

    LudoMultiplayer.playerId =
        player.id;

    LudoMultiplayer.playerColor =
        player.color;

    LudoMultiplayer.isHost =
        true;


    LudoMultiplayer.roomRef =
        ludoDatabase.ref(
            `ludoRooms/${roomId}`
        );


    /*
        Kiểm tra phòng đã tồn tại.
    */

    const snapshot =
        await LudoMultiplayer.roomRef.once(
            "value"
        );


    if (
        snapshot.exists()
    ) {

        throw new Error(
            "Phòng đã tồn tại."
        );

    }


    const room = {

        roomId,

        hostId:
            player.id,

        state:
            "lobby",

        createdAt:
            firebase.database.ServerValue.TIMESTAMP,

        updatedAt:
            firebase.database.ServerValue.TIMESTAMP,

        players: {

            [player.id]: {

                id:
                    player.id,

                name:
                    player.name ||
                    "Khách",

                color:
                    player.color ||
                    "red",

                type:
                    "human",

                connected:
                    true,

                isHost:
                    true,

                joinedAt:
                    firebase.database.ServerValue.TIMESTAMP

            }

        },

        game: null

    };


    await LudoMultiplayer.roomRef.set(
        room
    );


    await setupPresence(
        player
    );


    listenRoom();


    emitMultiplayerEvent(
        "ludo:roomCreated",
        {
            roomId
        }
    );


    return room;

}


/* =========================================================
   JOIN ROOM
========================================================= */

async function joinLudoRoom(
    roomId,
    player
) {

    if (
        !ludoDatabase
    ) {

        throw new Error(
            "Firebase Database chưa được khởi tạo."
        );

    }


    if (!roomId) {

        throw new Error(
            "Thiếu mã phòng."
        );

    }


    if (!player?.id) {

        throw new Error(
            "Thiếu player ID."
        );

    }


    const roomRef =
        ludoDatabase.ref(
            `ludoRooms/${roomId}`
        );


    const snapshot =
        await roomRef.once(
            "value"
        );


    if (
        !snapshot.exists()
    ) {

        throw new Error(
            "Không tìm thấy phòng."
        );

    }


    const room =
        snapshot.val();


    /*
        Không cho vào phòng
        đã kết thúc.
    */

    if (
        room.state ===
        "finished"
    ) {

        throw new Error(
            "Phòng này đã kết thúc."
        );

    }


    const players =
        room.players ||
        {};


    /*
        Kiểm tra phòng đủ 4 người.
    */

    const playerList =
        Object.values(
            players
        );


    if (
        playerList.length >= 4
    ) {

        throw new Error(
            "Phòng đã đủ 4 người."
        );

    }


    /*
        Không cho trùng tên trong phòng.
        Đây chỉ là kiểm tra trong room.
    */

    const duplicateName =
        playerList.some(
            existing =>
                String(existing.name)
                    .trim()
                    .toLowerCase() ===
                String(player.name)
                    .trim()
                    .toLowerCase()
        );


    if (duplicateName) {

        throw new Error(
            "Tên này đang được sử dụng trong phòng."
        );

    }


    /*
        Lấy màu còn trống.
    */

    const usedColors =
        playerList.map(
            p =>
                p.color
        );


    const color =
        getAvailableRoomColor(
            usedColors
        );


    if (!color) {

        throw new Error(
            "Không còn vị trí."
        );

    }


    LudoMultiplayer.roomId =
        roomId;

    LudoMultiplayer.playerId =
        player.id;

    LudoMultiplayer.playerColor =
        color;

    LudoMultiplayer.isHost =
        false;

    LudoMultiplayer.roomRef =
        roomRef;


    const playerData = {

        id:
            player.id,

        name:
            player.name ||
            "Khách",

        color,

        type:
            "human",

        connected:
            true,

        isHost:
            false,

        joinedAt:
            firebase.database.ServerValue.TIMESTAMP

    };


    await roomRef
        .child(
            `players/${player.id}`
        )
        .set(
            playerData
        );


    await setupPresence({
        ...player,
        color
    });


    listenRoom();


    emitMultiplayerEvent(
        "ludo:roomJoined",
        {
            roomId,

            player:
                playerData
        }
    );


    return playerData;

}


/* =========================================================
   LISTEN ROOM
========================================================= */

function listenRoom() {

    if (
        !LudoMultiplayer.roomRef
    ) {

        return;

    }


    if (
        LudoMultiplayer.listening
    ) {

        return;

    }


    LudoMultiplayer.listening =
        true;


    const roomHandler =
        snapshot => {

            const room =
                snapshot.val();


            if (!room) {

                emitMultiplayerEvent(
                    "ludo:roomClosed"
                );

                return;

            }


            handleRemoteRoom(
                room
            );

        };


    LudoMultiplayer.roomRef.on(
        "value",
        roomHandler
    );


    LudoMultiplayer.listeners.push({
        ref:
            LudoMultiplayer.roomRef,

        event:
            "value",

        handler:
            roomHandler

    });

}


/* =========================================================
   HANDLE REMOTE ROOM
========================================================= */

function handleRemoteRoom(
    room
) {

    if (
        !room
    ) {

        return;

    }


    LudoMultiplayer.lastRemoteState =
        room;


    /*
        Cập nhật host.
    */

    LudoMultiplayer.isHost =
        room.hostId ===
        LudoMultiplayer.playerId;


    /*
        Đồng bộ players.
    */

    syncPlayersFromRoom(
        room.players ||
        {}
    );


    /*
        Đồng bộ game.
    */

    if (
        room.game &&
        room.state ===
        "playing"
    ) {

        applyRemoteGameState(
            room.game
        );

    }


    /*
        Báo cho giao diện.
    */

    emitMultiplayerEvent(
        "ludo:roomUpdated",
        room
    );


    /*
        Nếu lobby.
    */

    if (
        room.state ===
        "lobby"
    ) {

        emitMultiplayerEvent(
            "ludo:lobbyUpdated",
            {
                players:
                    room.players ||
                    {},

                hostId:
                    room.hostId
            }
        );

    }


    /*
        Nếu game đã bắt đầu.
    */

    if (
        room.state ===
        "playing"
    ) {

        emitMultiplayerEvent(
            "ludo:onlineGameStarted",
            room
        );

    }


    /*
        Nếu game kết thúc.
    */

    if (
        room.state ===
        "finished"
    ) {

        emitMultiplayerEvent(
            "ludo:onlineGameFinished",
            room
        );

    }

}


/* =========================================================
   SYNC PLAYERS
========================================================= */

function syncPlayersFromRoom(
    playersObject
) {

    const players =
        Object.values(
            playersObject ||
            {}
        );


    players.sort(
        (a, b) => {

            const order = {

                red: 0,

                green: 1,

                yellow: 2,

                blue: 3

            };


            return (
                (order[a.color] ?? 99) -
                (order[b.color] ?? 99)
            );

        }
    );


    /*
        Cập nhật game.js.
    */

    if (
        window.LudoGame
    ) {

        /*
            Chỉ thay danh sách
            khi không đang xử lý
            local action.
        */

        LudoGame.players =
            players.map(
                player => ({

                    ...player,

                    disconnectedAt:
                        player.disconnectedAt ||
                        null

                })
            );


        LudoGame.hostPlayerId =
            getHostId(
                playersObject
            );

    }


    /*
        Cập nhật board.js.
    */

    syncBoardPlayers(
        players
    );

}


/* =========================================================
   SYNC BOARD PLAYERS
========================================================= */

function syncBoardPlayers(
    players
) {

    if (
        !window.LudoBoard
    ) {

        return;

    }


    players.forEach(
        (player, index) => {

            const boardPlayer =
                LudoBoard.players[index];


            if (!boardPlayer) {
                return;
            }


            boardPlayer.id =
                player.color;

            boardPlayer.name =
                player.name;

            boardPlayer.color =
                getColorHex(
                    player.color
                );

            boardPlayer.type =
                player.type ||
                "human";

            boardPlayer.connected =
                player.connected !== false;

            boardPlayer.isHost =
                player.isHost === true;

        }
    );


    /*
        AI / human state.
    */

    players.forEach(
        player => {

            if (
                player.type ===
                "ai"
            ) {

                if (
                    window.setLudoPlayerType
                ) {

                    window.setLudoPlayerType(
                        player.color,
                        "ai"
                    );

                }

            }

        }
    );

}


/* =========================================================
   START ROOM
========================================================= */

async function startRoom() {

    if (
        !LudoMultiplayer.roomRef
    ) {

        throw new Error(
            "Chưa kết nối phòng."
        );

    }


    if (
        !LudoMultiplayer.isHost
    ) {

        throw new Error(
            "Chỉ Host được bắt đầu."
        );

    }


    const snapshot =
        await LudoMultiplayer.roomRef.once(
            "value"
        );


    const room =
        snapshot.val();


    if (!room) {

        throw new Error(
            "Phòng không tồn tại."
        );

    }


    const players =
        Object.values(
            room.players ||
            {}
        );


    if (
        players.length < 2
    ) {

        throw new Error(
            "Cần ít nhất 2 người chơi."
        );

    }


    /*
        Tự động thêm AI
        cho đủ 4 slot.
    */

    const completePlayers =
        fillMissingPlayersWithAI(
            players
        );


    const gameState =
        createInitialOnlineGameState(
            completePlayers
        );


    await LudoMultiplayer.roomRef.update({

        state:
            "playing",

        updatedAt:
            firebase.database.ServerValue.TIMESTAMP,

        players:
            playersToObject(
                completePlayers
            ),

        game:
            gameState

    });


    emitMultiplayerEvent(
        "ludo:roomStarted",
        {
            game:
                gameState,

            players:
                completePlayers
        }
    );


    return true;

}


/* =========================================================
   FILL AI
========================================================= */

function fillMissingPlayersWithAI(
    players
) {

    const result =
        [...players];


    const colors = [

        "red",
        "green",
        "yellow",
        "blue"

    ];


    const usedColors =
        new Set(
            result.map(
                p =>
                    p.color
            )
        );


    colors.forEach(
        color => {

            if (
                result.length >= 4
            ) {

                return;

            }


            if (
                usedColors.has(
                    color
                )
            ) {

                return;

            }


            result.push({

                id:
                    `ai-${color}`,

                name:
                    `AI ${getColorName(color)}`,

                color,

                type:
                    "ai",

                connected:
                    false,

                isHost:
                    false,

                joinedAt:
                    Date.now()

            });


            usedColors.add(
                color
            );

        }
    );


    return result;

}


/* =========================================================
   CREATE INITIAL GAME STATE
========================================================= */

function createInitialOnlineGameState(
    players
) {

    const boardPlayers =
        players.map(
            player => ({

                id:
                    player.color,

                name:
                    player.name,

                color:
                    getColorHex(
                        player.color
                    ),

                type:
                    player.type,

                connected:
                    player.connected,

                isHost:
                    player.isHost,

                pieces: [

                    {
                        id: 0,
                        position: -1,
                        finished: false
                    },

                    {
                        id: 1,
                        position: -1,
                        finished: false
                    },

                    {
                        id: 2,
                        position: -1,
                        finished: false
                    },

                    {
                        id: 3,
                        position: -1,
                        finished: false
                    }

                ]

            })
        );


    return {

        currentPlayer:
            0,

        diceValue:
            0,

        turnNumber:
            1,

        winner:
            null,

        started:
            true,

        players:
            boardPlayers

    };

}


/* =========================================================
   SYNC GAME STATE
========================================================= */

function scheduleSync() {

    if (
        !LudoMultiplayer.roomRef ||
        LudoMultiplayer.applyingRemoteState
    ) {

        return;

    }


    if (
        LudoMultiplayer.syncTimer
    ) {

        return;

    }


    LudoMultiplayer.syncTimer =
        setTimeout(
            () => {

                LudoMultiplayer.syncTimer =
                    null;

                syncCurrentGame();

            },
            LudoMultiplayer.syncDelay
        );

}


/* =========================================================
   SYNC CURRENT GAME
========================================================= */

async function syncCurrentGame() {

    if (
        !LudoMultiplayer.roomRef
    ) {

        return;

    }


    if (
        LudoMultiplayer.applyingRemoteState
    ) {

        return;

    }


    /*
        Chỉ Host ghi game state.

        Điều này rất quan trọng:

        Không để 4 client cùng ghi
        state → conflict.
    */

    if (
        !LudoMultiplayer.isHost
    ) {

        return;

    }


    if (
        !window.getLudoState
    ) {

        return;

    }


    const gameState =
        window.getLudoState();


    LudoMultiplayer.writing =
        true;


    try {

        await LudoMultiplayer.roomRef
            .child("game")
            .set(
                sanitizeGameState(
                    gameState
                )
            );


        await LudoMultiplayer.roomRef
            .child("updatedAt")
            .set(
                firebase.database.ServerValue.TIMESTAMP
            );


    } catch (error) {

        console.error(
            "Lỗi sync game:",
            error
        );

    } finally {

        LudoMultiplayer.writing =
            false;

    }

}


/* =========================================================
   APPLY REMOTE GAME STATE
========================================================= */

function applyRemoteGameState(
    remoteGame
) {

    if (
        !remoteGame
    ) {

        return;

    }


    /*
        Nếu chính Host vừa ghi state
        thì không cần xử lý lại.
    */

    if (
        LudoMultiplayer.writing
    ) {

        return;

    }


    LudoMultiplayer.applyingRemoteState =
        true;


    try {

        if (
            window.loadLudoState
        ) {

            window.loadLudoState(
                remoteGame
            );

        }


        /*
            Cập nhật game.js.
        */

        if (
            window.loadLudoGameState
        ) {

            window.loadLudoGameState({

                mode:
                    "online",

                state:
                    "playing",

                roomId:
                    LudoMultiplayer.roomId,

                localPlayerId:
                    LudoMultiplayer.playerId,

                hostPlayerId:
                    getHostId(
                        LudoMultiplayer
                            .lastRemoteState
                            ?.players
                    ),

                players:
                    Object.values(
                        LudoMultiplayer
                            .lastRemoteState
                            ?.players ||
                        {}
                    ),

                board:
                    remoteGame

            });

        }

    } finally {

        LudoMultiplayer.applyingRemoteState =
            false;

    }

}


/* =========================================================
   PRESENCE
========================================================= */

async function setupPresence(
    player
) {

    if (
        !LudoMultiplayer.roomRef
    ) {

        return;

    }


    const playerPath =
        `players/${player.id}`;


    LudoMultiplayer.presenceRef =
        LudoMultiplayer.roomRef
            .child(
                playerPath
            );


    /*
        Firebase connection state.
    */

    const connectedRef =
        ludoDatabase.ref(
            ".info/connected"
        );


    const connectedHandler =
        async snapshot => {

            if (
                snapshot.val() !== true
            ) {

                LudoMultiplayer.connected =
                    false;

                return;

            }


            LudoMultiplayer.connected =
                true;


            /*
                Khi mất kết nối:
                Firebase tự đặt connected=false.
            */

            const disconnectData = {

                connected:
                    false,

                disconnectedAt:
                    firebase.database.ServerValue.TIMESTAMP

            };


            await LudoMultiplayer
                .presenceRef
                .onDisconnect()
                .update(
                    disconnectData
                );


            /*
                Khi kết nối lại:
                ghi connected=true.
            */

            await LudoMultiplayer
                .presenceRef
                .update({

                    connected:
                        true,

                    disconnectedAt:
                        null

                });

        };


    connectedRef.on(
        "value",
        connectedHandler
    );


    LudoMultiplayer.listeners.push({

        ref:
            connectedRef,

        event:
            "value",

        handler:
            connectedHandler

    });


    /*
        Nút rời phòng / tab đóng.
    */

    await LudoMultiplayer
        .presenceRef
        .onDisconnect()
        .update({

            connected:
                false,

            disconnectedAt:
                firebase.database
                    .ServerValue
                    .TIMESTAMP

        });

}


/* =========================================================
   LEAVE ROOM
========================================================= */

async function leaveRoom() {

    if (
        !LudoMultiplayer.roomRef ||
        !LudoMultiplayer.playerId
    ) {

        cleanupMultiplayer();

        return;

    }


    const playerRef =
        LudoMultiplayer.roomRef
            .child(
                `players/${LudoMultiplayer.playerId}`
            );


    try {

        /*
            Nếu đang lobby:
            xóa player khỏi room.
        */

        const snapshot =
            await LudoMultiplayer.roomRef
                .once("value");


        const room =
            snapshot.val();


        if (
            room?.state ===
            "lobby"
        ) {

            await playerRef.remove();

        } else {

            /*
                Nếu đang game:
                không xóa player.

                Chuyển disconnected.
                main/game sẽ xử lý AI.
            */

            await playerRef.update({

                connected:
                    false,

                disconnectedAt:
                    firebase.database
                        .ServerValue
                        .TIMESTAMP

            });

        }

    } catch (error) {

        console.error(
            "Lỗi rời phòng:",
            error
        );

    }


    cleanupMultiplayer();

}


/* =========================================================
   CLEANUP
========================================================= */

function cleanupMultiplayer() {

    LudoMultiplayer.listeners
        .forEach(
            listener => {

                try {

                    listener.ref.off(
                        listener.event,
                        listener.handler
                    );

                } catch {

                    // ignore

                }

            }
        );


    LudoMultiplayer.listeners =
        [];


    if (
        LudoMultiplayer.syncTimer
    ) {

        clearTimeout(
            LudoMultiplayer.syncTimer
        );

    }


    LudoMultiplayer.syncTimer =
        null;

    LudoMultiplayer.roomRef =
        null;

    LudoMultiplayer.presenceRef =
        null;

    LudoMultiplayer.roomId =
        null;

    LudoMultiplayer.playerId =
        null;

    LudoMultiplayer.playerColor =
        null;

    LudoMultiplayer.isHost =
        false;

    LudoMultiplayer.listening =
        false;

    LudoMultiplayer.connected =
        false;

}


/* =========================================================
   GET ROOM PLAYERS
========================================================= */

function getRoomPlayers() {

    if (
        !LudoMultiplayer.lastRemoteState
    ) {

        return [];

    }


    return Object.values(
        LudoMultiplayer
            .lastRemoteState
            .players ||
        {}
    );

}


/* =========================================================
   GET HOST
========================================================= */

function getHostId(
    players
) {

    if (!players) {
        return null;
    }


    const list =
        Object.values(
            players
        );


    const host =
        list.find(
            player =>
                player.isHost === true
        );


    return (
        host?.id ||
        null
    );

}


/* =========================================================
   ROOM COLORS
========================================================= */

function getAvailableRoomColor(
    usedColors
) {

    const colors = [

        "red",
        "green",
        "yellow",
        "blue"

    ];


    return colors.find(
        color =>
            !usedColors.includes(
                color
            )
    );

}


/* =========================================================
   PLAYERS TO OBJECT
========================================================= */

function playersToObject(
    players
) {

    const result = {};


    players.forEach(
        player => {

            result[player.id] =
                player;

        }
    );


    return result;

}


/* =========================================================
   SANITIZE GAME STATE
========================================================= */

function sanitizeGameState(
    state
) {

    if (!state) {
        return null;
    }


    return {

        currentPlayer:
            Number(
                state.currentPlayer
            ) || 0,

        diceValue:
            Number(
                state.diceValue
            ) || 0,

        turnNumber:
            Number(
                state.turnNumber
            ) || 1,

        winner:
            state.winner ||
            null,

        started:
            !!state.started,

        players:
            sanitizePlayers(
                state.players
            )

    };

}


/* =========================================================
   SANITIZE PLAYERS
========================================================= */

function sanitizePlayers(
    players
) {

    if (
        !Array.isArray(
            players
        )
    ) {

        return [];

    }


    return players.map(
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
                player.connected !== false,

            isHost:
                player.isHost === true,

            pieces:
                Array.isArray(
                    player.pieces
                )
                    ? player.pieces.map(
                        piece => ({

                            id:
                                Number(
                                    piece.id
                                ),

                            position:
                                Number(
                                    piece.position
                                ),

                            finished:
                                !!piece.finished

                        })
                    )
                    : []

        })
    );

}


/* =========================================================
   HEX COLORS
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
   COLOR NAMES
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
   EVENT
========================================================= */

function emitMultiplayerEvent(
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

window.LudoMultiplayer =
    LudoMultiplayer;

window.initLudoMultiplayer =
    initLudoMultiplayer;

window.createLudoRoom =
    createLudoRoom;

window.joinLudoRoom =
    joinLudoRoom;

window.startLudoRoom =
    startRoom;

window.leaveLudoRoom =
    leaveRoom;

window.getLudoRoomPlayers =
    getRoomPlayers;

window.cleanupLudoMultiplayer =
    cleanupMultiplayer;


/* =========================================================
   AUTO INIT
========================================================= */

/*
    Không tự init Firebase ở đây.

    main.js sẽ gọi:

    initLudoMultiplayer(database)
*/
