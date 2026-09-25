/* =========================================================
   LUDO AI
   CỜ CÁ NGỰA

   Phụ trách:
   - AI tự tung xúc xắc
   - AI chọn quân
   - Ưu tiên ăn quân
   - Ưu tiên về đích
   - Ưu tiên đưa quân ra
   - AI tiếp quản người chơi disconnect
   - Không dùng Firebase trực tiếp
========================================================= */

"use strict";


/* =========================================================
   AI CONFIG
========================================================= */

const LudoAI = {

    enabled: true,

    thinking: false,

    timer: null,

    /*
        Độ khó:

        easy
        normal
        hard
    */

    difficulty: "normal",

    /*
        Thời gian AI suy nghĩ.
    */

    thinkDelay: 700,

    /*
        Khoảng thời gian giữa
        các lần tung xúc xắc.
    */

    rollDelay: 650

};


/* =========================================================
   AI DIFFICULTY
========================================================= */

const AI_DIFFICULTY = {

    easy: {

        captureBonus: 20,

        finishBonus: 30,

        exitBonus: 10,

        progressBonus: 5,

        randomBonus: 20

    },

    normal: {

        captureBonus: 70,

        finishBonus: 100,

        exitBonus: 35,

        progressBonus: 15,

        randomBonus: 8

    },

    hard: {

        captureBonus: 110,

        finishBonus: 160,

        exitBonus: 50,

        progressBonus: 25,

        randomBonus: 3

    }

};


/* =========================================================
   INIT
========================================================= */

function initLudoAI() {

    document.addEventListener(
        "ludo:turnChanged",
        handleTurnChanged
    );

    document.addEventListener(
        "ludo:diceRolled",
        handleDiceRolled
    );

    document.addEventListener(
        "ludo:aiTakeover",
        handleAITakeover
    );

    console.log(
        "Ludo AI initialized"
    );

}


/* =========================================================
   TURN CHANGED
========================================================= */

function handleTurnChanged(event) {

    if (!LudoAI.enabled) {
        return;
    }

    const extraTurn =
        event?.detail?.extraTurn === true;

    if (extraTurn) {
        // Đang vẫn là AI đó; cho AI một khoảng nghĩ nhỏ
        // rồi tung lại, không chuyển currentPlayer.
        if (LudoAI.timer) {
            clearTimeout(LudoAI.timer);
            LudoAI.timer = null;
        }

        LudoAI.thinking = false;

        LudoAI.timer = setTimeout(
            () => {
                LudoAI.timer = null;
                if (isAITurn()) {
                    scheduleAITurn();
                }
            },
            500
        );

        return;
    }

    scheduleAITurn();

}


/* =========================================================
   AI TAKEOVER
========================================================= */

function handleAITakeover(event) {

    const player =
        event.detail?.player;

    if (!player) {
        return;
    }

    /*
        Không reset quân.

        AI tiếp quản toàn bộ state
        hiện tại của player.
    */

    player.type = "ai";

    player.connected = false;


    /*
        Nếu chính người này
        đang tới lượt thì AI chạy ngay.
    */

    if (
        window.LudoBoard &&
        LudoBoard.players[
            LudoBoard.currentPlayer
        ]?.id === player.id
    ) {

        scheduleAITurn();

    }

}


/* =========================================================
   CHECK AI TURN
========================================================= */

function isAITurn() {

    if (
        !window.LudoBoard ||
        !LudoBoard.started ||
        LudoBoard.winner
    ) {

        return false;

    }


    const player =
        LudoBoard.players[
            LudoBoard.currentPlayer
        ];


    if (!player) {
        return false;
    }


    /*
        Online: chỉ Host điều khiển AI.
        Như vậy các máy khách không cùng lúc tung xúc xắc
        và di chuyển cùng một AI.
    */
    if (
        window.LudoGame &&
        LudoGame.mode === "online" &&
        LudoGame.localPlayerId !== LudoGame.hostPlayerId
    ) {
        return false;
    }

    return player.type === "ai";

}


