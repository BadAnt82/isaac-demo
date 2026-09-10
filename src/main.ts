import "./styles.css";

type GameState = "ready" | "running" | "bubble-crash" | "ended";

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

type BubblePop = {
  x: number;
  y: number;
  radius: number;
  age: number;
  duration: number;
};

type PopParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  duration: number;
};

type SmokePuff = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  duration: number;
};

type PlaneDebris = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  spin: number;
  color: string;
  age: number;
  duration: number;
};

type CrashMotion = "spin" | "flip" | "spiral";

type CollisionResult = "none" | "ceiling" | "floor" | "obstacle" | "bubble";

type HighScoreResponse = {
  todayHighest?: number;
  todayName?: string;
  allTimeHighest?: number;
  allTimeName?: string;
  todayRecord?: boolean;
  allTimeRecord?: boolean;
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
const todayNameEl = requireElement<HTMLElement>("#today-name");
const serverHighEl = requireElement<HTMLElement>("#server-high");
const serverNameEl = requireElement<HTMLElement>("#server-name");
const scorePanel = requireElement<HTMLElement>(".score-panel");
const restartButton = requireElement<HTMLButtonElement>("#restart");
const startButton = requireElement<HTMLButtonElement>("#start");
const homeButton = requireElement<HTMLButtonElement>("#home");
const fullscreenButton = requireElement<HTMLButtonElement>("#fullscreen");
const rollButton = requireElement<HTMLElement>("#roll");
const gameFrame = requireElement<HTMLElement>(".game-frame");
const overlay = requireElement<HTMLElement>("#overlay");
const homePanel = requireElement<HTMLElement>("#home-panel");
const crashPanel = requireElement<HTMLElement>("#crash-panel");
const crashMessage = requireElement<HTMLElement>("#crash-message");
const recordDialog = requireElement<HTMLElement>("#record-dialog");
const recordForm = requireElement<HTMLFormElement>(".record-card");
const recordMessage = requireElement<HTMLElement>("#record-message");
const recordNameInput = requireElement<HTMLInputElement>("#record-name");
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
let bubblePops: BubblePop[] = [];
let popParticles: PopParticle[] = [];
let smokePuffs: SmokePuff[] = [];
let planeDebris: PlaneDebris[] = [];
let compactPlayfield = false;
let rollTimer = 0;
let freeRollAvailable = true;
let crashTimer = 0;
let smokeTimer = 0;
let crashEndTimer = 0;
let crashExploded = false;
let crashMotion: CrashMotion = "spin";
let crashDuration = 0.86;
let localHighest = 0;
let todayHighest = 0;
let serverHighest = 0;
let todayHighName = "";
let serverHighName = "";
let pendingRecordName: ((name: string) => void) | null = null;
let audioContext: AudioContext | null = null;
let propellerOscillator: OscillatorNode | null = null;
let propellerGain: GainNode | null = null;
let propellerPulse: OscillatorNode | null = null;
let propellerPulseGain: GainNode | null = null;

const localHighScoreKey = "isaac-demo-high-score";
const pendingScoreKey = "isaac-demo-pending-score";
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
const ceilingSpikeDepth = 26;

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
  compactPlayfield = true;
  const cssWidth = Math.max(320, Math.floor(box.width));
  const cssHeight = Math.max(1, Math.floor(box.height));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = compactWorldWidth;
  height = compactWorldHeight;
  renderScale = Math.min(cssWidth / width, cssHeight / height);
  renderOffsetX = (cssWidth - width * renderScale) / 2;
  renderOffsetY = (cssHeight - height * renderScale) / 2;
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

function getAudioContext() {
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioConstructor = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioConstructor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioConstructor();
  }

  return audioContext;
}

function unlockAudio() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume();
  }
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  delay = 0,
  endFrequency = frequency,
) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playNoiseBurst(duration: number, volume: number, delay = 0) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, start);
  filter.frequency.exponentialRampToValueAtTime(120, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(start);
}

