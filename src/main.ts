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
  | "snake-dead"
  | "bridge-menu"
  | "bridge-options"
  | "bridge-running"
  | "bridge-dead"
  | "pixel-menu"
  | "pixel-options"
  | "pixel-running";

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

type BridgeSide = "left" | "right";
type BridgeOperation = "+" | "-" | "x" | "/";

type BridgeWheelOutcome = {
  color?: string;
  label: string;
  apply: (points: number) => number;
  weight: number;
};

type BridgeHintOutcome = {
  color?: string;
  difficultyTierBonus?: number;
  face?: string;
  kind: "freebie" | "math";
  label: string;
  operation?: BridgeOperation;
  weight: number;
};

type BridgeJackpotResponse = {
  jackpot?: number;
  odds?: number;
  seed?: number;
};

type BridgeJackpotSpinResponse = BridgeJackpotResponse & {
  award?: number;
  contributed?: number;
  hit?: boolean;
};

type BridgePuzzle = {
  answers: Record<BridgeSide, number>;
  correctSide: BridgeSide;
  operation: BridgeOperation;
  prompt: string;
};

type BridgeHint = {
  kind: "freebie" | "math";
  pathIndex: number;
};

type BridgePanelRect = {
  h: number;
  pathIndex: number;
  row: number;
  side: BridgeSide;
  w: number;
  x: number;
  y: number;
};

type BridgeAreas = {
  boardWidth: number;
  wheelWidth: number;
  wheelX: number;
};

type PixelMode = "single" | "multi";

type PixelOwner = "neutral" | "player" | `bot-${number}` | `human-${number}`;

type PixelTurret = {
  aiTargetTimer: number;
  angle: number;
  arc: number;
  color: string;
  fireCooldown: number;
  fireInterval: number;
  homeAngle: number;
  id: PixelOwner;
  isPlayer: boolean;
  rotateDirection: number;
  rotateSpeed: number;
  x: number;
  y: number;
};

type PixelShot = {
  color: string;
  lastCell: number;
  life: number;
  owner: PixelOwner;
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type PixelBoardLayout = {
  boardH: number;
  boardW: number;
  cellH: number;
  cellW: number;
  canvasH: number;
  canvasW: number;
  panelX: number;
  x: number;
  y: number;
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
const bridgeLocalTileEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-tile-score="local"]'));
const bridgeTodayTileEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-tile-score="today"]'));
const bridgeServerTileEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-tile-score="server"]'));
const bridgeTodayTileNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-tile-score-name="today"]'));
const bridgeServerTileNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-tile-score-name="server"]'));
const bridgeLocalPointEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-point-score="local"]'));
const bridgeTodayPointEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-point-score="today"]'));
const bridgeServerPointEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-point-score="server"]'));
const bridgeTodayPointNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-point-score-name="today"]'));
const bridgeServerPointNameEls = Array.from(document.querySelectorAll<HTMLElement>('[data-bridge-point-score-name="server"]'));
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
const selectBridgeButton = requireElement<HTMLButtonElement>("#select-bridge");
const selectPixelButton = requireElement<HTMLButtonElement>("#select-pixel");
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
const bridgeMenuPanel = requireElement<HTMLElement>("#bridge-menu-panel");
const bridgeOptionsPanel = requireElement<HTMLElement>("#bridge-options-panel");
const bridgeDeadPanel = requireElement<HTMLElement>("#bridge-dead-panel");
const bridgeStartButton = requireElement<HTMLButtonElement>("#bridge-start");
const bridgeRestartButton = requireElement<HTMLButtonElement>("#bridge-restart");
const bridgeOptionsButton = requireElement<HTMLButtonElement>("#bridge-options");
const bridgeMenuBackButton = requireElement<HTMLButtonElement>("#bridge-menu-back");
const bridgeOptionsBackButton = requireElement<HTMLButtonElement>("#bridge-options-back");
const bridgeSoundToggle = requireElement<HTMLButtonElement>("#bridge-sound-toggle");
const bridgeReportIssueButton = requireElement<HTMLButtonElement>("#bridge-report-issue");
const bridgeControls = requireElement<HTMLElement>("#bridge-controls");
const bridgeHintSpinButton = requireElement<HTMLButtonElement>("#bridge-hint-spin");
const bridgeSpinButton = requireElement<HTMLButtonElement>("#bridge-spin");
const pixelLocalScoreEls = Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-score="local"]'));
const pixelMenuPanel = requireElement<HTMLElement>("#pixel-menu-panel");
const pixelOptionsPanel = requireElement<HTMLElement>("#pixel-options-panel");
const pixelStartButton = requireElement<HTMLButtonElement>("#pixel-start");
const pixelOptionsButton = requireElement<HTMLButtonElement>("#pixel-options");
const pixelMenuBackButton = requireElement<HTMLButtonElement>("#pixel-menu-back");
const pixelOptionsBackButton = requireElement<HTMLButtonElement>("#pixel-options-back");
const pixelReportIssueButton = requireElement<HTMLButtonElement>("#pixel-report-issue");
const pixelModeInput = requireElement<HTMLSelectElement>("#pixel-mode");
const pixelBotsInput = requireElement<HTMLInputElement>("#pixel-bots");
const pixelHumansInput = requireElement<HTMLInputElement>("#pixel-humans");
const pixelMenuTurrets = requireElement<HTMLElement>("#pixel-menu-turrets");
const reportPanel = requireElement<HTMLElement>("#report-panel");
const issueForm = requireElement<HTMLFormElement>("#issue-form");
const issueText = requireElement<HTMLTextAreaElement>("#issue-text");
const issueCancelButton = requireElement<HTMLButtonElement>("#issue-cancel");
const issueStatus = requireElement<HTMLElement>("#issue-status");
const snakeMessage = requireElement<HTMLElement>("#snake-message");
const bridgeMessage = requireElement<HTMLElement>("#bridge-message");
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
let reportGame: "jumpy-plane" | "shooting-snakes" | "glass-bridge" | "pixel-wars" = "jumpy-plane";
let reportReturnState: "plane-options" | "snake-options" | "bridge-options" | "pixel-options" = "plane-options";
let snakeLocalLongest = 3;
let snakeTodayLongest = 0;
let snakeServerLongest = 0;
let snakeTodayLongName = "";
let snakeServerLongName = "";
let snakeBestThisRun = 3;
let bridgeLocalTiles = 0;
let bridgeTodayTiles = 0;
let bridgeServerTiles = 0;
let bridgeTodayTileName = "";
let bridgeServerTileName = "";
let bridgeLocalPoints = 0;
let bridgeTodayPoints = 0;
let bridgeServerPoints = 0;
let bridgeTodayPointName = "";
let bridgeServerPointName = "";
let bridgeSafePath: BridgeSide[] = [];
let bridgeStep = 0;
let bridgeTiles = 0;
let bridgePoints = 0;
let bridgeHint: BridgeHint | null = null;
let bridgeBrokenSide: BridgeSide | null = null;
let bridgePlayerSide: BridgeSide | null = null;
let bridgeStandingSide: BridgeSide | null = null;
let bridgePuzzles: BridgePuzzle[] = [];
let bridgePendingSide: BridgeSide | null = null;
let bridgeJumpTimer = 0;
let bridgeSuccessTimer = 0;
let bridgeScrollTimer = 0;
let bridgeWheelLabel = "Ready";
let bridgeWheelTimer = 0;
let bridgeWheelSpinTimer = 0;
let bridgeWheelAngle = 0;
let bridgeWheelStartAngle = 0;
let bridgeWheelTargetAngle = 0;
let bridgePendingWheelOutcome: BridgeWheelOutcome | null = null;
let bridgeWheelRequesting = false;
let bridgeWheelSpinSequence = 0;
let bridgeFallTimer = 0;
let bridgeJackpot = 20;
let bridgeHintWheelLabel = "Hint";
let bridgeHintWheelTimer = 0;
let bridgeHintWheelSpinTimer = 0;
let bridgeHintWheelAngle = 0;
let bridgeHintWheelStartAngle = 0;
let bridgeHintWheelTargetAngle = 0;
let bridgePendingHintOutcome: BridgeHintOutcome | null = null;
let bridgeHintWheelRequesting = false;
let bridgeHintWheelSpinSequence = 0;
let pixelMode: PixelMode = "single";
let pixelBotCount = 3;
let pixelHumanSlots = 1;
let pixelCells: PixelOwner[] = [];
let pixelTurrets: PixelTurret[] = [];
let pixelShots: PixelShot[] = [];
let pixelAimActive = false;
let pixelAimPointerId: number | null = null;
let pixelAimX = 0;
let pixelAimY = 0;
let pixelTerritory = 0;
let pixelLocalBest = 0;

