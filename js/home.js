/* =========================================================
   TIENHUB — HOME.JS
   JavaScript cho trang chủ
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. HERO: CHUYỂN GIỮA 2 GAME (RACING / STICKMAN)
       - Mũi tên trái/phải: chuyển GAME.
       - Racing tự đổi qua 3 ảnh, vẫn ở cùng một GAME.
       - Soul Fighters hiển thị ảnh đấu trường cố định.
    ===================================================== */

    const heroImage = document.getElementById("heroImage");
    const heroPrev = document.getElementById("heroPrev");
    const heroNext = document.getElementById("heroNext");
    const heroDots = Array.from(document.querySelectorAll(".hero-dot"));
    const hero = document.getElementById("racingHero");
    const heroTitle = document.getElementById("heroTitle");
    const heroDescription = document.getElementById("heroDescription");
    const heroButtonIcon = document.getElementById("heroButtonIcon");

    const heroGames = [
        {
            title: "Racing",
            description: "Những cuộc đua tốc độ cao đang được phát triển cho TienHub.",
            icon: "🏁",
            images: [
                "assets/images/games/racing/sunset-coast.png",
                "assets/images/games/racing/greenvalley.png",
                "assets/images/games/racing/car-concept.png"
            ]
        },
        {
            title: "Soul Fighters",
            description: "Trải nghiệm những trận đấu võ thuật 3D trên đấu trường TienHub.",
            icon: "⚔️",
            images: ["assets/images/games/stickman-3d/training-arena.png"]
        }
    ];

    let currentGame = 0;
    let currentRacingPhoto = 0;
    let racingPhotoTimer = null;
    let renderTimer = null;
    let heroHovered = false;

    function renderHero() {
        const game = heroGames[currentGame];
        const photoIndex = currentGame === 0 ? currentRacingPhoto : 0;
        const photo = game.images[photoIndex];

        if (renderTimer !== null) window.clearTimeout(renderTimer);
        if (heroImage) heroImage.classList.add("is-changing");

        // Tránh ảnh cũ chồng lên ảnh mới khi nhấn mũi tên nhanh.
        renderTimer = window.setTimeout(() => {
            if (heroImage) {
                heroImage.src = photo;
                heroImage.alt = `${game.title} - hình giới thiệu ${photoIndex + 1}`;
                heroImage.classList.remove("is-changing");
            }
            renderTimer = null;
        }, 120);

        if (heroTitle) heroTitle.textContent = game.title;
        if (heroDescription) heroDescription.textContent = game.description;
        if (heroButtonIcon) heroButtonIcon.textContent = game.icon;

        // Chỉ có 2 chấm, mỗi chấm đại diện cho một GAME.
        heroDots.forEach((dot, index) => {
            const selected = index === currentGame;
            dot.classList.toggle("active", selected);
            dot.setAttribute("aria-selected", selected ? "true" : "false");
        });
    }

    function stopRacingTimer() {
        if (racingPhotoTimer !== null) {
            window.clearInterval(racingPhotoTimer);
            racingPhotoTimer = null;
        }
    }

    function startRacingTimer() {
        stopRacingTimer();
        // Stickman không có bộ đếm chuyển ảnh.
        if (currentGame !== 0 || heroHovered) return;
        racingPhotoTimer = window.setInterval(() => {
            if (currentGame !== 0) return;
            currentRacingPhoto = (currentRacingPhoto + 1) % heroGames[0].images.length;
            renderHero();
        }, 5500);
    }

    function showGame(index) {
        currentGame = (index + heroGames.length) % heroGames.length;
        // Quay lại Racing sẽ bắt đầu từ ảnh đầu tiên.
        if (currentGame === 0) currentRacingPhoto = 0;
        renderHero();
        startRacingTimer();
    }

    // Nút trái/phải đi thẳng sang game còn lại.
    if (heroPrev) heroPrev.addEventListener("click", () => showGame(currentGame - 1));
    if (heroNext) heroNext.addEventListener("click", () => showGame(currentGame + 1));

    heroDots.forEach((dot, index) => {
        dot.addEventListener("click", () => showGame(index));
    });

    document.addEventListener("keydown", (event) => {
        // Đừng chiếm phím điều hướng khi người chơi đang nhập/chọn văn bản.
        const target = event.target;
        if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
        if (event.key === "ArrowRight") showGame(currentGame + 1);
        if (event.key === "ArrowLeft") showGame(currentGame - 1);
    });

    if (hero) {
        hero.addEventListener("mouseenter", () => {
            heroHovered = true;
            stopRacingTimer();
        });
        hero.addEventListener("mouseleave", () => {
            heroHovered = false;
            startRacingTimer();
        });
    }

    renderHero();
    startRacingTimer();


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

       Đã bỏ hiển thị số người chơi khỏi trang chủ.
       Firebase presence vẫn được giữ cho các game online
       và sẽ được dùng sau này cho trang thống kê quản trị.
    ===================================================== */


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