function startPropellerSound() {
  const context = getAudioContext();
  if (!context || propellerOscillator) {
    return;
  }

  propellerOscillator = context.createOscillator();
  propellerGain = context.createGain();
  propellerPulse = context.createOscillator();
  propellerPulseGain = context.createGain();

  propellerOscillator.type = "sawtooth";
  propellerOscillator.frequency.value = 58;
  propellerPulse.type = "sine";
  propellerPulse.frequency.value = 11;
  propellerPulseGain.gain.value = 9;
  propellerGain.gain.value = 0.018;

  propellerPulse.connect(propellerPulseGain);
  propellerPulseGain.connect(propellerOscillator.frequency);
  propellerOscillator.connect(propellerGain);
  propellerGain.connect(context.destination);
  propellerPulse.start();
  propellerOscillator.start();
}

function stopPropellerSound() {
  const context = audioContext;
  if (!context || !propellerOscillator || !propellerGain || !propellerPulse) {
    return;
  }

  const stopAt = context.currentTime + 0.08;
  propellerGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
  propellerOscillator.stop(stopAt);
  propellerPulse.stop(stopAt);
  propellerOscillator = null;
  propellerGain = null;
  propellerPulse = null;
  propellerPulseGain = null;
}

function playBubbleShootSound() {
  playTone(360, 0.12, "square", 0.025, 0, 760);
  playTone(840, 0.06, "triangle", 0.018, 0.05, 520);
}

function playBubblePopSound() {
  playTone(780, 0.07, "sine", 0.038, 0, 1140);
  playTone(420, 0.09, "triangle", 0.026, 0.035, 220);
}

function playCrashFallSound() {
  for (let index = 0; index < 3; index += 1) {
    const delay = index * 0.18;
    playTone(620 - index * 90, 0.18, "sawtooth", 0.035, delay, 180 - index * 24);
    playTone(420 - index * 50, 0.16, "sine", 0.018, delay + 0.04, 130);
  }
}

function playExplosionSound() {
  playNoiseBurst(0.36, 0.16);
  playTone(92, 0.34, "sawtooth", 0.075, 0, 34);
  playTone(240, 0.12, "square", 0.036, 0.03, 70);
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
  todayNameEl.textContent = todayHighName || (todayHighest > 0 ? "Unknown scorer" : "No scorer yet");
  serverHighEl.textContent = formatScore(serverHighest);
  serverNameEl.textContent = serverHighName || (serverHighest > 0 ? "Unknown scorer" : "No scorer yet");
}

