type BreakoutState = "closed" | "menu" | "options" | "running" | "dead";
type PowerType = "paddle" | "multi" | "life";

type Brick = { x: number; y: number; width: number; height: number; health: number; maxHealth: number; power?: PowerType };
type Ball = { x: number; y: number; vx: number; vy: number; radius: number; speed: number; hits: number };
type Drop = { x: number; y: number; vy: number; type: PowerType };
type Progress = { currentLevel: number; highestLevel: number };

const WIDTH = 960;
const HEIGHT = 540;
const STORAGE_KEY = "badant-breakout-progress-v1";
const colors = ["#55e6ff", "#8d7aff", "#ff62c8", "#ffbd5a", "#8dff72", "#56a8ff"];

function el<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing Tile Breaker element ${selector}`);
  return node;
}

function readProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const currentLevel = Number.isFinite(raw.currentLevel) ? Math.max(1, Math.floor(raw.currentLevel)) : 1;
    const highestLevel = Number.isFinite(raw.highestLevel) ? Math.max(currentLevel, Math.floor(raw.highestLevel)) : currentLevel;
    return { currentLevel, highestLevel };
  } catch {
    return { currentLevel: 1, highestLevel: 1 };
  }
}

function saveProgress(progress: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function seeded(level: number) {
  let value = (level * 0x9e3779b9) >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 10000) / 10000;
  };
}

function formatPower(type: PowerType) {
  return type === "paddle" ? "W" : type === "multi" ? "x" : "+";
}

function powerColor(type: PowerType) {
  return type === "paddle" ? "#ffbd5a" : type === "multi" ? "#55e6ff" : "#8dff72";
}

export function initBreakout() {
  const gameCanvas = el<HTMLCanvasElement>("#game");
  const canvas = el<HTMLCanvasElement>("#breakout-canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tile Breaker canvas is unavailable");
  const ctx = context;
  const platform = el<HTMLElement>("#platform-panel");
  const overlay = el<HTMLElement>("#overlay");
  const homeButton = el<HTMLButtonElement>("#home");
  const menu = el<HTMLElement>("#breakout-menu-panel");
  const options = el<HTMLElement>("#breakout-options-panel");
  const dead = el<HTMLElement>("#breakout-dead-panel");
  const menuLevel = el<HTMLElement>("#breakout-menu-level");
  const menuHighest = el<HTMLElement>("#breakout-menu-highest");
  const tileLevel = el<HTMLElement>("#breakout-tile-level");
  const progressCopy = el<HTMLElement>("#breakout-progress-copy");
  const deadTitle = el<HTMLElement>("#breakout-dead-title");
  const deadMessage = el<HTMLElement>("#breakout-dead-message");
  const state = { value: "closed" as BreakoutState, level: 1, lives: 3, score: 0, paddleX: WIDTH / 2, targetPaddleX: WIDTH / 2, paddleBoost: 0, paddleLevel: 1, balls: [] as Ball[], bricks: [] as Brick[], drops: [] as Drop[], lastTime: 0, raf: 0, levelPause: 0, keys: new Set<string>(), progress: readProgress() };
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  function setPanels(next: BreakoutState) {
    state.value = next;
    if (next === "closed") {
      canvas.hidden = true;
      gameCanvas.hidden = false;
      menu.hidden = true;
      options.hidden = true;
      dead.hidden = true;
      overlay.hidden = false;
      overlay.classList.add("is-platform");
      overlay.classList.remove("is-breakout");
      platform.hidden = false;
      homeButton.hidden = true;
      return;
    }
    overlay.hidden = next === "running";
    overlay.classList.remove("is-platform");
    overlay.classList.add("is-breakout");
    platform.hidden = true;
    menu.hidden = next !== "menu";
    options.hidden = next !== "options";
    dead.hidden = next !== "dead";
    gameCanvas.hidden = true;
    homeButton.hidden = false;
    canvas.hidden = false;
    drawBackdrop();
    if (next === "menu") {
      menuLevel.textContent = `${state.progress.currentLevel}`;
      menuHighest.textContent = `${state.progress.highestLevel}`;
      tileLevel.textContent = `${state.progress.highestLevel}`;
      progressCopy.textContent = state.progress.currentLevel > 1 ? `Resume at level ${state.progress.currentLevel}. Break the wall.` : "Break the wall. Keep the ball alive.";
    }
    if (next === "running") canvas.focus();
  }

  function open() {
    state.progress = readProgress();
    setPanels("menu");
  }

  function close() {
    cancelAnimationFrame(state.raf);
    state.value = "closed";
    canvas.hidden = true;
    gameCanvas.hidden = false;
    menu.hidden = true;
    options.hidden = true;
    dead.hidden = true;
    overlay.hidden = false;
    overlay.classList.add("is-platform");
    overlay.classList.remove("is-breakout");
    platform.hidden = false;
    homeButton.hidden = true;
  }

  function levelHealth(level: number, random: () => number) {
    if (level === 1) return 1;
    return Math.min(12, 1 + Math.floor((level - 1) / 3) + (random() > 0.62 ? 1 : 0));
  }

  function paddleWidth() {
    if (state.paddleBoost <= 0) return 124;
    return [124, 154, 184][state.paddleLevel - 1] ?? 124;
  }

  function paddleTopAt(x: number) {
    const offset = Math.max(-1, Math.min(1, (x - state.paddleX) / (paddleWidth() / 2)));
    return 492 - 3 * (1 - offset * offset);
  }

  function buildLevel(level: number) {
    const random = seeded(level);
    const cols = Math.min(13, 10 + Math.floor(level / 6));
    const rows = Math.min(10, 4 + Math.floor((level - 1) / 2));
    const gap = 6;
    const margin = 56;
    const brickWidth = (WIDTH - margin * 2 - gap * (cols - 1)) / cols;
    const brickHeight = 22;
    const pattern = level % 5;
    const bricks: Brick[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const checker = (row + col) % 2 === 0;
        const diamond = Math.abs(col - (cols - 1) / 2) + Math.abs(row - (rows - 1) / 2) <= rows;
        const zigzag = (row % 2 === 0 ? col % 4 !== 0 : col % 4 !== 2);
        const column = col % 3 !== 1 || row % 3 === 0;
        const present = pattern === 0 ? true : pattern === 1 ? checker || row < 2 : pattern === 2 ? diamond : pattern === 3 ? zigzag : column;
        if (!present) continue;
        const health = levelHealth(level, random);
        const power = random() < Math.min(0.16, 0.08 + level * 0.006) ? (["paddle", "multi", "life"] as PowerType[])[Math.floor(random() * 3)] : undefined;
        bricks.push({ x: margin + col * (brickWidth + gap), y: 70 + row * (brickHeight + gap), width: brickWidth, height: brickHeight, health, maxHealth: health, power });
      }
    }
    return bricks;
  }

  function serveBall() {
    const speed = 310;
    const vx = (Math.random() - 0.5) * 190;
    state.balls = [{ x: state.paddleX, y: 462, vx, vy: -Math.sqrt(speed * speed - vx * vx), radius: 8, speed, hits: 0 }];
  }

  function startLevel(level: number, resetLives = false) {
    state.level = level;
    if (resetLives) state.lives = 3;
    state.paddleX = WIDTH / 2;
    state.targetPaddleX = WIDTH / 2;
    state.paddleBoost = 0;
    state.paddleLevel = 1;
    state.bricks = buildLevel(level);
    state.drops = [];
    serveBall();
    state.levelPause = 0.65;
    state.lastTime = performance.now();
    setPanels("running");
    state.raf = requestAnimationFrame(frame);
  }

  function start() {
    state.progress = readProgress();
    state.score = 0;
    startLevel(state.progress.currentLevel, true);
  }

  function postHighest() {
    void fetch("/api/breakout-high-scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Anonymous pilot", score: state.progress.highestLevel }) }).catch(() => undefined);
  }

  function endGame() {
    cancelAnimationFrame(state.raf);
    state.value = "dead";
    canvas.hidden = true;
    dead.hidden = false;
    deadTitle.textContent = `Level ${state.level} complete`; 
    deadMessage.textContent = `You reached level ${state.level}. Your highest level is ${state.progress.highestLevel}.`;
    overlay.hidden = false;
    postHighest();
  }

  function loseBall() {
    state.balls = [];
    state.lives -= 1;
    if (state.lives <= 0) {
      deadTitle.textContent = "Game over";
      deadMessage.textContent = `The wall wins this round. You reached level ${state.level}.`;
      endGame();
      return;
    }
    serveBall();
    state.levelPause = 0.9;
  }

  function applyPower(type: PowerType) {
    if (type === "paddle") {
      state.paddleLevel = Math.min(3, state.paddleLevel + 1);
      state.paddleBoost = 12;
    }
    if (type === "multi") {
      const source = state.balls[0] || { x: state.paddleX, y: 450, vx: 160, vy: -300, radius: 8, speed: 340, hits: 0 };
      while (state.balls.length < 3) {
        const angle = Math.atan2(source.vy, -source.vx + state.balls.length * 55);
        state.balls.push({ x: source.x, y: source.y, vx: Math.cos(angle) * source.speed, vy: Math.sin(angle) * source.speed, radius: 8, speed: source.speed, hits: source.hits });
      }
    }
    if (type === "life") state.lives = Math.min(5, state.lives + 1);
  }

  function intersects(ball: Ball, brick: Brick) {
    return ball.x + ball.radius > brick.x && ball.x - ball.radius < brick.x + brick.width && ball.y + ball.radius > brick.y && ball.y - ball.radius < brick.y + brick.height;
  }

  function accelerateBall(ball: Ball) {
    ball.hits += 1;
    ball.speed = Math.min(1000, 310 + ball.hits * 0.69);
    const direction = Math.atan2(ball.vy, ball.vx);
    ball.vx = Math.cos(direction) * ball.speed;
    ball.vy = Math.sin(direction) * ball.speed;
  }

  function update(dt: number) {
    const paddleWidthValue = paddleWidth();
    const paddleSpeed = 580;
    if (state.keys.has("ArrowLeft")) state.targetPaddleX -= paddleSpeed * dt;
    if (state.keys.has("ArrowRight")) state.targetPaddleX += paddleSpeed * dt;
    state.targetPaddleX = Math.max(paddleWidthValue / 2 + 20, Math.min(WIDTH - paddleWidthValue / 2 - 20, state.targetPaddleX));
    state.paddleX += (state.targetPaddleX - state.paddleX) * Math.min(1, dt * 18);
    state.paddleBoost = Math.max(0, state.paddleBoost - dt);
    if (state.paddleBoost === 0) state.paddleLevel = 1;
    if (state.levelPause > 0) { state.levelPause -= dt; return; }
    for (const ball of state.balls) {
      const steps = Math.min(8, Math.max(1, Math.ceil((ball.speed * dt) / 7)));
      const stepDt = dt / steps;
      for (let step = 0; step < steps; step += 1) {
      const previousX = ball.x;
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;
      if (ball.x < ball.radius + 18) { ball.x = ball.radius + 18; ball.vx = Math.abs(ball.vx); }
      if (ball.x > WIDTH - ball.radius - 18) { ball.x = WIDTH - ball.radius - 18; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.radius + 46) { ball.y = ball.radius + 46; ball.vy = Math.abs(ball.vy); }
      const pw = paddleWidth();
      const py = 492;
      const paddleTop = paddleTopAt(ball.x);
      if (ball.vy > 0 && ball.y + ball.radius >= paddleTop - 2 && ball.y - ball.radius <= py + 14 && Math.abs(ball.x - state.paddleX) <= pw / 2 + ball.radius) {
        const offset = (ball.x - state.paddleX) / (pw / 2);
        const speed = Math.min(1000, Math.max(310, ball.speed));
        ball.vx = offset * Math.min(420, speed * 0.78);
        ball.vy = -Math.sqrt(Math.max(120 * 120, speed * speed - ball.vx * ball.vx));
        ball.y = paddleTop - ball.radius - 1;
      }
      for (const brick of state.bricks) {
        if (!intersects(ball, brick)) continue;
        accelerateBall(ball);
        brick.health -= 1;
        const hitFromSide = previousX < brick.x || previousX > brick.x + brick.width;
        if (hitFromSide) ball.vx *= -1; else ball.vy *= -1;
        if (brick.health <= 0) {
          if (brick.power) state.drops.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, vy: 105, type: brick.power });
          state.bricks.splice(state.bricks.indexOf(brick), 1);
          state.score += 10 * brick.maxHealth;
        }
        break;
      }
      }
    }
    state.balls = state.balls.filter((ball) => ball.y < HEIGHT + 18);
    for (const drop of state.drops) {
      drop.y += drop.vy * dt;
      const pw = paddleWidth();
      if (drop.y > 478 && drop.y < 520 && Math.abs(drop.x - state.paddleX) < pw / 2 + 12) { applyPower(drop.type); drop.y = HEIGHT + 40; }
    }
    state.drops = state.drops.filter((drop) => drop.y < HEIGHT + 30);
    if (state.balls.length === 0) loseBall();
    if (state.bricks.length === 0) {
      state.progress.currentLevel = state.level + 1;
      state.progress.highestLevel = Math.max(state.progress.highestLevel, state.level + 1);
      saveProgress(state.progress);
      tileLevel.textContent = `${state.progress.highestLevel}`;
      postHighest();
      startLevel(state.level + 1);
    }
  }

  function drawBackdrop() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#0b1230"); gradient.addColorStop(1, "#100b27");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "rgba(86, 227, 255, .08)";
    for (let i = 0; i < 24; i += 1) { const x = (i * 127) % WIDTH; const y = 45 + ((i * 73) % 430); ctx.fillRect(x, y, 2, 2); }
  }

  function draw() {
    drawBackdrop();
    ctx.fillStyle = "#eaf7ff"; ctx.font = "700 16px Space Grotesk, sans-serif";
    ctx.fillText(`LEVEL ${state.level}`, 26, 28); ctx.fillText(`LIVES ${"*".repeat(Math.max(0, state.lives))}`, 150, 28); ctx.fillText(`BALLS ${state.balls.length}`, 330, 28); ctx.fillText(`SCORE ${state.score}`, 450, 28); ctx.fillText(`SPD ${Math.round(state.balls[0]?.speed ?? 0)}`, 575, 28);
    if (state.paddleBoost > 0) { ctx.fillStyle = "#ffbd5a"; ctx.fillText(`WIDE ${state.paddleLevel}/3 ${Math.ceil(state.paddleBoost)}s`, 640, 28); }
    for (const brick of state.bricks) {
      const color = colors[Math.min(colors.length - 1, brick.maxHealth - 1)];
      ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.fillStyle = color; ctx.globalAlpha = 0.28 + brick.health / (brick.maxHealth * 1.8); ctx.fillRect(brick.x, brick.y, brick.width, brick.height); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.strokeStyle = color; ctx.strokeRect(brick.x + .5, brick.y + .5, brick.width - 1, brick.height - 1);
      ctx.fillStyle = "#06101f"; ctx.font = "700 13px Space Grotesk, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`${brick.health}`, brick.x + brick.width / 2, brick.y + 16); ctx.textAlign = "left";
      if (brick.power) {
        const badgeColor = powerColor(brick.power);
        const pulse = 0.45 + Math.sin(performance.now() / 180) * 0.25;
        ctx.globalAlpha = pulse; ctx.strokeStyle = badgeColor; ctx.lineWidth = 2.5; ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.width - 3, brick.height - 3); ctx.globalAlpha = 1;
        ctx.fillStyle = badgeColor; ctx.beginPath(); ctx.roundRect(brick.x + brick.width - 21, brick.y + 3, 17, 16, 4); ctx.fill();
        ctx.fillStyle = "#06101f"; ctx.font = "700 11px Space Grotesk, sans-serif"; ctx.textAlign = "center"; ctx.fillText(formatPower(brick.power), brick.x + brick.width - 12.5, brick.y + 15); ctx.textAlign = "left";
      }
    }
    for (const drop of state.drops) { ctx.fillStyle = drop.type === "paddle" ? "#ffbd5a" : drop.type === "multi" ? "#55e6ff" : "#8dff72"; ctx.shadowBlur = 12; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.roundRect(drop.x - 14, drop.y - 10, 28, 20, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = "#091225"; ctx.font = "700 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText(formatPower(drop.type), drop.x, drop.y + 5); ctx.textAlign = "left"; }
    const pw = paddleWidth(); const left = state.paddleX - pw / 2; const right = state.paddleX + pw / 2; const paddleGradient = ctx.createLinearGradient(left, 0, right, 0); paddleGradient.addColorStop(0, "#d7d3ff"); paddleGradient.addColorStop(0.5, "#ffffff"); paddleGradient.addColorStop(1, "#d7d3ff"); ctx.fillStyle = paddleGradient; ctx.shadowBlur = 22; ctx.shadowColor = "#9d7cff"; ctx.beginPath(); ctx.moveTo(left, 501); ctx.quadraticCurveTo(state.paddleX, 489, right, 501); ctx.lineTo(right, 503); ctx.quadraticCurveTo(state.paddleX, 508, left, 503); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    for (const ball of state.balls) { ctx.fillStyle = "#ffffff"; ctx.shadowBlur = 18; ctx.shadowColor = "#55e6ff"; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }
    ctx.fillStyle = "rgba(234,247,255,.64)"; ctx.font = "600 11px Space Grotesk, sans-serif"; ctx.fillText("W  wide paddle    x  multi-ball    +  extra life", 26, 530);
  }

  function frame(time: number) {
    if (state.value !== "running") return;
    const dt = Math.min(0.033, Math.max(0.001, (time - state.lastTime) / 1000)); state.lastTime = time;
    update(dt); draw(); state.raf = requestAnimationFrame(frame);
  }

  function prepareReport() { cancelAnimationFrame(state.raf); canvas.hidden = true; gameCanvas.hidden = false; menu.hidden = true; options.hidden = true; dead.hidden = true; }
  function restoreAfterReport() { setPanels("options"); }

  el<HTMLButtonElement>("#select-breakout").addEventListener("click", open);
  el<HTMLButtonElement>("#breakout-start").addEventListener("click", start);
  el<HTMLButtonElement>("#breakout-options").addEventListener("click", () => setPanels("options"));
  el<HTMLButtonElement>("#breakout-options-back").addEventListener("click", () => setPanels("menu"));
  el<HTMLButtonElement>("#breakout-menu-back").addEventListener("click", close);
  el<HTMLButtonElement>("#breakout-restart").addEventListener("click", () => startLevel(state.level, true));
  el<HTMLButtonElement>("#breakout-dead-back").addEventListener("click", close);
  el<HTMLButtonElement>("#breakout-report-issue").addEventListener("click", () => window.dispatchEvent(new CustomEvent("breakout-report-issue")));
  homeButton.addEventListener("click", (event) => { if (state.value !== "closed") { event.stopImmediatePropagation(); close(); } });
  canvas.addEventListener("pointermove", (event) => { const rect = canvas.getBoundingClientRect(); state.targetPaddleX = ((event.clientX - rect.left) / rect.width) * WIDTH; });
  window.addEventListener("keydown", (event) => { if (state.value === "closed") return; if (["ArrowLeft", "ArrowRight"].includes(event.key)) { state.keys.add(event.key); event.preventDefault(); } if (event.key === "Escape" && state.value === "running") setPanels("options"); });
  window.addEventListener("keyup", (event) => state.keys.delete(event.key));
  window.addEventListener("breakout-open", open);
  window.addEventListener("breakout-prepare-report", prepareReport);
  window.addEventListener("breakout-restore-report", restoreAfterReport);
  setPanels("closed");
  return { isOpen: () => state.value !== "closed", prepareReport, restoreAfterReport, close };
}
