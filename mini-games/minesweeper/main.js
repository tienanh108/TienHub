const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10,  label: "EASY" },
  medium: { rows: 16, cols: 16, mines: 40,  label: "MEDIUM" },
  hard:   { rows: 16, cols: 30, mines: 99,  label: "HARD" }
};

const boardEl = document.getElementById("board");
const mineCountEl = document.getElementById("mineCount");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const difficultyEl = document.getElementById("difficulty");

let level = "easy";
let rows = 9;
let cols = 9;
let mineTotal = 10;
let cells = [];
let started = false;
let gameEnded = false;
let flags = 0;
let elapsed = 0;
let timerId = null;
let longPressTimer = null;
let suppressClick = false;

function bestKey() {
  return `tienhub_minesweeper_best_${level}`;
}

function loadBest() {
  const value = Number(localStorage.getItem(bestKey()));
  bestEl.textContent = value > 0 ? String(value).padStart(3, "0") : "---";
}

function pad(n) {
  return String(n).padStart(3, "0");
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (!gameEnded) {
      elapsed++;
      timerEl.textContent = pad(elapsed);
    }
  }, 1000);
}

function setup(levelName = level) {
  level = levelName;
  const config = LEVELS[level];

  rows = config.rows;
  cols = config.cols;
  mineTotal = config.mines;
  cells = [];
  started = false;
  gameEnded = false;
  flags = 0;
  elapsed = 0;

  stopTimer();
  timerEl.textContent = "000";
  mineCountEl.textContent = pad(mineTotal);
  statusEl.textContent = "CHỌN MỘT Ô ĐỂ BẮT ĐẦU";
  overlay.classList.add("hidden");

  loadBest();
  renderEmptyBoard();
}

function renderEmptyBoard() {
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = {
        r,
        c,
        mine: false,
        open: false,
        flag: false,
        count: 0,
        el: null
      };

      const el = document.createElement("button");
      el.className = "cell";
      el.type = "button";
      el.dataset.r = r;
      el.dataset.c = c;
      cell.el = el;

      el.addEventListener("click", () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        openCell(r, c);
      });

      el.addEventListener("contextmenu", e => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      // Mobile: long press = flag.
      el.addEventListener("pointerdown", e => {
        if (e.pointerType !== "touch") return;

        suppressClick = false;
        clearTimeout(longPressTimer);

        longPressTimer = setTimeout(() => {
          suppressClick = true;
          toggleFlag(r, c);
        }, 420);
      });

      el.addEventListener("pointerup", () => {
        clearTimeout(longPressTimer);
      });

      el.addEventListener("pointercancel", () => {
        clearTimeout(longPressTimer);
      });

      el.addEventListener("pointerleave", () => {
        clearTimeout(longPressTimer);
      });

      boardEl.appendChild(el);
      cells.push(cell);
    }
  }
}

function indexOf(r, c) {
  return r * cols + c;
}

function getCell(r, c) {
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return cells[indexOf(r, c)];
}

function neighbors(cell) {
  const result = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;

      const next = getCell(cell.r + dr, cell.c + dc);
      if (next) result.push(next);
    }
  }

  return result;
}

function buildMines(firstCell) {
  const forbidden = new Set(
    neighbors(firstCell)
      .concat(firstCell)
      .map(c => indexOf(c.r, c.c))
  );

  const available = [];

  for (const cell of cells) {
    if (!forbidden.has(indexOf(cell.r, cell.c))) {
      available.push(cell);
    }
  }

  // Fisher-Yates shuffle.
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  for (let i = 0; i < mineTotal; i++) {
    available[i].mine = true;
  }

  for (const cell of cells) {
    cell.count = neighbors(cell)
      .filter(n => n.mine)
      .length;
  }
}

function startGame(firstCell) {
  buildMines(firstCell);
  started = true;
  statusEl.textContent = "DÒ MÌN...";
  startTimer();
}

function openCell(r, c) {
  if (gameEnded) return;

  const cell = getCell(r, c);
  if (!cell || cell.flag || cell.open) return;

  if (!started) {
    startGame(cell);
  }

  if (cell.mine) {
    cell.open = true;
    renderCell(cell);
    revealMines(cell);
    lose();
    return;
  }

  floodOpen(cell);
  checkWin();
}

