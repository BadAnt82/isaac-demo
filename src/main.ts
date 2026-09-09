import "./styles.css";

type GameState = "ready" | "running" | "ended";

type Obstacle = {
  x: number;
  gapY: number;
  gapHeight: number;
  scored: boolean;
  image: HTMLImageElement;
};

type Bubble = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  scored: boolean;
};

function requireElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function requireCanvasContext(element: HTMLCanvasElement) {
  const context = element.getContext("2d");
  if (!context) {
    throw new Error("Canvas rendering is not available.");
  }
  return context;
}

const canvas = requireElement<HTMLCanvasElement>("#game");
const scoreEl = requireElement<HTMLElement>("#score");
const localHighEl = requireElement<HTMLElement>("#local-high");
const todayHighEl = requireElement<HTMLElement>("#today-high");
const serverHighEl = requireElement<HTMLElement>("#server-high");
const restartButton = requireElement<HTMLButtonElement>("#restart");
const startButton = requireElement<HTMLButtonElement>("#start");
const fullscreenButton = requireElement<HTMLButtonElement>("#fullscreen");
const rollButton = requireElement<HTMLElement>("#roll");
const gameFrame = requireElement<HTMLElement>(".game-frame");
const overlay = requireElement<HTMLElement>("#overlay");
const ctx = requireCanvasContext(canvas);

const artUrls = [
  "/assets/girl-with-pearl-earring.jpg",
  "/assets/mona-lisa.jpg",
  "/assets/lady-with-ermine.jpg",
];

const artImages = artUrls.map((src) => {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
});

const plane = {
  x: 150,
  y: 260,
  radius: 24,
  velocity: 0,
  rotation: 0,
};

const enemyPlane = {
  x: 820,
  y: 210,
  bob: 0,
};

let state: GameState = "ready";
let width = 960;
let height = 540;
let dpr = 1;
let renderScale = 1;
let renderOffsetX = 0;
let renderOffsetY = 0;
let lastTime = 0;
let spawnTimer = 0;
let bubbleTimer = 0;
let score = 0;
let obstacles: Obstacle[] = [];
let bubbles: Bubble[] = [];
let compactPlayfield = false;
let rollTimer = 0;
let localHighest = 0;
let todayHighest = 0;
let serverHighest = 0;

const mobileBreakpoint = 700;
const localHighScoreKey = "isaac-demo-high-score";
const obstacleWidth = 96;
const obstacleSpeed = 250;
const spawnEvery = 1.42;
const bubbleEvery = 1.08;
const bubbleSpeed = 320;
const groundHeight = 46;
const rollDuration = 0.72;
const rollPointCost = 2;
const compactGroundHeight = 34;
const compactWorldWidth = 960;
const compactWorldHeight = 540;
const compactObstacleWidth = 58;
const compactObstacleSpeed = 168;
const compactSpawnEvery = 1.62;
const compactBubbleSpeed = 168;
const compactGapHeight = 190;
const compactMargin = 54;
const compactPlaneRadius = 18;
const compactGravity = 820;
const compactLift = -360;
const obstacleEdgeOverflow = 72;

type FullscreenFrame = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function resize() {
  const box = canvas.getBoundingClientRect();
  compactPlayfield =
    window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches ||
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const cssWidth = Math.max(320, Math.floor(box.width));
  const cssHeight = compactPlayfield ? Math.max(1, Math.floor(box.height)) : Math.max(360, Math.floor(box.height));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = compactPlayfield ? compactWorldWidth : cssWidth;
  height = compactPlayfield ? compactWorldHeight : cssHeight;
  renderScale = compactPlayfield ? Math.min(cssWidth / width, cssHeight / height) : 1;
  renderOffsetX = compactPlayfield ? (cssWidth - width * renderScale) / 2 : 0;
  renderOffsetY = compactPlayfield ? (cssHeight - height * renderScale) / 2 : 0;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(
    dpr * renderScale,
    0,
    0,
    dpr * renderScale,
    dpr * renderOffsetX,
    dpr * renderOffsetY,
  );
  plane.radius = getPlaneRadius();
  plane.x = getPlayerX();
  enemyPlane.x = getEnemyX();
  if (state === "ready") {
    plane.y = height * 0.48;
    enemyPlane.y = height * 0.36;
  }
  updateFullscreenButton();
}

function getObstacleWidth() {
  return compactPlayfield ? compactObstacleWidth : obstacleWidth;
}

