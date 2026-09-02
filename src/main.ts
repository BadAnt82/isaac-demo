import "./styles.css";

type GameState = "ready" | "running" | "ended";

type Obstacle = {
  x: number;
  gapY: number;
  gapHeight: number;
  scored: boolean;
  image: HTMLImageElement;
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
const restartButton = requireElement<HTMLButtonElement>("#restart");
const startButton = requireElement<HTMLButtonElement>("#start");
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

let state: GameState = "ready";
let width = 960;
let height = 540;
let dpr = 1;
let lastTime = 0;
let spawnTimer = 0;
let score = 0;
let obstacles: Obstacle[] = [];

const gravity = 1480;
const lift = -475;
const obstacleWidth = 96;
const obstacleSpeed = 250;
const spawnEvery = 1.42;
const groundHeight = 46;

function resize() {
  const box = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, Math.floor(box.width));
  height = Math.max(360, Math.floor(box.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  plane.x = Math.max(92, Math.min(156, width * 0.18));
  if (state === "ready") {
    plane.y = height * 0.48;
  }
}

function reset(nextState: GameState) {
  score = 0;
  obstacles = [];
  spawnTimer = 0.45;
  plane.y = height * 0.48;
  plane.velocity = 0;
  plane.rotation = 0;
  state = nextState;
  scoreEl.textContent = "0";
  restartButton.hidden = nextState !== "ended";
  overlay.hidden = nextState !== "ready";
}

function flap() {
  if (state === "ready") {
    reset("running");
    overlay.hidden = true;
  }

  if (state === "running") {
    plane.velocity = lift;
  }
}

function spawnObstacle() {
  const playableHeight = height - groundHeight;
  const gapHeight = Math.max(150, Math.min(210, height * 0.34));
  const margin = 82;
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
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#76cdf4");
  sky.addColorStop(0.58, "#e1f6ff");
  sky.addColorStop(1, "#fff6da");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.38;
  drawCloud((width - ((time * 16) % (width + 220))) - 110, 88, 1.08);
  drawCloud((width - ((time * 10 + 270) % (width + 260))) - 130, 176, 0.78);
  drawCloud((width - ((time * 13 + 590) % (width + 240))) - 120, 124, 0.92);
  ctx.restore();

  const groundY = height - groundHeight;
  ctx.fillStyle = "#315c4d";
  ctx.fillRect(0, groundY, width, groundHeight);
  ctx.fillStyle = "#9fd36b";
  ctx.fillRect(0, groundY, width, 8);
}

function drawCloud(x: number, y: number, scale: number) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(x, y, 42 * scale, 20 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 34 * scale, y - 8 * scale, 36 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 76 * scale, y, 46 * scale, 22 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
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
  const topHeight = obstacle.gapY;
  const bottomY = obstacle.gapY + obstacle.gapHeight;
  const bottomHeight = height - groundHeight - bottomY;

  drawObstacleSegment(obstacle.x, 0, obstacleWidth, topHeight, obstacle.image, true);
  drawObstacleSegment(obstacle.x, bottomY, obstacleWidth, bottomHeight, obstacle.image, false);
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

function drawPlane() {
  ctx.save();
  ctx.translate(plane.x, plane.y);
  ctx.rotate(plane.rotation);

  ctx.fillStyle = "rgba(30, 38, 50, 0.18)";
  ctx.beginPath();
  ctx.ellipse(-2, 30, 38, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffd232";
  ctx.strokeStyle = "#7f5f00";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4a51c";
  ctx.beginPath();
  ctx.moveTo(-17, -11);
  ctx.lineTo(-44, -30);
  ctx.lineTo(-34, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffe891";
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.lineTo(26, -34);
  ctx.lineTo(18, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffe891";
  ctx.beginPath();
  ctx.moveTo(-4, 9);
  ctx.lineTo(26, 31);
  ctx.lineTo(17, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#6fc8ff";
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

function collide() {
  if (plane.y - plane.radius < 0 || plane.y + plane.radius > height - groundHeight) {
    return true;
  }

  return obstacles.some((obstacle) => {
    const closestX = Math.max(obstacle.x, Math.min(plane.x, obstacle.x + obstacleWidth));
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
}

function endGame() {
  state = "ended";
  restartButton.hidden = false;
  overlay.hidden = false;
  overlay.querySelector("h1")!.textContent = "Flight Complete";
  overlay.querySelector("p")!.textContent = `Score ${score}. Ready for another pass?`;
  startButton.hidden = true;
}

function update(dt: number) {
  if (state !== "running") {
    return;
  }

  plane.velocity += gravity * dt;
  plane.y += plane.velocity * dt;
  plane.rotation = Math.max(-0.42, Math.min(0.72, plane.velocity / 620));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = spawnEvery;
  }

  obstacles.forEach((obstacle) => {
    obstacle.x -= obstacleSpeed * dt;
    if (!obstacle.scored && obstacle.x + obstacleWidth < plane.x) {
      obstacle.scored = true;
      score += 1;
      scoreEl.textContent = `${score}`;
    }
  });
  obstacles = obstacles.filter((obstacle) => obstacle.x > -obstacleWidth - 10);

  if (collide()) {
    endGame();
  }
}

function render(time: number) {
  drawBackground(time);
  obstacles.forEach(drawObstacle);
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
});
canvas.addEventListener("pointerdown", flap);
startButton.addEventListener("click", flap);
restartButton.addEventListener("click", () => {
  overlay.querySelector("h1")!.textContent = "Isaac Demo";
  overlay.querySelector("p")!.textContent = "Tap, click, or press Space to climb.";
  startButton.hidden = false;
  reset("ready");
});

resize();
reset("ready");
requestAnimationFrame(loop);
