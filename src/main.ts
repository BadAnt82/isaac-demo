import "./styles.css";

type GameState =
  | "platform"
  | "ready"
  | "plane-options"
  | "report-issue"
  | "running"
  | "bubble-crash"
  | "ended"
  | "snake-menu"
  | "snake-options"
  | "snake-running"
  | "snake-dead";

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

type RollStyle = "forward" | "backward" | "sideways";

type CollisionResult = "none" | "ceiling" | "floor" | "obstacle" | "bubble";

type HighScoreResponse = {
  todayHighest?: number;
  todayName?: string;
  allTimeHighest?: number;
  allTimeName?: string;
  todayRecord?: boolean;
  allTimeRecord?: boolean;
};

type SnakeDirection = "up" | "down" | "left" | "right";

type SnakePoint = {
  x: number;
  y: number;
};

type SnakeOrb = SnakePoint & {
  color: string;
  id: string;
};

type SnakeProjectile = SnakePoint & {
  color: string;
  id: string;
};

type SnakePlayer = {
  alive: boolean;
  bestLength: number;
  color: string;
  id: string;
  orbsCollected: number;
  score: number;
  segments: SnakePoint[];
  shotBank: number;
};

type SnakeSnapshot = {
  board: {
    cellSize: number;
    height: number;
    width: number;
  };
  maxShotBank?: number;
  orbs: SnakeOrb[];
  players: SnakePlayer[];
  projectiles: SnakeProjectile[];
  type: "snake-state";
};

type SnakeWelcome = {
  board: SnakeSnapshot["board"];
  id: string;
  type: "snake-welcome";
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
const scoreLabel = requireElement<HTMLElement>(".score-panel .label");
const localHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-score="local"]'));
const todayHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-score="today"]'));
const serverHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-score="server"]'));
const todayNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-score-name="today"]'));
const serverNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-score-name="server"]'));
const snakeLocalHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-snake-score="local"]'));
const snakeTodayHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-snake-score="today"]'));
const snakeServerHighEls = Array.from(document.querySelectorAll<HTMLElement>('[data-snake-score="server"]'));
const snakeTodayNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-snake-score-name="today"]'));
const snakeServerNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-snake-score-name="server"]'));
const scorePanel = requireElement<HTMLElement>(".score-panel");
const restartButton = requireElement<HTMLButtonElement>("#restart");
const startButton = requireElement<HTMLButtonElement>("#start");
const planeOptionsButton = requireElement<HTMLButtonElement>("#plane-options");
const planeMenuBackButton = requireElement<HTMLButtonElement>("#plane-menu-back");
const planeOptionsBackButton = requireElement<HTMLButtonElement>("#plane-options-back");
const planeSoundToggle = requireElement<HTMLButtonElement>("#plane-sound-toggle");
const planeReportIssueButton = requireElement<HTMLButtonElement>("#plane-report-issue");
const selectPlaneButton = requireElement<HTMLButtonElement>("#select-plane");
const selectSnakeButton = requireElement<HTMLButtonElement>("#select-snake");
const homeButton = requireElement<HTMLButtonElement>("#home");
const fullscreenButton = requireElement<HTMLButtonElement>("#fullscreen");
const rollButton = requireElement<HTMLElement>("#roll");
const snakeControls = requireElement<HTMLElement>("#snake-controls");
const snakeJoystick = requireElement<HTMLElement>("#snake-joystick");
const snakeStartButton = requireElement<HTMLButtonElement>("#snake-start");
const snakeRestartButton = requireElement<HTMLButtonElement>("#snake-restart");
const snakeShootButton = requireElement<HTMLButtonElement>("#snake-shoot");
const snakeInfoBar = requireElement<HTMLElement>("#snake-info-bar");
const snakeInfoLongest = requireElement<HTMLElement>("#snake-info-longest");
const snakeInfoLength = requireElement<HTMLElement>("#snake-info-length");
const snakeInfoPlayers = requireElement<HTMLElement>("#snake-info-players");
const gameFrame = requireElement<HTMLElement>(".game-frame");
const overlay = requireElement<HTMLElement>("#overlay");
const platformPanel = requireElement<HTMLElement>("#platform-panel");
const gameMenuPanel = requireElement<HTMLElement>("#game-menu-panel");
const planeOptionsPanel = requireElement<HTMLElement>("#plane-options-panel");
const crashPanel = requireElement<HTMLElement>("#crash-panel");
const snakeMenuPanel = requireElement<HTMLElement>("#snake-menu-panel");
const snakeOptionsPanel = requireElement<HTMLElement>("#snake-options-panel");
const snakeDeadPanel = requireElement<HTMLElement>("#snake-dead-panel");
const snakeOptionsButton = requireElement<HTMLButtonElement>("#snake-options");
const snakeMenuBackButton = requireElement<HTMLButtonElement>("#snake-menu-back");
const snakeOptionsBackButton = requireElement<HTMLButtonElement>("#snake-options-back");
const snakeSoundToggle = requireElement<HTMLButtonElement>("#snake-sound-toggle");
const snakeReportIssueButton = requireElement<HTMLButtonElement>("#snake-report-issue");
const reportPanel = requireElement<HTMLElement>("#report-panel");
const issueForm = requireElement<HTMLFormElement>("#issue-form");
const issueText = requireElement<HTMLTextAreaElement>("#issue-text");
const issueCancelButton = requireElement<HTMLButtonElement>("#issue-cancel");
const issueStatus = requireElement<HTMLElement>("#issue-status");
const snakeMessage = requireElement<HTMLElement>("#snake-message");
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
let rollStyle: RollStyle = "forward";
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
let snakeSocket: WebSocket | null = null;
let snakeReconnectTimer = 0;
let snakeClientId = "";
let snakeSnapshot: SnakeSnapshot | null = null;
let snakeConnected = false;
let snakeStartPending = false;
let snakeSpawnedThisRun = false;
let snakeLastAlive = false;
let snakeLastLength = 0;
let snakeLastShotBank = 0;
let snakeJoystickPointerId: number | null = null;
let snakeJoystickPulseTimer = 0;
let lastSnakeShootTime = 0;
let reportGame: "jumpy-plane" | "shooting-snakes" = "jumpy-plane";
let reportReturnState: "plane-options" | "snake-options" = "plane-options";
let snakeLocalLongest = 3;
let snakeTodayLongest = 0;
let snakeServerLongest = 0;
let snakeTodayLongName = "";
let snakeServerLongName = "";
let snakeBestThisRun = 3;

