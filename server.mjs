import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist");
const storePath = process.env.SCORE_STORE_PATH || resolve(__dirname, "data", "high-scores.json");
const snakeStorePath = process.env.SNAKE_SCORE_STORE_PATH || resolve(__dirname, "data", "snake-high-scores.json");
const port = Number(process.env.PORT || 3000);
const timeZone = process.env.SCORE_TIME_ZONE || "America/Los_Angeles";
const snakeBoard = {
  cellSize: 24,
  height: 1920,
  width: 2880,
};
const targetSnakeOrbCount = 54;
const targetSnakeBotCount = 5;
const snakeBotRespawnTicks = 26;
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

function snakeOrbColor() {
  return `hsl(${Math.floor(Math.random() * 360)} 96% 64%)`;
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

function spawnSnakeOrb(x = randomGridCoordinate(snakeBoard.width), y = randomGridCoordinate(snakeBoard.height)) {
  snakeOrbs.push({
    color: snakeOrbColor(),
    id: `orb-${nextSnakeOrbId}`,
    x,
    y,
  });
  nextSnakeOrbId += 1;
}

function seedSnakeOrbs() {
  while (snakeOrbs.length < targetSnakeOrbCount) {
    spawnSnakeOrb();
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
    spawnSnakeOrb(segment.x, segment.y);
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
    direction: "right",
    id,
    length: 3,
    nextDirection: "right",
    orbsCollected: 0,
    score: 0,
    segments: [],
    shotBank: 0,
    shootCooldown: 0,
  };
  respawnSnake(bot);
  return bot;
}

function ensureSnakeBots() {
  while (snakeBots.size < targetSnakeBotCount) {
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

function nearestSnakeOrb(head) {
  let target = null;
  let targetDistance = Infinity;
  for (const orb of snakeOrbs) {
    const distance = Math.abs(orb.x - head.x) + Math.abs(orb.y - head.y);
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

  const target = nearestSnakeOrb(bot.segments[0]);
  const directionNames = Object.keys(snakeDirections);
  const candidates = directionNames
    .map((direction) => {
      const head = nextSnakeHead(bot, direction);
      const targetDistance = target ? Math.abs(target.x - head.x) + Math.abs(target.y - head.y) : Math.random() * 1000;
      return { direction, targetDistance: targetDistance + Math.random() * snakeBoard.cellSize * 0.4 };
    })
    .sort((a, b) => a.targetDistance - b.targetDistance);

  const safeChoice = candidates.find((candidate) => !directionWouldHit(bot, candidate.direction));
  bot.nextDirection = safeChoice?.direction || bot.direction;
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

  if (bot.shotBank >= 2 && bot.length > 4 && snakeThreatInLine(bot) && Math.random() < 0.035) {
    const firstShot = shootSnakeSegment(bot);
    if (firstShot && bot.shotBank > 0 && bot.length > 2) {
      shootSnakeSegment(bot, { leadCells: 2, skipCooldown: true });
    }
    return;
  }

  if (bot.shotBank > 0 && bot.length > 3 && snakeThreatInLine(bot) && Math.random() < 0.022) {
    shootSnakeSegment(bot);
  }
}

function updateSnakePlayer(player) {
  if (!player.alive || player.segments.length === 0) {
    return;
  }

  player.shootCooldown = Math.max(0, player.shootCooldown - 1);
  player.direction = player.nextDirection;

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
    player.length += 1;
    player.bestLength = Math.max(player.bestLength || 3, player.length);
    player.orbsCollected += 1;
    player.score += 1;
    if (player.orbsCollected % 10 === 0 && player.shotBank < 2) {
      player.shotBank += 1;
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

function updateSnakeProjectiles() {
  for (let index = snakeProjectiles.length - 1; index >= 0; index -= 1) {
    const projectile = snakeProjectiles[index];
    projectile.x += projectile.dx * snakeBoard.cellSize * 2;
    projectile.y += projectile.dy * snakeBoard.cellSize * 2;
    projectile.distance += snakeBoard.cellSize * 2;

    if (
      projectile.x < 0 ||
      projectile.x > snakeBoard.width ||
      projectile.y < 0 ||
      projectile.y > snakeBoard.height ||
      projectile.distance > snakeBoard.cellSize * 44
    ) {
      snakeProjectiles.splice(index, 1);
      continue;
    }

    let hit = false;
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
        hit = true;
        break;
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
        hit = true;
        break;
      }
    }

    if (hit) {
      snakeProjectiles.splice(index, 1);
    }
  }
}

function snakeSnapshot() {
  return {
    board: snakeBoard,
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
  seedSnakeOrbs();
  ensureSnakeBots();
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

  return false;
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
