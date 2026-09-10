import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist");
const storePath = process.env.SCORE_STORE_PATH || resolve(__dirname, "data", "high-scores.json");
const snakeStorePath = process.env.SNAKE_SCORE_STORE_PATH || resolve(__dirname, "data", "snake-high-scores.json");
const issueStorePaths = {
  "jumpy-plane": process.env.JUMPY_PLANE_ISSUE_STORE_PATH || resolve(__dirname, "data", "jumpy-plane-issues.json"),
  "shooting-snakes": process.env.SHOOTING_SNAKES_ISSUE_STORE_PATH || resolve(__dirname, "data", "shooting-snakes-issues.json"),
};
const port = Number(process.env.PORT || 3000);
const timeZone = process.env.SCORE_TIME_ZONE || "America/Los_Angeles";
const snakeBoard = {
  cellSize: 24,
  height: 1920,
  width: 2880,
};
const targetSnakeOrbCount = 54;
const maxSnakeOrbCount = 84;
const maxSnakeBotCount = 10;
const maxSnakeShotBank = 5;
const snakeProjectileRangeCells = 72;
const snakeProjectileSpeedCells = 4;
const snakeShotRecoilTicks = 4;
const snakeBotRespawnTicks = 26;
const snakeBotPersonalities = [
  { decisionMax: 5, decisionMin: 2, doubleShotChance: 0.018, mistakeChance: 0.04, randomSafeChance: 0.24, shootChance: 0.012 },
  { decisionMax: 4, decisionMin: 2, doubleShotChance: 0.04, mistakeChance: 0.07, randomSafeChance: 0.18, shootChance: 0.03 },
  { decisionMax: 6, decisionMin: 3, doubleShotChance: 0.028, mistakeChance: 0.13, randomSafeChance: 0.2, shootChance: 0.022 },
  { decisionMax: 7, decisionMin: 3, doubleShotChance: 0.012, mistakeChance: 0.025, randomSafeChance: 0.34, shootChance: 0.008 },
];
const snakeDirections = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};
const snakePlayers = new Map();
const snakeBots = new Map();
const snakeOrbs = [];
const snakeProjectiles = [];
let nextSnakeId = 1;
let nextSnakeOrbId = 1;
let nextSnakeProjectileId = 1;
let snakeRoomInterval = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function randomGridCoordinate(limit) {
  const cells = Math.floor(limit / snakeBoard.cellSize) - 4;
  return (2 + Math.floor(Math.random() * cells)) * snakeBoard.cellSize;
}

function snakeColorFromId(id) {
  const hue = (Number(id.replace(/\D/g, "")) * 53) % 360;
  return `hsl(${hue} 82% 58%)`;
}

const fallbackSnakeOrbColors = Array.from({ length: maxSnakeBotCount }, (_, index) => snakeColorFromId(`snake-${index + 1}`));

function snakeOrbColor() {
  const colors = [...new Set(allSnakes().map((player) => player.color))];
  const palette = colors.length > 0 ? colors : fallbackSnakeOrbColors;
  const colorCounts = new Map(palette.map((color) => [color, 0]));

  for (const orb of snakeOrbs) {
    colorCounts.set(orb.color, (colorCounts.get(orb.color) || 0) + 1);
  }

  const lowestCount = Math.min(...palette.map((color) => colorCounts.get(color) || 0));
  const balancedChoices = palette.filter((color) => (colorCounts.get(color) || 0) <= lowestCount + 1);
  const choices = Math.random() < 0.82 ? balancedChoices : palette;
  return randomItem(choices);
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomSnakeBotPersonality() {
  return snakeBotPersonalities[Math.floor(Math.random() * snakeBotPersonalities.length)];
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function resetSnakeBotDecision(bot) {
  bot.decisionTicks = randomInt(bot.personality.decisionMin, bot.personality.decisionMax);
}

function targetSnakeBotCount() {
  return Math.max(0, maxSnakeBotCount - Math.floor(snakePlayers.size / 2));
}

function allSnakes() {
  return [...snakePlayers.values(), ...snakeBots.values()];
}

function occupiedSnakePoint(x, y) {
  for (const player of allSnakes()) {
    if (!player.alive) {
      continue;
    }

    if (player.segments.some((segment) => segment.x === x && segment.y === y)) {
      return true;
    }
  }

  return false;
}

function createSnakeSegments(head, direction) {
  const step = snakeDirections[direction];
  return [
    head,
    { x: head.x - step.x * snakeBoard.cellSize, y: head.y - step.y * snakeBoard.cellSize },
    { x: head.x - step.x * snakeBoard.cellSize * 2, y: head.y - step.y * snakeBoard.cellSize * 2 },
  ];
}

function findSnakeSpawn() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const directionNames = Object.keys(snakeDirections);
    const direction = directionNames[Math.floor(Math.random() * directionNames.length)];
    const head = {
      x: randomGridCoordinate(snakeBoard.width),
      y: randomGridCoordinate(snakeBoard.height),
    };
    const segments = createSnakeSegments(head, direction);
    const safe = segments.every(
      (segment) =>
        segment.x > 0 &&
        segment.x < snakeBoard.width &&
        segment.y > 0 &&
        segment.y < snakeBoard.height &&
        !occupiedSnakePoint(segment.x, segment.y),
    );

    if (safe) {
      return { direction, segments };
    }
  }

  return {
    direction: "right",
    segments: createSnakeSegments({ x: snakeBoard.cellSize * 5, y: snakeBoard.cellSize * 5 }, "right"),
  };
}