/* =========================================================
   SCHEDULE AI
========================================================= */

function scheduleAITurn() {

    clearAITimer();


    if (!LudoAI.enabled) {
        return;
    }


    if (!isAITurn()) {
        return;
    }


    LudoAI.thinking =
        true;


    LudoAI.timer =
        setTimeout(
            () => {

                LudoAI.timer =
                    null;

                performAITurn();

            },
            LudoAI.thinkDelay
        );

}


/* =========================================================
   PERFORM AI TURN
========================================================= */

function performAITurn() {

    if (!isAITurn()) {

        LudoAI.thinking =
            false;

        return;

    }


    if (
        LudoBoard.rolling ||
        LudoBoard.animationLock
    ) {

        scheduleAITurn();

        return;

    }


    if (
        LudoBoard.diceValue !== 0
    ) {

        /*
            Đã có xúc xắc.

            Chọn quân.
        */

        chooseAIPiece();

        return;

    }


    /*
        Tung xúc xắc.
    */

    LudoAI.thinking =
        true;


    showAIMessage(
        `${getCurrentAIName()} đang tung xúc xắc...`
    );


    LudoAI.timer =
        setTimeout(
            () => {

                LudoAI.timer =
                    null;

                if (
                    isAITurn() &&
                    window.rollLudoDice
                ) {

                    window.rollLudoDice();

                }

            },
            LudoAI.rollDelay
        );

}


/* =========================================================
   DICE ROLLED
========================================================= */

function handleDiceRolled(event) {

    if (!isAITurn()) {
        return;
    }


    const value =
        event.detail?.value;


    if (!value) {
        return;
    }


    /*
        Cho board xử lý xong
        rồi AI mới chọn quân.
    */

    LudoAI.timer =
        setTimeout(
            () => {

                chooseAIPiece();

            },
            LudoAI.thinkDelay
        );

}


/* =========================================================
   CHOOSE AI PIECE
========================================================= */

function chooseAIPiece() {

    if (!isAITurn()) {

        LudoAI.thinking =
            false;

        return;

    }


    if (
        LudoBoard.rolling ||
        LudoBoard.animationLock
    ) {

        scheduleAITurn();

        return;

    }


    const player =
        LudoBoard.players[
            LudoBoard.currentPlayer
        ];


    if (!player) {
        return;
    }


    const dice =
        LudoBoard.diceValue;


    if (!dice) {
        return;
    }


    const movable =
        getMovablePieces(
            player,
            dice
        );


    if (
        movable.length === 0
    ) {

        LudoAI.thinking =
            false;

        return;

    }


    const selected =
        chooseBestPiece(
            player,
            movable,
            dice
        );


    if (!selected) {
        return;
    }


    showAIMessage(
        `${player.name} chọn quân ${selected.id + 1}`
    );


    LudoAI.thinking =
        false;


    LudoAI.timer =
        setTimeout(
            () => {

                if (
                    !isAITurn()
                ) {

                    return;

                }


                if (
                    window.selectLudoPiece
                ) {

                    window.selectLudoPiece(
                        player.id,
                        selected.id
                    );

                }

            },
            LudoAI.thinkDelay
        );

}


/* =========================================================
   GET MOVABLE PIECES
========================================================= */

function getMovablePieces(
    player,
    dice
) {

    return player.pieces.filter(
        piece =>
            canAIMove(
                player,
                piece,
                dice
            )
    );

}


/* =========================================================
   CAN AI MOVE
========================================================= */

function canAIMove(player, piece, dice) {
    if (typeof window.LudoBoardCanMovePiece === "function") {
        return window.LudoBoardCanMovePiece(player, piece, dice);
    }
    return false;
}


/* =========================================================
   CHOOSE BEST PIECE
========================================================= */

