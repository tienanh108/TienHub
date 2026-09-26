(() => {
  "use strict";

  const canvas = document.getElementById("pongCanvas");
  const wrap = document.getElementById("canvasWrap");
  const ctx = canvas.getContext("2d");
  const menuPanel = document.getElementById("menuPanel");
  const pausePanel = document.getElementById("pausePanel");
  const resultPanel = document.getElementById("resultPanel");
  const rotatePanel = document.getElementById("rotatePanel");
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const againBtn = document.getElementById("againBtn");
  const menuBtn = document.getElementById("menuBtn");
  const backBtn = document.getElementById("backBtn");
  const resultMenuBtn = document.getElementById("resultMenuBtn");
  const scoreLeftEl = document.getElementById("scoreLeft");
  const scoreRightEl = document.getElementById("scoreRight");
  const rightLabel = document.getElementById("rightLabel");
  const hint = document.getElementById("gameHint");
  const controlsNote = document.getElementById("controlsNote");
  const modeButtons = [...document.querySelectorAll(".mode-btn")];

  const WIN_SCORE = 5;
  const state = {
    mode: "ai",
    running: false,
    paused: false,
    gameOver: false,
    lastTime: 0,
    animation: 0,
    width: 1080,
    height: 540,
    scoreLeft: 0,
    scoreRight: 0,
    serveTimer: 0.7,
    serveDir: 1,
    keys: new Set(),
    touch: { left: null, right: null }
  };

  const left = { x: 26, y: 210, w: 13, h: 120, targetY: 210 };
  const right = { x: 1041, y: 210, w: 13, h: 120, targetY: 210 };
  const ball = { x: 540, y: 270, r: 9, vx: 0, vy: 0, speed: 480 };

  // Hai lò xo ở hai bên vạch giữa sân. Chạm vào sẽ tăng tốc bóng.
  const springs = [
    // Hai lò xo ở hai đầu của vạch giữa sân.
    { x: 540, y: 52, r: 24, cooldown: 0 },
    { x: 540, y: 488, r: 24, cooldown: 0 },
    // Hai lò xo nhỏ nằm ngay giữa sân, ôm hai bên vạch trắng.
    { x: 510, y: 270, r: 24, cooldown: 0 },
    { x: 570, y: 270, r: 24, cooldown: 0 }
  ];

  function isMobile() {
    return matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(320, rect.width);
    const cssH = Math.max(180, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    state.width = 1080;
    state.height = 540;
    ctx.setTransform(canvas.width / state.width, 0, 0, canvas.height / state.height, 0, 0);
    clampPaddles();
    if (!state.running) resetPositions();
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function clampPaddles() {
    left.y = clamp(left.y, 0, state.height - left.h);
    right.y = clamp(right.y, 0, state.height - right.h);
  }

  function resetPositions() {
    left.y = state.height / 2 - left.h / 2;
    right.y = state.height / 2 - right.h / 2;
    ball.x = state.width / 2;
    ball.y = state.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    state.serveTimer = 0.65;
  }

  function launchBall() {
    const angle = (Math.random() * 0.75 - 0.375);
    const direction = state.serveDir || (Math.random() > 0.5 ? 1 : -1);
    ball.speed = 480;
    ball.vx = Math.cos(angle) * ball.speed * direction;
    ball.vy = Math.sin(angle) * ball.speed;
    state.serveTimer = 0;
  }

  function setMode(mode) {
    state.mode = mode;
    modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
    rightLabel.textContent = mode === "ai" ? "MACHINE" : "PLAYER 2";
    if (mode === "ai") {
      controlsNote.textContent = "PC: W / S hoặc A / D • Mobile: kéo vợt bên trái";
      hint.textContent = isMobile() ? "Kéo nửa trái màn hình để điều khiển" : "W / S hoặc A / D để điều khiển vợt trái";
    } else {
      controlsNote.textContent = "PC: P1 W / S hoặc A / D • P2 ↑ / ↓ • Mobile: mỗi người một nửa màn hình";
      hint.textContent = isMobile() ? "P1 kéo bên trái • P2 kéo bên phải" : "P1: W / S hoặc A / D • P2: ↑ / ↓ hoặc ← / →";
    }
  }

  function showPongMenu() {
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    pausePanel.hidden = true;
    resultPanel.hidden = true;
    menuPanel.style.display = "flex";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Ⅱ";
    backBtn.textContent = "‹  Mini Games";
    backBtn.href = "../../pages/mini-game.html";
    resetPositions();
  }

  function resetGame() {
    state.scoreLeft = 0;
    state.scoreRight = 0;
    state.running = true;
    state.paused = false;
    state.gameOver = false;
    state.serveDir = Math.random() > 0.5 ? 1 : -1;
    scoreLeftEl.textContent = "0";
    scoreRightEl.textContent = "0";
    pauseBtn.disabled = false;
    pausePanel.hidden = true;
    resultPanel.hidden = true;
    menuPanel.style.display = "none";
    backBtn.textContent = "‹  Menu Pong";
    backBtn.removeAttribute("href");
    resetPositions();
  }

  function score(side) {
    if (side === "left") state.scoreLeft += 1;
    else state.scoreRight += 1;
    scoreLeftEl.textContent = String(state.scoreLeft);
    scoreRightEl.textContent = String(state.scoreRight);

    if (state.scoreLeft >= WIN_SCORE || state.scoreRight >= WIN_SCORE) {
      finish();
      return;
    }
    state.serveDir = side === "left" ? 1 : -1;
    resetPositions();
  }

  function finish() {
    state.running = false;
    state.gameOver = true;
    pauseBtn.disabled = true;
    const leftWon = state.scoreLeft > state.scoreRight;
    document.getElementById("resultTitle").textContent = leftWon ? "PLAYER 1 THẮNG" : (state.mode === "ai" ? "MACHINE THẮNG" : "PLAYER 2 THẮNG");
    document.getElementById("resultScore").textContent = `${state.scoreLeft} : ${state.scoreRight}`;
    resultPanel.hidden = false;
    menuPanel.style.display = "none";
  }

  function togglePause() {
    if (!state.running || state.gameOver) return;
    state.paused = !state.paused;
    pausePanel.hidden = !state.paused;
    pauseBtn.textContent = state.paused ? "▶" : "Ⅱ";
  }

  function movePaddle(paddle, target, dt, maxSpeed) {
    const diff = target - (paddle.y + paddle.h / 2);
    const step = clamp(diff, -maxSpeed * dt, maxSpeed * dt);
    paddle.y += step;
    paddle.y = clamp(paddle.y, 0, state.height - paddle.h);
  }

  function updatePlayerPaddles(dt) {
    const speed = 570;
    let leftDir = 0;
    if (state.keys.has("KeyW") || state.keys.has("KeyA")) leftDir -= 1;
    if (state.keys.has("KeyS") || state.keys.has("KeyD")) leftDir += 1;
    if (state.keys.has("ArrowUp") || state.keys.has("ArrowLeft")) right.y -= speed * dt;
    if (state.keys.has("ArrowDown") || state.keys.has("ArrowRight")) right.y += speed * dt;
    left.y += leftDir * speed * dt;

    if (state.touch.left !== null) left.y = state.touch.left - left.h / 2;
    if (state.mode === "2p" && state.touch.right !== null) right.y = state.touch.right - right.h / 2;

    left.y = clamp(left.y, 0, state.height - left.h);
    right.y = clamp(right.y, 0, state.height - right.h);
  }

  function updateAI(dt) {
    const target = ball.y - right.h / 2 + ball.vy * 0.08;
    movePaddle(right, target, dt, 355);
  }

  function intersects(p, b) {
    return b.x - b.r < p.x + p.w && b.x + b.r > p.x && b.y + b.r > p.y && b.y - b.r < p.y + p.h;
  }

  function bounceFromPaddle(paddle, direction) {
    const relative = clamp((ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2), -1, 1);
    const maxAngle = Math.PI * 0.39;
    const angle = relative * maxAngle;
    ball.speed = Math.min(ball.speed + 18, 760);
    ball.vx = Math.cos(angle) * ball.speed * direction;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.x = direction > 0 ? paddle.x + paddle.w + ball.r + 1 : paddle.x - ball.r - 1;
  }

  function update(dt) {
    if (!state.running || state.paused || state.gameOver) return;
    updatePlayerPaddles(dt);
    if (state.mode === "ai") updateAI(dt);

    if (state.serveTimer > 0) {
      state.serveTimer -= dt;
      if (state.serveTimer <= 0) launchBall();
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - ball.r <= 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
    if (ball.y + ball.r >= state.height) { ball.y = state.height - ball.r; ball.vy = -Math.abs(ball.vy); }

    if (ball.vx < 0 && intersects(left, ball)) bounceFromPaddle(left, 1);
    if (ball.vx > 0 && intersects(right, ball)) bounceFromPaddle(right, -1);

    // Lò xo giữa sân: chạm vào sẽ nảy ra và tăng tốc bóng.
    for (const spring of springs) {
      spring.cooldown = Math.max(0, spring.cooldown - dt);
      const dx = ball.x - spring.x;
      const dy = ball.y - spring.y;
      const hitDistance = ball.r + spring.r * 0.42;
      if (spring.cooldown <= 0 && dx * dx + dy * dy <= hitDistance * hitDistance) {
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        const speed = Math.min(Math.max(ball.speed * 1.28, 520), 920);
        const dot = ball.vx * nx + ball.vy * ny;
        ball.vx -= 2 * dot * nx;
        ball.vy -= 2 * dot * ny;
        const current = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = (ball.vx / current) * speed;
        ball.vy = (ball.vy / current) * speed;
        ball.x = spring.x + nx * (hitDistance + 2);
        ball.y = spring.y + ny * (hitDistance + 2);
        ball.speed = speed;
        spring.cooldown = 0.18;
      }
    }

    if (ball.x < -ball.r * 2) score("right");
    else if (ball.x > state.width + ball.r * 2) score("left");
  }

  function roundedRect(x,y,w,h,r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,rr);
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    const grad = ctx.createLinearGradient(0,0,state.width,0);
    grad.addColorStop(0,"#061d2c"); grad.addColorStop(.5,"#071522"); grad.addColorStop(1,"#1b0c18");
    ctx.fillStyle = grad; ctx.fillRect(0,0,state.width,state.height);

    ctx.strokeStyle = "rgba(120,180,210,.12)"; ctx.lineWidth = 2;
    ctx.strokeRect(14,14,state.width-28,state.height-28);
    ctx.setLineDash([12,14]); ctx.strokeStyle = "rgba(150,200,220,.16)"; ctx.beginPath(); ctx.moveTo(state.width/2,20); ctx.lineTo(state.width/2,state.height-20); ctx.stroke(); ctx.setLineDash([]);

    // Vẽ 4 lò xo: 2 ở hai đầu và 2 ở chính giữa vạch sân.
    springs.forEach((spring, index) => {
      const active = spring.cooldown > 0;
      ctx.save();
      ctx.translate(spring.x, spring.y);
      ctx.rotate(index % 2 === 0 ? 0 : Math.PI);
      ctx.strokeStyle = active ? "#ffffff" : "#ffc857";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.shadowBlur = active ? 24 : 10;
      ctx.shadowColor = active ? "#ffffff" : "#ffb52e";
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      for (let i = 0; i < 4; i++) {
        const x = -15 + i * 8;
        const y = i % 2 === 0 ? -9 : 9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.fillStyle = active ? "#fff" : "#ffd86a";
      ctx.beginPath(); ctx.arc(18, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    ctx.fillStyle = "rgba(80,205,255,.06)"; ctx.fillRect(0,0,state.width/2,state.height);
    ctx.fillStyle = "rgba(255,80,110,.035)"; ctx.fillRect(state.width/2,0,state.width/2,state.height);

    const lg = ctx.createLinearGradient(left.x,0,left.x+left.w,0); lg.addColorStop(0,"#44cfff"); lg.addColorStop(1,"#87e8ff");
    ctx.fillStyle = lg; roundedRect(left.x,left.y,left.w,left.h,7); ctx.fill();
    const rg = ctx.createLinearGradient(right.x,0,right.x+right.w,0); rg.addColorStop(0,"#ff8a9b"); rg.addColorStop(1,"#ff5570");
    ctx.fillStyle = rg; roundedRect(right.x,right.y,right.w,right.h,7); ctx.fill();

    ctx.shadowBlur = 18; ctx.shadowColor = "rgba(255,255,255,.8)"; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;

    if (state.running && state.serveTimer > 0) {
      ctx.fillStyle="rgba(220,240,250,.65)"; ctx.font="700 18px system-ui"; ctx.textAlign="center"; ctx.fillText("READY",state.width/2,state.height/2+65);
    }
  }

  function loop(time) {
    const dt = Math.min(0.032, Math.max(0, (time - state.lastTime) / 1000 || 0));
    state.lastTime = time;
    update(dt);
    draw();
    state.animation = requestAnimationFrame(loop);
  }

  function pointerY(event) {
    const rect = canvas.getBoundingClientRect();
    return clamp((event.clientY - rect.top) / rect.height * state.height, 0, state.height);
  }

  function pointerDown(event) {
    if (!state.running || state.paused) return;
    event.preventDefault();
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    const x = event.clientX - canvas.getBoundingClientRect().left;
    const leftHalf = x < canvas.getBoundingClientRect().width / 2;
    if (state.mode === "ai") {
      if (leftHalf) state.touch.left = pointerY(event);
    } else if (leftHalf) state.touch.left = pointerY(event);
    else state.touch.right = pointerY(event);
  }

  function pointerMove(event) {
    if (!state.running || state.paused) return;
    if (event.buttons === 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const leftHalf = x < rect.width / 2;
    if (state.mode === "ai") { if (leftHalf) state.touch.left = pointerY(event); }
    else if (leftHalf) state.touch.left = pointerY(event); else state.touch.right = pointerY(event);
  }

  function pointerUp(event) {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (state.mode === "ai") state.touch.left = null;
    else if (x < rect.width / 2) state.touch.left = null;
    else state.touch.right = null;
  }

  async function requestLandscape() {
    if (!isMobile()) return;
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {}
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock("landscape");
    } catch {}
    updateRotatePanel();
  }

  function updateRotatePanel() {
    const portrait = isMobile() && window.matchMedia("(orientation: portrait)").matches;
    rotatePanel.style.display = portrait ? "flex" : "none";
  }

  function goMenu() { showPongMenu(); }
  function goTienHub() { window.location.href = "../../index.html"; }

  modeButtons.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  startBtn.addEventListener("click", async () => { await requestLandscape(); resetGame(); });
  pauseBtn.addEventListener("click", togglePause);
  resumeBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", resetGame);
  againBtn.addEventListener("click", resetGame);
  menuBtn.addEventListener("click", goMenu);
  resultMenuBtn.addEventListener("click", goMenu);
  backBtn.addEventListener("click", event => {
    if (state.running || state.gameOver || state.paused) {
      event.preventDefault();
      goMenu();
    }
  });
  document.getElementById("hubMenuBtn").addEventListener("click", goTienHub);

  window.addEventListener("keydown", event => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyW","KeyS","KeyA","KeyD","Space"].includes(event.code)) event.preventDefault();
    state.keys.add(event.code);
    if (event.code === "Escape") togglePause();
  });
  window.addEventListener("keyup", event => state.keys.delete(event.code));
  canvas.addEventListener("pointerdown", pointerDown, { passive:false });
  canvas.addEventListener("pointermove", pointerMove, { passive:false });
  canvas.addEventListener("pointerup", pointerUp, { passive:false });
  canvas.addEventListener("pointercancel", pointerUp, { passive:false });
  window.addEventListener("resize", () => { resize(); updateRotatePanel(); });
  if (screen.orientation) screen.orientation.addEventListener("change", updateRotatePanel);

  setMode("ai");
  resize();
  updateRotatePanel();
  state.animation = requestAnimationFrame(loop);
})();