function spawnSnakeOrb(x = randomGridCoordinate(snakeBoard.width), y = randomGridCoordinate(snakeBoard.height), color = snakeOrbColor()) {
  if (snakeOrbs.length >= maxSnakeOrbCount) {
    return false;
  }

  snakeOrbs.push({
    color,
    id: `orb-${nextSnakeOrbId}`,
    x,
    y,
  });
  nextSnakeOrbId += 1;
  return true;
}

function seedSnakeOrbs() {
  while (snakeOrbs.length < targetSnakeOrbCount) {
    if (!spawnSnakeOrb()) {
      break;
    }
  }
}

function respawnSnake(player) {
  const spawn = findSnakeSpawn();
  player.alive = true;
  player.direction = spawn.direction;
  player.nextDirection = spawn.direction;
  player.segments = spawn.segments;
  player.length = 3;
  player.bestLength = 3;
  player.orbsCollected = 0;
  player.score = 0;
  player.shotBank = 0;
  player.shootCooldown = 0;
  player.shotRecoilTicks = 0;
  if (player.personality) {
    resetSnakeBotDecision(player);
  }
}

function destroySnake(player) {
  if (!player.alive) {
    return;
  }

  player.alive = false;
  if (player.botRespawnTicks !== undefined) {
    player.botRespawnTicks = snakeBotRespawnTicks;
  }
  const drops = Math.floor(player.segments.length * 0.5);
  for (let index = 0; index < drops; index += 1) {
    const segment = player.segments[Math.floor((index / Math.max(1, drops)) * player.segments.length)];
    spawnSnakeOrb(segment.x, segment.y, player.color);
  }
}

function trimSnake(player) {
  while (player.segments.length > player.length) {
    player.segments.pop();
  }
  if (player.length < 2) {
    destroySnake(player);
  }
}

function createSnakeBot() {
  const id = `snake-${nextSnakeId}`;
  nextSnakeId += 1;
  const bot = {
    alive: false,
    bestLength: 3,
    botRespawnTicks: 0,
    color: snakeColorFromId(id),
    decisionTicks: 0,
    direction: "right",
    id,
    length: 3,
    nextDirection: "right",
    orbsCollected: 0,
    personality: randomSnakeBotPersonality(),
    score: 0,
    segments: [],
    shotBank: 0,
    shootCooldown: 0,
    shotRecoilTicks: 0,
  };
  respawnSnake(bot);
  return bot;
}

function ensureSnakeBots() {
  const targetCount = targetSnakeBotCount();
  while (snakeBots.size > targetCount) {
    const removable = [...snakeBots.values()].find((bot) => !bot.alive) || [...snakeBots.values()].at(-1);
    if (!removable) {
      break;
    }
    snakeBots.delete(removable.id);
  }

  while (snakeBots.size < targetCount) {
    const bot = createSnakeBot();
    snakeBots.set(bot.id, bot);
  }

  for (const bot of snakeBots.values()) {
    if (bot.alive) {
      continue;
    }

    bot.botRespawnTicks = Math.max(0, (bot.botRespawnTicks || snakeBotRespawnTicks) - 1);
    if (bot.botRespawnTicks <= 0) {
      respawnSnake(bot);
    }
  }
}

