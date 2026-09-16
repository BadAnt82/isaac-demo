import { spawn } from "node:child_process";
import { WebSocket } from "ws";

const port = 4317;
const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await wait(250);
const open = () => new Promise((resolve, reject) => { const socket = new WebSocket(`ws://localhost:${port}/cribbage`); socket.once("open", () => resolve(socket)); socket.once("error", reject); });
const next = (socket, type) => new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 2500); const onMessage = (data) => { const message = JSON.parse(data.toString()); if (message.type !== type) return; clearTimeout(timer); socket.off("message", onMessage); resolve(message); }; socket.on("message", onMessage); });
try {
  const host = await open(); host.send(JSON.stringify({ type: "cribbage-list" })); await next(host, "cribbage-lobby-list");
  host.send(JSON.stringify({ type: "cribbage-create", config: { variant: "standard", playerCount: 2, format: "individual", seats: [{ name: "Host", control: "human" }, { name: "Guest", control: "human" }] } }));
  const created = await next(host, "cribbage-created");
  const guest = await open(); guest.send(JSON.stringify({ type: "cribbage-list" })); await next(guest, "cribbage-lobby-list"); guest.send(JSON.stringify({ type: "cribbage-join", gameId: created.gameId })); await next(guest, "cribbage-joined");
  const connection = await next(host, "cribbage-connection"); if (connection.seats.filter((seat) => seat.connected).length !== 2) throw new Error("Expected two connected seats");
  host.send(JSON.stringify({ type: "cribbage-state", snapshot: { players: [{ hand: [{ id: "h" }] }, { hand: [{ id: "g" }] }], crib: [{ id: "c" }], phase: "discard" } }));
  const state = await next(guest, "cribbage-state"); if (state.snapshot.players[0].hand.length !== 0 || state.snapshot.players[1].hand.length !== 1 || state.snapshot.crib[0].hidden !== true) throw new Error("Private hand redaction failed");
  guest.send(JSON.stringify({ type: "cribbage-quit" })); const quit = await next(host, "cribbage-player-quit"); if (quit.seat !== 1) throw new Error("Quit seat mismatch");
  host.close(); guest.close(); console.log("Cribbage network protocol passed: lobby, join, private state, and quit takeover.");
} finally { server.kill(); }