async function loadServerHighScores() {
  try {
    const response = await fetch("/api/high-scores", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const scores = await response.json();
    todayHighest = Number(scores.todayHighest) || 0;
    todayHighName = typeof scores.todayName === "string" ? scores.todayName : "";
    serverHighest = Number(scores.allTimeHighest) || 0;
    serverHighName = typeof scores.allTimeName === "string" ? scores.allTimeName : "";
    renderHighScores();
    void retryPendingServerScore();
    void reconcileLocalHighScore();
  } catch {
    // The game should still work offline or from a static dev server.
  }
}

function applyServerHighScores(scores: HighScoreResponse) {
  todayHighest = Number(scores.todayHighest) || todayHighest;
  todayHighName = typeof scores.todayName === "string" ? scores.todayName : todayHighName;
  serverHighest = Number(scores.allTimeHighest) || serverHighest;
  serverHighName = typeof scores.allTimeName === "string" ? scores.allTimeName : serverHighName;
  renderHighScores();
}

async function submitServerHighScore(finalScore: number, name = "") {
  try {
    const response = await fetch("/api/high-scores", {
      body: JSON.stringify({ name, score: finalScore }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return;
    }

    const scores = await response.json() as HighScoreResponse;
    applyServerHighScores(scores);
    if (Number(scores.todayHighest) >= finalScore || Number(scores.allTimeHighest) >= finalScore) {
      localStorage.removeItem(pendingScoreKey);
    }
    return scores;
  } catch {
    // Ignore score sync failures; the local score still persists.
  }
}

function rememberPendingServerScore(finalScore: number) {
  const pendingScore = Number(localStorage.getItem(pendingScoreKey) || 0);
  if (!Number.isFinite(pendingScore) || finalScore > pendingScore) {
    localStorage.setItem(pendingScoreKey, `${finalScore}`);
  }
}

async function retryPendingServerScore() {
  const pendingScore = Number(localStorage.getItem(pendingScoreKey) || 0);
  if (Number.isFinite(pendingScore) && pendingScore > 0) {
    await submitServerHighScore(pendingScore);
  }
}

async function reconcileLocalHighScore() {
  if (localHighest > todayHighest || localHighest > serverHighest) {
    rememberPendingServerScore(localHighest);
    await submitServerHighScore(localHighest);
  }
}

function askForRecordName(finalScore: number, recordLabels: string[]) {
  recordMessage.textContent = `You set ${recordLabels.join(" and ")} with ${formatScore(finalScore)} points.`;
  recordNameInput.value = localStorage.getItem("isaac-demo-player-name") || "";
  recordDialog.hidden = false;
  recordNameInput.focus();

  return new Promise<string>((resolve) => {
    pendingRecordName = resolve;
  });
}

async function syncFinalScore(finalScore: number) {
  rememberPendingServerScore(finalScore);
  const result = await submitServerHighScore(finalScore);
  if (!result) {
    return;
  }

  const recordLabels: string[] = [];
  if (result.todayRecord) {
    recordLabels.push("today's top score");
  }
  if (result.allTimeRecord) {
    recordLabels.push("the server top score");
  }

  if (recordLabels.length === 0) {
    return;
  }

  const name = await askForRecordName(finalScore, recordLabels);
  await submitServerHighScore(finalScore, name);
}

function addScore(points: number) {
  score += points;
  scoreEl.textContent = formatScore(score);
}

function updateRollButton() {
  const ready = state === "running" && rollTimer <= 0 && (freeRollAvailable || score >= rollPointCost);
  rollButton.hidden = state !== "running";
  rollButton.classList.toggle("is-disabled", !ready);
  rollButton.setAttribute("aria-disabled", `${!ready}`);
  rollButton.textContent = freeRollAvailable ? "roll (free)" : "roll (-2 points)";
}

function reset(nextState: GameState) {
  readLocalHighest();
  renderHighScores();
  score = 0;
  obstacles = [];
  bubbles = [];
  bubblePops = [];
  popParticles = [];
  smokePuffs = [];
  planeDebris = [];
  spawnTimer = 0.45;
  bubbleTimer = compactPlayfield ? 1.45 : 1;
  rollTimer = 0;
  freeRollAvailable = true;
  crashTimer = 0;
  smokeTimer = 0;
  crashEndTimer = 0;
  crashExploded = false;
  crashMotion = "spin";
  crashDuration = 0.86;
  plane.y = height * 0.48;
  plane.velocity = 0;
  plane.rotation = 0;
  enemyPlane.y = height * 0.36;
  enemyPlane.bob = 0;
  state = nextState;
  scoreEl.textContent = formatScore(score);
  scorePanel.hidden = nextState === "ready";
  homeButton.hidden = nextState === "ready";
  restartButton.hidden = true;
  startButton.hidden = nextState !== "ready";
  overlay.hidden = nextState !== "ready";
  homePanel.hidden = nextState !== "ready";
  crashPanel.hidden = true;
  if (nextState === "running") {
    startPropellerSound();
  } else {
    stopPropellerSound();
  }
  updateRollButton();
}

function flap() {
  unlockAudio();
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
  const wallPanelOffset = (time * 30) % 176;
  for (let x = 88 - wallPanelOffset; x < width + 176; x += 176) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = "#ffffff";
  const galleryLightOffset = (time * 22) % 176;
  for (let x = 132 - galleryLightOffset; x < width + 176; x += 176) {
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

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = "#80603c";
  ctx.lineWidth = 2;
  const floorOffset = (time * 84) % 72;
  for (let x = -floorOffset; x < width + 72; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 12);
    ctx.lineTo(x - 18, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCeilingSpikes() {
  const spikeWidth = compactPlayfield ? 34 : 42;
  const spikeDepth = compactPlayfield ? 20 : ceilingSpikeDepth;

  ctx.save();
  ctx.fillStyle = "#6f6758";
  ctx.strokeStyle = "rgba(44, 37, 28, 0.48)";
  ctx.lineWidth = 2;
  ctx.fillRect(0, 0, width, 8);
  for (let x = -spikeWidth; x < width + spikeWidth; x += spikeWidth) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + spikeWidth * 0.5, spikeDepth);
    ctx.lineTo(x + spikeWidth, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
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
  if (crashExploded) {
    return;
  }

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

function getPlaneTailPosition() {
  const scale = getPlaneScale();
  return {
    x: plane.x - Math.cos(plane.rotation) * 42 * scale,
    y: plane.y - Math.sin(plane.rotation) * 42 * scale,
  };
}

function drawCrashFlames(time: number) {
  const tail = getPlaneTailPosition();
  const scale = getPlaneScale();
  const flicker = 1 + Math.sin(time * 38) * 0.16;
  ctx.save();
  ctx.translate(tail.x, tail.y);
  ctx.rotate(plane.rotation);

  const flameLength = 34 * scale * flicker;
  const flameHeight = 18 * scale;
  const gradient = ctx.createRadialGradient(-flameLength * 0.34, 0, 2, -flameLength * 0.34, 0, flameLength);
  gradient.addColorStop(0, "rgba(255, 248, 142, 0.96)");
  gradient.addColorStop(0.4, "rgba(255, 126, 30, 0.92)");
  gradient.addColorStop(1, "rgba(204, 30, 18, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(4 * scale, 0);
  ctx.bezierCurveTo(-flameLength * 0.22, -flameHeight, -flameLength, -flameHeight * 0.5, -flameLength * 1.18, 0);
  ctx.bezierCurveTo(-flameLength, flameHeight * 0.54, -flameLength * 0.2, flameHeight, 4 * scale, 0);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 242, 108, 0.9)";
  ctx.beginPath();
  ctx.moveTo(1 * scale, 0);
  ctx.bezierCurveTo(-flameLength * 0.24, -flameHeight * 0.52, -flameLength * 0.64, -flameHeight * 0.22, -flameLength * 0.72, 0);
  ctx.bezierCurveTo(-flameLength * 0.56, flameHeight * 0.28, -flameLength * 0.18, flameHeight * 0.46, 1 * scale, 0);
  ctx.fill();
  ctx.restore();
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

function drawBubblePops() {
  bubblePops.forEach((pop) => {
    const progress = Math.min(1, pop.age / pop.duration);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, pop.radius + progress * pop.radius * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(69, 159, 238, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pop.x, pop.y, pop.radius * 0.55 + progress * pop.radius * 1.15, progress * 5, Math.PI * 1.4 + progress * 5);
    ctx.stroke();
    ctx.restore();
  });

  popParticles.forEach((particle) => {
    const progress = Math.min(1, particle.age / particle.duration);
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "rgba(225, 248, 255, 0.86)";
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * (1 - progress * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSmokeTrail() {
  smokePuffs.forEach((puff) => {
    const progress = Math.min(1, puff.age / puff.duration);
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.62;
    ctx.fillStyle = progress < 0.35 ? "rgba(38, 38, 38, 0.72)" : "rgba(102, 100, 96, 0.54)";
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.radius * (1 + progress * 1.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawPlaneDebris() {
  planeDebris.forEach((piece) => {
    const progress = Math.min(1, piece.age / piece.duration);
    ctx.save();
    ctx.globalAlpha = 1 - Math.max(0, progress - 0.55) / 0.45;
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.strokeStyle = "rgba(58, 43, 22, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.strokeRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.restore();
  });
}

function fireBubble() {
  playBubbleShootSound();
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
  unlockAudio();
  if (state !== "running" || rollTimer > 0 || (!freeRollAvailable && score < rollPointCost)) {
    return;
  }

  rollTimer = rollDuration;
  if (freeRollAvailable) {
    freeRollAvailable = false;
  } else {
    addScore(-rollPointCost);
  }
  updateRollButton();
}

function collide(): CollisionResult {
  const groundHeight = getGroundHeight();
  const spikeDepth = compactPlayfield ? 20 : ceilingSpikeDepth;
  if (plane.y - plane.radius < spikeDepth) {
    return "ceiling";
  }
  if (plane.y + plane.radius > height - groundHeight) {
    return "floor";
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
    return "obstacle";
  }

  if (rollTimer > 0) {
    return "none";
  }

  const hitBubble = bubbles.find((bubble) => {
    const dx = plane.x - bubble.x;
    const dy = plane.y - bubble.y;
    const hitRadius = plane.radius * 0.82 + bubble.radius;
    return dx * dx + dy * dy < hitRadius * hitRadius;
  });
  if (hitBubble) {
    startBubbleCrash(hitBubble);
    return "bubble";
  }

  return "none";
}

function startBubbleCrash(hitBubble: Bubble) {
  playBubblePopSound();
  bubbles = bubbles.filter((bubble) => bubble !== hitBubble);
  bubblePops.push({
    x: hitBubble.x,
    y: hitBubble.y,
    radius: hitBubble.radius,
    age: 0,
    duration: 0.46,
  });

  for (let index = 0; index < 14; index += 1) {
    const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.25;
    const speed = 110 + Math.random() * 90;
    popParticles.push({
      x: hitBubble.x,
      y: hitBubble.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2.4 + Math.random() * 2.8,
      age: 0,
      duration: 0.42 + Math.random() * 0.22,
    });
  }

  startRandomCrash({ lift: true });
}

function startImpactCrash() {
  startRandomCrash();
}

function startFloorCrash() {
  const groundY = height - getGroundHeight();
  plane.y = Math.min(plane.y, groundY - plane.radius - Math.max(58, height * 0.14));
  startRandomCrash({ downward: true });
}

function startCeilingCrash() {
  startRandomCrash({ downward: true });
}

function startRandomCrash(options: { downward?: boolean; lift?: boolean } = {}) {
  const motions: CrashMotion[] = ["spin", "flip", "spiral"];
  stopPropellerSound();
  playCrashFallSound();
  state = "bubble-crash";
  crashTimer = 0;
  smokeTimer = 0;
  crashEndTimer = 0;
  crashExploded = false;
  crashMotion = motions[Math.floor(Math.random() * motions.length)];
  crashDuration = 0.68 + Math.random() * 0.5;
  rollTimer = 0;
  if (options.lift) {
    plane.velocity = Math.min(plane.velocity, -125);
  } else if (options.downward) {
    plane.velocity = Math.max(plane.velocity, 140);
  } else {
    plane.velocity = Math.max(plane.velocity, 40 + Math.random() * 120);
  }
  plane.rotation = Math.max(plane.rotation, 0.46 + Math.random() * 0.32);
}

function updateEffects(dt: number) {
  bubblePops.forEach((pop) => {
    pop.age += dt;
  });
  bubblePops = bubblePops.filter((pop) => pop.age < pop.duration);

  popParticles.forEach((particle) => {
    particle.age += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 170 * dt;
  });
  popParticles = popParticles.filter((particle) => particle.age < particle.duration);

  smokePuffs.forEach((puff) => {
    puff.age += dt;
    puff.x += puff.vx * dt;
    puff.y += puff.vy * dt;
    puff.vy -= 16 * dt;
  });
  smokePuffs = smokePuffs.filter((puff) => puff.age < puff.duration);

  planeDebris.forEach((piece) => {
    piece.age += dt;
    piece.x += piece.vx * dt;
    piece.y += piece.vy * dt;
    piece.vy += getGravity() * 0.54 * dt;
    piece.rotation += piece.spin * dt;
  });
  planeDebris = planeDebris.filter((piece) => piece.age < piece.duration);
}

function addSmokePuff() {
  const tail = getPlaneTailPosition();
  const scale = getPlaneScale();
  smokePuffs.push({
    x: tail.x + (Math.random() - 0.5) * 10 * scale,
    y: tail.y + (Math.random() - 0.5) * 10 * scale,
    vx: -44 * scale + (Math.random() - 0.5) * 36,
    vy: -18 + (Math.random() - 0.5) * 42,
    radius: (7 + Math.random() * 7) * scale,
    age: 0,
    duration: 0.9 + Math.random() * 0.45,
  });
}

function updateBubbleCrash(dt: number) {
  crashTimer += dt;
  updateEffects(dt);

  if (crashExploded) {
    crashEndTimer -= dt;
    if (crashEndTimer <= 0) {
      endGame();
    }
    return;
  }

  plane.velocity += getGravity() * 1.16 * dt;
  plane.y += plane.velocity * dt;
  if (crashMotion === "spiral") {
    plane.x += Math.sin(crashTimer * 13) * 52 * dt;
    plane.rotation += (compactPlayfield ? 6.8 : 7.8) * dt;
  } else if (crashMotion === "flip") {
    plane.x += Math.sin(crashTimer * 8) * 18 * dt;
    plane.rotation += (compactPlayfield ? 9.2 : 10.6) * dt;
  } else {
    plane.x += Math.cos(crashTimer * 18) * 24 * dt;
    plane.rotation += (compactPlayfield ? 12.5 : 14) * dt;
  }

  smokeTimer -= dt;
  while (smokeTimer <= 0) {
    addSmokePuff();
    smokeTimer += 0.055;
  }

  const groundY = height - getGroundHeight();
  if (plane.y + plane.radius >= groundY || crashTimer > crashDuration) {
    if (crashTimer < 0.52) {
      plane.y = groundY - plane.radius - 3;
      plane.velocity = Math.min(plane.velocity, -90);
    } else {
      plane.y = Math.min(plane.y, groundY - plane.radius * 0.45);
      explodePlane();
    }
  }
}

function explodePlane() {
  if (crashExploded) {
    return;
  }

  playExplosionSound();
  crashExploded = true;
  crashEndTimer = 0.86;
  smokeTimer = 0;

  const scale = getPlaneScale();
  const colors = ["#ffd232", "#ffe891", "#f4a51c", "#6fc8ff", "#3a2b16", "#fff1b3"];
  for (let index = 0; index < 34; index += 1) {
    const angle = -Math.PI + (Math.PI * 2 * index) / 34 + (Math.random() - 0.5) * 0.4;
    const speed = (135 + Math.random() * 260) * scale;
    planeDebris.push({
      x: plane.x + (Math.random() - 0.5) * 28 * scale,
      y: plane.y + (Math.random() - 0.5) * 20 * scale,
      vx: Math.cos(angle) * speed + 40 * scale,
      vy: Math.sin(angle) * speed - 100 * scale,
      width: (8 + Math.random() * 16) * scale,
      height: (6 + Math.random() * 12) * scale,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 15,
      color: colors[index % colors.length],
      age: 0,
      duration: 1.08 + Math.random() * 0.52,
    });
  }

  for (let index = 0; index < 10; index += 1) {
    addSmokePuff();
  }
}

function endGame() {
  stopPropellerSound();
  writeLocalHighest(score);
  renderHighScores();
  void syncFinalScore(score);
  state = "ended";
  homeButton.hidden = false;
  restartButton.hidden = false;
  overlay.hidden = false;
  homePanel.hidden = true;
  crashPanel.hidden = false;
  crashPanel.querySelector("h1")!.textContent = "You Crashed";
  crashMessage.textContent = `Score ${formatScore(score)}.`;
  startButton.hidden = true;
  updateRollButton();
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
  if (state === "bubble-crash") {
    updateBubbleCrash(dt);
    updateRollButton();
    return;
  }

  updateEffects(dt);

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

  const collision = collide();
  if (collision === "ceiling") {
    startCeilingCrash();
  } else if (collision === "floor") {
    startFloorCrash();
  } else if (collision === "obstacle") {
    startImpactCrash();
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
  drawCeilingSpikes();
  obstacles.forEach(drawObstacle);
  drawBubblePops();
  drawBubbles();
  drawEnemyPlane(time);
  drawSmokeTrail();
  if (state === "bubble-crash" && !crashExploded) {
    drawCrashFlames(time);
  }
  drawPlane();
  drawPlaneDebris();

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
  unlockAudio();
  reset("running");
});
homeButton.addEventListener("click", () => {
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
recordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = recordNameInput.value.trim();
  if (name) {
    localStorage.setItem("isaac-demo-player-name", name);
  }
  recordDialog.hidden = true;
  pendingRecordName?.(name);
  pendingRecordName = null;
});
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  resize();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopPropellerSound();
  } else if (state === "running") {
    startPropellerSound();
  }
});

readLocalHighest();
renderHighScores();
void loadServerHighScores();
resize();
updateFullscreenButton();
reset("ready");
requestAnimationFrame(loop);
