/* =========================================================
   CARO 5 - AI
   4 LEVELS
   1. DỄ
   2. TRUNG BÌNH
   3. KHÓ
   4. SIÊU KHÓ

   IMPORTANT:
   - Không sử dụng Firebase
   - Không sử dụng matchmaking
   - Không sử dụng room
   - Không thay đổi game online
   - API giữ nguyên:
       getAIMove(difficulty)
       window.CaroAI
========================================================= */

(function () {
    "use strict";

    /* =====================================================
       CẤU HÌNH
    ===================================================== */

    const AI_PLAYER = "O";
    const HUMAN_PLAYER = "X";
    const WIN_LENGTH = 5;

    const DIRECTIONS = [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1]
    ];

    /*
     * Điểm đánh giá thế cờ.
     *
     * Các giá trị được cố tình cách xa nhau để
     * AI ưu tiên threat quan trọng hơn.
     */
    const SCORE = {
        FIVE: 1000000000,

        OPEN_FOUR: 10000000,
        FOUR: 1000000,

        BROKEN_FOUR: 700000,

        OPEN_THREE: 100000,
        THREE: 15000,

        BROKEN_THREE: 8000,

        OPEN_TWO: 1200,
        TWO: 300,

        ONE: 20
    };


    /* =====================================================
       LẤY BOARD
    ===================================================== */

    function getSize() {
        if (
            typeof boardSize === "number" &&
            boardSize > 0
        ) {
            return boardSize;
        }

        if (
            typeof window.boardSize === "number" &&
            window.boardSize > 0
        ) {
            return window.boardSize;
        }

        return 15;
    }


    function getBoard() {
        if (
            typeof board !== "undefined" &&
            Array.isArray(board)
        ) {
            return board;
        }

        if (Array.isArray(window.board)) {
            return window.board;
        }

        return [];
    }


    function indexOf(row, col, size) {
        return row * size + col;
    }


    function isInside(row, col, size) {
        return (
            row >= 0 &&
            row < size &&
            col >= 0 &&
            col < size
        );
    }


    function isEmpty(
        boardArray,
        row,
        col,
        size
    ) {
        return (
            isInside(row, col, size) &&
            boardArray[
                indexOf(row, col, size)
            ] === ""
        );
    }


    function centerDistance(
        row,
        col,
        size
    ) {
        const center =
            (size - 1) / 2;

        return (
            Math.abs(row - center) +
            Math.abs(col - center)
        );
    }


    /* =====================================================
       CANDIDATE MOVES
    ===================================================== */

    function getCandidateMoves(
        boardArray,
        size,
        radius
    ) {
        const occupied = [];

        for (
            let row = 0;
            row < size;
            row++
        ) {
            for (
                let col = 0;
                col < size;
                col++
            ) {
                if (
                    boardArray[
                        indexOf(row, col, size)
                    ] !== ""
                ) {
                    occupied.push({
                        row,
                        col
                    });
                }
            }
        }

        /*
         * Bàn trống.
         */
        if (occupied.length === 0) {
            const center =
                Math.floor(size / 2);

            return [
                {
                    row: center,
                    col: center
                }
            ];
        }

        const seen = new Set();
        const candidates = [];

        for (const piece of occupied) {
            for (
                let row =
                    piece.row - radius;
                row <=
                    piece.row + radius;
                row++
            ) {
                for (
                    let col =
                        piece.col - radius;
                    col <=
                        piece.col + radius;
                    col++
                ) {
                    if (
                        !isInside(
                            row,
                            col,
                            size
                        )
                    ) {
                        continue;
                    }

                    const index =
                        indexOf(
                            row,
                            col,
                            size
                        );

                    if (
                        boardArray[index] !== ""
                    ) {
                        continue;
                    }

                    if (seen.has(index)) {
                        continue;
                    }

                    seen.add(index);

                    candidates.push({
                        row,
                        col
                    });
                }
            }
        }

        /*
         * Ưu tiên:
         * 1. gần trung tâm
         * 2. gần quân cờ
         */
        candidates.sort(
            (a, b) => {
                return (
                    centerDistance(
                        a.row,
                        a.col,
                        size
                    ) -
                    centerDistance(
                        b.row,
                        b.col,
                        size
                    )
                );
            }
        );

        return candidates;
    }


    /* =====================================================
       ĐẾM QUÂN LIÊN TIẾP
    ===================================================== */

    function countDirection(
        boardArray,
        row,
        col,
        dr,
        dc,
        player,
        size
    ) {
        let count = 0;

        let r = row + dr;
        let c = col + dc;

        while (
            isInside(r, c, size) &&
            boardArray[
                indexOf(r, c, size)
            ] === player
        ) {
            count++;

            r += dr;
            c += dc;
        }

        return count;
    }


    /* =====================================================
       KIỂM TRA 5 QUÂN
    ===================================================== */

    function hasFive(
        boardArray,
        row,
        col,
        player,
        size
    ) {
        for (
            const [dr, dc]
            of DIRECTIONS
        ) {
            const total =
                1 +
                countDirection(
                    boardArray,
                    row,
                    col,
                    dr,
                    dc,
                    player,
                    size
                ) +
                countDirection(
                    boardArray,
                    row,
                    col,
                    -dr,
                    -dc,
                    player,
                    size
                );

            if (
                total >= WIN_LENGTH
            ) {
                return true;
            }
        }

        return false;
    }


    /* =====================================================
       LẤY CHUỖI THỰC TẾ
    ===================================================== */

    function getLine(
        boardArray,
        row,
        col,
        dr,
        dc,
        player,
        size
    ) {
        const cells = [];

        /*
         * Đi về đầu chuỗi.
         */
        let startRow = row;
        let startCol = col;

        while (
            isInside(
                startRow - dr,
                startCol - dc,
                size
            ) &&
            boardArray[
                indexOf(
                    startRow - dr,
                    startCol - dc,
                    size
                )
            ] === player
        ) {
            startRow -= dr;
            startCol -= dc;
        }

        /*
         * Đọc cả chuỗi.
         */
        let r = startRow;
        let c = startCol;

        while (
            isInside(r, c, size)
        ) {
            const value =
                boardArray[
                    indexOf(
                        r,
                        c,
                        size
                    )
                ];

            if (
                value !== player &&
                value !== ""
            ) {
                break;
            }

            cells.push(value);

            r += dr;
            c += dc;
        }

        return {
            cells,
            startRow,
            startCol
        };
    }


    /* =====================================================
       ĐÁNH GIÁ MỘT LINE
    ===================================================== */

    function evaluateLine(
        cells,
        player
    ) {
        const opponent =
            player === AI_PLAYER
                ? HUMAN_PLAYER
                : AI_PLAYER;

        let best = 0;

        /*
         * Kiểm tra mọi đoạn 5 ô.
         */
        for (
            let i = 0;
            i <= cells.length - 5;
            i++
        ) {
            let playerCount = 0;
            let emptyCount = 0;
            let blocked = false;

            for (
                let j = 0;
                j < 5;
                j++
            ) {
                const value =
                    cells[i + j];

                if (
                    value === player
                ) {
                    playerCount++;
                } else if (
                    value === ""
                ) {
                    emptyCount++;
                } else if (
                    value === opponent
                ) {
                    blocked = true;
                    break;
                }
            }

            if (blocked) {
                continue;
            }

            /*
             * XXXXX
             */
            if (playerCount === 5) {
                best = Math.max(
                    best,
                    SCORE.FIVE
                );
                continue;
            }

            /*
             * XXXX_
             */
            if (
                playerCount === 4 &&
                emptyCount === 1
            ) {
                best = Math.max(
                    best,
                    SCORE.FOUR
                );
                continue;
            }

            /*
             * XXX__
             */
            if (
                playerCount === 3 &&
                emptyCount === 2
            ) {
                best = Math.max(
                    best,
                    SCORE.THREE
                );
                continue;
            }

            /*
             * XX___
             */
            if (
                playerCount === 2 &&
                emptyCount === 3
            ) {
                best = Math.max(
                    best,
                    SCORE.TWO
                );
            }
        }

        /*
         * Open FOUR:
         *
         * _XXXX_
         */
        const text =
            cells.join("");

        if (
            text.includes(
                "_XXXX_"
            )
        ) {
            best = Math.max(
                best,
                SCORE.OPEN_FOUR
            );
        }

        /*
         * Open THREE:
         *
         * _XXX_
         */
        if (
            text.includes(
                "_XXX_"
            )
        ) {
            best = Math.max(
                best,
                SCORE.OPEN_THREE
            );
        }

        /*
         * Broken FOUR:
         *
         * XX_XX
         * X_XXX
         * XXX_X
         */
        if (
            text.includes("XX_XX") ||
            text.includes("X_XXX") ||
            text.includes("XXX_X")
        ) {
            best = Math.max(
                best,
                SCORE.BROKEN_FOUR
            );
        }

        /*
         * Broken THREE:
         *
         * XX_X
         * X_XX
         */
        if (
            text.includes("XX_X") ||
            text.includes("X_XX")
        ) {
            best = Math.max(
                best,
                SCORE.BROKEN_THREE
            );
        }

        return best;
    }


    /* =====================================================
       ĐÁNH GIÁ TOÀN BỘ BOARD
    ===================================================== */

    function evaluateBoard(
        boardArray,
        size
    ) {
        let score = 0;

        /*
         * Horizontal
         */
        for (
            let row = 0;
            row < size;
            row++
        ) {
            const cells = [];

            for (
                let col = 0;
                col < size;
                col++
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            row,
                            col,
                            size
                        )
                    ]
                );
            }

            const aiScore =
                evaluateLine(
                    cells,
                    AI_PLAYER
                );

            const humanScore =
                evaluateLine(
                    cells,
                    HUMAN_PLAYER
                );

            score += aiScore;
            score -= humanScore * 1.15;
        }


        /*
         * Vertical
         */
        for (
            let col = 0;
            col < size;
            col++
        ) {
            const cells = [];

            for (
                let row = 0;
                row < size;
                row++
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            row,
                            col,
                            size
                        )
                    ]
                );
            }

            const aiScore =
                evaluateLine(
                    cells,
                    AI_PLAYER
                );

            const humanScore =
                evaluateLine(
                    cells,
                    HUMAN_PLAYER
                );

            score += aiScore;
            score -= humanScore * 1.15;
        }


        /*
         * Diagonal \
         */
        for (
            let startRow = 0;
            startRow < size;
            startRow++
        ) {
            const cells = [];

            let r = startRow;
            let c = 0;

            while (
                isInside(
                    r,
                    c,
                    size
                )
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            r,
                            c,
                            size
                        )
                    ]
                );

                r++;
                c++;
            }

            if (
                cells.length >= 5
            ) {
                score +=
                    evaluateLine(
                        cells,
                        AI_PLAYER
                    );

                score -=
                    evaluateLine(
                        cells,
                        HUMAN_PLAYER
                    ) * 1.15;
            }
        }

        for (
            let startCol = 1;
            startCol < size;
            startCol++
        ) {
            const cells = [];

            let r = 0;
            let c = startCol;

            while (
                isInside(
                    r,
                    c,
                    size
                )
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            r,
                            c,
                            size
                        )
                    ]
                );

                r++;
                c++;
            }

            if (
                cells.length >= 5
            ) {
                score +=
                    evaluateLine(
                        cells,
                        AI_PLAYER
                    );

                score -=
                    evaluateLine(
                        cells,
                        HUMAN_PLAYER
                    ) * 1.15;
            }
        }


        /*
         * Diagonal /
         */
        for (
            let startRow = 0;
            startRow < size;
            startRow++
        ) {
            const cells = [];

            let r = startRow;
            let c = size - 1;

            while (
                isInside(
                    r,
                    c,
                    size
                )
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            r,
                            c,
                            size
                        )
                    ]
                );

                r++;
                c--;
            }

            if (
                cells.length >= 5
            ) {
                score +=
                    evaluateLine(
                        cells,
                        AI_PLAYER
                    );

                score -=
                    evaluateLine(
                        cells,
                        HUMAN_PLAYER
                    ) * 1.15;
            }
        }

        for (
            let startCol = size - 2;
            startCol >= 0;
            startCol--
        ) {
            const cells = [];

            let r = 0;
            let c = startCol;

            while (
                isInside(
                    r,
                    c,
                    size
                )
            ) {
                cells.push(
                    boardArray[
                        indexOf(
                            r,
                            c,
                            size
                        )
                    ]
                );

                r++;
                c--;
            }

            if (
                cells.length >= 5
            ) {
                score +=
                    evaluateLine(
                        cells,
                        AI_PLAYER
                    );

                score -=
                    evaluateLine(
                        cells,
                        HUMAN_PLAYER
                    ) * 1.15;
            }
        }


        /*
         * Center control.
         */
        for (
            let row = 0;
            row < size;
            row++
        ) {
            for (
                let col = 0;
                col < size;
                col++
            ) {
                const value =
                    boardArray[
                        indexOf(
                            row,
                            col,
                            size
                        )
                    ];

                if (
                    value === ""
                ) {
                    continue;
                }

                const bonus =
                    Math.max(
                        0,
                        size -
                        centerDistance(
                            row,
                            col,
                            size
                        )
                    );

                if (
                    value === AI_PLAYER
                ) {
                    score +=
                        bonus * 2;
                } else {
                    score -=
                        bonus;
                }
            }
        }

        return score;
    }


    /* =====================================================
       ĐÁNH GIÁ MỘT NƯỚC
    ===================================================== */

    function evaluateSingleMove(
        boardArray,
        row,
        col,
        player,
        size
    ) {
        if (
            !isEmpty(
                boardArray,
                row,
                col,
                size
            )
        ) {
            return -Infinity;
        }

        const index =
            indexOf(
                row,
                col,
                size
            );

        boardArray[index] =
            player;

        let score = 0;

        for (
            const [dr, dc]
            of DIRECTIONS
        ) {
            const line =
                getLine(
                    boardArray,
                    row,
                    col,
                    dr,
                    dc,
                    player,
                    size
                );

            const lineScore =
                evaluateLine(
                    line.cells,
                    player
                );

            score += lineScore;
        }

        /*
         * Nếu đánh nước này thắng.
         */
        if (
            hasFive(
                boardArray,
                row,
                col,
                player,
                size
            )
        ) {
            score += SCORE.FIVE;
        }

        /*
         * Center bonus.
         */
        score +=
            Math.max(
                0,
                size -
                centerDistance(
                    row,
                    col,
                    size
                )
            ) * 3;

        boardArray[index] =
            "";

        return score;
    }


    /* =====================================================
       NƯỚC THẮNG NGAY
    ===================================================== */

    function findWinningMove(
        boardArray,
        player,
        size,
        candidates
    ) {
        for (
            const move of candidates
        ) {
            const index =
                indexOf(
                    move.row,
                    move.col,
                    size
                );

            boardArray[index] =
                player;

            const won =
                hasFive(
                    boardArray,
                    move.row,
                    move.col,
                    player,
                    size
                );

            boardArray[index] =
                "";

            if (won) {
                return move;
            }
        }

        return null;
    }


    /* =====================================================
       TÌM CÁC NƯỚC THẮNG TIỀM NĂNG
    ===================================================== */

    function getWinningMoves(
        boardArray,
        player,
        size,
        candidates
    ) {
        const result = [];

        for (
            const move of candidates
        ) {
            const index =
                indexOf(
                    move.row,
                    move.col,
                    size
                );

            boardArray[index] =
                player;

            const won =
                hasFive(
                    boardArray,
                    move.row,
                    move.col,
                    player,
                    size
                );

            boardArray[index] =
                "";

            if (won) {
                result.push(move);
            }
        }

        return result;
    }


    /* =====================================================
       THREAT SCORE
    ===================================================== */

    function getThreatScore(
        boardArray,
        move,
        player,
        size
    ) {
        const index =
            indexOf(
                move.row,
                move.col,
                size
            );

        if (
            boardArray[index] !== ""
        ) {
            return -Infinity;
        }

        boardArray[index] =
            player;

        let score = 0;

        for (
            const [dr, dc]
            of DIRECTIONS
        ) {
            const line =
                getLine(
                    boardArray,
                    move.row,
                    move.col,
                    dr,
                    dc,
                    player,
                    size
                );

            score +=
                evaluateLine(
                    line.cells,
                    player
                );
        }

        boardArray[index] =
            "";

        return score;
    }


    /* =====================================================
       TÌM THREAT MẠNH NHẤT CỦA PLAYER
    ===================================================== */

    function findStrongThreat(
        boardArray,
        player,
        size,
        candidates
    ) {
        let bestMove = null;
        let bestScore = -Infinity;

        for (
            const move of candidates
        ) {
            const score =
                getThreatScore(
                    boardArray,
                    move,
                    player,
                    size
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

        return {
            move: bestMove,
            score: bestScore
        };
    }


    /* =====================================================
       DOUBLE THREAT
    ===================================================== */

    function createsDoubleThreat(
        boardArray,
        move,
        player,
        size,
        candidates
    ) {
        const index =
            indexOf(
                move.row,
                move.col,
                size
            );

        if (
            boardArray[index] !== ""
        ) {
            return false;
        }

        boardArray[index] =
            player;

        /*
         * Sau khi đánh move,
         * tìm xem có từ 2 nước thắng
         * tiếp theo hay không.
         */
        const nextCandidates =
            getCandidateMoves(
                boardArray,
                size,
                1
            );

        let winningReplies = 0;

        for (
            const reply
            of nextCandidates
        ) {
            const replyIndex =
                indexOf(
                    reply.row,
                    reply.col,
                    size
                );

            boardArray[
                replyIndex
            ] = player;

            if (
                hasFive(
                    boardArray,
                    reply.row,
                    reply.col,
                    player,
                    size
                )
            ) {
                winningReplies++;
            }

            boardArray[
                replyIndex
            ] = "";

            if (
                winningReplies >= 2
            ) {
                break;
            }
        }

        boardArray[index] =
            "";

        return (
            winningReplies >= 2
        );
    }


    /* =====================================================
       TÌM DOUBLE THREAT CỦA HUMAN
    ===================================================== */

    function findOpponentDoubleThreat(
        boardArray,
        size,
        candidates
    ) {
        for (
            const move
            of candidates
        ) {
            if (
                createsDoubleThreat(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size,
                    candidates
                )
            ) {
                return move;
            }
        }

        return null;
    }


    /* =====================================================
       KIỂM TRA OPEN FOUR
    ===================================================== */

    function isOpenFour(
        boardArray,
        move,
        player,
        size
    ) {
        const index =
            indexOf(
                move.row,
                move.col,
                size
            );

        if (
            boardArray[index] !== ""
        ) {
            return false;
        }

        boardArray[index] =
            player;

        let found = false;

        for (
            const [dr, dc]
            of DIRECTIONS
        ) {
            const line =
                getLine(
                    boardArray,
                    move.row,
                    move.col,
                    dr,
                    dc,
                    player,
                    size
                );

            const text =
                line.cells.join("");

            if (
                text.includes(
                    "_XXXX_"
                )
            ) {
                found = true;
                break;
            }
        }

        boardArray[index] =
            "";

        return found;
    }


    /* =====================================================
       TÌM NƯỚC CHẶN THREAT
    ===================================================== */

    function findBestBlock(
        boardArray,
        size,
        candidates
    ) {
        /*
         * 1. Chặn thắng ngay.
         */
        const immediate =
            findWinningMove(
                boardArray,
                HUMAN_PLAYER,
                size,
                candidates
            );

        if (immediate) {
            return immediate;
        }

        /*
         * 2. Chặn open four.
         */
        for (
            const move
            of candidates
        ) {
            if (
                isOpenFour(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size
                )
            ) {
                return move;
            }
        }

        /*
         * 3. Chặn threat mạnh nhất.
         */
        let bestMove = null;
        let bestScore = -Infinity;

        for (
            const move
            of candidates
        ) {
            const score =
                getThreatScore(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size
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

        /*
         * Chỉ block nếu threat
         * thực sự đáng kể.
         */
        if (
            bestScore >=
            SCORE.THREE
        ) {
            return bestMove;
        }

        return null;
    }


    /* =====================================================
       EASY
    ===================================================== */

    function easyMove(
        boardArray,
        size,
        candidates
    ) {
        /*
         * Easy cố tình không hoàn hảo.
         */

        /*
         * 75%:
         * đánh ngẫu nhiên.
         */
        if (
            Math.random() < 0.75
        ) {
            const count =
                Math.min(
                    12,
                    candidates.length
                );

            return candidates[
                Math.floor(
                    Math.random() *
                    count
                )
            ];
        }

        /*
         * 25%:
         * chọn nước tương đối tốt.
         */
        const scored =
            candidates
                .map(move => ({
                    move,
                    score:
                        evaluateSingleMove(
                            boardArray,
                            move.row,
                            move.col,
                            AI_PLAYER,
                            size
                        )
                }))
                .sort(
                    (a, b) =>
                        b.score -
                        a.score
                );

        const top =
            Math.min(
                5,
                scored.length
            );

        return scored[
            Math.floor(
                Math.random() * top
            )
        ].move;
    }


    /* =====================================================
       MEDIUM
    ===================================================== */

    function mediumMove(
        boardArray,
        size,
        candidates
    ) {
        /*
         * 1. Có thể thắng.
         */
        const win =
            findWinningMove(
                boardArray,
                AI_PLAYER,
                size,
                candidates
            );

        if (win) {
            return win;
        }

        /*
         * 2. Đối thủ thắng ngay.
         */
        const block =
            findWinningMove(
                boardArray,
                HUMAN_PLAYER,
                size,
                candidates
            );

        if (block) {
            return block;
        }

        /*
         * 3. Chấm công + thủ.
         */
        let bestMove =
            candidates[0];

        let bestScore =
            -Infinity;

        for (
            const move
            of candidates
        ) {
            const attack =
                getThreatScore(
                    boardArray,
                    move,
                    AI_PLAYER,
                    size
                );

            const defense =
                getThreatScore(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size
                );

            const score =
                attack +
                defense * 0.9;

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


    /* =====================================================
       HARD
    ===================================================== */

    function hardMove(
        boardArray,
        size,
        candidates
    ) {
        /*
         * 1. Thắng ngay.
         */
        const win =
            findWinningMove(
                boardArray,
                AI_PLAYER,
                size,
                candidates
            );

        if (win) {
            return win;
        }

        /*
         * 2. Chặn thắng ngay.
         */
        const block =
            findWinningMove(
                boardArray,
                HUMAN_PLAYER,
                size,
                candidates
            );

        if (block) {
            return block;
        }

        /*
         * 3. Nếu X đang tạo double threat,
         * phải ưu tiên xử lý.
         */
        const opponentFork =
            findOpponentDoubleThreat(
                boardArray,
                size,
                candidates
            );

        if (opponentFork) {
            return opponentFork;
        }

        /*
         * 4. AI tạo double threat.
         */
        for (
            const move
            of candidates
        ) {
            if (
                createsDoubleThreat(
                    boardArray,
                    move,
                    AI_PLAYER,
                    size,
                    candidates
                )
            ) {
                return move;
            }
        }

        /*
         * 5. Công + thủ.
         */
        let bestMove =
            candidates[0];

        let bestScore =
            -Infinity;

        for (
            const move
            of candidates
        ) {
            const attack =
                getThreatScore(
                    boardArray,
                    move,
                    AI_PLAYER,
                    size
                );

            const defense =
                getThreatScore(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size
                );

            const center =
                Math.max(
                    0,
                    size -
                    centerDistance(
                        move.row,
                        move.col,
                        size
                    )
                );

            const score =
                attack * 1.25 +
                defense * 1.15 +
                center * 3;

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


    /* =====================================================
       MINIMAX
    ===================================================== */

    function minimax(
        boardArray,
        size,
        depth,
        maximizing,
        alpha,
        beta
    ) {
        if (
            depth <= 0
        ) {
            return evaluateBoard(
                boardArray,
                size
            );
        }

        let candidates =
            getCandidateMoves(
                boardArray,
                size,
                1
            );

        if (
            candidates.length === 0
        ) {
            return 0;
        }

        /*
         * Giới hạn candidate.
         *
         * Đây là điểm quan trọng
         * để 25x25 không bị treo.
         */
        const limit =
            size >= 25
                ? 6
                : size >= 20
                    ? 7
                    : 9;

        const player =
            maximizing
                ? AI_PLAYER
                : HUMAN_PLAYER;

        candidates =
            candidates
                .map(move => ({
                    move,
                    score:
                        getThreatScore(
                            boardArray,
                            move,
                            player,
                            size
                        )
                }))
                .sort(
                    (a, b) =>
                        b.score -
                        a.score
                )
                .slice(
                    0,
                    limit
                )
                .map(
                    item => item.move
                );

        if (maximizing) {
            let best =
                -Infinity;

            for (
                const move
                of candidates
            ) {
                const index =
                    indexOf(
                        move.row,
                        move.col,
                        size
                    );

                boardArray[index] =
                    AI_PLAYER;

                if (
                    hasFive(
                        boardArray,
                        move.row,
                        move.col,
                        AI_PLAYER,
                        size
                    )
                ) {
                    boardArray[index] =
                        "";

                    return SCORE.FIVE;
                }

                const value =
                    minimax(
                        boardArray,
                        size,
                        depth - 1,
                        false,
                        alpha,
                        beta
                    );

                boardArray[index] =
                    "";

                best =
                    Math.max(
                        best,
                        value
                    );

                alpha =
                    Math.max(
                        alpha,
                        best
                    );

                if (
                    beta <= alpha
                ) {
                    break;
                }
            }

            return best;
        }


        let best =
            Infinity;

        for (
            const move
            of candidates
        ) {
            const index =
                indexOf(
                    move.row,
                    move.col,
                    size
                );

            boardArray[index] =
                HUMAN_PLAYER;

            if (
                hasFive(
                    boardArray,
                    move.row,
                    move.col,
                    HUMAN_PLAYER,
                    size
                )
            ) {
                boardArray[index] =
                    "";

                return -SCORE.FIVE;
            }

            const value =
                minimax(
                    boardArray,
                    size,
                    depth - 1,
                    true,
                    alpha,
                    beta
                );

            boardArray[index] =
                "";

            best =
                Math.min(
                    best,
                    value
                );

            beta =
                Math.min(
                    beta,
                    best
                );

            if (
                beta <= alpha
            ) {
                break;
            }
        }

        return best;
    }


    /* =====================================================
       EXTREME
    ===================================================== */

    function extremeMove(
        boardArray,
        size,
        candidates
    ) {
        /*
         * ================================================
         * PHASE 1
         * AI THẮNG NGAY
         * ================================================
         */

        const win =
            findWinningMove(
                boardArray,
                AI_PLAYER,
                size,
                candidates
            );

        if (win) {
            return win;
        }


        /*
         * ================================================
         * PHASE 2
         * HUMAN THẮNG NGAY
         * ================================================
         */

        const immediateBlock =
            findWinningMove(
                boardArray,
                HUMAN_PLAYER,
                size,
                candidates
            );

        if (immediateBlock) {
            return immediateBlock;
        }


        /*
         * ================================================
         * PHASE 3
         *
         * KIỂM TRA OPEN FOUR CỦA X
         * ================================================
         */

        for (
            const move
            of candidates
        ) {
            if (
                isOpenFour(
                    boardArray,
                    move,
                    HUMAN_PLAYER,
                    size
                )
            ) {
                return move;
            }
        }


        /*
         * ================================================
         * PHASE 4
         *
         * X DOUBLE THREAT
         * ================================================
         */

        const opponentFork =
            findOpponentDoubleThreat(
                boardArray,
                size,
                candidates
            );

        if (opponentFork) {
            return opponentFork;
        }


        /*
         * ================================================
         * PHASE 5
         *
         * AI DOUBLE THREAT
         * ================================================
         */

        for (
            const move
            of candidates
        ) {
            if (
                createsDoubleThreat(
                    boardArray,
                    move,
                    AI_PLAYER,
                    size,
                    candidates
                )
            ) {
                return move;
            }
        }


        /*
         * ================================================
         * PHASE 6
         *
         * CHẤM CÁC NƯỚC
         * ================================================
         */

        const ordered =
            candidates
                .map(move => {
                    const attack =
                        getThreatScore(
                            boardArray,
                            move,
                            AI_PLAYER,
                            size
                        );

                    const defense =
                        getThreatScore(
                            boardArray,
                            move,
                            HUMAN_PLAYER,
                            size
                        );

                    /*
                     * Sau khi AI đánh,
                     * xem X có thể tạo threat mạnh
                     * ở nước tiếp theo hay không.
                     */
                    const index =
                        indexOf(
                            move.row,
                            move.col,
                            size
                        );

                    boardArray[index] =
                        AI_PLAYER;

                    const replyCandidates =
                        getCandidateMoves(
                            boardArray,
                            size,
                            1
                        );

                    let opponentBest =
                        0;

                    /*
                     * Không cần kiểm tra toàn bộ.
                     */
                    const replyLimit =
                        size >= 25
                            ? 12
                            : 18;

                    for (
                        let i = 0;
                        i <
                        Math.min(
                            replyLimit,
                            replyCandidates.length
                        );
                        i++
                    ) {
                        const reply =
                            replyCandidates[i];

                        const threat =
                            getThreatScore(
                                boardArray,
                                reply,
                                HUMAN_PLAYER,
                                size
                            );

                        if (
                            threat >
                            opponentBest
                        ) {
                            opponentBest =
                                threat;
                        }
                    }

                    boardArray[index] =
                        "";

                    const center =
                        Math.max(
                            0,
                            size -
                            centerDistance(
                                move.row,
                                move.col,
                                size
                            )
                        );

                    /*
                     * Điểm cuối.
                     *
                     * defense rất quan trọng.
                     *
                     * opponentBest bị trừ mạnh
                     * để AI không tự mở đường
                     * cho X.
                     */
                    const score =
                        attack * 1.35 +
                        defense * 1.20 +
                        center * 4 -
                        opponentBest * 1.35;

                    return {
                        move,
                        score
                    };
                })
                .sort(
                    (a, b) =>
                        b.score -
                        a.score
                );


        /*
         * Chỉ minimax trên nhóm tốt nhất.
         */
        const searchCount =
            size >= 25
                ? 5
                : size >= 20
                    ? 7
                    : 9;

        const searchMoves =
            ordered.slice(
                0,
                searchCount
            );


        /*
         * ================================================
         * PHASE 7
         *
         * MINIMAX
         * ================================================
         */

        /*
         * Bàn nhỏ:
         * depth 3
         *
         * Bàn lớn:
         * depth 2
         *
         * Không tăng quá cao vì JavaScript
         * chạy trên main thread.
         */
        const depth =
            size <= 15
                ? 3
                : 2;

        let bestMove =
            searchMoves.length > 0
                ? searchMoves[0].move
                : candidates[0];

        let bestScore =
            -Infinity;

        for (
            const item
            of searchMoves
        ) {
            const move =
                item.move;

            const index =
                indexOf(
                    move.row,
                    move.col,
                    size
                );

            boardArray[index] =
                AI_PLAYER;

            const score =
                minimax(
                    boardArray,
                    size,
                    depth - 1,
                    false,
                    -Infinity,
                    Infinity
                );

            boardArray[index] =
                "";

            /*
             * Kết hợp:
             *
             * minimax
             * +
             * tactical score
             */
            const finalScore =
                score +
                item.score * 0.18;

            if (
                finalScore >
                bestScore
            ) {
                bestScore =
                    finalScore;

                bestMove =
                    move;
            }
        }

        return bestMove;
    }


    /* =====================================================
       MAIN
    ===================================================== */

    function getAIMove(
        difficulty
    ) {
        const boardArray =
            getBoard();

        const size =
            getSize();

        if (
            !Array.isArray(
                boardArray
            )
        ) {
            return null;
        }

        if (
            size <= 0
        ) {
            return null;
        }

        const expectedLength =
            size * size;

        if (
            boardArray.length <
            expectedLength
        ) {
            return null;
        }


        /*
         * Lấy candidate rộng hơn
         * để không bỏ sót threat.
         */
        let candidates =
            getCandidateMoves(
                boardArray,
                size,
                2
            );

        if (
            candidates.length === 0
        ) {
            return null;
        }


        /*
         * Giới hạn candidate chính.
         */
        const candidateLimit =
            size >= 25
                ? 40
                : size >= 20
                    ? 45
                    : 55;

        candidates =
            candidates.slice(
                0,
                candidateLimit
            );


        /*
         * Chuẩn hóa difficulty.
         */
        let level =
            String(
                difficulty ??
                window.aiDifficulty ??
                "medium"
            )
            .toLowerCase()
            .trim();


        /*
         * Tiếng Việt.
         */
        if (
            level === "easy" ||
            level.includes("dễ")
        ) {
            level = "easy";
        } else if (
            level === "medium" ||
            level.includes("trung")
        ) {
            level = "medium";
        } else if (
            level === "hard" ||
            (
                level.includes("khó") &&
                !level.includes("siêu")
            )
        ) {
            level = "hard";
        } else if (
            level === "extreme" ||
            level.includes("siêu")
        ) {
            level = "extreme";
        } else {
            level = "medium";
        }


        /*
         * Chọn AI.
         */
        switch (level) {
            case "easy":
                return easyMove(
                    boardArray,
                    size,
                    candidates
                );

            case "medium":
                return mediumMove(
                    boardArray,
                    size,
                    candidates
                );

            case "hard":
                return hardMove(
                    boardArray,
                    size,
                    candidates
                );

            case "extreme":
                return extremeMove(
                    boardArray,
                    size,
                    candidates
                );

            default:
                return mediumMove(
                    boardArray,
                    size,
                    candidates
                );
        }
    }


    /* =====================================================
       EXPORT
    ===================================================== */

    /*
     * GIỮ NGUYÊN API CŨ
     *
     * game.js không cần sửa.
     */
    window.getAIMove =
        getAIMove;


    window.CaroAI = {
        getAIMove,
        evaluateBoard,
        evaluateSingleMove,
        getCandidateMoves,
        hasFive
    };

})();