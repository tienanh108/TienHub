(function () {
    "use strict";

    const FILES = [
        "a", "b", "c", "d",
        "e", "f", "g", "h"
    ];


    const PIECES = {

        w: {
            k: "♔",
            q: "♕",
            r: "♖",
            b: "♗",
            n: "♘",
            p: "♙"
        },

        b: {
            k: "♚",
            q: "♛",
            r: "♜",
            b: "♝",
            n: "♞",
            p: "♟"
        }

    };


    /* =====================================================
       BOARD
    ===================================================== */

    function normalizeBoard(board) {

        const result =
            new Array(64).fill(null);

        if (Array.isArray(board)) {

            for (
                let i = 0;
                i < 64;
                i++
            ) {

                const piece =
                    board[i];

                result[i] =
                    piece && piece.c && piece.t
                        ? {
                            c: piece.c,
                            t: piece.t
                        }
                        : null;

            }

            return result;
        }


        if (
            board &&
            typeof board === "object"
        ) {

            for (
                let i = 0;
                i < 64;
                i++
            ) {

                const piece =
                    board[i];

                result[i] =
                    piece && piece.c && piece.t
                        ? {
                            c: piece.c,
                            t: piece.t
                        }
                        : null;

            }

        }

        return result;
    }


    function initialBoard() {

        const board =
            Array(64).fill(null);

        const backRank = [
            "r",
            "n",
            "b",
            "q",
            "k",
            "b",
            "n",
            "r"
        ];


        for (
            let c = 0;
            c < 8;
            c++
        ) {

            board[c] = {
                c: "b",
                t: backRank[c]
            };

            board[8 + c] = {
                c: "b",
                t: "p"
            };

            board[48 + c] = {
                c: "w",
                t: "p"
            };

            board[56 + c] = {
                c: "w",
                t: backRank[c]
            };

        }

        return board;
    }


    function cloneBoard(board) {

        const normalized =
            normalizeBoard(board);

        return normalized.map(
            piece =>
                piece
                    ? { ...piece }
                    : null
        );

    }


    function row(index) {

        return Math.floor(
            index / 8
        );

    }


    function col(index) {

        return index % 8;

    }


    function inside(r, c) {

        return (
            r >= 0 &&
            r < 8 &&
            c >= 0 &&
            c < 8
        );

    }


    function index(r, c) {

        return r * 8 + c;

    }


    function opposite(color) {

        return color === "w"
            ? "b"
            : "w";

    }


    function squareName(index) {

        return (
            FILES[col(index)] +
            (8 - row(index))
        );

    }


    /* =====================================================
       ATTACKS
    ===================================================== */

    function attacksSquare(
        board,
        from,
        target
    ) {

        const piece =
            board[from];

        if (!piece) {
            return false;
        }


        const r =
            row(from);

        const c =
            col(from);

        const tr =
            row(target);

        const tc =
            col(target);

        const dr =
            tr - r;

        const dc =
            tc - c;


        /* TỐT */

        if (
            piece.t === "p"
        ) {

            const direction =
                piece.c === "w"
                    ? -1
                    : 1;

            return (
                dr === direction &&
                Math.abs(dc) === 1
            );

        }


        /* MÃ */

        if (
            piece.t === "n"
        ) {

            return (
                (
                    Math.abs(dr) === 2 &&
                    Math.abs(dc) === 1
                ) ||
                (
                    Math.abs(dr) === 1 &&
                    Math.abs(dc) === 2
                )
            );

        }


        /* VUA */

        if (
            piece.t === "k"
        ) {

            return (
                Math.max(
                    Math.abs(dr),
                    Math.abs(dc)
                ) === 1
            );

        }


        const diagonal =
            Math.abs(dr) ===
            Math.abs(dc);

        const straight =
            dr === 0 ||
            dc === 0;


        if (
            (
                piece.t === "b" &&
                !diagonal
            ) ||
            (
                piece.t === "r" &&
                !straight
            ) ||
            (
                piece.t === "q" &&
                !diagonal &&
                !straight
            )
        ) {

            return false;

        }


        const stepR =
            Math.sign(dr);

        const stepC =
            Math.sign(dc);


        let rr =
            r + stepR;

        let cc =
            c + stepC;


        while (
            rr !== tr ||
            cc !== tc
        ) {

            if (
                board[index(rr, cc)]
            ) {

                return false;

            }

            rr += stepR;
            cc += stepC;

        }


        return true;

    }


    function isAttacked(
        board,
        target,
        byColor
    ) {

        const normalized =
            normalizeBoard(board);

        for (
            let i = 0;
            i < 64;
            i++
        ) {

            if (
                normalized[i]?.c === byColor &&
                attacksSquare(
                    normalized,
                    i,
                    target
                )
            ) {

                return true;

            }

        }

        return false;

    }


    function kingIndex(
        board,
        color
    ) {

        const normalized =
            normalizeBoard(board);

        return normalized.findIndex(
            piece =>
                piece?.c === color &&
                piece.t === "k"
        );

    }


    function inCheck(
        board,
        color
    ) {

        const normalized =
            normalizeBoard(board);

        const king =
            kingIndex(
                normalized,
                color
            );

        return (
            king >= 0 &&
            isAttacked(
                normalized,
                king,
                opposite(color)
            )
        );

    }


    /* =====================================================
       PSEUDO MOVES
    ===================================================== */

    function pseudoMoves(
        state,
        from
    ) {

        const board =
            normalizeBoard(
                state.board
            );

        const turn =
            state.turn;

        const castling =
            state.castling || {
                wK: false,
                wQ: false,
                bK: false,
                bQ: false
            };

        const enPassant =
            state.enPassant ?? null;


        const piece =
            board[from];


        if (
            !piece ||
            piece.c !== turn
        ) {

            return [];

        }


        const moves = [];

        const r =
            row(from);

        const c =
            col(from);


        function add(
            to,
            extra = {}
        ) {

            if (
                to < 0 ||
                to >= 64
            ) {

                return;

            }


            /* Không được ăn quân cùng màu */

            if (
                board[to]?.c === piece.c
            ) {

                return;

            }


            moves.push({
                from,
                to,
                ...extra
            });

        }


        /* =================================================
           TỐT
        ================================================= */

        if (
            piece.t === "p"
        ) {

            const direction =
                piece.c === "w"
                    ? -1
                    : 1;

            const startRow =
                piece.c === "w"
                    ? 6
                    : 1;

            const promotionRow =
                piece.c === "w"
                    ? 0
                    : 7;


            const nextRow =
                r + direction;


            /* Đi thẳng 1 ô */

            if (
                inside(
                    nextRow,
                    c
                )
            ) {

                const one =
                    index(
                        nextRow,
                        c
                    );


                if (
                    !board[one]
                ) {

                    moves.push({
                        from,
                        to: one,
                        promotion:
                            row(one) ===
                            promotionRow
                                ? "q"
                                : null
                    });


                    /* Đi 2 ô */

                    const twoRow =
                        r +
                        2 * direction;

                    const two =
                        index(
                            twoRow,
                            c
                        );


                    if (
                        r === startRow &&
                        inside(
                            twoRow,
                            c
                        ) &&
                        !board[two]
                    ) {

                        moves.push({
                            from,
                            to: two
                        });

                    }

                }

            }


            /* =================================================
               ĂN QUÂN / EN PASSANT
            ================================================= */

            for (
                const dc of [-1, 1]
            ) {

                const targetRow =
                    r + direction;

                const targetCol =
                    c + dc;


                if (
                    !inside(
                        targetRow,
                        targetCol
                    )
                ) {

                    continue;

                }


                const to =
                    index(
                        targetRow,
                        targetCol
                    );


                /* ĂN QUÂN BÌNH THƯỜNG */

                if (
                    board[to] &&
                    board[to].c !== piece.c
                ) {

                    moves.push({
                        from,
                        to,
                        promotion:
                            row(to) ===
                            promotionRow
                                ? "q"
                                : null
                    });

                }


                /* EN PASSANT */

                else if (
                    to === enPassant
                ) {

                    moves.push({
                        from,
                        to,
                        enPassant: true
                    });

                }

            }

        }


        /* =================================================
           MÃ
        ================================================= */

        else if (
            piece.t === "n"
        ) {

            const offsets = [

                [-2, -1],
                [-2, 1],

                [-1, -2],
                [-1, 2],

                [1, -2],
                [1, 2],

                [2, -1],
                [2, 1]

            ];


            for (
                const [dr, dc]
                of offsets
            ) {

                if (
                    inside(
                        r + dr,
                        c + dc
                    )
                ) {

                    add(
                        index(
                            r + dr,
                            c + dc
                        )
                    );

                }

            }

        }


        /* =================================================
           TƯỢNG / XE / HẬU
        ================================================= */

        else if (
            piece.t === "b" ||
            piece.t === "r" ||
            piece.t === "q"
        ) {

            let directions;


            if (
                piece.t === "b"
            ) {

                directions = [
                    [-1, -1],
                    [-1, 1],
                    [1, -1],
                    [1, 1]
                ];

            }

            else if (
                piece.t === "r"
            ) {

                directions = [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1]
                ];

            }

            else {

                directions = [

                    [-1, -1],
                    [-1, 1],

                    [1, -1],
                    [1, 1],

                    [-1, 0],
                    [1, 0],

                    [0, -1],
                    [0, 1]

                ];

            }


            for (
                const [dr, dc]
                of directions
            ) {

                let rr =
                    r + dr;

                let cc =
                    c + dc;


                while (
                    inside(
                        rr,
                        cc
                    )
                ) {

                    const to =
                        index(
                            rr,
                            cc
                        );


                    if (
                        !board[to]
                    ) {

                        moves.push({
                            from,
                            to
                        });

                    }

                    else {

                        /* Gặp quân địch → được ăn */

                        if (
                            board[to].c !==
                            piece.c
                        ) {

                            moves.push({
                                from,
                                to
                            });

                        }

                        /* Dừng sau khi gặp quân */

                        break;

                    }


                    rr += dr;
                    cc += dc;

                }

            }

        }


        /* =================================================
           VUA
        ================================================= */

        else if (
            piece.t === "k"
        ) {

            for (
                let dr = -1;
                dr <= 1;
                dr++
            ) {

                for (
                    let dc = -1;
                    dc <= 1;
                    dc++
                ) {

                    if (
                        dr === 0 &&
                        dc === 0
                    ) {

                        continue;

                    }


                    if (
                        inside(
                            r + dr,
                            c + dc
                        )
                    ) {

                        add(
                            index(
                                r + dr,
                                c + dc
                            )
                        );

                    }

                }

            }


            const enemy =
                opposite(piece.c);


            /* =================================================
               NHẬP THÀNH
            ================================================= */

            if (
                !inCheck(
                    board,
                    piece.c
                )
            ) {

                /* TRẮNG */

                if (
                    piece.c === "w" &&
                    from === 60
                ) {

                    /* Nhập thành gần */

                    if (
                        castling.wK &&
                        board[61] === null &&
                        board[62] === null &&
                        !isAttacked(
                            board,
                            61,
                            enemy
                        ) &&
                        !isAttacked(
                            board,
                            62,
                            enemy
                        ) &&
                        board[63]?.t === "r" &&
                        board[63]?.c === "w"
                    ) {

                        moves.push({
                            from,
                            to: 62,
                            castle: "K"
                        });

                    }


                    /* Nhập thành xa */

                    if (
                        castling.wQ &&
                        board[59] === null &&
                        board[58] === null &&
                        board[57] === null &&
                        !isAttacked(
                            board,
                            59,
                            enemy
                        ) &&
                        !isAttacked(
                            board,
                            58,
                            enemy
                        ) &&
                        board[56]?.t === "r" &&
                        board[56]?.c === "w"
                    ) {

                        moves.push({
                            from,
                            to: 58,
                            castle: "Q"
                        });

                    }

                }


                /* ĐEN */

                if (
                    piece.c === "b" &&
                    from === 4
                ) {

                    /* Nhập thành gần */

                    if (
                        castling.bK &&
                        board[5] === null &&
                        board[6] === null &&
                        !isAttacked(
                            board,
                            5,
                            enemy
                        ) &&
                        !isAttacked(
                            board,
                            6,
                            enemy
                        ) &&
                        board[7]?.t === "r" &&
                        board[7]?.c === "b"
                    ) {

                        moves.push({
                            from,
                            to: 6,
                            castle: "K"
                        });

                    }


                    /* Nhập thành xa */

                    if (
                        castling.bQ &&
                        board[3] === null &&
                        board[2] === null &&
                        board[1] === null &&
                        !isAttacked(
                            board,
                            3,
                            enemy
                        ) &&
                        !isAttacked(
                            board,
                            2,
                            enemy
                        ) &&
                        board[0]?.t === "r" &&
                        board[0]?.c === "b"
                    ) {

                        moves.push({
                            from,
                            to: 2,
                            castle: "Q"
                        });

                    }

                }

            }

        }


        return moves;

    }


    /* =====================================================
       APPLY MOVE
    ===================================================== */

    function applyMove(
        state,
        move
    ) {

        const board =
            cloneBoard(
                state.board
            );


        const piece =
            board[move.from];


        if (!piece) {
            return null;
        }


        /* Không cho ăn quân cùng màu */

        const target =
            board[move.to];


        if (
            target &&
            target.c === piece.c
        ) {

            return null;

        }


        /* Xóa quân khỏi ô cũ */

        board[move.from] =
            null;


        /* =================================================
           EN PASSANT
        ================================================= */

        if (
            move.enPassant
        ) {

            const captured =
                move.to +
                (
                    piece.c === "w"
                        ? 8
                        : -8
                );


            board[captured] =
                null;

        }


        /* =================================================
           NHẬP THÀNH
        ================================================= */

        if (
            move.castle
        ) {

            if (
                move.to === 62
            ) {

                board[61] =
                    board[63];

                board[63] =
                    null;

            }


            else if (
                move.to === 58
            ) {

                board[59] =
                    board[56];

                board[56] =
                    null;

            }


            else if (
                move.to === 6
            ) {

                board[5] =
                    board[7];

                board[7] =
                    null;

            }


            else if (
                move.to === 2
            ) {

                board[3] =
                    board[0];

                board[0] =
                    null;

            }

        }


        /* =================================================
           PHONG CẤP
        ================================================= */

        const placed = {
            ...piece
        };


        if (
            piece.t === "p" &&
            (
                row(move.to) === 0 ||
                row(move.to) === 7
            )
        ) {

            placed.t =
                move.promotion ||
                "q";

        }


        /*
           QUAN TRỌNG:
           Ghi quân đang đi vào ô đích.
           Nếu ô đích có quân đối thủ,
           quân đó sẽ bị thay thế = CAPTURE.
        */

        board[move.to] =
            placed;


        /* =================================================
           CASTLING RIGHTS
        ================================================= */

        const newCastling = {
            ...(state.castling || {
                wK: false,
                wQ: false,
                bK: false,
                bQ: false
            })
        };


        /* Vua di chuyển */

        if (
            piece.t === "k"
        ) {

            if (
                piece.c === "w"
            ) {

                newCastling.wK =
                    false;

                newCastling.wQ =
                    false;

            }

            else {

                newCastling.bK =
                    false;

                newCastling.bQ =
                    false;

            }

        }


        /* Xe di chuyển */

        if (
            piece.t === "r"
        ) {

            if (
                move.from === 63
            ) {
                newCastling.wK =
                    false;
            }

            if (
                move.from === 56
            ) {
                newCastling.wQ =
                    false;
            }

            if (
                move.from === 7
            ) {
                newCastling.bK =
                    false;
            }

            if (
                move.from === 0
            ) {
                newCastling.bQ =
                    false;
            }

        }


        /*
           Xe bị ăn
           → mất quyền nhập thành tương ứng
        */

        if (
            target?.t === "r"
        ) {

            if (
                move.to === 63
            ) {
                newCastling.wK =
                    false;
            }

            if (
                move.to === 56
            ) {
                newCastling.wQ =
                    false;
            }

            if (
                move.to === 7
            ) {
                newCastling.bK =
                    false;
            }

            if (
                move.to === 0
            ) {
                newCastling.bQ =
                    false;
            }

        }


        /* =================================================
           EN PASSANT TARGET
        ================================================= */

        let newEnPassant =
            null;


        if (
            piece.t === "p" &&
            Math.abs(
                row(move.to) -
                row(move.from)
            ) === 2
        ) {

            newEnPassant =
                (
                    move.from +
                    move.to
                ) / 2;

        }


        /* =================================================
           RETURN NEW STATE
        ================================================= */

        return {

            ...state,

            board,

            turn:
                opposite(
                    state.turn
                ),

            castling:
                newCastling,

            enPassant:
                newEnPassant

        };

    }


    /* =====================================================
       LEGAL MOVES
    ===================================================== */

    function legalMoves(state) {

        const normalizedState = {

            ...state,

            board:
                normalizeBoard(
                    state.board
                ),

            castling:
                state.castling || {
                    wK: false,
                    wQ: false,
                    bK: false,
                    bQ: false
                },

            enPassant:
                state.enPassant ?? null

        };


        const result = [];


        for (
            let i = 0;
            i < 64;
            i++
        ) {

            if (
                normalizedState.board[i]?.c !==
                normalizedState.turn
            ) {

                continue;

            }


            const pseudo =
                pseudoMoves(
                    normalizedState,
                    i
                );


            for (
                const move
                of pseudo
            ) {

                const next =
                    applyMove(
                        normalizedState,
                        move
                    );


                if (
                    !next
                ) {

                    continue;

                }


                if (
                    !inCheck(
                        next.board,
                        normalizedState.turn
                    )
                ) {

                    result.push(move);

                }

            }

        }


        return result;

    }


    function legalMovesFrom(
        state,
        from
    ) {

        return legalMoves(
            state
        ).filter(
            move =>
                move.from === from
        );

    }


    /* =====================================================
       ALGEBRAIC
    ===================================================== */

    function algebraicMove(
        from,
        to,
        promotion
    ) {

        return (
            squareName(from) +
            squareName(to) +
            (
                promotion ||
                ""
            )
        );

    }


    /* =====================================================
       EXPORT
    ===================================================== */

    window.ChessCore = {

        initialBoard,

        normalizeBoard,

        cloneBoard,

        legalMoves,

        legalMovesFrom,

        applyMove,

        inCheck,

        kingIndex,

        squareName,

        algebraicMove,

        PIECES,

        opposite

    };


    console.log(
        "================================="
    );

    console.log(
        "✅ CHESS CORE ĐÃ ĐƯỢC TẠO"
    );

    console.log(
        "ChessCore:",
        window.ChessCore
    );

    console.log(
        "================================="
    );

})();