function nearestSnakeOrb(head, player = null) {
  let target = null;
  let targetDistance = Infinity;
  for (const orb of snakeOrbs) {
    let distance = Math.abs(orb.x - head.x) + Math.abs(orb.y - head.y);
    if (player) {
      const matchesPlayer = orb.color === player.color;
      if (matchesPlayer && player.shotBank < maxSnakeShotBank) {
        distance *= player.shotBank <= 1 ? 0.68 : 0.88;
      }
      if (!matchesPlayer && player.length <= 5) {
        distance *= 0.72;
      }
      if (matchesPlayer && player.shotBank >= maxSnakeShotBank) {
        distance *= 1.35;
      }
    }
    if (distance < targetDistance) {
      target = orb;
      targetDistance = distance;
    }
  }
  return target;
}

function nextSnakeHead(player, directionName) {
  const step = snakeDirections[directionName];
  const head = player.segments[0];
  return {
    x: head.x + step.x * snakeBoard.cellSize,
    y: head.y + step.y * snakeBoard.cellSize,
  };
}

function directionWouldHit(player, directionName) {
  const head = nextSnakeHead(player, directionName);
  if (head.x < 0 || head.y < 0 || head.x > snakeBoard.width || head.y > snakeBoard.height) {
    return true;
  }

  return allSnakes().some(
    (other) =>
      other.id !== player.id &&
      other.alive &&
      other.segments.some((segment) => segment.x === head.x && segment.y === head.y),
  );
}

function chooseSnakeBotDirection(bot) {
  if (!bot.alive || bot.segments.length === 0) {
    return;
  }

  bot.decisionTicks = Math.max(0, bot.decisionTicks - 1);
  if (bot.decisionTicks > 0) {
    return;
  }
  resetSnakeBotDecision(bot);

  const target = nearestSnakeOrb(bot.segments[0], bot);
  const directionNames = Object.keys(snakeDirections);
  const candidates = directionNames
    .map((direction) => {
      const head = nextSnakeHead(bot, direction);
      const targetDistance = target ? Math.abs(target.x - head.x) + Math.abs(target.y - head.y) : Math.random() * 1000;
      return { direction, targetDistance: targetDistance + Math.random() * snakeBoard.cellSize * 0.4 };
    })
    .sort((a, b) => a.targetDistance - b.targetDistance);

  const safeCandidates = candidates.filter((candidate) => !directionWouldHit(bot, candidate.direction));
  const choiceRoll = Math.random();

  if (choiceRoll < bot.personality.mistakeChance) {
    bot.nextDirection = randomItem(candidates.slice(0, 2)).direction;
    return;
  }

  if (safeCandidates.length > 0 && choiceRoll < bot.personality.mistakeChance + bot.personality.randomSafeChance) {
    bot.nextDirection = randomItem(safeCandidates).direction;
    return;
  }

  bot.nextDirection = safeCandidates[0]?.direction || candidates[0]?.direction || bot.direction;
}

function snakeThreatInLine(player) {
  const step = snakeDirections[player.direction];
  const head = player.segments[0];
  const maxDistance = snakeBoard.cellSize * 18;

  for (const other of allSnakes()) {
    if (!other.alive || other.id === player.id) {
      continue;
    }

    for (const segment of other.segments) {
      const dx = segment.x - head.x;
      const dy = segment.y - head.y;
      const ahead = step.x !== 0 ? dx * step.x > 0 && dy === 0 : dy * step.y > 0 && dx === 0;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (ahead && distance <= maxDistance) {
        return true;
      }
    }
  }

  return false;
}

function updateSnakeBot(bot) {
  if (!bot.alive) {
    return;
  }

  chooseSnakeBotDirection(bot);
  bot.direction = bot.nextDirection;

  if (bot.shotBank >= 2 && bot.length > 4 && snakeThreatInLine(bot) && Math.random() < bot.personality.doubleShotChance) {
    const firstShot = shootSnakeSegment(bot);
    if (firstShot && bot.shotBank > 0 && bot.length > 2) {
      shootSnakeSegment(bot, { leadCells: 2, skipCooldown: true });
    }
    return;
  }

  if (bot.shotBank > 0 && bot.length > 3 && snakeThreatInLine(bot) && Math.random() < bot.personality.shootChance) {
    shootSnakeSegment(bot);
  }
}