const localHighScoreKey = "badant-games-jumpy-plane-high-score";
const oldLocalHighScoreKeys = ["isaac-demo-high-score"];
const pendingScoreKey = "badant-games-jumpy-plane-pending-score";
const playerNameKey = "badant-games-player-name";
const oldSnakeLocalLongestKey = "badant-games-glow-snake-longest";
const oldSnakePendingScoreKey = "badant-games-glow-snake-pending-longest";
const snakeLocalLongestKey = "badant-games-shooting-snakes-longest";
const snakePendingScoreKey = "badant-games-shooting-snakes-pending-longest";
const bridgeLocalTilesKey = "badant-games-glass-bridge-tiles";
const bridgeLocalPointsKey = "badant-games-glass-bridge-points";
const bridgePendingTilesKey = "badant-games-glass-bridge-pending-tiles";
const bridgePendingPointsKey = "badant-games-glass-bridge-pending-points";
const pixelLocalBestKey = "badant-games-pixel-wars-best-claim";
const planeSoundKey = "badant-games-jumpy-plane-sound";
const snakeSoundKey = "badant-games-shooting-snakes-sound";
const bridgeSoundKey = "badant-games-glass-bridge-sound";
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
const bridgeVisibleRows = 7;
const bridgeWheelCost = 1;
const bridgeFallDuration = 0.95;
const bridgeJumpDuration = 0.34;
const bridgeSuccessDuration = 0.52;
const bridgeScrollDuration = 0.34;
const bridgeWheelPreSpinDuration = 0.62;
const bridgeWheelPreSpinSpeed = Math.PI * 9;
const bridgeWheelSpinDuration = 1.25;
const bridgeNormalWheelOutcomes: BridgeWheelOutcome[] = [
  { label: "+1", apply: (points) => points + 1, weight: 1 },
  { label: "+3", apply: (points) => points + 3, weight: 1 },
  { label: "-1", apply: (points) => points - 1, weight: 1 },
  { label: "-2", apply: (points) => points - 2, weight: 1 },
  { label: "x2", apply: (points) => points * 2, weight: 1 },
  { label: "/2", apply: (points) => Math.floor(points / 2), weight: 1 },
];
const bridgeJackpotSegmentIndex = 0;
const bridgeWheelSegments: BridgeWheelOutcome[] = [
  { color: "rgba(255, 95, 118, 0.94)", label: "JP", apply: (points) => points, weight: 1 },
  ...Array.from({ length: 19 }, (_, index) => bridgeNormalWheelOutcomes[index % bridgeNormalWheelOutcomes.length]),
];
const bridgeHintWheelSegments: BridgeHintOutcome[] = [
  { color: "rgba(107, 255, 174, 0.9)", kind: "freebie", label: "Free", weight: 1 },
  { difficultyTierBonus: 0, face: ":)", kind: "math", label: "Addition", operation: "+", weight: 1 },
  { difficultyTierBonus: 1, face: ">:(", kind: "math", label: "Addition", operation: "+", weight: 1 },
  { difficultyTierBonus: 0, face: ":)", kind: "math", label: "Subtraction", operation: "-", weight: 1 },
  { difficultyTierBonus: 1, face: ">:(", kind: "math", label: "Subtraction", operation: "-", weight: 1 },
  { difficultyTierBonus: 0, face: ":)", kind: "math", label: "Multiplication", operation: "x", weight: 1 },
  { difficultyTierBonus: 1, face: ">:(", kind: "math", label: "Multiplication", operation: "x", weight: 1 },
  { difficultyTierBonus: 0, face: ":)", kind: "math", label: "Division", operation: "/", weight: 1 },
  { difficultyTierBonus: 1, face: ">:(", kind: "math", label: "Division", operation: "/", weight: 1 },
];
const pixelColumns = 54;
const pixelRows = 36;
const pixelShotSpeed = 360;
const pixelMaxPlayers = 9;
const pixelBaseFireInterval = 1;
const pixelOwnerColors: Partial<Record<PixelOwner, string>> & { neutral: string; player: string } = {
  neutral: "#606773",
  player: "#35d7ff",
  "bot-1": "#ff4d75",
  "bot-2": "#ffd84f",
  "bot-3": "#6dff80",
  "bot-4": "#b66dff",
  "bot-5": "#ff8a3d",
  "bot-6": "#45ffce",
  "bot-7": "#ff65dc",
  "bot-8": "#a5ff45",
  "bot-9": "#4d75ff",
  "bot-10": "#ffef8a",
  "bot-11": "#ff5335",
  "bot-12": "#72a8ff",
  "human-2": "#ffffff",
  "human-3": "#f7a8ff",
  "human-4": "#a8ffea",
  "human-5": "#ffc7a8",
  "human-6": "#c8ff9b",
  "human-7": "#a8d1ff",
  "human-8": "#ffb3cb",
};
let planeSoundEnabled = localStorage.getItem(planeSoundKey) !== "off";
let snakeSoundEnabled = localStorage.getItem(snakeSoundKey) !== "off";
let bridgeSoundEnabled = localStorage.getItem(bridgeSoundKey) !== "off";

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
  if (state === "pixel-running") {
    positionPixelTurrets();
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

function playBridgeStepSound() {
  if (!bridgeSoundEnabled) {
    return;
  }
  playTone(620, 0.08, "sine", 0.03, 0, 980);
  playTone(1240, 0.05, "triangle", 0.018, 0.04, 880);
}

function playBridgeBreakSound() {
  if (!bridgeSoundEnabled) {
    return;
  }
  playNoiseBurst(0.22, 0.07);
  playTone(340, 0.12, "sawtooth", 0.04, 0, 72);
  playTone(1100, 0.05, "square", 0.018, 0.03, 260);
}

function playBridgeWheelSound() {
  if (!bridgeSoundEnabled) {
    return;
  }
  playTone(420, 0.07, "triangle", 0.026, 0, 840);
  playTone(840, 0.07, "sine", 0.022, 0.06, 360);
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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }
  return normalized;
}

function pixelOwnerColor(owner: PixelOwner) {
  return pixelOwnerColors[owner] ?? "#ffffff";
}

function readPixelLocalBest() {
  pixelLocalBest = Math.max(0, readStoredNumber(pixelLocalBestKey));
}

function writePixelLocalBest(value: number) {
  pixelLocalBest = Math.max(pixelLocalBest, value);
  writeStoredNumber(pixelLocalBestKey, pixelLocalBest);
}

function renderPixelScores() {
  setText(pixelLocalScoreEls, `${formatScore(pixelLocalBest)}%`);
  pixelMenuTurrets.textContent = `${pixelHumanSlots + pixelBotCount}`;
}

function syncPixelConfigFromInputs() {
  pixelMode = pixelModeInput.value === "multi" ? "multi" : "single";
  pixelHumanSlots =
    pixelMode === "multi" ? clampNumber(Math.round(Number(pixelHumansInput.value) || 1), 1, pixelMaxPlayers) : 1;
  pixelBotCount = clampNumber(
    Math.round(Number(pixelBotsInput.value) || 0),
    0,
    Math.max(0, pixelMaxPlayers - pixelHumanSlots),
  );
  pixelBotsInput.value = `${pixelBotCount}`;
  pixelHumansInput.value = `${pixelHumanSlots}`;
  pixelBotsInput.max = `${Math.max(0, pixelMaxPlayers - pixelHumanSlots)}`;
  pixelHumansInput.disabled = pixelMode === "single";
  renderPixelScores();
}

function pixelLayout(): PixelBoardLayout {
  const canvasW = canvas.width / dpr;
  const canvasH = canvas.height / dpr;
  const panelX = Math.round(canvasW * 0.58);
  const padding = Math.max(12, Math.min(28, canvasW * 0.024));
  const availableW = panelX - padding * 2;
  const availableH = canvasH - padding * 2;
  const cellSize = Math.floor(Math.max(5, Math.min(availableW / pixelColumns, availableH / pixelRows)));
  const boardW = cellSize * pixelColumns;
  const boardH = cellSize * pixelRows;
  return {
    boardH,
    boardW,
    canvasH,
    canvasW,
    cellH: cellSize,
    cellW: cellSize,
    panelX,
    x: Math.round((panelX - boardW) * 0.5),
    y: Math.round((canvasH - boardH) * 0.5),
  };
}

function clampPixelTurretAngle(turret: PixelTurret, angle: number) {
  if (turret.arc >= Math.PI) {
    return normalizeAngle(angle);
  }
  const delta = clampNumber(normalizeAngle(angle - turret.homeAngle), -turret.arc, turret.arc);
  return normalizeAngle(turret.homeAngle + delta);
}

function pixelSpawnAnchors(layout: PixelBoardLayout) {
  const left = layout.x;
  const centerX = layout.x + layout.boardW / 2;
  const right = layout.x + layout.boardW;
  const top = layout.y;
  const centerY = layout.y + layout.boardH / 2;
  const bottom = layout.y + layout.boardH;
  return [
    { x: centerX, y: bottom },
    { x: left, y: top },
    { x: centerX, y: top },
    { x: right, y: top },
    { x: right, y: centerY },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: centerY },
    { x: centerX, y: centerY },
  ];
}

function setPixelTurretPosition(turret: PixelTurret, index: number) {
  const layout = pixelLayout();
  const centerX = layout.x + layout.boardW / 2;
  const centerY = layout.y + layout.boardH / 2;
  const anchor = pixelSpawnAnchors(layout)[index % pixelMaxPlayers];
  turret.x = anchor.x;
  turret.y = anchor.y;
  const centered = Math.abs(turret.x - centerX) < 1 && Math.abs(turret.y - centerY) < 1;
  turret.homeAngle = centered ? -Math.PI / 2 : Math.atan2(centerY - turret.y, centerX - turret.x);
  turret.arc = centered ? Math.PI : Math.PI * 0.42;
  turret.angle = clampPixelTurretAngle(turret, turret.angle || turret.homeAngle);
}

function positionPixelTurrets() {
  pixelTurrets.forEach((turret, index) => setPixelTurretPosition(turret, index));
}

function createPixelTurret(id: PixelOwner, isPlayer: boolean): PixelTurret {
  const color = pixelOwnerColor(id);
  return {
    aiTargetTimer: 0,
    angle: isPlayer ? -Math.PI / 2 : Math.PI / 2,
    arc: Math.PI * 0.4,
    color,
    fireCooldown: Math.random() * pixelBaseFireInterval,
    fireInterval: pixelBaseFireInterval,
    homeAngle: isPlayer ? -Math.PI / 2 : Math.PI / 2,
    id,
    isPlayer,
    rotateDirection: Math.random() < 0.5 ? -1 : 1,
    rotateSpeed: isPlayer ? 0.8 : 0.55 + Math.random() * 0.5,
    x: 0,
    y: 0,
  };
}

function resetPixelWars() {
  syncPixelConfigFromInputs();
  pixelCells = Array.from({ length: pixelColumns * pixelRows }, () => "neutral");
  pixelShots = [];
  pixelAimActive = false;
  pixelAimPointerId = null;
  pixelTerritory = 0;
  pixelTurrets = [createPixelTurret("player", true)];
  for (let human = 2; human <= pixelHumanSlots; human += 1) {
    pixelTurrets.push(createPixelTurret(`human-${human}` as PixelOwner, false));
  }
  for (let bot = 1; bot <= pixelBotCount; bot += 1) {
    pixelTurrets.push(createPixelTurret(`bot-${bot}` as PixelOwner, false));
  }
  positionPixelTurrets();
  updatePixelScore();
}

function updatePixelScore() {
  if (pixelCells.length === 0) {
    pixelTerritory = 0;
    scoreLabel.textContent = "Claim";
    scoreEl.textContent = "0%";
    return;
  }
  const owned = pixelCells.filter((owner) => owner === "player").length;
  pixelTerritory = Math.round((owned / pixelCells.length) * 1000) / 10;
  scoreLabel.textContent = "Claim";
  scoreEl.textContent = `${formatScore(pixelTerritory)}%`;
  if (pixelTerritory > pixelLocalBest) {
    writePixelLocalBest(pixelTerritory);
    renderPixelScores();
  }
}