function floodOpen(start) {
  const queue = [start];
  const visited = new Set();

  while (queue.length) {
    const cell = queue.shift();
    const key = indexOf(cell.r, cell.c);

    if (visited.has(key) || cell.flag || cell.open) continue;
    visited.add(key);

    if (cell.mine) continue;

    cell.open = true;
    renderCell(cell);

    if (cell.count === 0) {
      for (const n of neighbors(cell)) {
        if (!n.open && !n.flag && !n.mine) {
          queue.push(n);
        }
      }
    }
  }
}

function toggleFlag(r, c) {
  if (gameEnded) return;

  const cell = getCell(r, c);
  if (!cell || cell.open) return;

  if (!cell.flag && flags >= mineTotal) return;

  cell.flag = !cell.flag;
  flags += cell.flag ? 1 : -1;

  renderCell(cell);
  mineCountEl.textContent = pad(Math.max(0, mineTotal - flags));

  if (!started) {
    statusEl.textContent = "CỜ ĐÃ ĐẶT — CHỌN Ô ĐỂ BẮT ĐẦU";
  }

  checkWin();
}

function renderCell(cell) {
  const el = cell.el;
  el.className = "cell";

  if (!cell.open) {
    if (cell.flag) {
      el.classList.add("flag");
      el.textContent = "⚑";
    } else {
      el.textContent = "";
    }
    return;
  }

  el.classList.add("open");

  if (cell.mine) {
    el.classList.add("mine");
    el.textContent = "✹";
    return;
  }

  if (cell.count > 0) {
    el.classList.add(`n${cell.count}`);
    el.textContent = String(cell.count);
  } else {
    el.textContent = "";
  }
}

function revealMines(trigger) {
  for (const cell of cells) {
    if (cell.mine) {
      cell.open = true;
      renderCell(cell);
    } else if (cell.flag && !cell.mine) {
      cell.flag = false;
      cell.open = true;
      cell.el.textContent = "×";
      cell.el.classList.remove("flag");
      cell.el.classList.add("open");
    }
  }

  trigger.el.textContent = "💥";
}

function checkWin() {
  if (!started || gameEnded) return;

  const safeLeft = cells.some(cell => !cell.mine && !cell.open);

  if (!safeLeft) {
    win();
  }
}

function lose() {
  gameEnded = true;
  stopTimer();

  resultIcon.textContent = "💥";
  resultTitle.textContent = "GAME OVER";
  resultText.textContent = `Bạn đã dò trúng mìn sau ${elapsed} giây.`;
  statusEl.textContent = "GAME OVER";
  overlay.classList.remove("hidden");
}

function win() {
  gameEnded = true;
  stopTimer();

  for (const cell of cells) {
    if (cell.mine && !cell.flag) {
      cell.flag = true;
      renderCell(cell);
    }
  }

  const currentBest = Number(localStorage.getItem(bestKey())) || Infinity;

  if (elapsed < currentBest) {
    localStorage.setItem(bestKey(), String(elapsed));
  }

  loadBest();

  resultIcon.textContent = "🏆";
  resultTitle.textContent = "YOU WIN";
  resultText.textContent = `Bạn hoàn thành ${LEVELS[level].label} trong ${elapsed} giây.`;
  statusEl.textContent = "HOÀN THÀNH!";
  overlay.classList.remove("hidden");
}

function setLevel(nextLevel) {
  if (!LEVELS[nextLevel]) return;

  level = nextLevel;

  for (const button of difficultyEl.children) {
    button.classList.toggle(
      "active",
      button.dataset.level === level
    );
  }

  setup(level);
}

difficultyEl.addEventListener("click", e => {
  const button = e.target.closest("button[data-level]");
  if (!button) return;
  setLevel(button.dataset.level);
});

document.getElementById("newBtn").addEventListener("click", () => {
  setup(level);
});

document.getElementById("againBtn").addEventListener("click", () => {
  setup(level);
});

document.getElementById("menuBtn").addEventListener("click", () => {
  window.location.href = "../../index.html";
});

// Prevent accidental browser context menu on the board.
boardEl.addEventListener("contextmenu", e => e.preventDefault());

setup("easy");
