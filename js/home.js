/* =========================================================
   TIENHUB — HOME.JS
   JavaScript cho trang chủ
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. RACING HERO CAROUSEL
    ===================================================== */

    const heroImage = document.getElementById("heroImage");
    const heroPrev = document.getElementById("heroPrev");
    const heroNext = document.getElementById("heroNext");
    const heroDots = Array.from(
        document.querySelectorAll(".hero-dot")
    );
    const hero = document.getElementById("racingHero");

    // 3 ảnh Racing
    const heroImages = [
        "assets/images/games/racing/sunset-coast.png",
        "assets/images/games/racing/greenvalley.png",
        "assets/images/games/racing/car-concept.png"
    ];

    let currentHero = 0;
    let heroTimer = null;


    /* -----------------------------------------------------
       Cập nhật ảnh Hero
    ----------------------------------------------------- */

    function updateHero() {

        if (!heroImage) return;

        // Hiệu ứng chuyển ảnh
        heroImage.classList.add("is-changing");

        window.setTimeout(() => {

            heroImage.src = heroImages[currentHero];

            heroImage.alt =
                `TienHub Racing - hình ${currentHero + 1}`;

            // Cập nhật các dấu chấm
            heroDots.forEach((dot, index) => {

                dot.classList.toggle(
                    "active",
                    index === currentHero
                );

                dot.setAttribute(
                    "aria-selected",
                    index === currentHero
                        ? "true"
                        : "false"
                );
            });

            window.setTimeout(() => {
                heroImage.classList.remove("is-changing");
            }, 40);

        }, 120);
    }


    /* -----------------------------------------------------
       Chuyển tới ảnh cụ thể
    ----------------------------------------------------- */

    function showHero(index) {

        currentHero =
            (index + heroImages.length) %
            heroImages.length;

        updateHero();

        restartHeroTimer();
    }


    /* -----------------------------------------------------
       Ảnh tiếp theo
    ----------------------------------------------------- */

    function nextHero() {

        showHero(currentHero + 1);

    }


    /* -----------------------------------------------------
       Ảnh trước
    ----------------------------------------------------- */

    function prevHero() {

        showHero(currentHero - 1);

    }


    /* -----------------------------------------------------
       Reset bộ đếm tự động
    ----------------------------------------------------- */

    function restartHeroTimer() {

        if (heroTimer) {
            window.clearInterval(heroTimer);
        }

        // Tự động chuyển sau 5.5 giây
        heroTimer = window.setInterval(
            nextHero,
            5500
        );
    }


    /* -----------------------------------------------------
       Nút Previous / Next
    ----------------------------------------------------- */

    if (heroNext) {

        heroNext.addEventListener(
            "click",
            nextHero
        );

    }


    if (heroPrev) {

        heroPrev.addEventListener(
            "click",
            prevHero
        );

    }


    /* -----------------------------------------------------
       Các dấu chấm
    ----------------------------------------------------- */

    heroDots.forEach((dot, index) => {

        dot.addEventListener(
            "click",
            () => showHero(index)
        );

    });


    /* -----------------------------------------------------
       Phím ← →
    ----------------------------------------------------- */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "ArrowRight") {
                nextHero();
            }

            if (event.key === "ArrowLeft") {
                prevHero();
            }

        }
    );


    /* -----------------------------------------------------
       Hover vào Hero → tạm dừng tự động chuyển
    ----------------------------------------------------- */

    if (hero) {

        hero.addEventListener(
            "mouseenter",
            () => {

                if (heroTimer) {
                    window.clearInterval(heroTimer);
                }

            }
        );


        hero.addEventListener(
            "mouseleave",
            restartHeroTimer
        );

    }


    /* -----------------------------------------------------
       Khởi động Hero
    ----------------------------------------------------- */

    updateHero();

    restartHeroTimer();



    /* =====================================================
       2. SEARCH
    ===================================================== */

    const searchInput =
        document.querySelector(".search input");

    const cards = Array.from(
        document.querySelectorAll(
            ".game-card, .mini-card"
        )
    );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                const keyword =
                    searchInput.value
                        .trim()
                        .toLowerCase();


                cards.forEach((card) => {

                    const text =
                        card.textContent
                            .toLowerCase();


                    const matched =
                        !keyword ||
                        text.includes(keyword);


                    card.style.display =
                        matched
                            ? ""
                            : "none";

                });

            }
        );

    }



    /* =====================================================
       3. LIVE PLAYER COUNTS

       Đọc presence từ Firebase và đếm số UID đang online
       trong từng game. Không đổi giao diện khi Firebase lỗi.
    ===================================================== */

    async function setupLivePlayerCounts() {

        const countElements = new Map();

        document
            .querySelectorAll("[data-game-online]")
            .forEach((element) => {
                countElements.set(
                    element.dataset.gameOnline,
                    element
                );
            });

        if (!countElements.size) return;

        try {
            const { db } = await import("../src/core/firebase.js");
            const { ref, onValue } = await import(
                "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js"
            );

            onValue(ref(db, "presence"), (snapshot) => {
                const data = snapshot.val() || {};
                const gameUsers = {};

                Object.keys(data).forEach((uid) => {
                    const sessions = data[uid];
                    if (!sessions || typeof sessions !== "object") return;

                    // Legacy format: presence/uid = { game, online }
                    if (sessions.game || sessions.online !== undefined) {
                        if (sessions.online === true || sessions.game) {
                            const game = sessions.game;
                            if (game) {
                                if (!gameUsers[game]) gameUsers[game] = new Set();
                                gameUsers[game].add(uid);
                            }
                        }
                        return;
                    }

                    // Current format: presence/uid/sessionId = { game, online }
                    Object.values(sessions).forEach((session) => {
                        if (!session || typeof session !== "object") return;
                        if (session.online !== true || !session.game) return;

                        if (!gameUsers[session.game]) {
                            gameUsers[session.game] = new Set();
                        }
                        gameUsers[session.game].add(uid);
                    });
                });

                countElements.forEach((element, gameId) => {
                    const count = gameUsers[gameId]?.size || 0;
                    element.textContent = String(count);
                });
            });
        } catch (error) {
            console.warn("TienHub live player count unavailable:", error);
        }
    }

    setupLivePlayerCounts();


    /* =====================================================
       4. ACTIVE NAVIGATION
       
       Tự đánh dấu trang hiện tại trên navbar.
    ===================================================== */

    const currentPage =
        window.location.pathname
            .split("/")
            .pop() || "index.html";


    document
        .querySelectorAll(".main-nav a")
        .forEach((link) => {

            const href =
                link.getAttribute("href");


            if (!href) return;


            const linkPage =
                href.split("/").pop();


            if (linkPage === currentPage) {

                link.classList.add("active");

            }

        });

});