function updateSnakePlayer(player) {
  if (!player.alive || player.segments.length === 0) {
    return;
  }

  player.shootCooldown = Math.max(0, player.shootCooldown - 1);
  player.direction = player.nextDirection;
  if (player.shotRecoilTicks > 0) {
    player.shotRecoilTicks -= 1;
    return;
  }

  const head = nextSnakeHead(player, player.direction);

  if (head.x < 0 || head.y < 0 || head.x > snakeBoard.width || head.y > snakeBoard.height) {
    destroySnake(player);
    return;
  }

  for (const other of allSnakes()) {
    if (other.id === player.id || !other.alive) {
      continue;
    }

    if (other.segments.some((segment) => segment.x === head.x && segment.y === head.y)) {
      destroySnake(player);
      return;
    }
  }

  player.segments.unshift(head);
  const eatenIndex = snakeOrbs.findIndex(
    (orb) => Math.abs(orb.x - head.x) < snakeBoard.cellSize && Math.abs(orb.y - head.y) < snakeBoard.cellSize,
  );
  if (eatenIndex >= 0) {
    const eatenOrb = snakeOrbs[eatenIndex];
    player.orbsCollected += 1;
    player.score += 1;
    if (eatenOrb.color === player.color) {
      player.shotBank = Math.min(maxSnakeShotBank, player.shotBank + 1);
    } else {
      player.length += 1;
      player.bestLength = Math.max(player.bestLength || 3, player.length);
    }
    snakeOrbs.splice(eatenIndex, 1);
    spawnSnakeOrb();
  }
  trimSnake(player);
}

function shootSnakeSegment(player, options = {}) {
  const skipCooldown = Boolean(options.skipCooldown);
  const leadCells = Number.isFinite(options.leadCells) ? options.leadCells : 1;
  if (!player.alive || player.length <= 2 || (!skipCooldown && player.shootCooldown > 0) || player.shotBank <= 0) {
    return false;
  }

  const direction = snakeDirections[player.direction];
  const head = player.segments[0];
  player.length -= 1;
  player.shotBank -= 1;
  player.segments.pop();
  if (!skipCooldown) {
    player.shootCooldown = 5;
  }
  player.shotRecoilTicks = Math.max(player.shotRecoilTicks || 0, snakeShotRecoilTicks);
  snakeProjectiles.push({
    color: player.color,
    distance: 0,
    dx: direction.x,
    dy: direction.y,
    id: `shot-${nextSnakeProjectileId}`,
    ownerId: player.id,
    x: head.x + direction.x * snakeBoard.cellSize * leadCells,
    y: head.y + direction.y * snakeBoard.cellSize * leadCells,
  });
  nextSnakeProjectileId += 1;
  return true;
}

function snakeProjectileHit(projectile) {
  for (const player of allSnakes()) {
    if (!player.alive || player.id === projectile.ownerId) {
      continue;
    }

    const head = player.segments[0];
    if (
      head &&
      Math.abs(head.x - projectile.x) <= snakeBoard.cellSize * 0.5 &&
      Math.abs(head.y - projectile.y) <= snakeBoard.cellSize * 0.5
    ) {
      destroySnake(player);
      return true;
    }

    if (
      player.segments.slice(1).some(
        (segment) =>
          Math.abs(segment.x - projectile.x) <= snakeBoard.cellSize * 0.5 &&
          Math.abs(segment.y - projectile.y) <= snakeBoard.cellSize * 0.5,
      )
    ) {
      player.length -= 1;
      trimSnake(player);
      return true;
    }
  }

  return false;
}

function updateSnakeProjectiles() {
  for (let index = snakeProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = snakeProjectiles[index];
    let removeProjectile = snakeProjectileHit(projectile);
    for (let step = 0; step < snakeProjectileSpeedCells; step += 1) {
      if (removeProjectile) {
        break;
      }

      projectile.x += projectile.dx * snakeBoard.cellSize;
      projectile.y += projectile.dy * snakeBoard.cellSize;
      projectile.distance += snakeBoard.cellSize;
      if (
        projectile.x < 0 ||
        projectile.x > snakeBoard.width ||
        projectile.y < 0 ||
        projectile.y > snakeBoard.height ||
        projectile.distance > snakeBoard.cellSize * snakeProjectileRangeCells
      ) {
        removeProjectile = true;
        break;
      }

      if (snakeProjectileHit(projectile)) {
        removeProjectile = true;
        break;
      }
    }

    if (removeProjectile) {
      snakeProjectiles.splice(index, 1);
    }
  }
}