function getObstacleSpeed() {
  return compactPlayfield ? compactObstacleSpeed : obstacleSpeed;
}

function getSpawnEvery() {
  return compactPlayfield ? compactSpawnEvery : spawnEvery;
}

function getPlaneScale() {
  return compactPlayfield ? 0.72 : 1;
}

function getPlaneRadius() {
  return compactPlayfield ? compactPlaneRadius : 24;
}

function getPlayerX() {
  return compactPlayfield ? 82 : Math.max(92, Math.min(156, width * 0.18));
}

function getEnemyX() {
  return compactPlayfield
    ? width - 86
    : width - Math.max(86, Math.min(138, width * 0.12));
}

function getGravity() {
  return compactPlayfield ? compactGravity : 1480;
}

function getLift() {
  return compactPlayfield ? compactLift : -475;
}

function getBubbleEvery() {
  return compactPlayfield ? 1.55 : bubbleEvery;
}

function getBubbleSpeed() {
  return compactPlayfield ? compactBubbleSpeed : bubbleSpeed;
}

function getBubbleRadius() {
  return compactPlayfield ? 12 + Math.random() * 3 : 14 + Math.random() * 6;
}

function getGroundHeight() {
  return compactPlayfield ? compactGroundHeight : groundHeight;
}

function drawViewportBackground(canvasWidth: number, canvasHeight: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  wall.addColorStop(0, "#cdbf9f");
  wall.addColorStop(0.62, "#eee6d2");
  wall.addColorStop(1, "#a99066");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function readLocalHighest() {
  const storedScore = Number(localStorage.getItem(localHighScoreKey) || 0);
  localHighest = Number.isFinite(storedScore) ? storedScore : 0;
}

function writeLocalHighest(nextScore: number) {
  localHighest = Math.max(localHighest, nextScore);
  localStorage.setItem(localHighScoreKey, `${localHighest}`);
}

function renderHighScores() {
  localHighEl.textContent = formatScore(localHighest);
  todayHighEl.textContent = formatScore(todayHighest);
  serverHighEl.textContent = formatScore(serverHighest);
}

async function loadServerHighScores() {
  try {
    const response = await fetch("/api/high-scores", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const scores = await response.json();
    todayHighest = Number(scores.todayHighest) || 0;
    serverHighest = Number(scores.allTimeHighest) || 0;
    renderHighScores();
  } catch {
    // The game should still work offline or from a static dev server.
  }
}

async function submitServerHighScore(finalScore: number) {
  try {
    const response = await fetch("/api/high-scores", {
      body: JSON.stringify({ score: finalScore }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return;
    }

    const scores = await response.json();
    todayHighest = Number(scores.todayHighest) || todayHighest;
    serverHighest = Number(scores.allTimeHighest) || serverHighest;
    renderHighScores();
  } catch {
    // Ignore score sync failures; the local score still persists.
  }
}

function addScore(points: number) {
  score += points;
  scoreEl.textContent = formatScore(score);
}

function updateRollButton() {
  const ready = state === "running" && score >= rollPointCost && rollTimer <= 0;
  rollButton.classList.toggle("is-disabled", !ready);
  rollButton.setAttribute("aria-disabled", `${!ready}`);
  rollButton.textContent = "roll -2";
}

function reset(nextState: GameState) {
  readLocalHighest();
  renderHighScores();
  score = 0;
  obstacles = [];
  bubbles = [];
  spawnTimer = 0.45;
  bubbleTimer = compactPlayfield ? 1.45 : 1;
  rollTimer = 0;
  plane.y = height * 0.48;
  plane.velocity = 0;
  plane.rotation = 0;
  enemyPlane.y = height * 0.36;
  enemyPlane.bob = 0;
  state = nextState;
  scoreEl.textContent = formatScore(score);
  restartButton.hidden = nextState !== "ended";
  overlay.hidden = nextState !== "ready";
  updateRollButton();
}

function flap() {
  if (state === "ready") {
    reset("running");
    overlay.hidden = true;
  }

  if (state === "running") {
    plane.velocity = getLift();
  }
}

function spawnObstacle() {
  const playableHeight = height - getGroundHeight();
  const gapHeight = compactPlayfield ? compactGapHeight : Math.max(150, Math.min(210, height * 0.34));
  const margin = compactPlayfield ? compactMargin : 82;
  const gapY = margin + Math.random() * (playableHeight - gapHeight - margin * 2);
  const image = artImages[Math.floor(Math.random() * artImages.length)];
  obstacles.push({
    x: width + 40,
    gapY,
    gapHeight,
    image,
    scored: false,
  });
}

function drawBackground(time: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, height);
  wall.addColorStop(0, "#cdbf9f");
  wall.addColorStop(0.52, "#f0e7d1");
  wall.addColorStop(1, "#d1bd91");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = "#b59f76";
  ctx.lineWidth = 2;
  for (let x = 88; x < width; x += 176) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#ffffff";
  for (let x = 132 - ((time * 8) % 176); x < width + 176; x += 176) {
    ctx.fillRect(x, 48, 54, 8);
    ctx.beginPath();
    ctx.moveTo(x + 6, 56);
    ctx.lineTo(x - 18, 118);
    ctx.moveTo(x + 48, 56);
    ctx.lineTo(x + 72, 118);
    ctx.strokeStyle = "#7e6a48";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  const groundHeight = getGroundHeight();
  const groundY = height - groundHeight;
  ctx.fillStyle = "#6b5840";
  ctx.fillRect(0, groundY, width, groundHeight);
  ctx.fillStyle = "#b79d6a";
  ctx.fillRect(0, groundY, width, 10);
  ctx.fillStyle = "#4b3a2a";
  ctx.fillRect(0, groundY + 10, width, groundHeight);
}

function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawImageCover(image: HTMLImageElement, x: number, y: number, w: number, h: number) {
  if (!image.complete || image.naturalWidth === 0) {
    ctx.fillStyle = "#efe2c7";
    ctx.fillRect(x, y, w, h);
    return;
  }

  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawObstacle(obstacle: Obstacle) {
  const width = getObstacleWidth();
  const topHeight = obstacle.gapY;
  const bottomY = obstacle.gapY + obstacle.gapHeight;
  const bottomHeight = height - getGroundHeight() - bottomY;

  drawObstacleSegment(
    obstacle.x,
    -obstacleEdgeOverflow,
    width,
    topHeight + obstacleEdgeOverflow,
    obstacle.image,
    true,
  );
  drawObstacleSegment(
    obstacle.x,
    bottomY,
    width,
    bottomHeight + getGroundHeight() + obstacleEdgeOverflow,
    obstacle.image,
    false,
  );
}

function drawObstacleSegment(
  x: number,
  y: number,
  w: number,
  h: number,
  image: HTMLImageElement,
  flip: boolean,
) {
  if (h <= 0) {
    return;
  }

  ctx.save();
  drawRoundedRect(x, y, w, h, 18);
  ctx.clip();

  if (flip) {
    ctx.translate(x + w, y + h);
    ctx.rotate(Math.PI);
    drawImageCover(image, 0, 0, w, h);
  } else {
    drawImageCover(image, x, y, w, h);
  }

  ctx.restore();

  ctx.save();
  drawRoundedRect(x, y, w, h, 18);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff4d1";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(75, 48, 25, 0.28)";
  ctx.stroke();
  ctx.restore();
}

function drawPlaneBody(
  x: number,
  y: number,
  rotation: number,
  bodyColor: string,
  wingColor: string,
  tailColor: string,
  cockpitColor: string,
  direction: 1 | -1,
  scale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction * scale, scale);
  ctx.rotate(rotation);

  ctx.fillStyle = "rgba(30, 38, 50, 0.18)";
  ctx.beginPath();
  ctx.ellipse(-2, 30, 38, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = "#7f5f00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = tailColor;
  ctx.beginPath();
  ctx.moveTo(-17, -11);
  ctx.lineTo(-44, -30);
  ctx.lineTo(-34, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(26, -34);
  ctx.lineTo(18, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = wingColor;
  ctx.beginPath();
  ctx.moveTo(-4, 9);
  ctx.lineTo(26, 31);
  ctx.lineTo(17, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = cockpitColor;
  ctx.beginPath();
  ctx.ellipse(14, -4, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#3a2b16";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(37, 0);
  ctx.lineTo(58, 0);
  ctx.stroke();

  ctx.strokeStyle = "rgba(58, 43, 22, 0.52)";
  ctx.lineWidth = 3;
  const propSpin = performance.now() / 95;
  ctx.save();
  ctx.translate(61, 0);
  ctx.rotate(propSpin);
  ctx.beginPath();
  ctx.moveTo(-1, -22);
  ctx.lineTo(1, 22);
  ctx.moveTo(-22, -1);
  ctx.lineTo(22, 1);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawPlane() {
  const rollProgress = rollTimer > 0 ? 1 - rollTimer / rollDuration : 0;
  const rollRotation = rollTimer > 0 ? Math.PI * 2 * rollProgress : 0;
  drawPlaneBody(
    plane.x,
    plane.y,
    plane.rotation + rollRotation,
    "#ffd232",
    "#ffe891",
    "#f4a51c",
    "#6fc8ff",
    1,
    getPlaneScale(),
  );
}

function drawEnemyPlane(time: number) {
  const wobble = Math.sin(time * 3.2) * 0.08;
  drawPlaneBody(enemyPlane.x, enemyPlane.y, wobble, "#2f80ed", "#9bd4ff", "#174e9a", "#d8f7ff", -1, getPlaneScale());
}

function drawBubbles() {
  bubbles.forEach((bubble) => {
    const shine = bubble.radius * 0.36;
    const gradient = ctx.createRadialGradient(
      bubble.x - shine,
      bubble.y - shine,
      1,
      bubble.x,
      bubble.y,
      bubble.radius,
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    gradient.addColorStop(0.42, "rgba(143, 225, 255, 0.55)");
    gradient.addColorStop(1, "rgba(43, 135, 230, 0.28)");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(28, 99, 185, 0.68)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.beginPath();
    ctx.arc(bubble.x - bubble.radius * 0.34, bubble.y - bubble.radius * 0.34, bubble.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function fireBubble() {
  bubbles.push({
    x: enemyPlane.x - 58 * getPlaneScale(),
    y: enemyPlane.y + 4,
    radius: getBubbleRadius(),
    speed: getBubbleSpeed() + Math.random() * 18,
    drift: compactPlayfield ? -24 + Math.random() * 48 : -35 + Math.random() * 70,
    scored: false,
  });
}

function roll() {
  if (state !== "running" || score < rollPointCost || rollTimer > 0) {
    return;
  }

  rollTimer = rollDuration;
  addScore(-rollPointCost);
  updateRollButton();
}

function collide() {
  const groundHeight = getGroundHeight();
  if (plane.y - plane.radius < 0 || plane.y + plane.radius > height - groundHeight) {
    return true;
  }

  const hitObstacle = obstacles.some((obstacle) => {
    const width = getObstacleWidth();
    const closestX = Math.max(obstacle.x, Math.min(plane.x, obstacle.x + width));
    const inTop = plane.y < obstacle.gapY;
    const inBottom = plane.y > obstacle.gapY + obstacle.gapHeight;
    if (!inTop && !inBottom) {
      return false;
    }
    const segmentY = inTop ? 0 : obstacle.gapY + obstacle.gapHeight;
    const segmentHeight = inTop ? obstacle.gapY : height - groundHeight - segmentY;
    const closestY = Math.max(segmentY, Math.min(plane.y, segmentY + segmentHeight));
    const dx = plane.x - closestX;
    const dy = plane.y - closestY;
    return dx * dx + dy * dy < plane.radius * plane.radius * 0.78;
  });

  if (hitObstacle) {
    return true;
  }

  if (rollTimer > 0) {
    return false;
  }

  return bubbles.some((bubble) => {
    const dx = plane.x - bubble.x;
    const dy = plane.y - bubble.y;
    const hitRadius = plane.radius * 0.82 + bubble.radius;
    return dx * dx + dy * dy < hitRadius * hitRadius;
  });
}

function endGame() {
  writeLocalHighest(score);
  todayHighest = Math.max(todayHighest, score);
  serverHighest = Math.max(serverHighest, score);
  renderHighScores();
  void submitServerHighScore(score);
  state = "ended";
  restartButton.hidden = false;
  overlay.hidden = false;
  overlay.querySelector("h1")!.textContent = "Flight Complete";
  overlay.querySelector("p")!.textContent = `Score ${score}. Ready for another pass?`;
  startButton.hidden = true;
}

function isFullscreen() {
  const fullscreenDocument = document as FullscreenDocument;
  return (
    document.fullscreenElement === gameFrame ||
    fullscreenDocument.webkitFullscreenElement === gameFrame ||
    gameFrame.classList.contains("fullscreen-fallback")
  );
}

function updateFullscreenButton() {
  const label = compactPlayfield
    ? isFullscreen()
      ? "Exit"
      : "Full"
    : isFullscreen()
      ? "Exit full screen"
      : "Full screen";
  fullscreenButton.textContent = label;
  fullscreenButton.setAttribute(
    "aria-label",
    isFullscreen() ? "Exit full screen mode" : "Enter full screen mode",
  );
}

async function toggleFullscreen() {
  const fullscreenFrame = gameFrame as FullscreenFrame;
  const fullscreenDocument = document as FullscreenDocument;

  if (isFullscreen()) {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) {
      await fullscreenDocument.webkitExitFullscreen();
    } else {
      gameFrame.classList.remove("fullscreen-fallback");
      document.body.classList.remove("fullscreen-fallback-active");
    }
  } else {
    if (document.fullscreenEnabled && gameFrame.requestFullscreen) {
      await gameFrame.requestFullscreen();
    } else if (fullscreenDocument.webkitFullscreenEnabled && fullscreenFrame.webkitRequestFullscreen) {
      await fullscreenFrame.webkitRequestFullscreen();
    } else {
      gameFrame.classList.add("fullscreen-fallback");
      document.body.classList.add("fullscreen-fallback-active");
    }
  }

  updateFullscreenButton();
  resize();
}

function update(dt: number) {
  if (state !== "running") {
    return;
  }

  rollTimer = Math.max(0, rollTimer - dt);

  plane.velocity += getGravity() * dt;
  plane.y += plane.velocity * dt;
  plane.rotation = Math.max(-0.42, Math.min(0.72, plane.velocity / 620));

  enemyPlane.bob += dt;
  const enemyTargetY = height * 0.34 + Math.sin(enemyPlane.bob * 1.7) * Math.min(96, height * 0.16);
  enemyPlane.y += (enemyTargetY - enemyPlane.y) * Math.min(1, dt * 3.2);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = getSpawnEvery();
  }

  bubbleTimer -= dt;
  if (bubbleTimer <= 0) {
    fireBubble();
    bubbleTimer = getBubbleEvery() + Math.random() * 0.38;
  }

  obstacles.forEach((obstacle) => {
    const width = getObstacleWidth();
    obstacle.x -= getObstacleSpeed() * dt;
    if (!obstacle.scored && obstacle.x + width < plane.x) {
      obstacle.scored = true;
      addScore(1);
      updateRollButton();
    }
  });
  obstacles = obstacles.filter((obstacle) => obstacle.x > -getObstacleWidth() - 10);

  bubbles.forEach((bubble) => {
    bubble.x -= bubble.speed * dt;
    bubble.y += bubble.drift * dt;
    if (!bubble.scored && bubble.x < plane.x) {
      bubble.scored = true;
      addScore(0.5);
      updateRollButton();
    }
  });
  bubbles = bubbles.filter((bubble) => bubble.x > -bubble.radius * 2);

  if (collide()) {
    endGame();
  }

  updateRollButton();
}

function render(time: number) {
  const canvasWidth = canvas.width / dpr;
  const canvasHeight = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawViewportBackground(canvasWidth, canvasHeight);
  ctx.setTransform(
    dpr * renderScale,
    0,
    0,
    dpr * renderScale,
    dpr * renderOffsetX,
    dpr * renderOffsetY,
  );
  drawBackground(time);
  obstacles.forEach(drawObstacle);
  drawBubbles();
  drawEnemyPlane(time);
  drawPlane();

  if (state === "ready") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(0, 0, width, height);
  }
}

function loop(now: number) {
  const time = now / 1000;
  const dt = Math.min(0.032, Math.max(0, time - lastTime || 0));
  lastTime = time;
  update(dt);
  render(time);
  requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    flap();
  }
  if (event.code === "KeyR" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
    event.preventDefault();
    roll();
  }
});
canvas.addEventListener("pointerdown", flap);
startButton.addEventListener("click", flap);
restartButton.addEventListener("click", () => {
  overlay.querySelector("h1")!.textContent = "Isaac Demo";
  overlay.querySelector("p")!.textContent = "Tap, click, or press Space to climb.";
  startButton.hidden = false;
  reset("ready");
});
fullscreenButton.addEventListener("click", () => {
  void toggleFullscreen();
});
rollButton.addEventListener("click", roll);
rollButton.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "Space") {
    event.preventDefault();
    roll();
  }
});
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  resize();
});

readLocalHighest();
renderHighScores();
void loadServerHighScores();
resize();
updateFullscreenButton();
reset("ready");
requestAnimationFrame(loop);