function chooseBestPiece(
    player,
    pieces,
    dice
) {

    const difficulty =
        AI_DIFFICULTY[
            LudoAI.difficulty
        ] ||
        AI_DIFFICULTY.normal;


    let bestPiece =
        null;

    let bestScore =
        -Infinity;


    pieces.forEach(
        piece => {

            const score =
                evaluateMove(
                    player,
                    piece,
                    dice,
                    difficulty
                );


            /*
                Có chút ngẫu nhiên
                để AI không đi
                y hệt mỗi ván.
            */

            let randomTieBreak = 0;

            if (window.crypto?.getRandomValues) {
                const values = new Uint32Array(1);
                window.crypto.getRandomValues(values);
                randomTieBreak =
                    (values[0] / 0x100000000) *
                    difficulty.randomBonus;
            } else {
                randomTieBreak =
                    Math.random() *
                    difficulty.randomBonus;
            }

            const finalScore =
                score +
                randomTieBreak;


            if (
                finalScore >
                bestScore
            ) {

                bestScore =
                    finalScore;

                bestPiece =
                    piece;

            }

        }
    );


    return bestPiece;

}


/* =========================================================
   EVALUATE MOVE
========================================================= */

function evaluateMove(
    player,
    piece,
    dice,
    difficulty
) {

    let score = 0;

    const isInStable = piece.position === -1;
    const isOnArrow = piece.position === LUDO_CONFIG.TRACK_LENGTH - 1;
    const isInHomeLane =
        piece.position >= LUDO_CONFIG.HOME_PATH_START &&
        piece.position <= LUDO_CONFIG.FINISH_POSITION;

    /*
        1. ĐƯA QUÂN RA KHI ĐỔ 6

        Đây phải là một lựa chọn thực sự ưu tiên.
        Trước đây progressBonus của một quân đang chạy xa
        có thể lớn hơn exitBonus, khiến AI đổ 6 nhưng cứ chọn
        quân đang ở ngoài thay vì đưa quân mới ra.

        Không ép tuyệt đối: ăn quân / vào đích hợp lệ vẫn có thể
        được ưu tiên cao hơn.
    */
    if (isInStable && dice === LUDO_CONFIG.EXIT_ROLL) {
        // If a 6 can legally bring a piece out, strongly prefer that
        // option so AI cannot keep moving another piece instead.
        score += 1000;
        score += difficulty.exitBonus * 3;
        return score;
    }

    /*
        Quân trong chuồng với dice khác 6 không phải nước đi hợp lệ.
    */
    if (isInStable) {
        return -Infinity;
    }

    /*
        2. ƯU TIÊN VỀ ĐÍCH / VÀO ĐƯỜNG ĐÍCH

        Dùng API của board để tính đúng luật đặc biệt:
        - đang ở mũi tên: roll N -> finish N
        - đã vào finish: phải đi tuần tự
    */
    let targetPosition = null;

    if (typeof window.getLudoHomeTargetPosition === "function") {
        targetPosition = window.getLudoHomeTargetPosition(
            player,
            piece,
            dice
        );
    }

    if (targetPosition !== null) {
        const targetHomeNumber =
            typeof window.getLudoHomeNumber === "function"
                ? window.getLudoHomeNumber(targetPosition)
                : 0;

        if (targetPosition >= LUDO_CONFIG.FINISH_POSITION) {
            score += difficulty.finishBonus + 180;
        } else if (targetHomeNumber > 0) {
            // Vào đường đích luôn có giá trị cao hơn đi vòng ngoài.
            score += difficulty.finishBonus + targetHomeNumber * 35;
        }

        // Nếu đây là nước đưa quân từ mũi tên vào finish, ưu tiên mạnh.
        if (isOnArrow) {
            score += 100;
        }

        return score;
    }

    /*
        3. QUÂN VÒNG NGOÀI

        Không dùng piece.position + dice một cách mù quáng vì
        nó không phản ánh shortcut và đường đích.
    */
    if (piece.position >= 0 &&
        piece.position < LUDO_CONFIG.HOME_PATH_START) {

        let progress = dice;

        const shortcut =
            dice === 1 &&
            typeof window.getLudoSpawnShortcut === "function"
                ? window.getLudoSpawnShortcut(player, piece, dice)
                : null;

        if (shortcut) {
            progress = shortcut.distance;
            score += 80; // bay tới mũi tên
        }

        // Ăn quân là ưu tiên cao.
        if (wouldCapture(player, piece, dice)) {
            score += difficulty.captureBonus + 220;
        }

        // Tiến càng xa càng tốt, nhưng không để nó lấn át việc xuất quân.
        score += progress * difficulty.progressBonus;

        if (piece.position >= 40) {
            score += 35;
        }

        if (isDangerousPosition(player, piece, dice)) {
            score -= 20;
        }

        return score;
    }

    return score;
}