function snakeSnapshot() {
  return {
    board: snakeBoard,
    maxShotBank: maxSnakeShotBank,
    orbs: snakeOrbs,
    players: allSnakes().map((player) => ({
      alive: player.alive,
      bestLength: player.bestLength || 3,
      color: player.color,
      id: player.id,
      orbsCollected: player.orbsCollected || 0,
      score: player.score,
      segments: player.segments,
      shotBank: player.shotBank || 0,
    })),
    projectiles: snakeProjectiles,
    type: "snake-state",
  };
}

function broadcastSnakeState() {
  const message = JSON.stringify(snakeSnapshot());
  for (const player of snakePlayers.values()) {
    if (player.socket.readyState === WebSocket.OPEN) {
      player.socket.send(message);
    }
  }
}

function tickSnakeRoom() {
  ensureSnakeBots();
  seedSnakeOrbs();
  for (const bot of snakeBots.values()) {
    updateSnakeBot(bot);
  }
  for (const player of allSnakes()) {
    updateSnakePlayer(player);
  }
  updateSnakeProjectiles();
  broadcastSnakeState();
}

function startSnakeRoom() {
  if (snakeRoomInterval) {
    return;
  }

  snakeRoomInterval = setInterval(tickSnakeRoom, 115);
}

function stopSnakeRoomIfIdle() {
  if (snakePlayers.size > 0 || !snakeRoomInterval) {
    return;
  }

  clearInterval(snakeRoomInterval);
  snakeRoomInterval = null;
  snakeBots.clear();
  snakeOrbs.length = 0;
  snakeProjectiles.length = 0;
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(new Date());
}

function blankScores() {
  return {
    todayDate: todayKey(),
    todayHighest: 0,
    todayName: "",
    allTimeHighest: 0,
    allTimeName: "",
  };
}

function normalizeScores(scores) {
  const todayDate = todayKey();
  const todayHighest = Number.isFinite(scores.todayHighest) ? scores.todayHighest : 0;
  const allTimeHighest = Number.isFinite(scores.allTimeHighest) ? scores.allTimeHighest : 0;
  const current = {
    todayDate: typeof scores.todayDate === "string" ? scores.todayDate : todayDate,
    todayHighest,
    todayName: typeof scores.todayName === "string" && scores.todayName ? scores.todayName : todayHighest > 0 ? "Unknown scorer" : "",
    allTimeHighest,
    allTimeName:
      typeof scores.allTimeName === "string" && scores.allTimeName
        ? scores.allTimeName
        : allTimeHighest > 0
          ? "Unknown scorer"
          : "",
  };

  if (current.todayDate !== todayDate) {
    current.todayDate = todayDate;
    current.todayHighest = 0;
    current.todayName = "";
  }

  return current;
}

function cleanName(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.slice(0, 24) || "Unknown scorer";
}

function isClaimableName(name) {
  return !name || name === "Unknown scorer";
}

function readScores(path = storePath) {
  try {
    if (!existsSync(path)) {
      return blankScores();
    }

    return normalizeScores(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return blankScores();
  }
}

function writeScores(scores, path = storePath) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(scores, null, 2)}\n`);
}

function readIssues(path) {
  try {
    if (!existsSync(path)) {
      return [];
    }

    const issues = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(issues) ? issues : [];
  } catch {
    return [];
  }
}

function writeIssues(issues, path) {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(issues, null, 2)}\n`);
}