function startPixelWars() {
  unlockAudio();
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  resetPixelWars();
  state = "pixel-running";
  overlay.hidden = true;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = false;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  updateRollButton();
}

function showPixelMenu() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  readPixelLocalBest();
  syncPixelConfigFromInputs();
  state = "pixel-menu";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = false;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  updateRollButton();
}

function showPixelOptions() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  state = "pixel-options";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = false;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  issueStatus.textContent = "";
  updateRollButton();
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = false;
  bridgeControls.hidden = true;
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  issueStatus.textContent = "";
  updateSoundButtons();
  updateRollButton();
}

function showBridgeMenu() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  readBridgeLocalScores();
  renderBridgeHighScores();
  void loadServerBridgeHighScores();
  void loadBridgeJackpot();
  state = "bridge-menu";
  scoreEl.textContent = "0";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = false;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  updateBridgeControls();
  updateRollButton();
}

function showBridgeOptions() {
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  state = "bridge-options";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = false;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  issueStatus.textContent = "";
  updateSoundButtons();
  updateRollButton();
}

function showReportIssue(
  game: "jumpy-plane" | "shooting-snakes" | "glass-bridge" | "pixel-wars",
  returnState: "plane-options" | "snake-options" | "bridge-options" | "pixel-options",
) {
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = false;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = true;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  issueText.value = "";
  issueStatus.textContent = "";
  issueText.focus();
  updateRollButton();
}