/* =========================================================
   WOULD CAPTURE
========================================================= */

function wouldCapture(
    player,
    piece,
    dice
) {

    /*
        Quân trong chuồng
        không thể ăn.
    */

    if (
        piece.position === -1
    ) {

        return false;

    }


    if (
        piece.position >= LUDO_CONFIG.TRACK_LENGTH
    ) {

        return false;

    }


    const newRelative =
        piece.position + dice;


    if (
        newRelative >= LUDO_CONFIG.TRACK_LENGTH
    ) {

        return false;

    }


    const absolute =
        (
            typeof window.getLudoAbsoluteTrackIndex === "function"
                ? window.getLudoAbsoluteTrackIndex(
                    player,
                    newRelative
                )
                : (
                    (
                        player.start -
                        newRelative
                    ) % LUDO_CONFIG.TRACK_LENGTH +
                    LUDO_CONFIG.TRACK_LENGTH
                ) % LUDO_CONFIG.TRACK_LENGTH
        );


    /*
        Ô an toàn không ăn được.
    */

    if (
        window.SAFE_TRACK_CELLS &&
        SAFE_TRACK_CELLS.has(
            absolute
        )
    ) {

        return false;

    }


    /*
        Kiểm tra đối thủ.
    */

    for (
        const opponent
        of LudoBoard.players
    ) {

        if (
            opponent.id ===
            player.id
        ) {

            continue;

        }


        for (
            const opponentPiece
            of opponent.pieces
        ) {

            if (
                opponentPiece.position < 0 ||
                opponentPiece.position >= LUDO_CONFIG.TRACK_LENGTH
            ) {

                continue;

            }


            const opponentAbsolute =
                (
                    typeof window.getLudoAbsoluteTrackIndex === "function"
                        ? window.getLudoAbsoluteTrackIndex(
                            opponent,
                            opponentPiece.position
                        )
                        : (
                            (
                                opponent.start -
                                opponentPiece.position
                            ) % LUDO_CONFIG.TRACK_LENGTH +
                            LUDO_CONFIG.TRACK_LENGTH
                        ) % LUDO_CONFIG.TRACK_LENGTH
                );


            if (
                opponentAbsolute ===
                absolute
            ) {

                return true;

            }

        }

    }


    return false;

}


/* =========================================================
   DANGER CHECK
========================================================= */