function cleanIssueText(value) {
  return (typeof value === "string" ? value.trim() : "").slice(0, 900);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[".json"],
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        request.destroy();
        rejectBody(new Error("Request body too large."));
      }
    });
    request.on("end", () => resolveBody(body));
    request.on("error", rejectBody);
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  if (request.url === "/api/high-scores" && request.method === "GET") {
    sendJson(response, 200, readScores(storePath));
    return true;
  }

  if (request.url === "/api/snake-high-scores" && request.method === "GET") {
    sendJson(response, 200, readScores(snakeStorePath));
    return true;
  }

  if (request.url === "/api/high-scores" && request.method === "POST") {
    await handleScorePost(request, response, storePath);
    return true;
  }

  if (request.url === "/api/snake-high-scores" && request.method === "POST") {
    await handleScorePost(request, response, snakeStorePath);
    return true;
  }

  if (url.pathname.startsWith("/api/issues/") && request.method === "POST") {
    const game = decodeURIComponent(url.pathname.replace("/api/issues/", ""));
    await handleIssuePost(request, response, game);
    return true;
  }

  return false;
}

async function handleIssuePost(request, response, game) {
  try {
    const path = issueStorePaths[game];
    if (!path) {
      sendJson(response, 404, { error: "Unknown game issue bucket." });
      return;
    }

    const body = JSON.parse(await readRequestBody(request));
    const message = cleanIssueText(body.message);
    if (message.length < 3) {
      sendJson(response, 400, { error: "Issue report must include a short message." });
      return;
    }

    const issues = readIssues(path);
    const issue = {
      createdAt: new Date().toISOString(),
      game,
      id: `${game}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      page: cleanIssueText(body.page).slice(0, 240),
      userAgent: cleanIssueText(body.userAgent).slice(0, 240),
    };
    issues.push(issue);
    writeIssues(issues.slice(-500), path);
    sendJson(response, 201, { ok: true });
  } catch {
    sendJson(response, 400, { error: "Invalid issue report." });
  }
}

async function handleScorePost(request, response, path) {
  try {
    const body = JSON.parse(await readRequestBody(request));
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0) {
      sendJson(response, 400, { error: "Score must be a non-negative number." });
      return;
    }

    const scores = readScores(path);
    const name = cleanName(body.name);
    const todayRecord = score > scores.todayHighest || (score === scores.todayHighest && isClaimableName(scores.todayName));
    const allTimeRecord =
      score > scores.allTimeHighest || (score === scores.allTimeHighest && isClaimableName(scores.allTimeName));

    if (todayRecord) {
      scores.todayHighest = score;
      scores.todayName = name;
    }

    if (allTimeRecord) {
      scores.allTimeHighest = score;
      scores.allTimeName = name;
    }

    writeScores(scores, path);
    sendJson(response, 200, { ...scores, todayRecord, allTimeRecord });
  } catch {
    sendJson(response, 400, { error: "Invalid score payload." });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(distDir, requestedPath));

  if (!filePath.startsWith(distDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const pathToServe = existsSync(filePath) ? filePath : join(distDir, "index.html");
  const extension = extname(pathToServe);
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Type": contentTypes[extension] || "application/octet-stream",
  });
  createReadStream(pathToServe).pipe(response);
}

const server = createServer(async (request, response) => {
  if (await handleApi(request, response)) {
    return;
  }

  serveStatic(request, response);
});

const snakeServer = new WebSocketServer({ path: "/snake", server });

snakeServer.on("connection", (socket) => {
  const id = `snake-${nextSnakeId}`;
  nextSnakeId += 1;
  const player = {
    alive: false,
    bestLength: 3,
    color: snakeColorFromId(id),
    direction: "right",
    id,
    length: 3,
    nextDirection: "right",
    orbsCollected: 0,
    score: 0,
    segments: [],
    shotBank: 0,
    shootCooldown: 0,
    shotRecoilTicks: 0,
    socket,
  };
  snakePlayers.set(id, player);
  startSnakeRoom();
  socket.send(JSON.stringify({ board: snakeBoard, id, type: "snake-welcome" }));
  socket.send(JSON.stringify(snakeSnapshot()));

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (message.type === "snake-start" || message.type === "snake-restart") {
      respawnSnake(player);
      broadcastSnakeState();
      return;
    }

    if (message.type === "snake-direction" && typeof message.direction === "string" && snakeDirections[message.direction]) {
      player.nextDirection = message.direction;
      return;
    }

    if (message.type === "snake-shoot") {
      shootSnakeSegment(player);
      broadcastSnakeState();
    }
  });

  socket.on("close", () => {
    snakePlayers.delete(id);
    broadcastSnakeState();
    stopSnakeRoomIfIdle();
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Bad Ant Games listening on ${port}`);
});
