/* =========================================================
   TIENHUB — MINI GAME PAGE
   Catalog 15 game / trang
   Thứ tự ưu tiên theo số người chơi.
   Khi chưa có dữ liệu Firebase, giữ thứ tự hiện tại.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const games = [
        {
            id: "caro5",
            name: "Caro 5",
            players: null,
            href: "../mini-games/caro5/index.html",
            visual: `
                <div class="mini-cover caro-cover">
                    <span class="xo x1">×</span>
                    <span class="xo o1">○</span>
                    <span class="xo x2">×</span>
                    <span class="xo o2">○</span>
                    <span class="xo x3">×</span>
                    <span class="xo o3">○</span>
                    <span class="xo x4">×</span>
                    <span class="xo o4">○</span>
                    <span class="xo x5">×</span>
                </div>
            `
        },
        {
            id: "chess",
            name: "Chess",
            players: null,
            href: "../mini-games/chess/index.html",
            visual: `
                <div class="mini-cover chess-cover">

                    <div class="chess-board">
                        <span>♜</span><span>♞</span><span>♝</span><span>♛</span>
                        <span>♟</span><span>♟</span><span>♟</span><span>♟</span>
                        <span>♙</span><span>♙</span><span>♙</span><span>♙</span>
                        <span>♖</span><span>♘</span><span>♗</span><span>♕</span>
                    </div>
                </div>
            `
        },
        {
            id: "flappy",
            name: "Flappy Bird",
            players: null,
            href: "../mini-games/flappy/index.html",
            visual: `
                <div class="mini-cover flappy-cover">
                    <span class="cloud cloud-1"></span>
                    <span class="cloud cloud-2"></span>
                    <span class="flappy-pipe pipe-top"></span>
                    <span class="flappy-pipe pipe-bottom"></span>

                    <span class="flappy-bird">
                        <i class="bird-eye"></i>
                        <i class="bird-beak"></i>
                        <i class="bird-wing"></i>
                    </span>
                </div>
            `
        },
        {
            id: "snake",
            name: "Snake",
            players: null,
            href: "#",
            visual: `
                <div class="mini-cover snake-cover">
                    <span class="snake-body snake-1"></span>
                    <span class="snake-body snake-2"></span>
                    <span class="snake-body snake-3"></span>
                    <span class="snake-body snake-4"></span>
                    <span class="snake-head"></span>
                    <span class="snake-food"></span>
                </div>
            `
        },
        {
            id: "stickman",
            name: "Stickman",
            players: null,
            href: "#",
            visual: `
                <div class="mini-cover stickman-cover">
                    <span class="stickman-head"></span>
                    <span class="stickman-body"></span>
                    <span class="stickman-arm arm-left"></span>
                    <span class="stickman-arm arm-right"></span>
                    <span class="stickman-leg leg-left"></span>
                    <span class="stickman-leg leg-right"></span>
                    <span class="stickman-sword"></span>
                </div>
            `
        },
        {
            id: "ludo",
            name: "Ludo",
            players: null,
            href: "../mini-games/ludo/index.html",
            visual: `
                <div class="mini-cover ludo-cover">

                    <div class="ludo-board">
                        <span class="ludo-home red"></span>
                        <span class="ludo-home blue"></span>
                        <span class="ludo-home yellow"></span>
                        <span class="ludo-home green"></span>
                        <span class="ludo-center"></span>
                    </div>
                </div>
            `
        }
    ];

    const perPage = 15;
    let currentPage = 1;
    let filteredGames = [...games];

    const grid = document.getElementById("miniGrid");
    const search = document.getElementById("miniSearch");
    const count = document.getElementById("miniCount");

    const prev = document.getElementById("miniPrev");
    const next = document.getElementById("miniNext");
    const pageNumbers = document.getElementById("miniPageNumbers");
    const pagination = document.getElementById("miniPagination");


    function sortGames(list) {
        return [...list];
    }

    function render() {

        const totalPages =
            Math.max(1, Math.ceil(filteredGames.length / perPage));

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const start =
            (currentPage - 1) * perPage;

        const visible =
            filteredGames.slice(start, start + perPage);

        grid.innerHTML = "";


        /*
         * Luôn tạo đủ 15 slot:
         * 1  2  3  4  5
         * 6  7  8  9  10
         * 11 12 13 14 15
         *
         * Slot trống không hiển thị card,
         * nhưng vẫn giữ đúng chiều cao 3 hàng.
         */

        for (let index = 0; index < perPage; index++) {

            const game = visible[index];

            if (!game) {

                const empty =
                    document.createElement("div");

                empty.className = "mini-card-slot-empty";
                empty.setAttribute("aria-hidden", "true");

                grid.appendChild(empty);

                continue;
            }



            const card =
                document.createElement("a");

            card.className = "mini-card";

            card.href = game.href;

            card.dataset.name =
                game.name.toLowerCase();


            card.innerHTML = `
                ${game.visual}

                <div class="mini-info">
                    <div>
                        <h3>${game.name}</h3>
                    </div>

                    <span class="play-button">
                        Chơi
                    </span>
                </div>
            `;




            grid.appendChild(card);
        }


        count.textContent =
            `${filteredGames.length} game`;


        renderPagination(totalPages);
    }


    function renderPagination(totalPages) {

        /*
         * Chỉ cần nút chuyển trang khi có hơn 15 game.
         * Với 6 game hiện tại, khu vực pagination ẩn.
         */

        if (totalPages <= 1) {

            pagination.classList.remove("is-visible");
            return;

        }

        pagination.classList.add("is-visible");

        prev.disabled =
            currentPage === 1;

        next.disabled =
            currentPage === totalPages;

        pageNumbers.innerHTML = "";


        for (let page = 1; page <= totalPages; page++) {

            const button =
                document.createElement("button");

            button.type = "button";

            button.className =
                "mini-page-number";

            button.textContent =
                String(page);

            if (page === currentPage) {
                button.classList.add("active");
            }

            button.addEventListener(
                "click",
                () => {

                    currentPage = page;
                    render();

                    window.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    });
                }
            );

            pageNumbers.appendChild(button);
        }
    }


    function applySearch() {

        const keyword =
            search.value
                .trim()
                .toLowerCase();


        filteredGames =
            sortGames(
                games.filter((game) =>
                    !keyword ||
                    game.name
                        .toLowerCase()
                        .includes(keyword)
                )
            );

        currentPage = 1;

        render();
    }


    search.addEventListener(
        "input",
        applySearch
    );


    prev.addEventListener(
        "click",
        () => {

            if (currentPage <= 1) return;

            currentPage--;
            render();
        }
    );


    next.addEventListener(
        "click",
        () => {

            const totalPages =
                Math.ceil(filteredGames.length / perPage);

            if (currentPage >= totalPages) return;

            currentPage++;
            render();
        }
    );


    filteredGames =
        sortGames(games);

    render();

    /* ---------------------------------------------------------
       Smooth page transition
    --------------------------------------------------------- */

    document.querySelectorAll("a[href]").forEach((link) => {

        link.addEventListener("click", (event) => {

            if (
                event.defaultPrevented ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const href = link.getAttribute("href");

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:")
            ) {
                return;
            }

            if (link.target === "_blank") {
                return;
            }

            let target;

            try {
                target = new URL(href, window.location.href);
            } catch {
                return;
            }

            if (target.origin !== window.location.origin) {
                return;
            }

            event.preventDefault();

            document.body.classList.add("page-leaving");

            window.setTimeout(() => {
                window.location.href = target.href;
            }, 180);
        });
    });

});