const localHighScoreKey = "badant-games-jumpy-plane-high-score";
const oldLocalHighScoreKeys = ["isaac-demo-high-score"];
const pendingScoreKey = "badant-games-jumpy-plane-pending-score";
const playerNameKey = "badant-games-player-name";
const oldSnakeLocalLongestKey = "badant-games-glow-snake-longest";
const oldSnakePendingScoreKey = "badant-games-glow-snake-pending-longest";
const snakeLocalLongestKey = "badant-games-shooting-snakes-longest";
const snakePendingScoreKey = "badant-games-shooting-snakes-pending-longest";
const planeSoundKey = "badant-games-jumpy-plane-sound";
const snakeSoundKey = "badant-games-shooting-snakes-sound";
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
const snakeFallbackBoard = {
  cellSize: 24,
  height: 1920,
  width: 2880,
};
const fallbackSnakeShotBank = 5;
const snakeCameraZoom = 1 / 1.2;
let planeSoundEnabled = localStorage.getItem(planeSoundKey) !== "off";
let snakeSoundEnabled = localStorage.getItem(snakeSoundKey) !== "off";

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
  if (state === "platform" || state === "ready") {
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

function playBubbleShootSound() {
  if (!planeSoundEnabled) {
    return;
  }
  playTone(360, 0.12, "square", 0.025, 0, 760);
  playTone(840, 0.06, "triangle", 0.018, 0.05, 520);
}

function playBubblePopSound() {
  if (!planeSoundEnabled) {
    return;
  }
  playTone(780, 0.07, "sine", 0.038, 0, 1140);
  playTone(420, 0.09, "triangle", 0.026, 0.035, 220);
}

function playFlapSound() {
  if (!planeSoundEnabled) {
    return;
  }
  playTone(210, 0.055, "triangle", 0.026, 0, 520);
  playTone(1220, 0.045, "sine", 0.018, 0.035, 760);
}

function playRollSound() {
  if (!planeSoundEnabled) {
    return;
  }
  playTone(520, 0.11, "sine", 0.04, 0, 820);
  playTone(820, 0.12, "triangle", 0.034, 0.08, 460);
  playTone(440, 0.13, "sine", 0.032, 0.17, 720);
}

function playCrashFallSound() {
  if (!planeSoundEnabled) {
    return;
  }
  for (let index = 0; index < 3; index += 1) {
    const delay = index * 0.18;
    playTone(620 - index * 90, 0.18, "sawtooth", 0.035, delay, 180 - index * 24);
    playTone(420 - index * 50, 0.16, "sine", 0.018, delay + 0.04, 130);
  }
}

function playExplosionSound() {
  if (!planeSoundEnabled) {
    return;
  }
  playNoiseBurst(0.36, 0.16);
  playTone(92, 0.34, "sawtooth", 0.075, 0, 34);
  playTone(240, 0.12, "square", 0.036, 0.03, 70);
}

function playSnakeOrbSound() {
  if (!snakeSoundEnabled) {
    return;
  }
  playTone(300, 0.07, "sine", 0.028, 0, 520);
  playTone(520, 0.08, "triangle", 0.022, 0.035, 360);
}

function playSnakeShotPickupSound() {
  if (!snakeSoundEnabled) {
    return;
  }
  playTone(880, 0.07, "triangle", 0.04, 0, 1320);
  playTone(1420, 0.06, "sine", 0.026, 0.045, 960);
  playTone(620, 0.1, "square", 0.018, 0.08, 720);
}

function playSnakeDeathSound() {
  if (!snakeSoundEnabled) {
    return;
  }
  playTone(220, 0.11, "sawtooth", 0.05, 0, 74);
  playTone(92, 0.18, "triangle", 0.038, 0.055, 42);
  playNoiseBurst(0.16, 0.055, 0.02);
}

function playSnakeShootSound() {
  if (!snakeSoundEnabled) {
    return;
  }
  playTone(180, 0.08, "square", 0.032, 0, 680);
}

function getSnakeSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/snake`;
}

function sendSnakeMessage(message: Record<string, unknown>) {
  if (snakeSocket?.readyState === WebSocket.OPEN) {
    snakeSocket.send(JSON.stringify(message));
  }
}

function connectSnakeSocket() {
  if (snakeSocket && (snakeSocket.readyState === WebSocket.OPEN || snakeSocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  snakeSocket = new WebSocket(getSnakeSocketUrl());
  snakeSocket.addEventListener("open", () => {
    snakeConnected = true;
    if (snakeStartPending) {
      snakeStartPending = false;
      sendSnakeMessage({ type: "snake-start" });
    }
  });
  snakeSocket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data as string) as SnakeSnapshot | SnakeWelcome;
    if (message.type === "snake-welcome") {
      snakeClientId = message.id;
      return;
    }

    snakeSnapshot = message;
    const self = getLocalSnake();
    if (state === "snake-running" && self) {
      if (snakeLastAlive && self.alive) {
        if (self.shotBank > snakeLastShotBank) {
          playSnakeShotPickupSound();
        } else if (self.segments.length > snakeLastLength) {
          playSnakeOrbSound();
        }
      } else if (snakeLastAlive && !self.alive) {
        playSnakeDeathSound();
      }
    }
    if (self?.alive) {
      snakeSpawnedThisRun = true;
    }
    if (self) {
      snakeBestThisRun = Math.max(snakeBestThisRun, self.bestLength ?? 0, self.segments.length);
      writeSnakeLocalLongest(snakeBestThisRun);
      renderSnakeHighScores();
    }
    if (state === "snake-running" && self && !self.alive && snakeSpawnedThisRun) {
      showSnakeDead();
    }
    if (self) {
      snakeLastAlive = self.alive;
      snakeLastLength = self.segments.length;
      snakeLastShotBank = self.shotBank;
    } else {
      snakeLastAlive = false;
      snakeLastLength = 0;
      snakeLastShotBank = 0;
    }
    updateSnakeScore();
  });
  snakeSocket.addEventListener("close", () => {
    snakeConnected = false;
    snakeSocket = null;
    if (state === "snake-running" || state === "snake-dead") {
      window.clearTimeout(snakeReconnectTimer);
      snakeReconnectTimer = window.setTimeout(connectSnakeSocket, 900);
    }
  });
}

function leaveSnakeRoom() {
  window.clearTimeout(snakeReconnectTimer);
  snakeStartPending = false;
  snakeSpawnedThisRun = false;
  snakeLastAlive = false;
  snakeLastLength = 0;
  snakeLastShotBank = 0;
  snakeConnected = false;
  snakeClientId = "";
  snakeSnapshot = null;
  if (snakeSocket) {
    snakeSocket.close();
    snakeSocket = null;
  }
}

function getLocalSnake() {
  return snakeSnapshot?.players.find((player) => player.id === snakeClientId);
}

function setSnakeLayout(active: boolean) {
  gameFrame.classList.toggle("snake-layout", active);
  snakeInfoBar.hidden = !active;
  resize();
}

function showPlaneOptions() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  state = "plane-options";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = false;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  issueStatus.textContent = "";
  updateSoundButtons();
  updateRollButton();
}

function showPlaneMenu() {
  reset("ready");
}

function startSnakeGame(restart = false) {
  unlockAudio();
  snakeBestThisRun = 3;
  snakeSpawnedThisRun = false;
  snakeLastAlive = false;
  snakeLastLength = 0;
  snakeLastShotBank = 0;
  resetSnakeJoystick();
  state = "snake-running";
  scoreLabel.textContent = "Length";
  overlay.hidden = true;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = false;
  setSnakeLayout(true);
  updateRollButton();
  connectSnakeSocket();
  if (snakeSocket?.readyState === WebSocket.OPEN) {
    sendSnakeMessage({ type: restart ? "snake-restart" : "snake-start" });
  } else {
    snakeStartPending = true;
  }
  updateSnakeScore();
}

function showSnakeMenu() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  snakeLastAlive = false;
  snakeLastLength = 0;
  snakeLastShotBank = 0;
  readSnakeLocalLongest();
  renderSnakeHighScores();
  void loadServerSnakeHighScores();
  state = "snake-menu";
  scoreEl.textContent = "0";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = false;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  updateRollButton();
}

function showSnakeOptions() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  state = "snake-options";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = false;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  issueStatus.textContent = "";
  updateSoundButtons();
  updateRollButton();
}

function showReportIssue(game: "jumpy-plane" | "shooting-snakes", returnState: "plane-options" | "snake-options") {
  reportGame = game;
  reportReturnState = returnState;
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  state = "report-issue";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = false;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  issueText.value = "";
  issueStatus.textContent = "";
  issueText.focus();
  updateRollButton();
}

function returnFromReportIssue() {
  if (reportReturnState === "snake-options") {
    showSnakeOptions();
  } else {
    showPlaneOptions();
  }
}

function showSnakeDead() {
  state = "snake-dead";
  snakeSpawnedThisRun = false;
  setSnakeLayout(false);
  resetSnakeJoystick();
  scoreLabel.textContent = "Longest";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = false;
  scorePanel.hidden = false;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  const self = getLocalSnake();
  const finalLength = Math.max(3, snakeBestThisRun, self?.bestLength ?? 0, self?.segments.length ?? 0);
  writeSnakeLocalLongest(finalLength);
  renderSnakeHighScores();
  void syncFinalSnakeScore(finalLength);
  scoreEl.textContent = formatScore(finalLength);
  snakeMessage.textContent = `Longest ${formatScore(finalLength)}.`;
  updateSnakeShootButton();
  updateSnakeInfoBar();
  updateRollButton();
}

function updateSnakeScore() {
  if (state !== "snake-running" && state !== "snake-dead") {
    return;
  }

  const self = getLocalSnake();
  const length = Math.max(3, self?.segments.length ?? snakeBestThisRun);
  scoreEl.textContent = formatScore(state === "snake-dead" ? Math.max(length, snakeBestThisRun) : length);
  updateSnakeShootButton();
  updateSnakeInfoBar();
}

function updateSnakeShootButton() {
  const self = getLocalSnake();
  const maxShotBank = Math.max(fallbackSnakeShotBank, snakeSnapshot?.maxShotBank ?? fallbackSnakeShotBank);
  const shotBank = Math.max(0, Math.min(maxShotBank, self?.shotBank ?? 0));
  const canShoot = state === "snake-running" && Boolean(self?.alive) && shotBank > 0 && (self?.segments.length ?? 0) > 2;
  snakeShootButton.textContent = `Shoot (${shotBank}/${maxShotBank})`;
  snakeShootButton.disabled = !canShoot;
}

function updateSnakeInfoBar() {
  if (state !== "snake-running") {
    return;
  }

  const self = getLocalSnake();
  const alivePlayers = snakeSnapshot?.players.filter((player) => player.alive) ?? [];
  const longestLength = Math.max(
    3,
    ...alivePlayers.map((player) => Math.max(player.segments.length, player.bestLength || 3)),
  );
  const myLength = Math.max(3, self?.segments.length ?? snakeBestThisRun);
  snakeInfoLongest.textContent = formatScore(longestLength);
  snakeInfoLength.textContent = formatScore(myLength);
  snakeInfoPlayers.textContent = `${alivePlayers.length}`;
}

function directionFromJoystick(dx: number, dy: number, deadZone: number) {
  if (Math.hypot(dx, dy) < deadZone) {
    return null;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }

  return dy > 0 ? "down" : "up";
}

function setSnakeJoystickOffset(x: number, y: number, active = false) {
  snakeJoystick.style.setProperty("--stick-x", `${x}px`);
  snakeJoystick.style.setProperty("--stick-y", `${y}px`);
  snakeJoystick.classList.toggle("is-active", active);
}

function resetSnakeJoystick() {
  window.clearTimeout(snakeJoystickPulseTimer);
  snakeJoystickPulseTimer = 0;
  setSnakeJoystickOffset(0, 0);
}

function pulseSnakeJoystick(direction: SnakeDirection) {
  if (snakeJoystickPointerId !== null) {
    return;
  }

  const distance = Math.min(34, snakeJoystick.getBoundingClientRect().width * 0.28);
  const offsets: Record<SnakeDirection, SnakePoint> = {
    down: { x: 0, y: distance },
    left: { x: -distance, y: 0 },
    right: { x: distance, y: 0 },
    up: { x: 0, y: -distance },
  };
  setSnakeJoystickOffset(offsets[direction].x, offsets[direction].y, true);
  window.clearTimeout(snakeJoystickPulseTimer);
  snakeJoystickPulseTimer = window.setTimeout(resetSnakeJoystick, 170);
}

function updateSnakeJoystickFromPointer(event: PointerEvent) {
  const rect = snakeJoystick.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.5;
  const maxDistance = rect.width * 0.42;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.min(maxDistance, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const stickX = Math.cos(angle) * distance;
  const stickY = Math.sin(angle) * distance;
  const direction = directionFromJoystick(dx, dy, rect.width * 0.08);

  setSnakeJoystickOffset(stickX, stickY, true);
  if (direction) {
    setSnakeDirection(direction);
  }
}

function setSnakeDirection(direction: SnakeDirection, reflectJoystick = false) {
  if (state !== "snake-running") {
    return;
  }
  if (reflectJoystick) {
    pulseSnakeJoystick(direction);
  }
  sendSnakeMessage({ direction, type: "snake-direction" });
}

function shootSnake() {
  if (state !== "snake-running") {
    return;
  }
  const now = performance.now();
  if (now - lastSnakeShootTime < 180) {
    return;
  }

  const self = getLocalSnake();
  if (!self || self.shotBank <= 0 || self.segments.length <= 2) {
    updateSnakeShootButton();
    return;
  }

  lastSnakeShootTime = now;
  playSnakeShootSound();
  sendSnakeMessage({ type: "snake-shoot" });
  updateSnakeShootButton();
}

function getSnakeBoard() {
  return snakeSnapshot?.board ?? snakeFallbackBoard;
}

function snakeCamera(viewWidth: number, viewHeight: number) {
  const board = getSnakeBoard();
  const self = getLocalSnake();
  const head = self?.segments[0] ?? { x: board.width * 0.5, y: board.height * 0.5 };
  const maxX = Math.max(0, board.width - viewWidth);
  const maxY = Math.max(0, board.height - viewHeight);
  return {
    x: Math.max(0, Math.min(maxX, head.x - viewWidth * 0.5)),
    y: Math.max(0, Math.min(maxY, head.y - viewHeight * 0.5)),
  };
}

function drawSnakeBackground(camera: SnakePoint, viewWidth: number, viewHeight: number, time: number) {
  const board = getSnakeBoard();
  const gradient = ctx.createLinearGradient(0, 0, viewWidth, viewHeight);
  gradient.addColorStop(0, "#071421");
  gradient.addColorStop(0.55, "#102b30");
  gradient.addColorStop(1, "#180d2c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.strokeStyle = "rgba(127, 255, 216, 0.14)";
  ctx.lineWidth = 1;
  const grid = board.cellSize * 2;
  const startX = Math.floor(camera.x / grid) * grid;
  const startY = Math.floor(camera.y / grid) * grid;
  for (let x = startX; x < camera.x + viewWidth + grid; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, camera.y);
    ctx.lineTo(x, camera.y + viewHeight);
    ctx.stroke();
  }
  for (let y = startY; y < camera.y + viewHeight + grid; y += grid) {
    ctx.beginPath();
    ctx.moveTo(camera.x, y);
    ctx.lineTo(camera.x + viewWidth, y);
    ctx.stroke();
  }

  ctx.strokeStyle = `hsla(${(time * 24) % 360}, 100%, 72%, 0.9)`;
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, board.width, board.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, board.width - 8, board.height - 8);
  ctx.restore();
}

function drawSnakeOrb(orb: SnakeOrb, camera: SnakePoint, time: number) {
  const pulse = 1 + Math.sin(time * 5 + orb.x * 0.01) * 0.18;
  ctx.save();
  ctx.translate(orb.x - camera.x, orb.y - camera.y);
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 18 * pulse);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, orb.color);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = orb.color;
  ctx.beginPath();
  ctx.arc(0, 0, 6 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnakePlayer(player: SnakePlayer, camera: SnakePoint) {
  player.segments.forEach((segment, index) => {
    const radius = Math.max(8, 14 - index * 0.12);
    ctx.save();
    ctx.translate(segment.x - camera.x, segment.y - camera.y);
    ctx.shadowBlur = player.id === snakeClientId ? 16 : 10;
    ctx.shadowColor = player.color;
    ctx.fillStyle = index === 0 ? "#f8fff9" : player.color;
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * (index === 0 ? 1.16 : 1), radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (index === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#10202a";
      ctx.beginPath();
      ctx.arc(4, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(4, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

function drawSnakeProjectile(projectile: SnakeProjectile, camera: SnakePoint) {
  ctx.save();
  ctx.translate(projectile.x - camera.x, projectile.y - camera.y);
  ctx.shadowBlur = 18;
  ctx.shadowColor = projectile.color;
  ctx.fillStyle = projectile.color;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSnakeGame(time: number) {
  const cssWidth = canvas.width / dpr;
  const cssHeight = canvas.height / dpr;
  const viewWidth = cssWidth / snakeCameraZoom;
  const viewHeight = cssHeight / snakeCameraZoom;
  ctx.setTransform(dpr * snakeCameraZoom, 0, 0, dpr * snakeCameraZoom, 0, 0);
  const camera = snakeCamera(viewWidth, viewHeight);
  drawSnakeBackground(camera, viewWidth, viewHeight, time);

  const inView = (point: SnakePoint, margin = 60) =>
    point.x >= camera.x - margin &&
    point.x <= camera.x + viewWidth + margin &&
    point.y >= camera.y - margin &&
    point.y <= camera.y + viewHeight + margin;

  snakeSnapshot?.orbs.filter((orb) => inView(orb)).forEach((orb) => drawSnakeOrb(orb, camera, time));
  snakeSnapshot?.projectiles
    .filter((projectile) => inView(projectile))
    .forEach((projectile) => drawSnakeProjectile(projectile, camera));
  snakeSnapshot?.players
    .filter((player) => player.alive && player.segments.some((segment) => inView(segment, 120)))
    .forEach((player) => drawSnakePlayer(player, camera));

  if (state === "snake-running" && !snakeConnected) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText("Connecting...", 18, 30);
  }
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

function readStoredNumber(key: string, fallback = 0) {
  try {
    const storedValue = localStorage.getItem(key);
    const storedNumber = storedValue === null ? fallback : Number(storedValue);
    return Number.isFinite(storedNumber) ? storedNumber : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, `${value}`);
  } catch {
    // Local scores are best-effort on browsers that restrict storage.
  }
}

function readStoredPlaneHighest() {
  return Math.max(
    0,
    readStoredNumber(localHighScoreKey),
    readStoredNumber(pendingScoreKey),
    ...oldLocalHighScoreKeys.map((key) => readStoredNumber(key)),
  );
}

function readLocalHighest() {
  const storedScore = readStoredPlaneHighest();
  localHighest = Math.max(localHighest, storedScore);
  if (storedScore > 0) {
    writeStoredNumber(localHighScoreKey, localHighest);
  }
}

function writeLocalHighest(nextScore: number) {
  localHighest = Math.max(localHighest, readStoredPlaneHighest(), nextScore);
  writeStoredNumber(localHighScoreKey, localHighest);
}

function setText(elements: HTMLElement[], text: string) {
  elements.forEach((element) => {
    element.textContent = text;
  });
}

function updateSoundButtons() {
  planeSoundToggle.textContent = planeSoundEnabled ? "Sound on" : "Sound off";
  planeSoundToggle.setAttribute("aria-pressed", `${planeSoundEnabled}`);
  snakeSoundToggle.textContent = snakeSoundEnabled ? "Sound on" : "Sound off";
  snakeSoundToggle.setAttribute("aria-pressed", `${snakeSoundEnabled}`);
}

function setPlaneSound(enabled: boolean) {
  planeSoundEnabled = enabled;
  localStorage.setItem(planeSoundKey, enabled ? "on" : "off");
  updateSoundButtons();
}

function setSnakeSound(enabled: boolean) {
  snakeSoundEnabled = enabled;
  localStorage.setItem(snakeSoundKey, enabled ? "on" : "off");
  updateSoundButtons();
}

async function submitIssue(game: "jumpy-plane" | "shooting-snakes", message: string) {
  const response = await fetch(`/api/issues/${game}`, {
    body: JSON.stringify({
      message,
      page: window.location.href,
      userAgent: navigator.userAgent,
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Issue report failed.");
  }
}

function renderHighScores() {
  setText(localHighEls, formatScore(localHighest));
  setText(todayHighEls, formatScore(todayHighest));
  setText(serverHighEls, formatScore(serverHighest));
  setText(todayNameEls, todayHighName || (todayHighest > 0 ? "Unknown scorer" : "No scorer yet"));
  setText(serverNameEls, serverHighName || (serverHighest > 0 ? "Unknown scorer" : "No scorer yet"));
}

function readSnakeLocalLongest() {
  const storedValue = localStorage.getItem(snakeLocalLongestKey) ?? localStorage.getItem(oldSnakeLocalLongestKey) ?? "3";
  const storedScore = Number(storedValue);
  snakeLocalLongest = Number.isFinite(storedScore) ? Math.max(3, storedScore) : 3;
  if (localStorage.getItem(snakeLocalLongestKey) === null && localStorage.getItem(oldSnakeLocalLongestKey) !== null) {
    localStorage.setItem(snakeLocalLongestKey, `${snakeLocalLongest}`);
  }
}

function writeSnakeLocalLongest(nextLength: number) {
  snakeLocalLongest = Math.max(3, snakeLocalLongest, nextLength);
  localStorage.setItem(snakeLocalLongestKey, `${snakeLocalLongest}`);
}

function renderSnakeHighScores() {
  setText(snakeLocalHighEls, formatScore(Math.max(3, snakeLocalLongest)));
  setText(snakeTodayHighEls, formatScore(Math.max(3, snakeTodayLongest)));
  setText(snakeServerHighEls, formatScore(Math.max(3, snakeServerLongest)));
  setText(snakeTodayNameEls, snakeTodayLongName || (snakeTodayLongest > 0 ? "Unknown scorer" : "No scorer yet"));
  setText(snakeServerNameEls, snakeServerLongName || (snakeServerLongest > 0 ? "Unknown scorer" : "No scorer yet"));
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

function applyServerSnakeHighScores(scores: HighScoreResponse) {
  snakeTodayLongest = Number(scores.todayHighest) || snakeTodayLongest;
  snakeTodayLongName = typeof scores.todayName === "string" ? scores.todayName : snakeTodayLongName;
  snakeServerLongest = Number(scores.allTimeHighest) || snakeServerLongest;
  snakeServerLongName = typeof scores.allTimeName === "string" ? scores.allTimeName : snakeServerLongName;
  renderSnakeHighScores();
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

async function loadServerSnakeHighScores() {
  try {
    const response = await fetch("/api/snake-high-scores", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const scores = await response.json() as HighScoreResponse;
    applyServerSnakeHighScores(scores);
    void retryPendingServerSnakeScore();
    void reconcileSnakeLocalHighScore();
  } catch {
    // Snake can still run locally if the score endpoint is unavailable.
  }
}

async function submitServerSnakeHighScore(finalScore: number, name = "") {
  try {
    const response = await fetch("/api/snake-high-scores", {
      body: JSON.stringify({ name, score: finalScore }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return;
    }

    const scores = await response.json() as HighScoreResponse;
    applyServerSnakeHighScores(scores);
    if (Number(scores.todayHighest) >= finalScore || Number(scores.allTimeHighest) >= finalScore) {
      localStorage.removeItem(snakePendingScoreKey);
      localStorage.removeItem(oldSnakePendingScoreKey);
    }
    return scores;
  } catch {
    // Ignore sync failures; the browser's longest snake still persists.
  }
}

function rememberPendingServerScore(finalScore: number) {
  const pendingScore = Number(localStorage.getItem(pendingScoreKey) || 0);
  if (!Number.isFinite(pendingScore) || finalScore > pendingScore) {
    localStorage.setItem(pendingScoreKey, `${finalScore}`);
  }
}

function rememberPendingServerSnakeScore(finalScore: number) {
  const pendingScore = Number(localStorage.getItem(snakePendingScoreKey) || 0);
  if (!Number.isFinite(pendingScore) || finalScore > pendingScore) {
    localStorage.setItem(snakePendingScoreKey, `${finalScore}`);
  }
}

async function retryPendingServerScore() {
  const pendingScore = Number(localStorage.getItem(pendingScoreKey) || 0);
  if (Number.isFinite(pendingScore) && pendingScore > 0) {
    await submitServerHighScore(pendingScore);
  }
}

async function retryPendingServerSnakeScore() {
  const pendingScore = Math.max(
    Number(localStorage.getItem(snakePendingScoreKey) || 0),
    Number(localStorage.getItem(oldSnakePendingScoreKey) || 0),
  );
  if (Number.isFinite(pendingScore) && pendingScore > 0) {
    await submitServerSnakeHighScore(pendingScore);
  }
}

async function reconcileLocalHighScore() {
  if (localHighest > todayHighest || localHighest > serverHighest) {
    rememberPendingServerScore(localHighest);
    await submitServerHighScore(localHighest);
  }
}

async function reconcileSnakeLocalHighScore() {
  if (localStorage.getItem(snakeLocalLongestKey) === null && localStorage.getItem(oldSnakeLocalLongestKey) === null) {
    return;
  }

  if (snakeLocalLongest > snakeTodayLongest || snakeLocalLongest > snakeServerLongest) {
    rememberPendingServerSnakeScore(snakeLocalLongest);
    await submitServerSnakeHighScore(snakeLocalLongest);
  }
}

function askForRecordName(finalScore: number, recordLabels: string[], unitLabel = "points") {
  recordMessage.textContent = `You set ${recordLabels.join(" and ")} with ${formatScore(finalScore)} ${unitLabel}.`;
  recordNameInput.value = localStorage.getItem(playerNameKey) || "";
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

async function syncFinalSnakeScore(finalScore: number) {
  rememberPendingServerSnakeScore(finalScore);
  const result = await submitServerSnakeHighScore(finalScore);
  if (!result) {
    return;
  }

  const recordLabels: string[] = [];
  if (result.todayRecord) {
    recordLabels.push("today's longest snake");
  }
  if (result.allTimeRecord) {
    recordLabels.push("the server longest snake");
  }

  if (recordLabels.length === 0) {
    return;
  }

  const name = await askForRecordName(finalScore, recordLabels, "segments");
  await submitServerSnakeHighScore(finalScore, name);
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
  snakeSpawnedThisRun = false;
  snakeLastAlive = false;
  snakeLastLength = 0;
  snakeLastShotBank = 0;
  resetSnakeJoystick();
  readSnakeLocalLongest();
  renderHighScores();
  renderSnakeHighScores();
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
  rollStyle = "forward";
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
  setSnakeLayout(false);
  scoreLabel.textContent = "Score";
  scoreEl.textContent = formatScore(score);
  scorePanel.hidden = nextState !== "running";
  homeButton.hidden = nextState === "platform";
  restartButton.hidden = true;
  startButton.hidden = nextState !== "ready";
  overlay.hidden = nextState === "running";
  overlay.classList.toggle("is-platform", nextState === "platform");
  platformPanel.hidden = nextState !== "platform";
  gameMenuPanel.hidden = nextState !== "ready";
  planeOptionsPanel.hidden = nextState !== "plane-options";
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  snakeControls.hidden = true;
  updateSoundButtons();
  updateSnakeShootButton();
  updateRollButton();
}

function flap() {
  unlockAudio();
  if (state === "ready") {
    reset("running");
    overlay.hidden = true;
  }

  if (state === "running") {
    playFlapSound();
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
  verticalScale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(direction * scale, scale * verticalScale);
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
  let rollRotation = 0;
  let rollVerticalScale = 1;
  if (rollTimer > 0) {
    if (rollStyle === "sideways") {
      rollRotation = Math.sin(rollProgress * Math.PI * 2) * 0.18;
      rollVerticalScale = Math.cos(rollProgress * Math.PI * 2);
    } else {
      const direction = rollStyle === "backward" ? -1 : 1;
      rollRotation = Math.PI * 2 * rollProgress * direction;
    }
  }
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
    rollVerticalScale,
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

  playRollSound();
  const rollChoice = Math.random();
  rollStyle = rollChoice < 0.42 ? "forward" : rollChoice < 0.84 ? "backward" : "sideways";
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
  writeLocalHighest(score);
  renderHighScores();
  void syncFinalScore(score);
  state = "ended";
  scorePanel.hidden = false;
  homeButton.hidden = false;
  restartButton.hidden = false;
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = false;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
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
  if (state === "snake-menu" || state === "snake-options" || state === "snake-running" || state === "snake-dead") {
    drawSnakeGame(time);
    return;
  }

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

  if (state === "platform" || state === "ready") {
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
  if (state === "snake-running") {
    const directionByKey: Partial<Record<string, SnakeDirection>> = {
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      KeyA: "left",
      KeyD: "right",
      KeyS: "down",
      KeyW: "up",
    };
    const direction = directionByKey[event.code];
    if (direction) {
      event.preventDefault();
      setSnakeDirection(direction, true);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      shootSnake();
      return;
    }
  }

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
planeOptionsButton.addEventListener("click", showPlaneOptions);
planeMenuBackButton.addEventListener("click", () => reset("platform"));
planeOptionsBackButton.addEventListener("click", showPlaneMenu);
planeSoundToggle.addEventListener("click", () => {
  unlockAudio();
  setPlaneSound(!planeSoundEnabled);
});
planeReportIssueButton.addEventListener("click", () => showReportIssue("jumpy-plane", "plane-options"));
restartButton.addEventListener("click", () => {
  unlockAudio();
  reset("running");
});
homeButton.addEventListener("click", () => {
  leaveSnakeRoom();
  reset("platform");
});
selectPlaneButton.addEventListener("click", () => {
  leaveSnakeRoom();
  reset("ready");
});
selectSnakeButton.addEventListener("click", showSnakeMenu);
snakeOptionsButton.addEventListener("click", showSnakeOptions);
snakeMenuBackButton.addEventListener("click", () => reset("platform"));
snakeOptionsBackButton.addEventListener("click", showSnakeMenu);
snakeSoundToggle.addEventListener("click", () => {
  unlockAudio();
  setSnakeSound(!snakeSoundEnabled);
});
snakeReportIssueButton.addEventListener("click", () => showReportIssue("shooting-snakes", "snake-options"));
issueCancelButton.addEventListener("click", returnFromReportIssue);
issueForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = issueText.value.trim();
  if (!message) {
    issueStatus.textContent = "Add a short note first.";
    return;
  }

  issueStatus.textContent = "Sending...";
  void submitIssue(reportGame, message)
    .then(() => {
      issueText.value = "";
      issueStatus.textContent = "Issue saved.";
      window.setTimeout(() => {
        returnFromReportIssue();
      }, 900);
    })
    .catch(() => {
      issueStatus.textContent = "Issue did not save.";
    });
});
snakeStartButton.addEventListener("click", () => {
  startSnakeGame();
});
snakeRestartButton.addEventListener("click", () => {
  startSnakeGame(true);
});
fullscreenButton.addEventListener("click", () => {
  void toggleFullscreen();
});
snakeJoystick.addEventListener("pointerdown", (event) => {
  if (state !== "snake-running") {
    return;
  }

  event.preventDefault();
  unlockAudio();
  snakeJoystickPointerId = event.pointerId;
  snakeJoystick.setPointerCapture(event.pointerId);
  updateSnakeJoystickFromPointer(event);
});
snakeJoystick.addEventListener("pointermove", (event) => {
  if (event.pointerId !== snakeJoystickPointerId) {
    return;
  }

  event.preventDefault();
  updateSnakeJoystickFromPointer(event);
});
snakeJoystick.addEventListener("pointerup", (event) => {
  if (event.pointerId !== snakeJoystickPointerId) {
    return;
  }

  snakeJoystickPointerId = null;
  resetSnakeJoystick();
});
snakeJoystick.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== snakeJoystickPointerId) {
    return;
  }

  snakeJoystickPointerId = null;
  resetSnakeJoystick();
});
snakeJoystick.addEventListener("lostpointercapture", () => {
  snakeJoystickPointerId = null;
  resetSnakeJoystick();
});
snakeShootButton.addEventListener("pointerdown", (event) => {
  if (state !== "snake-running") {
    return;
  }

  event.preventDefault();
  unlockAudio();
  shootSnake();
});
snakeShootButton.addEventListener("click", shootSnake);
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
    localStorage.setItem(playerNameKey, name);
  }
  recordDialog.hidden = true;
  pendingRecordName?.(name);
  pendingRecordName = null;
});
document.addEventListener("fullscreenchange", () => {
  updateFullscreenButton();
  resize();
});
readLocalHighest();
readSnakeLocalLongest();
renderHighScores();
renderSnakeHighScores();
void loadServerHighScores();
void loadServerSnakeHighScores();
resize();
updateFullscreenButton();
reset("platform");
requestAnimationFrame(loop);