function isDangerousPosition(
    player,
    piece,
    dice
) {

    if (
        piece.position < 0 ||
        piece.position >= LUDO_CONFIG.TRACK_LENGTH
    ) {

        return false;

    }


    const newRelative =
        piece.position + dice;


    if (
        newRelative >= LUDO_CONFIG.TRACK_LENGTH
    ) {

        return false;

    }


    const absolute =
        (
            typeof window.getLudoAbsoluteTrackIndex === "function"
                ? window.getLudoAbsoluteTrackIndex(
                    player,
                    newRelative
                )
                : (
                    (
                        player.start -
                        newRelative
                    ) % LUDO_CONFIG.TRACK_LENGTH +
                    LUDO_CONFIG.TRACK_LENGTH
                ) % LUDO_CONFIG.TRACK_LENGTH
        );


    /*
        Ô an toàn thì không nguy hiểm.
    */

    if (
        SAFE_TRACK_CELLS.has(
            absolute
        )
    ) {

        return false;

    }


    /*
        Kiểm tra đối thủ có thể ăn
        ở vị trí này hay không.
    */

    for (
        const opponent
        of LudoBoard.players
    ) {

        if (
            opponent.id ===
            player.id
        ) {

            continue;

        }


        for (
            const opponentPiece
            of opponent.pieces
        ) {

            if (
                opponentPiece.position < 0 ||
                opponentPiece.position >= LUDO_CONFIG.TRACK_LENGTH
            ) {

                continue;

            }


            const opponentAbsolute =
                (
                    typeof window.getLudoAbsoluteTrackIndex === "function"
                        ? window.getLudoAbsoluteTrackIndex(
                            opponent,
                            opponentPiece.position
                        )
                        : (
                            (
                                opponent.start -
                                opponentPiece.position
                            ) % LUDO_CONFIG.TRACK_LENGTH +
                            LUDO_CONFIG.TRACK_LENGTH
                        ) % LUDO_CONFIG.TRACK_LENGTH
                );


            const distance =
                (
                    absolute -
                    opponentAbsolute +
                    LUDO_CONFIG.TRACK_LENGTH
                ) % LUDO_CONFIG.TRACK_LENGTH;


            /*
                Nếu đối thủ nằm cách
                1–6 ô phía sau,
                có khả năng ăn.
            */

            if (
                distance >= 1 &&
                distance <= 6
            ) {

                return true;

            }

        }

    }


    return false;

}


/* =========================================================
   AI NAME
========================================================= */

function getCurrentAIName() {

    if (
        !window.LudoBoard
    ) {

        return "AI";

    }


    const player =
        LudoBoard.players[
            LudoBoard.currentPlayer
        ];


    return player?.name ||
        "AI";

}


/* =========================================================
   AI MESSAGE
========================================================= */

function showAIMessage(
    message
) {

    const element =
        document.getElementById(
            "ludoBoardMessage"
        );


    if (element) {

        element.textContent =
            message;

    }

}


/* =========================================================
   SET DIFFICULTY
========================================================= */

function setLudoAIDifficulty(
    difficulty
) {

    if (
        !AI_DIFFICULTY[
            difficulty
        ]
    ) {

        return false;

    }


    LudoAI.difficulty =
        difficulty;


    return true;

}


/* =========================================================
   ENABLE / DISABLE AI
========================================================= */

function setLudoAIEnabled(
    enabled
) {

    LudoAI.enabled =
        !!enabled;


    if (
        !LudoAI.enabled
    ) {

        clearAITimer();

        LudoAI.thinking =
            false;

    } else {

        scheduleAITurn();

    }

}


/* =========================================================
   CLEAR AI TIMER
========================================================= */

function clearAITimer() {

    if (
        LudoAI.timer !== null
    ) {

        clearTimeout(
            LudoAI.timer
        );

        LudoAI.timer =
            null;

    }

}


/* =========================================================
   FORCE AI TURN
========================================================= */

function forceAITurn() {

    clearAITimer();

    LudoAI.thinking =
        false;

    scheduleAITurn();

}


/* =========================================================
   GET AI STATE
========================================================= */

function getLudoAIState() {

    return {

        enabled:
            LudoAI.enabled,

        thinking:
            LudoAI.thinking,

        difficulty:
            LudoAI.difficulty

    };

}


/* =========================================================
   PUBLIC API
========================================================= */

window.LudoAI =
    LudoAI;


window.initLudoAI =
    initLudoAI;


window.setLudoAIDifficulty =
    setLudoAIDifficulty;


window.setLudoAIEnabled =
    setLudoAIEnabled;


window.forceLudoAITurn =
    forceAITurn;


window.clearLudoAITimer =
    clearAITimer;


window.getLudoAIState =
    getLudoAIState;


/* =========================================================
   AUTO INIT
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initLudoAI
    );

} else {

    initLudoAI();

}