function returnFromReportIssue() {
  if (reportReturnState === "pixel-options") {
    showPixelOptions();
  } else if (reportReturnState === "bridge-options") {
    showBridgeOptions();
  } else if (reportReturnState === "snake-options") {
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = false;
  scorePanel.hidden = false;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
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

function randomInteger(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomChoice<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function delay(milliseconds: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function bridgePuzzleDifficulty() {
  return bridgeTiles * 1.45 + bridgePoints * 0.85;
}

function bridgePuzzleTier(difficulty: number) {
  if (difficulty < 5) {
    return 0;
  }
  if (difficulty < 13) {
    return 1;
  }
  if (difficulty < 25) {
    return 2;
  }
  return 3;
}

function generateBridgePuzzle(
  correctSide: BridgeSide,
  difficulty: number,
  forcedOperation?: BridgeOperation,
  difficultyTierBonus = 0,
): BridgePuzzle {
  const tier = Math.min(3, bridgePuzzleTier(difficulty) + difficultyTierBonus);
  const operationsByTier: BridgeOperation[][] = [
    ["+", "-", "+"],
    ["+", "-", "x"],
    ["+", "-", "x", "/"],
    ["+", "-", "x", "/", "x"],
  ];
  const operation = forcedOperation ?? randomChoice(operationsByTier[tier]);
  let left = randomInteger(1, tier === 0 ? 10 : tier === 1 ? 18 : tier === 2 ? 30 : 48);
  let right = randomInteger(1, tier === 0 ? 10 : tier === 1 ? 18 : tier === 2 ? 30 : 48);
  let answer = 0;
  let prompt = "";

  if (operation === "+") {
    answer = left + right;
    prompt = `${left} + ${right}`;
  } else if (operation === "-") {
    if (right > left) {
      [left, right] = [right, left];
    }
    answer = left - right;
    prompt = `${left} - ${right}`;
  } else if (operation === "x") {
    left = randomInteger(
      tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 4 : 6,
      tier === 0 ? 6 : tier === 1 ? 9 : tier === 2 ? 12 : 14,
    );
    right = randomInteger(2, tier === 0 ? 6 : tier === 1 ? 9 : tier === 2 ? 11 : 12);
    answer = left * right;
    prompt = `${left} x ${right}`;
  } else {
    answer = randomInteger(
      tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 4 : 6,
      tier === 0 ? 8 : tier === 1 ? 12 : tier === 2 ? 16 : 20,
    );
    right = randomInteger(2, tier === 0 ? 6 : tier === 1 ? 9 : tier === 2 ? 10 : 12);
    left = answer * right;
    prompt = `${left} / ${right}`;
  }

  const offsets = tier < 2 ? [-3, -2, -1, 1, 2, 3] : [-8, -5, -3, -2, 2, 3, 5, 8];
  const offset = randomChoice(offsets);
  let wrongAnswer = Math.max(0, answer + offset);
  if (wrongAnswer === answer) {
    wrongAnswer += 1;
  }

  return {
    answers: {
      left: correctSide === "left" ? answer : wrongAnswer,
      right: correctSide === "right" ? answer : wrongAnswer,
    },
    correctSide,
    operation,
    prompt,
  };
}

function ensureBridgeRows(count: number) {
  while (bridgeSafePath.length < count) {
    const correctSide = Math.random() < 0.5 ? "left" : "right";
    bridgeSafePath.push(correctSide);
    bridgePuzzles.push(generateBridgePuzzle(correctSide, bridgePuzzles.length));
  }
}

function wheelTotalWeight(segments: { weight: number }[]) {
  return segments.reduce((total, segment) => total + segment.weight, 0);
}

function wheelSegmentBounds(segments: { weight: number }[], index: number) {
  const totalWeight = wheelTotalWeight(segments);
  const startWeight = segments.slice(0, index).reduce((total, segment) => total + segment.weight, 0);
  const start = (Math.PI * 2 * startWeight) / totalWeight;
  const end = start + (Math.PI * 2 * segments[index].weight) / totalWeight;
  return { center: start + (end - start) / 2, end, start };
}

function randomWeightedSegmentIndex(segments: { weight: number }[], firstIndex = 0) {
  const weightedSegments = segments.slice(firstIndex);
  const totalWeight = wheelTotalWeight(weightedSegments);
  let roll = Math.random() * totalWeight;
  for (let index = 0; index < weightedSegments.length; index += 1) {
    roll -= weightedSegments[index].weight;
    if (roll <= 0) {
      return index + firstIndex;
    }
  }

  return segments.length - 1;
}

function randomBridgeNormalWheelIndex() {
  return randomWeightedSegmentIndex(bridgeWheelSegments, 1);
}

function wheelLandingTargetAngle(currentAngle: number, segments: { weight: number }[], outcomeIndex: number) {
  const segmentBounds = wheelSegmentBounds(segments, outcomeIndex);
  const targetAngle = -Math.PI / 2 - segmentBounds.center;
  const fullTurn = Math.PI * 2;
  const catchUpTurns = Math.ceil((currentAngle - targetAngle) / fullTurn);
  return targetAngle + (catchUpTurns + 4) * fullTurn;
}

function bridgeHintOutcomeLabel(outcome: BridgeHintOutcome) {
  return outcome.face ? `${outcome.label} ${outcome.face}` : outcome.label;
}

function resetBridgeRun() {
  bridgeSafePath = [];
  bridgePuzzles = [];
  bridgeStep = 0;
  bridgeTiles = 0;
  bridgePoints = 0;
  bridgeHint = null;
  bridgeBrokenSide = null;
  bridgePlayerSide = null;
  bridgeStandingSide = null;
  bridgePendingSide = null;
  bridgeJumpTimer = 0;
  bridgeSuccessTimer = 0;
  bridgeScrollTimer = 0;
  bridgeWheelLabel = "Ready";
  bridgeWheelTimer = 0;
  bridgeWheelSpinTimer = 0;
  bridgeWheelAngle = 0;
  bridgeWheelStartAngle = 0;
  bridgeWheelTargetAngle = 0;
  bridgePendingWheelOutcome = null;
  bridgeWheelRequesting = false;
  bridgeWheelSpinSequence += 1;
  bridgeHintWheelLabel = "Hint";
  bridgeHintWheelTimer = 0;
  bridgeHintWheelSpinTimer = 0;
  bridgeHintWheelAngle = 0;
  bridgeHintWheelStartAngle = 0;
  bridgeHintWheelTargetAngle = 0;
  bridgePendingHintOutcome = null;
  bridgeHintWheelRequesting = false;
  bridgeHintWheelSpinSequence += 1;
  bridgeFallTimer = 0;
  ensureBridgeRows(bridgeVisibleRows + 3);
}

function bridgeWheelBusy() {
  return (
    bridgeFallTimer > 0 ||
    bridgeJumpTimer > 0 ||
    bridgeSuccessTimer > 0 ||
    bridgeScrollTimer > 0 ||
    bridgeWheelRequesting ||
    bridgeWheelSpinTimer > 0 ||
    bridgeHintWheelRequesting ||
    bridgeHintWheelSpinTimer > 0
  );
}

function updateBridgeControls() {
  const bridgeBusy = bridgeWheelBusy();
  const hasPoints = bridgePoints >= bridgeWheelCost;
  const hintUsed = bridgeHint?.pathIndex === bridgeStep;
  bridgeHintSpinButton.disabled = state !== "bridge-running" || bridgeBusy || !hasPoints || hintUsed;
  bridgeHintSpinButton.textContent = !hasPoints ? "Need 1 point" : hintUsed ? "Hint used" : "Hint wheel (-1)";
  bridgeSpinButton.disabled = state !== "bridge-running" || bridgeBusy || !hasPoints;
  bridgeSpinButton.textContent = hasPoints ? "Point wheel (-1)" : "Need 1 point";
}

function updateBridgeScore() {
  if (state !== "bridge-running" && state !== "bridge-dead") {
    return;
  }
  scoreLabel.textContent = "Points";
  scoreEl.textContent = formatScore(bridgePoints);
  updateBridgeControls();
}

function showBridgeDead() {
  state = "bridge-dead";
  scoreLabel.textContent = "Points";
  overlay.hidden = false;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = false;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = false;
  homeButton.hidden = false;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  writeBridgeLocalScores(bridgeTiles, bridgePoints);
  renderBridgeHighScores();
  void syncFinalBridgeScores(bridgeTiles, bridgePoints);
  bridgeMessage.textContent = `Tiles ${formatScore(bridgeTiles)}. Points ${formatScore(bridgePoints)}.`;
  updateBridgeScore();
  updateRollButton();
}

function startBridgeGame() {
  unlockAudio();
  leaveSnakeRoom();
  setSnakeLayout(false);
  resetSnakeJoystick();
  resetBridgeRun();
  void loadBridgeJackpot();
  scoreLabel.textContent = "Points";
  state = "bridge-running";
  overlay.hidden = true;
  overlay.classList.remove("is-platform");
  platformPanel.hidden = true;
  gameMenuPanel.hidden = true;
  planeOptionsPanel.hidden = true;
  crashPanel.hidden = true;
  snakeMenuPanel.hidden = true;
  snakeOptionsPanel.hidden = true;
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  scorePanel.hidden = false;
  homeButton.hidden = false;
  startButton.hidden = true;
  restartButton.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = false;
  updateBridgeScore();
  updateRollButton();
}

function chooseBridgeSide(side: BridgeSide) {
  if (state !== "bridge-running" || bridgeWheelBusy()) {
    return;
  }

  unlockAudio();
  ensureBridgeRows(bridgeStep + bridgeVisibleRows + 3);
  bridgePendingSide = side;
  bridgePlayerSide = side;
  bridgeBrokenSide = null;
  bridgeJumpTimer = bridgeJumpDuration;
  updateBridgeControls();
}

function resolveBridgeChoice() {
  if (!bridgePendingSide) {
    return;
  }

  const side = bridgePendingSide;
  bridgePendingSide = null;
  const safeSide = bridgeSafePath[bridgeStep];
  if (side === safeSide) {
    bridgePlayerSide = side;
    bridgeTiles += 1;
    bridgePoints += 1;
    bridgeBrokenSide = null;
    bridgeWheelLabel = "+1";
    bridgeWheelTimer = 0.75;
    bridgeSuccessTimer = bridgeSuccessDuration;
    playBridgeStepSound();
    updateBridgeScore();
    return;
  }

  bridgeBrokenSide = side;
  bridgePlayerSide = side;
  bridgeFallTimer = bridgeFallDuration;
  playBridgeBreakSound();
  updateBridgeControls();
}

async function spinBridgeWheel() {
  if (state !== "bridge-running" || bridgeWheelBusy() || bridgePoints < bridgeWheelCost) {
    return;
  }

  unlockAudio();
  bridgePoints -= bridgeWheelCost;
  bridgeWheelRequesting = true;
  bridgeWheelLabel = "Spinning";
  const spinSequence = ++bridgeWheelSpinSequence;
  playBridgeWheelSound();
  updateBridgeScore();

  const [jackpotSpin] = await Promise.all([
    submitBridgeJackpotSpin(),
    delay(bridgeWheelPreSpinDuration * 1000),
  ]);
  if (spinSequence !== bridgeWheelSpinSequence || state !== "bridge-running") {
    return;
  }

  bridgeWheelRequesting = false;
  if (!jackpotSpin) {
    bridgePoints += bridgeWheelCost;
    bridgeWheelLabel = "Offline";
    bridgeWheelTimer = 1.4;
    updateBridgeScore();
    return;
  }

  bridgeJackpot = Math.max(0, Number(jackpotSpin.jackpot) || bridgeJackpot);
  const award = Math.max(0, Math.floor(Number(jackpotSpin.award) || 0));
  const hitJackpot = jackpotSpin.hit === true && award > 0;
  const outcomeIndex = hitJackpot ? bridgeJackpotSegmentIndex : randomBridgeNormalWheelIndex();
  const outcome = hitJackpot
    ? {
        color: bridgeWheelSegments[bridgeJackpotSegmentIndex].color,
        label: `JP +${formatScore(award)}`,
        apply: (points: number) => points + award,
        weight: bridgeWheelSegments[bridgeJackpotSegmentIndex].weight,
      }
    : bridgeWheelSegments[outcomeIndex];
  bridgePendingWheelOutcome = outcome;
  bridgeWheelStartAngle = bridgeWheelAngle;
  bridgeWheelTargetAngle = wheelLandingTargetAngle(bridgeWheelAngle, bridgeWheelSegments, outcomeIndex);
  bridgeWheelLabel = "Spinning";
  bridgeWheelTimer = bridgeWheelSpinDuration;
  bridgeWheelSpinTimer = bridgeWheelSpinDuration;
  updateBridgeScore();
}

async function spinBridgeHintWheel() {
  if (
    state !== "bridge-running" ||
    bridgeWheelBusy() ||
    bridgePoints < bridgeWheelCost ||
    bridgeHint?.pathIndex === bridgeStep
  ) {
    return;
  }

  unlockAudio();
  const difficulty = bridgePuzzleDifficulty();
  bridgePoints -= bridgeWheelCost;
  bridgeHintWheelRequesting = true;
  bridgeHintWheelLabel = "Spinning";
  const spinSequence = ++bridgeHintWheelSpinSequence;
  playBridgeWheelSound();
  updateBridgeScore();

  const [jackpotContribution] = await Promise.all([
    submitBridgeJackpotContribution(),
    delay(bridgeWheelPreSpinDuration * 1000),
  ]);
  if (spinSequence !== bridgeHintWheelSpinSequence || state !== "bridge-running") {
    return;
  }

  bridgeHintWheelRequesting = false;
  if (!jackpotContribution) {
    bridgePoints += bridgeWheelCost;
    bridgeHintWheelLabel = "Offline";
    bridgeHintWheelTimer = 1.4;
    updateBridgeScore();
    return;
  }

  const outcomeIndex = randomWeightedSegmentIndex(bridgeHintWheelSegments);
  bridgePendingHintOutcome = bridgeHintWheelSegments[outcomeIndex];
  if (bridgePendingHintOutcome.kind === "math" && bridgePendingHintOutcome.operation) {
    bridgePuzzles[bridgeStep] = generateBridgePuzzle(
      bridgeSafePath[bridgeStep],
      difficulty,
      bridgePendingHintOutcome.operation,
      bridgePendingHintOutcome.difficultyTierBonus ?? 0,
    );
  }
  bridgeHintWheelStartAngle = bridgeHintWheelAngle;
  bridgeHintWheelTargetAngle = wheelLandingTargetAngle(
    bridgeHintWheelAngle,
    bridgeHintWheelSegments,
    outcomeIndex,
  );
  bridgeHintWheelLabel = "Spinning";
  bridgeHintWheelTimer = bridgeWheelSpinDuration;
  bridgeHintWheelSpinTimer = bridgeWheelSpinDuration;
  updateBridgeScore();
}

function updateBridge(dt: number) {
  if (state !== "bridge-running") {
    return;
  }

  bridgeWheelTimer = Math.max(0, bridgeWheelTimer - dt);
  if (bridgeWheelRequesting && bridgeWheelSpinTimer <= 0) {
    bridgeWheelAngle = (bridgeWheelAngle + bridgeWheelPreSpinSpeed * dt) % (Math.PI * 2);
  }
  bridgeHintWheelTimer = Math.max(0, bridgeHintWheelTimer - dt);
  if (bridgeHintWheelRequesting && bridgeHintWheelSpinTimer <= 0) {
    bridgeHintWheelAngle = (bridgeHintWheelAngle + bridgeWheelPreSpinSpeed * dt) % (Math.PI * 2);
  }
  if (bridgeWheelSpinTimer > 0) {
    bridgeWheelSpinTimer = Math.max(0, bridgeWheelSpinTimer - dt);
    const progress = 1 - bridgeWheelSpinTimer / bridgeWheelSpinDuration;
    const eased = 1 - (1 - progress) ** 3;
    bridgeWheelAngle = bridgeWheelStartAngle + (bridgeWheelTargetAngle - bridgeWheelStartAngle) * eased;
    if (bridgeWheelSpinTimer <= 0 && bridgePendingWheelOutcome) {
      bridgeWheelAngle = bridgeWheelTargetAngle;
      bridgePoints = Math.max(0, bridgePendingWheelOutcome.apply(bridgePoints));
      bridgeWheelLabel = bridgePendingWheelOutcome.label;
      bridgePendingWheelOutcome = null;
      bridgeWheelTimer = 1.4;
      updateBridgeScore();
    }
  }
  if (bridgeHintWheelSpinTimer > 0) {
    bridgeHintWheelSpinTimer = Math.max(0, bridgeHintWheelSpinTimer - dt);
    const progress = 1 - bridgeHintWheelSpinTimer / bridgeWheelSpinDuration;
    const eased = 1 - (1 - progress) ** 3;
    bridgeHintWheelAngle =
      bridgeHintWheelStartAngle + (bridgeHintWheelTargetAngle - bridgeHintWheelStartAngle) * eased;
    if (bridgeHintWheelSpinTimer <= 0 && bridgePendingHintOutcome) {
      bridgeHintWheelAngle = bridgeHintWheelTargetAngle;
      bridgeHint = { kind: bridgePendingHintOutcome.kind, pathIndex: bridgeStep };
      bridgeHintWheelLabel = bridgeHintOutcomeLabel(bridgePendingHintOutcome);
      bridgePendingHintOutcome = null;
      bridgeHintWheelTimer = 1.4;
      updateBridgeScore();
    }
  }
  if (bridgeJumpTimer > 0) {
    bridgeJumpTimer = Math.max(0, bridgeJumpTimer - dt);
    if (bridgeJumpTimer <= 0) {
      resolveBridgeChoice();
    }
  }
  if (bridgeSuccessTimer > 0) {
    bridgeSuccessTimer = Math.max(0, bridgeSuccessTimer - dt);
    if (bridgeSuccessTimer <= 0) {
      bridgeStandingSide = bridgePlayerSide;
      bridgeStep += 1;
      bridgeScrollTimer = bridgeScrollDuration;
      ensureBridgeRows(bridgeStep + bridgeVisibleRows + 3);
      updateBridgeScore();
    }
  }
  if (bridgeScrollTimer > 0) {
    bridgeScrollTimer = Math.max(0, bridgeScrollTimer - dt);
    if (bridgeScrollTimer <= 0) {
      updateBridgeScore();
    }
  }
  if (bridgeFallTimer > 0) {
    bridgeFallTimer = Math.max(0, bridgeFallTimer - dt);
    if (bridgeFallTimer <= 0) {
      showBridgeDead();
    }
  }
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

function pixelCellIndexAt(x: number, y: number, layout = pixelLayout()) {
  if (x < layout.x || x >= layout.x + layout.boardW || y < layout.y || y >= layout.y + layout.boardH) {
    return -1;
  }
  const column = Math.floor((x - layout.x) / layout.cellW);
  const row = Math.floor((y - layout.y) / layout.cellH);
  if (column < 0 || column >= pixelColumns || row < 0 || row >= pixelRows) {
    return -1;
  }
  return row * pixelColumns + column;
}

function paintPixelCell(index: number, owner: PixelOwner) {
  if (index < 0 || index >= pixelCells.length) {
    return;
  }
  const currentOwner = pixelCells[index];
  if (currentOwner === "neutral") {
    pixelCells[index] = owner;
  } else if (currentOwner !== owner) {
    pixelCells[index] = "neutral";
  }
}

function firePixelShot(turret: PixelTurret) {
  const barrel = 18;
  pixelShots.push({
    color: turret.color,
    lastCell: -1,
    life: 2.2,
    owner: turret.id,
    vx: Math.cos(turret.angle) * pixelShotSpeed,
    vy: Math.sin(turret.angle) * pixelShotSpeed,
    x: turret.x + Math.cos(turret.angle) * barrel,
    y: turret.y + Math.sin(turret.angle) * barrel,
  });
}

function steerPixelTurret(turret: PixelTurret, dt: number) {
  if (turret.isPlayer && pixelAimActive) {
    turret.angle = clampPixelTurretAngle(turret, Math.atan2(pixelAimY - turret.y, pixelAimX - turret.x));
    return;
  }

  if (!turret.isPlayer) {
    turret.aiTargetTimer -= dt;
    if (turret.aiTargetTimer <= 0) {
      const layout = pixelLayout();
      const targetOwner = Math.random() < 0.68 ? "neutral" : "player";
      const targetIndexes = pixelCells
        .map((owner, index) => ({ index, owner }))
        .filter((cell) => cell.owner === targetOwner || (targetOwner !== "neutral" && cell.owner !== turret.id));
      const choice = targetIndexes[Math.floor(Math.random() * targetIndexes.length)]?.index ?? Math.floor(Math.random() * pixelCells.length);
      const column = choice % pixelColumns;
      const row = Math.floor(choice / pixelColumns);
      const targetX = layout.x + column * layout.cellW + layout.cellW / 2;
      const targetY = layout.y + row * layout.cellH + layout.cellH / 2;
      const targetAngle = clampPixelTurretAngle(turret, Math.atan2(targetY - turret.y, targetX - turret.x));
      const delta = normalizeAngle(targetAngle - turret.angle);
      turret.rotateDirection = delta >= 0 ? 1 : -1;
      turret.aiTargetTimer = 0.35 + Math.random() * 1.1;
      turret.angle = clampPixelTurretAngle(
        turret,
        turret.angle + clampNumber(delta, -turret.rotateSpeed * dt * 3, turret.rotateSpeed * dt * 3),
      );
      return;
    }
  }

  turret.angle = clampPixelTurretAngle(turret, turret.angle + turret.rotateDirection * turret.rotateSpeed * dt);
  if (Math.abs(normalizeAngle(turret.angle - turret.homeAngle)) > turret.arc * 0.98) {
    turret.rotateDirection *= -1;
  }
}

function updatePixelWars(dt: number) {
  if (state !== "pixel-running") {
    return;
  }

  positionPixelTurrets();
  pixelTurrets.forEach((turret) => {
    steerPixelTurret(turret, dt);
    turret.fireCooldown -= dt;
    if (turret.fireCooldown <= 0) {
      firePixelShot(turret);
      turret.fireCooldown = turret.fireInterval * (0.82 + Math.random() * 0.36);
    }
  });

  const layout = pixelLayout();
  for (let index = pixelShots.length - 1; index >= 0; index -= 1) {
    const shot = pixelShots[index];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    const cellIndex = pixelCellIndexAt(shot.x, shot.y, layout);
    if (cellIndex !== -1 && cellIndex !== shot.lastCell) {
      paintPixelCell(cellIndex, shot.owner);
      pixelShots.splice(index, 1);
      continue;
    }
    const outside = shot.x < -80 || shot.x > layout.canvasW + 80 || shot.y < -80 || shot.y > layout.canvasH + 80;
    if (shot.life <= 0 || outside) {
      pixelShots.splice(index, 1);
    }
  }

  updatePixelScore();
}

function drawPixelTileGrid(layout: PixelBoardLayout) {
  for (let row = 0; row < pixelRows; row += 1) {
    for (let column = 0; column < pixelColumns; column += 1) {
      const owner = pixelCells[row * pixelColumns + column] ?? "neutral";
      ctx.fillStyle = pixelOwnerColor(owner);
      ctx.globalAlpha = owner === "neutral" ? 0.78 : 0.95;
      ctx.fillRect(
        layout.x + column * layout.cellW,
        layout.y + row * layout.cellH,
        Math.max(1, layout.cellW - 1),
        Math.max(1, layout.cellH - 1),
      );
    }
  }
  ctx.globalAlpha = 1;
}

function drawPixelTurret(turret: PixelTurret) {
  const radius = turret.isPlayer ? 13 : 11;
  ctx.save();
  ctx.translate(turret.x, turret.y);
  ctx.rotate(turret.angle);
  ctx.fillStyle = "rgba(8, 12, 22, 0.9)";
  ctx.beginPath();
  roundedRectPath(0, -5, 28, 10, 5);
  ctx.fill();
  ctx.fillStyle = turret.color;
  ctx.fillRect(16, -3, 18, 6);
  ctx.restore();

  ctx.save();
  ctx.translate(turret.x, turret.y);
  ctx.shadowBlur = turret.isPlayer ? 18 : 10;
  ctx.shadowColor = turret.color;
  ctx.fillStyle = turret.color;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.74)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(7, 12, 22, 0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPixelWars(time: number) {
  const layout = pixelLayout();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const background = ctx.createLinearGradient(0, 0, layout.canvasW, layout.canvasH);
  background.addColorStop(0, "#111827");
  background.addColorStop(0.56, "#172033");
  background.addColorStop(1, "#231b32");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#50d7ff";
  ctx.lineWidth = 1;
  const gridOffset = (time * 18) % 32;
  for (let x = -gridOffset; x < layout.canvasW; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, layout.canvasH);
    ctx.stroke();
  }
  for (let y = -gridOffset; y < layout.canvasH; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(layout.canvasW, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = "rgba(3, 7, 16, 0.5)";
  ctx.fillRect(layout.panelX, 0, layout.canvasW - layout.panelX, layout.canvasH);
  ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
  ctx.font = "900 18px Inter, sans-serif";
  ctx.fillText("Systems", layout.panelX + 22, 36);
  ctx.font = "800 14px Inter, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.66)";
  ctx.fillText(`Turrets ${pixelTurrets.length}`, layout.panelX + 22, 66);
  ctx.fillText(`Claim ${formatScore(pixelTerritory)}%`, layout.panelX + 22, 90);

  ctx.save();
  ctx.shadowBlur = 24;
  ctx.shadowColor = "rgba(80, 215, 255, 0.42)";
  ctx.fillStyle = "rgba(11, 16, 28, 0.92)";
  ctx.strokeStyle = "rgba(168, 232, 255, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundedRectPath(layout.x - 3, layout.y - 3, layout.boardW + 6, layout.boardH + 6, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawPixelTileGrid(layout);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let column = 0; column <= pixelColumns; column += 6) {
    const x = layout.x + column * layout.cellW;
    ctx.beginPath();
    ctx.moveTo(x, layout.y);
    ctx.lineTo(x, layout.y + layout.boardH);
    ctx.stroke();
  }
  for (let row = 0; row <= pixelRows; row += 6) {
    const y = layout.y + row * layout.cellH;
    ctx.beginPath();
    ctx.moveTo(layout.x, y);
    ctx.lineTo(layout.x + layout.boardW, y);
    ctx.stroke();
  }
  ctx.restore();

  pixelShots.forEach((shot) => {
    ctx.save();
    ctx.shadowBlur = 14;
    ctx.shadowColor = shot.color;
    ctx.fillStyle = shot.color;
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  pixelTurrets.forEach(drawPixelTurret);

  if (state === "pixel-menu" || state === "pixel-options") {
    ctx.fillStyle = "rgba(5, 9, 20, 0.48)";
    ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);
  }
}

function roundedRectPath(x: number, y: number, rectWidth: number, rectHeight: number, radius: number) {
  const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + rectWidth - r, y);
  ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + r);
  ctx.lineTo(x + rectWidth, y + rectHeight - r);
  ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - r, y + rectHeight);
  ctx.lineTo(x + r, y + rectHeight);
  ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function bridgeAreas(canvasWidth: number): BridgeAreas {
  const wheelWidth = Math.min(300, Math.max(150, canvasWidth * 0.32));
  return {
    boardWidth: canvasWidth - wheelWidth,
    wheelWidth,
    wheelX: canvasWidth - wheelWidth,
  };
}

function bridgePanelRects(canvasWidth: number, canvasHeight: number) {
  const areas = bridgeAreas(canvasWidth);
  const panelWidth = Math.min(170, areas.boardWidth * 0.32);
  const visibleAheadRows = canvasHeight < 320 ? 4 : 6;
  const firstRow = bridgeStep > 0 ? -1 : 0;
  const lastRow = visibleAheadRows - 1;
  const rowCount = lastRow - firstRow + 1;
  const topMargin = Math.max(50, canvasHeight * 0.14);
  const bottomClearance = Math.max(62, canvasHeight * 0.2);
  const bottomY = canvasHeight - bottomClearance;
  const basePanelHeight = Math.min(68, Math.max(26, canvasHeight * 0.12));
  const rowPitch = Math.max(20, (bottomY - topMargin - basePanelHeight) / Math.max(1, rowCount - 1));
  const panelHeight = Math.min(basePanelHeight, Math.max(18, rowPitch * 0.76));
  const scrollOffset = bridgeScrollTimer > 0 ? -rowPitch * (bridgeScrollTimer / bridgeScrollDuration) : 0;
  const gap = Math.min(38, areas.boardWidth * 0.06);
  const centerX = areas.boardWidth / 2;
  const leftX = centerX - panelWidth - gap / 2;
  const rightX = centerX + gap / 2;
  const rects: BridgePanelRect[] = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    const pathIndex = bridgeStep + row;
    const y = bottomY - panelHeight - (row - firstRow) * rowPitch + scrollOffset;
    const scale = Math.max(0.72, 1 - row * 0.045);
    const offsetX = (1 - scale) * panelWidth * 0.5;
    (["left", "right"] as BridgeSide[]).forEach((side) => {
      rects.push({
        h: panelHeight * scale,
        pathIndex,
        row,
        side,
        w: panelWidth * scale,
        x: (side === "left" ? leftX : rightX) + offsetX,
        y,
      });
    });
  }

  return rects;
}

function bridgePanelAtPoint(x: number, y: number) {
  return bridgePanelRects(canvas.width / dpr, canvas.height / dpr).find(
    (panel) =>
      panel.row === 0 &&
      x >= panel.x &&
      x <= panel.x + panel.w &&
      y >= panel.y &&
      y <= panel.y + panel.h,
  );
}

function drawBridgeWheelFace<T extends { color?: string; label: string; weight: number }>(
  segments: T[],
  angle: number,
  centerX: number,
  centerY: number,
  radius: number,
  isPointWheel: boolean,
  labelLines: (segment: T, index: number) => string[],
) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  segments.forEach((segment, index) => {
    const { center, end, start } = wheelSegmentBounds(segments, index);
    ctx.fillStyle =
      segment.color ?? (index % 2 === 0 ? "rgba(127, 223, 255, 0.82)" : "rgba(255, 216, 90, 0.86)");
    ctx.strokeStyle = "rgba(8, 18, 32, 0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, end);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const lines = labelLines(segment, index);
    ctx.save();
    ctx.rotate(center);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = index === bridgeJackpotSegmentIndex && isPointWheel ? "#ffffff" : "#10253d";
    ctx.font = `900 ${Math.max(7, radius * (isPointWheel ? 0.11 : 0.1))}px Inter, sans-serif`;
    if (index === bridgeJackpotSegmentIndex && isPointWheel) {
      ctx.font = `900 ${Math.max(7, radius * 0.1)}px Inter, sans-serif`;
      ctx.strokeStyle = "rgba(58, 4, 16, 0.78)";
      ctx.lineWidth = 3;
    }
    lines.forEach((line, lineIndex) => {
      const offset = (lineIndex - (lines.length - 1) / 2) * Math.max(9, radius * 0.12);
      const textX = index === bridgeJackpotSegmentIndex && isPointWheel ? radius * 0.52 : radius * 0.66;
      if (index === bridgeJackpotSegmentIndex && isPointWheel) {
        ctx.strokeText(line, textX, offset);
      }
      ctx.fillText(line, textX, offset);
    });
    ctx.restore();
  });
  ctx.restore();

  ctx.fillStyle = "#ff5f76";
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius - 6);
  ctx.lineTo(centerX - 8, centerY - radius - 20);
  ctx.lineTo(centerX + 8, centerY - radius - 20);
  ctx.closePath();
  ctx.fill();
}

function drawBridgeWheelPanel(canvasHeight: number, areas: BridgeAreas) {
  ctx.fillStyle = "rgba(4, 10, 20, 0.74)";
  ctx.fillRect(areas.wheelX, 0, areas.wheelWidth, canvasHeight);
  ctx.strokeStyle = "rgba(205, 249, 255, 0.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(areas.wheelX, 0);
  ctx.lineTo(areas.wheelX, canvasHeight);
  ctx.stroke();

  const centerX = areas.wheelX + areas.wheelWidth / 2;
  const radius = Math.min(64, areas.wheelWidth * 0.28, canvasHeight * 0.12);
  const pointWheelY = Math.max(radius + 36, canvasHeight * 0.2);
  const hintWheelY = Math.max(pointWheelY + radius * 2 + 54, canvasHeight * 0.5);

  drawBridgeWheelFace(bridgeWheelSegments, bridgeWheelAngle, centerX, pointWheelY, radius, true, (outcome, index) =>
    index === bridgeJackpotSegmentIndex ? ["Jackpot"] : [outcome.label],
  );
  drawBridgeWheelFace(bridgeHintWheelSegments, bridgeHintWheelAngle, centerX, hintWheelY, radius, false, (outcome) => [
    outcome.label,
    outcome.face ?? "",
  ].filter(Boolean));

  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 15px Inter, sans-serif";
  ctx.fillText("Point Wheel", centerX, Math.max(22, pointWheelY - radius - 28));
  ctx.font = "900 17px Inter, sans-serif";
  ctx.fillText(
    bridgeWheelRequesting || bridgeWheelSpinTimer > 0 ? "Spinning" : bridgeWheelLabel,
    centerX,
    pointWheelY + radius + 24,
  );
  ctx.font = "900 15px Inter, sans-serif";
  ctx.fillText("Hint Wheel", centerX, hintWheelY - radius - 22);
  ctx.font = "900 17px Inter, sans-serif";
  ctx.fillText(
    bridgeHintWheelRequesting || bridgeHintWheelSpinTimer > 0 ? "Spinning" : bridgeHintWheelLabel,
    centerX,
    hintWheelY + radius + 24,
  );
  ctx.fillStyle = "#ffd85a";
  ctx.font = "900 12px Inter, sans-serif";
  ctx.fillText(`Jackpot ${formatScore(bridgeJackpot)}`, centerX, pointWheelY + radius + 42);

  const puzzle = bridgePuzzles[bridgeStep];
  const activeHint = bridgeHint?.pathIndex === bridgeStep ? bridgeHint : null;
  const promptY = Math.min(canvasHeight - 106, hintWheelY + radius + 44);
  ctx.fillStyle = "rgba(213, 245, 255, 0.12)";
  ctx.strokeStyle = "rgba(205, 249, 255, 0.32)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(areas.wheelX + 14, promptY, areas.wheelWidth - 28, 96, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d9f8ff";
  ctx.font = "900 12px Inter, sans-serif";
  ctx.fillText(activeHint ? "Hint" : "Choice", centerX, promptY + 23);
  ctx.fillStyle = "#ffffff";
  ctx.font = activeHint?.kind === "math" ? "900 22px Inter, sans-serif" : "900 16px Inter, sans-serif";
  ctx.fillText(activeHint?.kind === "math" ? `${puzzle?.prompt ?? "?"} = ?` : "Pick a glass tile", centerX, promptY + 54);
  ctx.fillStyle = "#afefff";
  ctx.font = "800 12px Inter, sans-serif";
  ctx.fillText(activeHint?.kind === "freebie" ? "Safe tile is glowing" : "Tap left or right glass", centerX, promptY + 78);
  ctx.textAlign = "left";
}

function drawBridgeGame(time: number) {
  const canvasWidth = canvas.width / dpr;
  const canvasHeight = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ensureBridgeRows(bridgeStep + bridgeVisibleRows + 2);

  const background = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  background.addColorStop(0, "#10253d");
  background.addColorStop(0.48, "#243b63");
  background.addColorStop(1, "#080d18");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 97 + time * 18) % (canvasWidth + 120) - 60;
    const y = (index * 53 + Math.sin(time + index) * 12) % canvasHeight;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (index % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  const areas = bridgeAreas(canvasWidth);
  drawBridgeWheelPanel(canvasHeight, areas);

  const centerX = areas.boardWidth / 2;
  const panels = bridgePanelRects(canvasWidth, canvasHeight);
  const panelBounds = panels.reduce(
    (bounds, panel) => ({
      bottom: Math.max(bounds.bottom, panel.y + panel.h),
      left: Math.min(bounds.left, panel.x),
      right: Math.max(bounds.right, panel.x + panel.w),
      top: Math.min(bounds.top, panel.y),
    }),
    { bottom: -Infinity, left: Infinity, right: -Infinity, top: Infinity },
  );

  ctx.fillStyle = "rgba(3, 7, 15, 0.48)";
  ctx.fillRect(
    panelBounds.left - 32,
    panelBounds.top - 32,
    panelBounds.right - panelBounds.left + 64,
    panelBounds.bottom - panelBounds.top + 84,
  );

  for (const panel of panels.sort((a, b) => b.row - a.row)) {
    const puzzle = bridgePuzzles[panel.pathIndex];
    const isBroken = panel.pathIndex === bridgeStep && bridgeBrokenSide === panel.side;
    const isLanded = panel.pathIndex === bridgeStep && bridgeSuccessTimer > 0 && bridgePlayerSide === panel.side;
    const isJumpTarget = panel.pathIndex === bridgeStep && bridgeJumpTimer > 0 && bridgePlayerSide === panel.side;
    const isTraversed = panel.row === -1 && panel.pathIndex === bridgeStep - 1 && bridgeStandingSide === panel.side;
    const isCurrent = panel.row === 0;
    const activeHint = bridgeHint?.pathIndex === panel.pathIndex ? bridgeHint : null;
    const isFreebieSafe =
      isCurrent && activeHint?.kind === "freebie" && bridgeSafePath[panel.pathIndex] === panel.side;
    const tint = "rgba(196, 242, 255, 0.34)";
    const x = panel.x;
    const y = panel.y;
    const w = panel.w;
    const h = panel.h;
    const scale = Math.max(0.72, 1 - panel.row * 0.045);
    if (panel.side === "left" && panel.pathIndex >= 0) {
      ctx.save();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isCurrent ? "#ffd85a" : isTraversed ? "#84ffb5" : "rgba(217, 248, 255, 0.8)";
      ctx.font = `900 ${Math.max(12, h * 0.28)}px Inter, sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 8;
      ctx.fillText(`${panel.pathIndex + 1}`, x - Math.max(10, 14 * scale), y + h * 0.5);
      ctx.restore();
    }

    const glass = ctx.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, "rgba(255, 255, 255, 0.78)");
    glass.addColorStop(0.45, tint);
    glass.addColorStop(1, "rgba(44, 179, 211, 0.28)");
    ctx.fillStyle = isBroken
      ? "rgba(255, 95, 118, 0.22)"
      : isLanded
        ? "rgba(85, 255, 150, 0.58)"
        : isFreebieSafe
          ? "rgba(85, 255, 150, 0.46)"
        : isTraversed
          ? "rgba(85, 255, 150, 0.36)"
          : glass;
    ctx.strokeStyle = isBroken
      ? "rgba(255, 95, 118, 0.95)"
      : isLanded
        ? "rgba(85, 255, 150, 0.98)"
        : isFreebieSafe
          ? "rgba(85, 255, 150, 0.98)"
        : isTraversed
          ? "rgba(85, 255, 150, 0.76)"
          : isJumpTarget
            ? "rgba(255, 220, 102, 0.95)"
            : isCurrent
              ? "rgba(255, 220, 102, 0.9)"
              : "rgba(205, 249, 255, 0.54)";
    ctx.lineWidth = isCurrent || isJumpTarget || isLanded || isTraversed ? 3 : 2;
    ctx.beginPath();
    roundedRectPath(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 12 * scale, y + h * 0.28);
    ctx.lineTo(x + w - 18 * scale, y + h * 0.12);
    ctx.stroke();

    if (isCurrent && activeHint?.kind === "math" && puzzle) {
      const choiceLabel = panel.side === "left" ? "A" : "B";
      ctx.fillStyle = isBroken ? "#ffe0e5" : isLanded ? "#072817" : "#10253d";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${Math.max(12, h * 0.2)}px Inter, sans-serif`;
      ctx.fillText(choiceLabel, x + w * 0.24, y + h * 0.5);
      ctx.font = `900 ${Math.max(18, h * 0.34)}px Inter, sans-serif`;
      ctx.fillText(`${puzzle.answers[panel.side]}`, x + w * 0.62, y + h * 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    if (isBroken) {
      ctx.strokeStyle = "#f7fbff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.18);
      ctx.lineTo(x + w * 0.52, y + h * 0.48);
      ctx.lineTo(x + w * 0.36, y + h * 0.82);
      ctx.moveTo(x + w * 0.52, y + h * 0.48);
      ctx.lineTo(x + w * 0.86, y + h * 0.24);
      ctx.moveTo(x + w * 0.52, y + h * 0.48);
      ctx.lineTo(x + w * 0.82, y + h * 0.78);
      ctx.stroke();
    }
  }

  const targetPanel = panels.find((panel) => panel.row === 0 && panel.side === (bridgeBrokenSide || bridgePlayerSide));
  const previousPanel = panels.find((panel) => panel.row === -1 && panel.side === bridgeStandingSide);
  const fallbackPanel = panels.find((panel) => panel.row === 0);
  const fallProgress = bridgeFallTimer > 0 ? 1 - bridgeFallTimer / bridgeFallDuration : 0;
  const jumpProgress = bridgeJumpTimer > 0 ? 1 - bridgeJumpTimer / bridgeJumpDuration : 0;
  const startX = previousPanel ? previousPanel.x + previousPanel.w / 2 : centerX;
  const startY = previousPanel
    ? previousPanel.y + previousPanel.h * 0.48
    : (fallbackPanel?.y ?? canvasHeight * 0.7) + (fallbackPanel?.h ?? 60) + 38;
  const targetX = targetPanel ? targetPanel.x + targetPanel.w / 2 : startX;
  const targetY = targetPanel ? targetPanel.y + targetPanel.h * 0.48 : startY;
  let playerX = startX;
  let playerY = startY + Math.sin(time * 5) * 3;

  if (bridgeJumpTimer > 0) {
    playerX = startX + (targetX - startX) * jumpProgress;
    playerY = startY + (targetY - startY) * jumpProgress - Math.sin(jumpProgress * Math.PI) * 42;
  } else if (bridgeFallTimer > 0 && targetPanel) {
    playerX = targetX;
    playerY = targetY + fallProgress * canvasHeight * 0.42;
  } else if (bridgeSuccessTimer > 0 && targetPanel) {
    playerX = targetX;
    playerY = targetY + Math.sin(time * 12) * 2;
  } else if (previousPanel) {
    playerX = startX;
    playerY = startY + Math.sin(time * 5) * 2;
  }
  ctx.save();
  ctx.translate(playerX, playerY);
  ctx.rotate(bridgeFallTimer > 0 ? fallProgress * 8 : bridgeJumpTimer > 0 ? Math.sin(jumpProgress * Math.PI) * 0.22 : 0);
  ctx.globalAlpha = bridgeFallTimer > 0 ? Math.max(0.28, 1 - fallProgress * 0.45) : 1;
  ctx.fillStyle = "#ffd85a";
  ctx.strokeStyle = "#342503";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -10, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff6e7f";
  ctx.beginPath();
  roundedRectPath(-12, 4, 24, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "900 18px Inter, sans-serif";
  ctx.fillText(`Traversed ${formatScore(bridgeTiles)}`, 18, 34);
  ctx.fillText(`Points ${formatScore(bridgePoints)}`, 18, 60);
  ctx.textAlign = "right";
  ctx.fillText(`Jackpot ${formatScore(bridgeJackpot)}`, canvasWidth - 18, 34);
  ctx.textAlign = "left";
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
  bridgeSoundToggle.textContent = bridgeSoundEnabled ? "Sound on" : "Sound off";
  bridgeSoundToggle.setAttribute("aria-pressed", `${bridgeSoundEnabled}`);
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

function setBridgeSound(enabled: boolean) {
  bridgeSoundEnabled = enabled;
  localStorage.setItem(bridgeSoundKey, enabled ? "on" : "off");
  updateSoundButtons();
}

async function submitIssue(game: "jumpy-plane" | "shooting-snakes" | "glass-bridge" | "pixel-wars", message: string) {
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

function readBridgeLocalScores() {
  bridgeLocalTiles = Math.max(0, readStoredNumber(bridgeLocalTilesKey), readStoredNumber(bridgePendingTilesKey));
  bridgeLocalPoints = Math.max(0, readStoredNumber(bridgeLocalPointsKey), readStoredNumber(bridgePendingPointsKey));
  writeStoredNumber(bridgeLocalTilesKey, bridgeLocalTiles);
  writeStoredNumber(bridgeLocalPointsKey, bridgeLocalPoints);
}

function writeBridgeLocalScores(tiles: number, points: number) {
  bridgeLocalTiles = Math.max(bridgeLocalTiles, tiles);
  bridgeLocalPoints = Math.max(bridgeLocalPoints, points);
  writeStoredNumber(bridgeLocalTilesKey, bridgeLocalTiles);
  writeStoredNumber(bridgeLocalPointsKey, bridgeLocalPoints);
}

function renderBridgeHighScores() {
  setText(bridgeLocalTileEls, formatScore(bridgeLocalTiles));
  setText(bridgeTodayTileEls, formatScore(bridgeTodayTiles));
  setText(bridgeServerTileEls, formatScore(bridgeServerTiles));
  setText(bridgeTodayTileNameEls, bridgeTodayTileName || (bridgeTodayTiles > 0 ? "Unknown scorer" : "No scorer yet"));
  setText(bridgeServerTileNameEls, bridgeServerTileName || (bridgeServerTiles > 0 ? "Unknown scorer" : "No scorer yet"));
  setText(bridgeLocalPointEls, formatScore(bridgeLocalPoints));
  setText(bridgeTodayPointEls, formatScore(bridgeTodayPoints));
  setText(bridgeServerPointEls, formatScore(bridgeServerPoints));
  setText(bridgeTodayPointNameEls, bridgeTodayPointName || (bridgeTodayPoints > 0 ? "Unknown scorer" : "No scorer yet"));
  setText(bridgeServerPointNameEls, bridgeServerPointName || (bridgeServerPoints > 0 ? "Unknown scorer" : "No scorer yet"));
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

function applyServerBridgeTileScores(scores: HighScoreResponse) {
  bridgeTodayTiles = Number(scores.todayHighest) || bridgeTodayTiles;
  bridgeTodayTileName = typeof scores.todayName === "string" ? scores.todayName : bridgeTodayTileName;
  bridgeServerTiles = Number(scores.allTimeHighest) || bridgeServerTiles;
  bridgeServerTileName = typeof scores.allTimeName === "string" ? scores.allTimeName : bridgeServerTileName;
  renderBridgeHighScores();
}

function applyServerBridgePointScores(scores: HighScoreResponse) {
  bridgeTodayPoints = Number(scores.todayHighest) || bridgeTodayPoints;
  bridgeTodayPointName = typeof scores.todayName === "string" ? scores.todayName : bridgeTodayPointName;
  bridgeServerPoints = Number(scores.allTimeHighest) || bridgeServerPoints;
  bridgeServerPointName = typeof scores.allTimeName === "string" ? scores.allTimeName : bridgeServerPointName;
  renderBridgeHighScores();
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

async function loadServerBridgeHighScores() {
  try {
    const [tileResponse, pointResponse] = await Promise.all([
      fetch("/api/glass-bridge-tile-scores", { cache: "no-store" }),
      fetch("/api/glass-bridge-point-scores", { cache: "no-store" }),
    ]);
    if (tileResponse.ok) {
      applyServerBridgeTileScores(await tileResponse.json() as HighScoreResponse);
    }
    if (pointResponse.ok) {
      applyServerBridgePointScores(await pointResponse.json() as HighScoreResponse);
    }
    void retryPendingServerBridgeScores();
    void reconcileBridgeLocalScores();
  } catch {
    // Glass Bridge can still run locally if the score endpoints are unavailable.
  }
}

function applyBridgeJackpot(response: BridgeJackpotResponse) {
  bridgeJackpot = Math.max(0, Number(response.jackpot) || bridgeJackpot);
}

async function loadBridgeJackpot() {
  try {
    const response = await fetch("/api/glass-bridge-jackpot", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    applyBridgeJackpot(await response.json() as BridgeJackpotResponse);
  } catch {
    // The game can still run if the jackpot endpoint is temporarily unavailable.
  }
}

async function submitBridgeJackpotSpin() {
  try {
    const response = await fetch("/api/glass-bridge-jackpot-spin", {
      cache: "no-store",
      method: "POST",
    });
    if (!response.ok) {
      return null;
    }

    const spin = await response.json() as BridgeJackpotSpinResponse;
    applyBridgeJackpot(spin);
    return spin;
  } catch {
    return null;
  }
}

async function submitBridgeJackpotContribution() {
  try {
    const response = await fetch("/api/glass-bridge-jackpot-contribution", {
      cache: "no-store",
      method: "POST",
    });
    if (!response.ok) {
      return null;
    }

    const contribution = await response.json() as BridgeJackpotResponse;
    applyBridgeJackpot(contribution);
    return contribution;
  } catch {
    return null;
  }
}

async function submitServerBridgeTileScore(finalScore: number, name = "") {
  try {
    const response = await fetch("/api/glass-bridge-tile-scores", {
      body: JSON.stringify({ name, score: finalScore }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return;
    }

    const scores = await response.json() as HighScoreResponse;
    applyServerBridgeTileScores(scores);
    if (Number(scores.todayHighest) >= finalScore || Number(scores.allTimeHighest) >= finalScore) {
      localStorage.removeItem(bridgePendingTilesKey);
    }
    return scores;
  } catch {
    // Ignore sync failures; the browser's bridge record still persists.
  }
}

async function submitServerBridgePointScore(finalScore: number, name = "") {
  try {
    const response = await fetch("/api/glass-bridge-point-scores", {
      body: JSON.stringify({ name, score: finalScore }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      return;
    }

    const scores = await response.json() as HighScoreResponse;
    applyServerBridgePointScores(scores);
    if (Number(scores.todayHighest) >= finalScore || Number(scores.allTimeHighest) >= finalScore) {
      localStorage.removeItem(bridgePendingPointsKey);
    }
    return scores;
  } catch {
    // Ignore sync failures; the browser's bridge record still persists.
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

function rememberPendingServerBridgeScores(tiles: number, points: number) {
  const pendingTiles = Number(localStorage.getItem(bridgePendingTilesKey) || 0);
  if (!Number.isFinite(pendingTiles) || tiles > pendingTiles) {
    localStorage.setItem(bridgePendingTilesKey, `${tiles}`);
  }
  const pendingPoints = Number(localStorage.getItem(bridgePendingPointsKey) || 0);
  if (!Number.isFinite(pendingPoints) || points > pendingPoints) {
    localStorage.setItem(bridgePendingPointsKey, `${points}`);
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

async function retryPendingServerBridgeScores() {
  const pendingTiles = Number(localStorage.getItem(bridgePendingTilesKey) || 0);
  const pendingPoints = Number(localStorage.getItem(bridgePendingPointsKey) || 0);
  if (Number.isFinite(pendingTiles) && pendingTiles > 0) {
    await submitServerBridgeTileScore(pendingTiles);
  }
  if (Number.isFinite(pendingPoints) && pendingPoints > 0) {
    await submitServerBridgePointScore(pendingPoints);
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

async function reconcileBridgeLocalScores() {
  if (bridgeLocalTiles > bridgeTodayTiles || bridgeLocalTiles > bridgeServerTiles) {
    rememberPendingServerBridgeScores(bridgeLocalTiles, bridgeLocalPoints);
    await submitServerBridgeTileScore(bridgeLocalTiles);
  }
  if (bridgeLocalPoints > bridgeTodayPoints || bridgeLocalPoints > bridgeServerPoints) {
    rememberPendingServerBridgeScores(bridgeLocalTiles, bridgeLocalPoints);
    await submitServerBridgePointScore(bridgeLocalPoints);
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

async function syncFinalBridgeScores(finalTiles: number, finalPoints: number) {
  rememberPendingServerBridgeScores(finalTiles, finalPoints);
  const [tileResult, pointResult] = await Promise.all([
    submitServerBridgeTileScore(finalTiles),
    submitServerBridgePointScore(finalPoints),
  ]);

  const recordLabels: string[] = [];
  if (tileResult?.todayRecord) {
    recordLabels.push("today's bridge tile record");
  }
  if (tileResult?.allTimeRecord) {
    recordLabels.push("the server bridge tile record");
  }
  if (pointResult?.todayRecord) {
    recordLabels.push("today's bridge point record");
  }
  if (pointResult?.allTimeRecord) {
    recordLabels.push("the server bridge point record");
  }

  if (recordLabels.length === 0) {
    return;
  }

  const name = await askForRecordName(Math.max(finalTiles, finalPoints), recordLabels, "best result");
  await Promise.all([
    submitServerBridgeTileScore(finalTiles, name),
    submitServerBridgePointScore(finalPoints, name),
  ]);
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
  readBridgeLocalScores();
  readPixelLocalBest();
  renderHighScores();
  renderSnakeHighScores();
  renderBridgeHighScores();
  renderPixelScores();
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
  bridgeMenuPanel.hidden = true;
  bridgeOptionsPanel.hidden = true;
  bridgeDeadPanel.hidden = true;
  pixelMenuPanel.hidden = true;
  pixelOptionsPanel.hidden = true;
  reportPanel.hidden = true;
  snakeDeadPanel.hidden = true;
  snakeControls.hidden = true;
  bridgeControls.hidden = true;
  updateSoundButtons();
  updateSnakeShootButton();
  updateBridgeControls();
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
  updateBridge(dt);
  updatePixelWars(dt);

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
  if (state === "pixel-menu" || state === "pixel-options" || state === "pixel-running") {
    drawPixelWars(time);
    return;
  }

  if (state === "snake-menu" || state === "snake-options" || state === "snake-running" || state === "snake-dead") {
    drawSnakeGame(time);
    return;
  }

  if (state === "bridge-menu" || state === "bridge-options" || state === "bridge-running" || state === "bridge-dead") {
    drawBridgeGame(time);
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

function canvasPointFromEvent(event: PointerEvent) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * (canvas.width / dpr),
    y: ((event.clientY - box.top) / box.height) * (canvas.height / dpr),
  };
}

function updatePixelAimFromPointer(event: PointerEvent) {
  const point = canvasPointFromEvent(event);
  pixelAimX = point.x;
  pixelAimY = point.y;
}

function startPixelAim(event: PointerEvent) {
  event.preventDefault();
  unlockAudio();
  pixelAimActive = true;
  pixelAimPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  updatePixelAimFromPointer(event);
}

function stopPixelAim(event: PointerEvent) {
  if (event.pointerId !== pixelAimPointerId) {
    return;
  }
  pixelAimActive = false;
  pixelAimPointerId = null;
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (state === "pixel-running") {
    const playerTurret = pixelTurrets.find((turret) => turret.isPlayer);
    if (playerTurret && (event.code === "ArrowLeft" || event.code === "KeyA")) {
      event.preventDefault();
      pixelAimActive = false;
      playerTurret.angle = clampPixelTurretAngle(playerTurret, playerTurret.angle - 0.12);
      return;
    }
    if (playerTurret && (event.code === "ArrowRight" || event.code === "KeyD")) {
      event.preventDefault();
      pixelAimActive = false;
      playerTurret.angle = clampPixelTurretAngle(playerTurret, playerTurret.angle + 0.12);
      return;
    }
  }

  if (state === "bridge-running") {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      event.preventDefault();
      chooseBridgeSide("left");
      return;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      event.preventDefault();
      chooseBridgeSide("right");
      return;
    }
    if (event.code === "Space" || event.code === "KeyS") {
      event.preventDefault();
      void spinBridgeWheel();
      return;
    }
    if (event.code === "KeyH") {
      event.preventDefault();
      void spinBridgeHintWheel();
      return;
    }
  }

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
canvas.addEventListener("pointerdown", (event) => {
  if (state === "pixel-running") {
    startPixelAim(event);
    return;
  }

  if (state === "bridge-running") {
    const point = canvasPointFromEvent(event);
    const panel = bridgePanelAtPoint(point.x, point.y);
    if (panel) {
      chooseBridgeSide(panel.side);
    }
    return;
  }

  flap();
});
canvas.addEventListener("pointermove", (event) => {
  if (state !== "pixel-running" || event.pointerId !== pixelAimPointerId) {
    return;
  }

  event.preventDefault();
  updatePixelAimFromPointer(event);
});
canvas.addEventListener("pointerup", stopPixelAim);
canvas.addEventListener("pointercancel", stopPixelAim);
canvas.addEventListener("lostpointercapture", () => {
  pixelAimActive = false;
  pixelAimPointerId = null;
});
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
selectBridgeButton.addEventListener("click", showBridgeMenu);
selectPixelButton.addEventListener("click", showPixelMenu);
snakeOptionsButton.addEventListener("click", showSnakeOptions);
snakeMenuBackButton.addEventListener("click", () => reset("platform"));
snakeOptionsBackButton.addEventListener("click", showSnakeMenu);
snakeSoundToggle.addEventListener("click", () => {
  unlockAudio();
  setSnakeSound(!snakeSoundEnabled);
});
snakeReportIssueButton.addEventListener("click", () => showReportIssue("shooting-snakes", "snake-options"));
bridgeOptionsButton.addEventListener("click", showBridgeOptions);
bridgeMenuBackButton.addEventListener("click", () => reset("platform"));
bridgeOptionsBackButton.addEventListener("click", showBridgeMenu);
bridgeSoundToggle.addEventListener("click", () => {
  unlockAudio();
  setBridgeSound(!bridgeSoundEnabled);
});
bridgeReportIssueButton.addEventListener("click", () => showReportIssue("glass-bridge", "bridge-options"));
pixelStartButton.addEventListener("click", startPixelWars);
pixelOptionsButton.addEventListener("click", showPixelOptions);
pixelMenuBackButton.addEventListener("click", () => reset("platform"));
pixelOptionsBackButton.addEventListener("click", showPixelMenu);
pixelReportIssueButton.addEventListener("click", () => showReportIssue("pixel-wars", "pixel-options"));
pixelModeInput.addEventListener("change", syncPixelConfigFromInputs);
pixelBotsInput.addEventListener("input", syncPixelConfigFromInputs);
pixelHumansInput.addEventListener("input", syncPixelConfigFromInputs);
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
bridgeStartButton.addEventListener("click", startBridgeGame);
bridgeRestartButton.addEventListener("click", startBridgeGame);
bridgeHintSpinButton.addEventListener("click", () => {
  void spinBridgeHintWheel();
});
bridgeSpinButton.addEventListener("click", () => {
  void spinBridgeWheel();
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
readBridgeLocalScores();
readPixelLocalBest();
renderHighScores();
renderSnakeHighScores();
renderBridgeHighScores();
renderPixelScores();
void loadServerHighScores();
void loadServerSnakeHighScores();
void loadServerBridgeHighScores();
void loadBridgeJackpot();
resize();
updateFullscreenButton();
reset("platform");
requestAnimationFrame(loop);
