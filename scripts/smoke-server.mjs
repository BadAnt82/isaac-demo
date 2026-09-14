import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { WebSocket } from "ws";

const port = Number(process.env.SMOKE_PORT || 4197);
const baseUrl = `http://127.0.0.1:${port}`;
const tempDir = resolve(".tmp-smoke");

rmSync(tempDir, { force: true, recursive: true });

const server = spawn(process.execPath, ["server.mjs"], {
  env: {
    ...process.env,
    BRIDGE_JACKPOT_STORE_PATH: resolve(tempDir, "bridge-jackpot.json"),
    BRIDGE_POINT_SCORE_STORE_PATH: resolve(tempDir, "bridge-points.json"),
    BRIDGE_TILE_SCORE_STORE_PATH: resolve(tempDir, "bridge-tiles.json"),
    GLASS_BRIDGE_ISSUE_STORE_PATH: resolve(tempDir, "glass-bridge-issues.json"),
    JUMPY_PLANE_ISSUE_STORE_PATH: resolve(tempDir, "jumpy-plane-issues.json"),
    PIXEL_WARS_ISSUE_STORE_PATH: resolve(tempDir, "pixel-wars-issues.json"),
    PORT: `${port}`,
    SCORE_STORE_PATH: resolve(tempDir, "jumpy-plane-scores.json"),
    SHOOTING_SNAKES_ISSUE_STORE_PATH: resolve(tempDir, "shooting-snakes-issues.json"),
    SNAKE_SCORE_STORE_PATH: resolve(tempDir, "snake-scores.json"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

function wait(milliseconds) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds);
  });
}

async function waitForServer() {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/high-scores`);
      if (response.ok) {
        return;
      }
    } catch {
      await wait(100);
    }
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}

async function json(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  return { body, status: response.status };
}

function socketRoundTrip(path, onOpen, accept, timeoutMs = 5000) {
  return new Promise((resolveSocket, rejectSocket) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    const timer = setTimeout(() => {
      socket.close();
      rejectSocket(new Error(`Timed out waiting for ${path}`));
    }, timeoutMs);

    socket.on("open", () => onOpen?.(socket));
    socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      const result = accept(message, socket);
      if (result) {
        clearTimeout(timer);
        resolveSocket({ result, socket });
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      rejectSocket(error);
    });
  });
}

try {
  await waitForServer();

  let response = await json("/api/high-scores");
  assert.equal(response.status, 200);
  assert.equal(response.body.todayHighest, 0);

  response = await json("/api/high-scores", {
    body: JSON.stringify({ name: "Smoke", score: 12 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.todayRecord, true);
  assert.equal(response.body.allTimeRecord, true);

  response = await json("/api/snake-high-scores", {
    body: JSON.stringify({ name: "Snake", score: 8 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.allTimeHighest, 8);

  response = await json("/api/glass-bridge-tile-scores", {
    body: JSON.stringify({ name: "Bridge", score: 5 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.todayRecord, true);

  response = await json("/api/glass-bridge-point-scores", {
    body: JSON.stringify({ score: 9 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.todayRecord, true);
  assert.equal(response.body.todayName, "Unknown scorer");

  response = await json("/api/glass-bridge-point-scores", {
    body: JSON.stringify({ score: 9 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.todayRecord, false);
  assert.equal(response.body.allTimeRecord, false);
  assert.equal(response.body.todayName, "Unknown scorer");

  response = await json("/api/glass-bridge-point-scores", {
    body: JSON.stringify({ name: "Claimed", score: 9 }),
    method: "POST",
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.todayRecord, false);
  assert.equal(response.body.allTimeRecord, false);
  assert.equal(response.body.todayName, "Claimed");

  response = await json("/api/glass-bridge-jackpot");
  assert.equal(response.status, 200);
  assert.equal(response.body.jackpot, 20);

  response = await json("/api/glass-bridge-jackpot-contribution", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(response.body.jackpot, 21);

  response = await json("/api/issues/jumpy-plane", {
    body: JSON.stringify({ message: "Smoke issue", page: "/", userAgent: "smoke" }),
    method: "POST",
  });
  assert.equal(response.status, 201);

  const snake = await socketRoundTrip(
    "/snake",
    (socket) => socket.send(JSON.stringify({ type: "snake-start" })),
    (message) => {
      if (message.type !== "snake-state") {
        return null;
      }
      const human = message.players.find((player) => player.id.startsWith("snake-") && player.alive);
      return human ? { players: message.players.length, self: human.id } : null;
    },
  );
  assert.ok(snake.result.players >= 1);
  snake.socket.close();

  response = await json("/api/pixel-wars-lobbies", {
    body: JSON.stringify({ aiBots: 1, humanPlayers: 2 }),
    method: "POST",
  });
  assert.equal(response.status, 201);
  const lobbyId = response.body.lobby.id;

  const firstPixel = await socketRoundTrip(
    "/pixel-wars",
    (socket) => socket.send(JSON.stringify({ lobbyId, type: "pixel-join" })),
    (message) => (message.type === "pixel-wars-welcome" ? { id: message.id } : null),
  );
  const secondPixel = await socketRoundTrip(
    "/pixel-wars",
    (socket) => socket.send(JSON.stringify({ lobbyId, type: "pixel-join" })),
    (message) => (message.type === "pixel-wars-welcome" ? { id: message.id } : null),
  );
  assert.notEqual(firstPixel.result.id, secondPixel.result.id);

  const pixelState = await new Promise((resolveState, rejectState) => {
    const timer = setTimeout(() => rejectState(new Error("Timed out waiting for Pixel Wars state")), 5000);
    firstPixel.socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "pixel-wars-state" && message.lobby.playerCount === 2) {
        clearTimeout(timer);
        resolveState(message);
      }
    });
  });
  assert.equal(pixelState.cells.length, 54 * 36);
  assert.equal(pixelState.turrets.length, 3);
  assert.equal(pixelState.lobby.status, "full");

  const jackpotStatePromise = new Promise((resolveState, rejectState) => {
    const timer = setTimeout(() => rejectState(new Error("Timed out waiting for Pixel Wars jackpot turret")), 5000);
    firstPixel.socket.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (
        message.type === "pixel-wars-state" &&
        message.turrets.filter((turret) => turret.id === firstPixel.result.id).length >= 2
      ) {
        clearTimeout(timer);
        resolveState(message);
      }
    });
  });
  firstPixel.socket.send(JSON.stringify({ prize: "turret", type: "pixel-prize" }));
  const jackpotState = await jackpotStatePromise;
  const jackpotTurrets = jackpotState.turrets.filter((turret) => turret.id === firstPixel.result.id);
  assert.equal(jackpotTurrets.length, 2);
  assert.equal(jackpotTurrets.filter((turret) => turret.respawnPending).length, 1);

  const blockingTurret = jackpotState.turrets.find((turret) => turret.id === secondPixel.result.id);
  assert.ok(blockingTurret);
  let blockedRespawnState = jackpotState;
  firstPixel.socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === "pixel-wars-state") {
      blockedRespawnState = message;
    }
  });
  firstPixel.socket.send(
    JSON.stringify({
      type: "pixel-respawn",
      xRatio: blockingTurret.xRatio,
      yRatio: blockingTurret.yRatio,
    }),
  );
  await wait(250);
  const blockedRespawnTurrets = blockedRespawnState.turrets.filter((turret) => turret.id === firstPixel.result.id);
  assert.equal(blockedRespawnTurrets.filter((turret) => turret.respawnPending).length, 1);

  firstPixel.socket.close();
  secondPixel.socket.close();

  console.log("Smoke checks passed.");
} finally {
  server.kill();
}
