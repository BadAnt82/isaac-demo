import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distDir = resolve(__dirname, "dist");
const storePath = process.env.SCORE_STORE_PATH || resolve(__dirname, "data", "high-scores.json");
const port = Number(process.env.PORT || 3000);
const timeZone = process.env.SCORE_TIME_ZONE || "America/Los_Angeles";
const snakeBoard = {
  cellSize: 24,
  height: 1920,
  width: 2880,
};
const snakeDirections = {
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
};
const snakePlayers = new Map();
const snakeOrbs = [];
const snakeProjectiles = [];
let nextSnakeId = 1;
let nextSnakeOrbId = 1;
let nextSnakeProjectileId = 1;

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

function occupiedSnakePoint(x, y) {
  for (const player of snakePlayers.values()) {
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
  while (snakeOrbs.length < 90) {
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
  player.score = 0;
  player.shootCooldown = 0;
}

function destroySnake(player) {
  if (!player.alive) {
    return;
  }

  player.alive = false;
  const drops = Math.ceil(player.segments.length * 0.5);
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

function updateSnakePlayer(player) {
  if (!player.alive || player.segments.length === 0) {
    return;
  }

  player.shootCooldown = Math.max(0, player.shootCooldown - 1);
  player.direction = player.nextDirection;

  const step = snakeDirections[player.direction];
  const currentHead = player.segments[0];
  const head = {
    x: currentHead.x + step.x * snakeBoard.cellSize,
    y: currentHead.y + step.y * snakeBoard.cellSize,
  };

  if (head.x < 0 || head.y < 0 || head.x > snakeBoard.width || head.y > snakeBoard.height) {
    destroySnake(player);
    return;
  }

  for (const other of snakePlayers.values()) {
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
    player.score += 1;
    snakeOrbs.splice(eatenIndex, 1);
    spawnSnakeOrb();
  }
  trimSnake(player);
}

function shootSnakeSegment(player) {
  if (!player.alive || player.length <= 2 || player.shootCooldown > 0) {
    return;
  }

  const direction = snakeDirections[player.direction];
  const head = player.segments[0];
  player.length -= 1;
  player.segments.pop();
  player.shootCooldown = 5;
  snakeProjectiles.push({
    color: player.color,
    distance: 0,
    dx: direction.x,
    dy: direction.y,
    id: `shot-${nextSnakeProjectileId}`,
    ownerId: player.id,
    x: head.x + direction.x * snakeBoard.cellSize,
    y: head.y + direction.y * snakeBoard.cellSize,
  });
  nextSnakeProjectileId += 1;
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
    for (const player of snakePlayers.values()) {
      if (!player.alive || player.id === projectile.ownerId) {
        continue;
      }

      if (
        player.segments.some(
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
    players: Array.from(snakePlayers.values()).map((player) => ({
      alive: player.alive,
      color: player.color,
      id: player.id,
      score: player.score,
      segments: player.segments,
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
  for (const player of snakePlayers.values()) {
    updateSnakePlayer(player);
  }
  updateSnakeProjectiles();
  broadcastSnakeState();
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

function readScores() {
  try {
    if (!existsSync(storePath)) {
      return blankScores();
    }

    return normalizeScores(JSON.parse(readFileSync(storePath, "utf8")));
  } catch {
    return blankScores();
  }
}

function writeScores(scores) {
  mkdirSync(resolve(storePath, ".."), { recursive: true });
  writeFileSync(storePath, `${JSON.stringify(scores, null, 2)}\n`);
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
    sendJson(response, 200, readScores());
    return true;
  }

  if (request.url === "/api/high-scores" && request.method === "POST") {
    try {
      const body = JSON.parse(await readRequestBody(request));
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0) {
        sendJson(response, 400, { error: "Score must be a non-negative number." });
        return true;
      }

      const scores = readScores();
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

      writeScores(scores);
      sendJson(response, 200, { ...scores, todayRecord, allTimeRecord });
    } catch {
      sendJson(response, 400, { error: "Invalid score payload." });
    }
    return true;
  }

  return false;
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
    color: snakeColorFromId(id),
    direction: "right",
    id,
    length: 3,
    nextDirection: "right",
    score: 0,
    segments: [],
    shootCooldown: 0,
    socket,
  };
  snakePlayers.set(id, player);
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
  });
});

setInterval(tickSnakeRoom, 115);

server.listen(port, "0.0.0.0", () => {
  console.log(`Jumpy Plane and Snake listening on ${port}`);
});
