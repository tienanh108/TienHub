const MINI_GAMES = [
    {
        id: "caro5",
        name: "Caro 5",
        category: "board",
        categoryName: "Board Game",
        image: "assets/games/caro5.png",
        description: "Connect five pieces in a row to win.",
        status: "play",
        path: "mini-games/caro5/index.html"
    },
    {
        id: "chess",
        name: "Chess",
        category: "board",
        categoryName: "Board Game",
        image: "assets/games/chess.png",
        description: "Outwit your opponent and deliver checkmate.",
        status: "play",
        path: "mini-games/chess/index.html"
    },
    {
        id: "flappy",
        name: "Flappy Bird",
        category: "arcade",
        categoryName: "Arcade",
        image: "assets/games/flappy.png",
        description: "Fly as far as you can.",
        status: "play",
        path: "mini-games/flappy/index.html"
    },
    {
        id: "ludo",
        name: "Ludo",
        category: "board",
        categoryName: "Board Game",
        image: "assets/games/ludo.png",
        description: "Get your pieces home before your opponents.",
        status: "play",
        path: "mini-games/ludo/index.html"
    },
    {
        id: "snake",
        name: "Snake",
        category: "arcade",
        categoryName: "Arcade",
        image: "assets/games/snake.png",
        description: "Eat food and become the longest snake.",
        status: "play",
        path: "mini-games/snake/index.html"
    },
    {
        id: "stickman",
        name: "Stickman",
        category: "arcade",
        categoryName: "Arcade",
        image: "assets/games/stickman.png",
        description: "Dodge obstacles and keep moving forward.",
        status: "play",
        path: "mini-games/stickman/index.html"
    },
    {
        id: "brick-breaker",
        name: "Brick Breaker",
        category: "arcade",
        categoryName: "Arcade",
        image: "assets/games/brick-breaker.png",
        description: "Break every brick with your ball.",
        status: "play",
        path: "mini-games/brick-breaker/index.html"
    },
    {
        id: "minesweeper",
        name: "Minesweeper",
        category: "puzzle",
        categoryName: "Puzzle",
        image: "assets/games/minesweeper.png",
        description: "Find safe tiles and avoid mines.",
        status: "play",
        path: "mini-games/minesweeper/index.html"
    },
    {
        id: "blackjack",
        name: "Blackjack",
        category: "card",
        categoryName: "Card Game",
        image: "assets/games/blackjack.png",
        description: "Get closer to 21 than the dealer.",
        status: "play",
        path: "mini-games/blackjack/index.html"
    },
    {
        id: "pong",
        name: "Pong",
        category: "arcade",
        categoryName: "Arcade",
        image: "assets/games/pong.png",
        description: "Return the ball and outscore your opponent.",
        status: "play",
        path: "mini-games/pong/index.html"
    }
];

const GAME_CATEGORIES = [
    { id: "all", name: "All" },
    { id: "arcade", name: "Arcade" },
    { id: "board", name: "Board Game" },
    { id: "card", name: "Card Game" },
    { id: "puzzle", name: "Puzzle" }
];

const HOME_FEATURED_GAMES = [
    "caro5",
    "chess",
    "flappy",
    "ludo",
    "snake",
    "stickman",
    "brick-breaker",
    "minesweeper",
    "blackjack",
    "pong"
];

function getGameById(id) {
    return MINI_GAMES.find((game) => game.id === id);
}

function getGamesByCategory(category) {
    if (!category || category === "all") {
        return [...MINI_GAMES];
    }

    return MINI_GAMES.filter((game) => game.category === category);
}

function getHomeGames() {
    return HOME_FEATURED_GAMES
        .map((id) => getGameById(id))
        .filter(Boolean);
}

function getPlayableGames() {
    return MINI_GAMES.filter((game) => game.status === "play");
}

function searchGames(keyword) {
    if (!keyword) {
        return [...MINI_GAMES];
    }

    const search = keyword.toLowerCase().trim();

    return MINI_GAMES.filter((game) =>
        game.name.toLowerCase().includes(search) ||
        game.categoryName.toLowerCase().includes(search) ||
        game.description.toLowerCase().includes(search)
    );
}

function openGame(gameId) {
    const game = getGameById(gameId);

    if (!game) {
        console.warn(`[TienHub] Game not found: ${gameId}`);
        return;
    }

    if (game.status !== "play") {
        console.log(`[TienHub] Game "${game.name}"is not available yet.`);
        return;
    }

    window.location.href = game.path;
}

window.TienHubGames = {
    all: MINI_GAMES,
    categories: GAME_CATEGORIES,
    home: getHomeGames,
    getById: getGameById,
    getByCategory: getGamesByCategory,
    getPlayable: getPlayableGames,
    search: searchGames,
    open: openGame
};
