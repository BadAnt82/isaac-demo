type CribbageView = "closed" | "menu" | "options" | "network" | "board" | "round-over";
type CribbagePhase = "discard" | "dealer-select" | "pegging";
type Variant = "standard" | "crazy";
type PlayFormat = "individual" | "team";
type Control = "human" | "ai";
type Card = { id: string; rank: number; suit: string };
type Player = { name: string; control: Control; team: 1 | 2; score: number; hand: Card[]; scoringHand: Card[] };
type NetworkSeat = { seat: number; name: string; control: Control; team: 1 | 2; connected: boolean; available?: boolean; quit?: boolean };
type PegRecord = { seat: number; card: Card };
type ScoreLine = { label: string; points: number; kind?: "fifteen" | "thirty-one" | "pair" | "trips" | "run" | "flush" | "nobs" | "go" | "last" };
type RoundResult = { label: string; cards: Card[]; points: number; lines: ScoreLine[] };

const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS: Record<string, string> = { "♥": "red", "♦": "red", "♠": "black", "♣": "black" };
const SAVE_KEY = "badant-cribbage-match-v2";

function element<T extends HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing Digital Cribbage element ${selector}`);
  return node;
}

function cardName(card: Card) {
  const rank = card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : `${card.rank}`;
  return `${rank}${card.suit}`;
}

function cardValue(card: Card) { return Math.min(10, card.rank); }

function makeDeck() {
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ id: `${suit}-${index + 1}`, rank: index + 1, suit })));
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

function combinationIndices(length: number, choose: number) {
  const combinations: number[][] = [];
  function visit(start: number, picked: number[]) {
    if (picked.length === choose) { combinations.push(picked.slice()); return; }
    for (let index = start; index < length; index += 1) visit(index + 1, [...picked, index]);
  }
  visit(0, []);
  return combinations;
}

function rankLabel(rank: number) {
  return rank === 1 ? "Ace" : rank === 11 ? "Jack" : rank === 12 ? "Queen" : rank === 13 ? "King" : `${rank}`;
}

export function scoreHandBreakdown(cards: Card[], crib = false): ScoreLine[] {
  const lines: ScoreLine[] = [];
  for (let mask = 1; mask < (1 << cards.length); mask += 1) {
    let total = 0;
    const selected: Card[] = [];
    for (let index = 0; index < cards.length; index += 1) {
      if (mask & (1 << index)) {
        total += cardValue(cards[index]);
        selected.push(cards[index]);
      }
    }
    if (total === 15) lines.push({ kind: "fifteen", label: `Fifteen: ${selected.map(cardName).join(" + ")}`, points: 2 });
  }

  const byRank = new Map<number, Card[]>();
  cards.forEach((card) => byRank.set(card.rank, [...(byRank.get(card.rank) || []), card]));
  byRank.forEach((rankCards, rank) => {
    if (rankCards.length === 2) lines.push({ kind: "pair", label: `Pair of ${rankLabel(rank)}s`, points: 2 });
    if (rankCards.length === 3) lines.push({ kind: "trips", label: `Three ${rankLabel(rank)}s`, points: 6 });
    if (rankCards.length === 4) lines.push({ kind: "trips", label: `Four ${rankLabel(rank)}s`, points: 12 });
  });

  const unique = [...byRank.keys()].sort((a, b) => a - b);
  for (let start = 0; start < unique.length;) {
    let end = start + 1;
    while (end < unique.length && unique[end] === unique[end - 1] + 1) end += 1;
    if (end - start >= 3) {
      let multiplier = 1;
      for (let index = start; index < end; index += 1) multiplier *= byRank.get(unique[index])?.length || 1;
      const ranks = unique.slice(start, end);
      const points = ranks.length * multiplier;
      const suffix = multiplier > 1 ? ` x${multiplier}` : "";
      lines.push({ kind: "run", label: `Run ${ranks[0]}-${ranks.at(-1)}${suffix}`, points });
    }
    start = end;
  }

  if (cards.length >= 5) {
    const handCards = cards.slice(0, -1);
    const cut = cards.at(-1)!;
    const handFlush = handCards.length === 4 && handCards.every((card) => card.suit === handCards[0].suit);
    if (crib) {
      if (cards.every((card) => card.suit === cards[0].suit)) lines.push({ kind: "flush", label: "Five-card flush in the crib", points: 5 });
    } else {
      if (handFlush) {
        lines.push({ kind: "flush", label: "Four-card flush", points: 4 });
        if (cut.suit === handCards[0].suit) lines.push({ kind: "flush", label: "Cut matches flush", points: 1 });
      }
      if (handCards.some((card) => card.rank === 11 && card.suit === cut.suit)) lines.push({ kind: "nobs", label: "His nobs", points: 1 });
    }
  }
  return lines;
}

export function scoreHand(cards: Card[], crib = false) {
  return scoreHandBreakdown(cards, crib).reduce((total, line) => total + line.points, 0);
}

export function dealCounts(variant: Variant, playerCount: number, dealer: number) {
  if (variant === "standard") return Array.from({ length: playerCount }, () => playerCount === 2 ? 6 : 5);
  if (playerCount === 2) return Array.from({ length: playerCount }, (_, index) => index === dealer ? 4 : 8);
  if (playerCount === 3) return Array.from({ length: playerCount }, (_, index) => index === dealer ? 4 : 6);
  return Array.from({ length: playerCount }, () => 5);
}

export function chooseBestKeep(cards: Card[], keepCount: number, dealerCrib: boolean) {
  let best = combinationIndices(cards.length, keepCount)[0] || [];
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const indices of combinationIndices(cards.length, keepCount)) {
    const keep = indices.map((index) => cards[index]);
    const passed = cards.filter((_, index) => !indices.includes(index));
    const value = scoreHand(keep) + (dealerCrib ? scoreHand(passed) * 0.55 : -scoreHand(passed) * 0.2);
    if (value > bestValue) { bestValue = value; best = indices; }
  }
  return best;
}

export function initCribbage() {
  const gameCanvas = element<HTMLCanvasElement>("#game");
  const overlay = element<HTMLElement>("#overlay");
  const platform = element<HTMLElement>("#platform-panel");
  const homeButton = element<HTMLButtonElement>("#home");
  const menu = element<HTMLElement>("#cribbage-menu-panel");
  const options = element<HTMLElement>("#cribbage-options-panel");
  const board = element<HTMLElement>("#cribbage-board-panel");
  const roundPanel = element<HTMLElement>("#cribbage-round-panel");
  const mode = element<HTMLSelectElement>("#cribbage-mode");
  const playerCount = element<HTMLSelectElement>("#cribbage-player-count");
  const format = element<HTMLSelectElement>("#cribbage-format");
  const playerNames = element<HTMLElement>("#cribbage-player-names");
  const modeNote = element<HTMLElement>("#cribbage-mode-note");
  const resumeButton = element<HTMLButtonElement>("#cribbage-resume");
  const status = element<HTMLElement>("#cribbage-status");
  const roundLabel = element<HTMLElement>("#cribbage-round-label");
  const scoreboard = element<HTMLElement>("#cribbage-scoreboard");
  const dealerLabel = element<HTMLElement>("#cribbage-dealer");
  const cutLabel = element<HTMLElement>("#cribbage-cut-card");
  const cribCount = element<HTMLElement>("#cribbage-crib-count");
  const totalLabel = element<HTMLElement>("#cribbage-total");
  const turnLabel = element<HTMLElement>("#cribbage-turn-label");
  const hand = element<HTMLElement>("#cribbage-hand");
  const cribAction = element<HTMLButtonElement>("#cribbage-crib-action");
  const passButton = element<HTMLButtonElement>("#cribbage-pass");
  const roundTitle = element<HTMLElement>("#cribbage-round-title");
  const roundMessage = element<HTMLElement>("#cribbage-round-message");
  const roundScores = element<HTMLElement>("#cribbage-round-scores");
  const roundResults = element<HTMLElement>("#cribbage-round-results");
  const nextRoundButton = element<HTMLButtonElement>("#cribbage-next-round");
  const networkPanel = element<HTMLElement>("#cribbage-network-panel");
  const networkList = element<HTMLElement>("#cribbage-network-list");
  const networkStatus = element<HTMLElement>("#cribbage-network-status");
  const createGameButton = element<HTMLButtonElement>("#cribbage-create-game");
  const refreshGamesButton = element<HTMLButtonElement>("#cribbage-refresh-games");
  const networkBackButton = element<HTMLButtonElement>("#cribbage-network-back");
  const multiplayerButton = element<HTMLButtonElement>("#cribbage-multiplayer");
  const connectionStatus = element<HTMLElement>("#cribbage-connection-status");
  const quitButton = element<HTMLButtonElement>("#cribbage-quit");
  const networkStartButton = element<HTMLButtonElement>("#cribbage-network-start");
  const cancelGameButton = element<HTMLButtonElement>("#cribbage-cancel-game");
  const pegs = element<HTMLElement>("#cribbage-pegs");
  const pegHoles = element<HTMLElement>("#cribbage-peg-holes");
  const playedCards = element<HTMLElement>("#cribbage-played-cards");
  const peggingScoring = element<HTMLElement>("#cribbage-pegging-scoring");
  const state = {
    view: "closed" as CribbageView,
    phase: "discard" as CribbagePhase,
    variant: "standard" as Variant,
    format: "individual" as PlayFormat,
    players: [] as Player[],
    deck: [] as Card[],
    crib: [] as Card[],
    cut: null as Card | null,
    roundResults: [] as RoundResult[],
    selected: new Set<string>(),
    dealer: 0,
    active: 0,
    total: 0,
    pegged: [] as Card[],
    pegHistory: [] as PegRecord[],
    peggingCallouts: [] as ScoreLine[],
    discardedSeats: new Set<number>(),
    round: 1,
    winner: "",
    teamScores: { 1: 0, 2: 0 },
    aiTimer: 0,
    network: { socket: null as WebSocket | null, gameId: "", sessionId: "", seat: -1, host: false, remote: false, reconnect: 0 },
    connectionSeats: [] as NetworkSeat[],
  };
  try { const savedNetwork = JSON.parse(localStorage.getItem("badant-cribbage-network") || "null"); if (savedNetwork?.gameId && savedNetwork?.sessionId) { state.network.gameId = savedNetwork.gameId; state.network.sessionId = savedNetwork.sessionId; } } catch { /* ignore stale session */ }

  function readSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
      return raw && Array.isArray(raw.players) && raw.players.length >= 2 ? raw : null;
    } catch { return null; }
  }

  function saveGame() {
    if (!state.players.length || state.view === "closed" || state.view === "menu") return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, selected: [...state.selected], discardedSeats: [...state.discardedSeats], aiTimer: 0 }));
  }

  function setPanels(next: CribbageView) {
    state.view = next;
    if (next === "closed") {
      window.clearTimeout(state.aiTimer);
      gameCanvas.hidden = false; platform.hidden = false; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true; networkPanel.hidden = true;
      overlay.hidden = false; overlay.classList.add("is-platform"); overlay.classList.remove("is-cribbage"); homeButton.hidden = true; return;
    }
    gameCanvas.hidden = true; platform.hidden = true; menu.hidden = next !== "menu"; options.hidden = next !== "options"; board.hidden = next !== "board"; roundPanel.hidden = next !== "round-over"; networkPanel.hidden = next !== "network";
    overlay.hidden = false; overlay.classList.remove("is-platform"); overlay.classList.add("is-cribbage"); homeButton.hidden = false;
    if (next === "menu") {
      updateSetupUi(); const saved = readSaved(); resumeButton.disabled = !saved; resumeButton.textContent = saved ? `Resume saved match (Round ${saved.round || 1})` : "Resume saved match";
    }
  }

  function networkSend(payload: unknown) { const socket = state.network.socket; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)); }
  function renderConnections() {
    if (!state.network.remote) { connectionStatus.replaceChildren(); return; }
    connectionStatus.replaceChildren(...state.connectionSeats.map((seat) => { const item = document.createElement("span"); item.className = `cribbage-connection-seat ${seat.connected ? "is-connected" : seat.control === "ai" ? "is-ai" : ""}`; item.textContent = `${seat.name}: ${seat.control === "ai" ? "AI" : seat.connected ? "Connected" : "Disconnected"}`; return item; }));
  }
  function ownedNetworkGames(): string[] { try { const value = JSON.parse(localStorage.getItem("badant-cribbage-owned-games") || "[]"); return Array.isArray(value) ? value.filter((id) => typeof id === "string") : []; } catch { return []; } }
  function rememberOwnedGame(gameId: string, sessionId = "") { const games = [...new Set([...ownedNetworkGames(), gameId])]; localStorage.setItem("badant-cribbage-owned-games", JSON.stringify(games)); if (sessionId) { try { const sessions = JSON.parse(localStorage.getItem("badant-cribbage-owned-sessions") || "{}"); sessions[gameId] = sessionId; localStorage.setItem("badant-cribbage-owned-sessions", JSON.stringify(sessions)); } catch { /* ignore storage errors */ } } }
  function sessionForOwnedGame(gameId: string) { try { const sessions = JSON.parse(localStorage.getItem("badant-cribbage-owned-sessions") || "{}"); return typeof sessions[gameId] === "string" ? sessions[gameId] : ""; } catch { return ""; } }
  function forgetOwnedGame(gameId: string) { localStorage.setItem("badant-cribbage-owned-games", JSON.stringify(ownedNetworkGames().filter((id) => id !== gameId))); try { const sessions = JSON.parse(localStorage.getItem("badant-cribbage-owned-sessions") || "{}"); delete sessions[gameId]; localStorage.setItem("badant-cribbage-owned-sessions", JSON.stringify(sessions)); } catch { /* ignore storage errors */ } }
  function renderNetworkList(games: Array<{ gameId: string; variant: Variant; playerCount: number; format: PlayFormat; seats: NetworkSeat[]; started: boolean; ownerSeat?: number }> = []) {
    const owned = new Set(ownedNetworkGames());
    const visibleGames = games.filter((game) => game.seats.some((seat) => seat.available) || owned.has(game.gameId));
    networkList.replaceChildren(...visibleGames.map((game) => { const row = document.createElement("div"); row.className = "cribbage-network-game"; const open = game.seats.filter((seat) => seat.available).length; const mine = owned.has(game.gameId); const opponents = mine ? game.seats.filter((seat) => seat.control === "human" && seat.seat !== (game.ownerSeat ?? 0)) : []; const connected = opponents.filter((seat) => seat.connected).length; row.innerHTML = `<div><strong>${game.gameId}${mine ? " · My game" : ""}</strong><span>${game.variant === "crazy" ? "Crazy" : "Standard"} · ${game.format === "team" ? "2 vs 2" : "Individual"}${mine ? ` · Opponents: ${connected}/${opponents.length} connected` : ` · ${open} open seat${open === 1 ? "" : "s"}`}</span></div>`; const enter = document.createElement("button"); enter.type = "button"; enter.textContent = "Enter game"; enter.disabled = !mine && (game.started || open === 0); enter.addEventListener("click", () => { state.network.gameId = game.gameId; state.network.remote = true; networkSend({ type: "cribbage-join", gameId: game.gameId, sessionId: mine ? sessionForOwnedGame(game.gameId) : undefined }); networkStatus.textContent = `Entering ${game.gameId}…`; }); row.append(enter); if (mine) { const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "secondary"; cancel.textContent = "Cancel"; cancel.addEventListener("click", () => { networkSend({ type: "cribbage-cancel", gameId: game.gameId }); networkStatus.textContent = `Cancelling ${game.gameId}…`; }); row.append(cancel); } return row; }));
  }
  function networkUrl() { return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/cribbage`; }
  function connectNetwork() {
    if (state.network.socket && state.network.socket.readyState !== WebSocket.CLOSED) return;
    const socket = new WebSocket(networkUrl()); state.network.socket = socket;
    socket.addEventListener("open", () => { networkStatus.textContent = "Connected. Choose a game or create one."; networkSend({ type: "cribbage-list" }); if (state.network.remote && state.network.gameId && state.network.sessionId) networkSend({ type: "cribbage-join", gameId: state.network.gameId, sessionId: state.network.sessionId }); });
    socket.addEventListener("message", (event) => { let message: any; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "cribbage-lobby-list") { renderNetworkList(message.games || []); return; }
      if (message.type === "cribbage-error") { networkStatus.textContent = message.message; return; }
      if (message.type === "cribbage-created" || message.type === "cribbage-joined") { state.network.gameId = message.gameId; state.network.sessionId = message.sessionId; state.network.seat = message.seat; state.network.host = Boolean(message.host); state.network.remote = true; networkStartButton.hidden = !state.network.host; cancelGameButton.hidden = !state.network.host; if (message.type === "cribbage-created") rememberOwnedGame(message.gameId, message.sessionId); createGameButton.disabled = false; localStorage.setItem("badant-cribbage-network", JSON.stringify({ gameId: message.gameId, sessionId: message.sessionId })); networkStatus.textContent = state.network.host ? `Game ${message.gameId} created. Share this code, then wait for players.` : `Joined ${message.gameId}. Waiting for the host to deal.`; return; }
      if (message.type === "cribbage-ready") { if (state.network.host) { networkStartButton.hidden = false; networkStatus.textContent = "All human seats are connected. Start when you are ready."; } return; }
      if (message.type === "cribbage-cancelled") { forgetOwnedGame(message.gameId); if (message.gameId === state.network.gameId) { state.network.remote = false; state.network.host = false; state.network.gameId = ""; state.network.sessionId = ""; state.network.seat = -1; networkStartButton.hidden = true; cancelGameButton.hidden = true; localStorage.removeItem("badant-cribbage-network"); } createGameButton.disabled = false; networkStatus.textContent = "Game cancelled. Choose another game or create a new one."; setPanels("network"); return; }
      if (message.type === "cribbage-connection") { if (message.gameId === state.network.gameId) { state.connectionSeats = message.seats || []; renderConnections(); networkStatus.textContent = state.connectionSeats.filter((seat: NetworkSeat) => seat.connected && seat.control === "human").length >= 1 ? "Players can reconnect if their connection drops." : networkStatus.textContent; } return; }
      if (message.type === "cribbage-state") { if (!state.network.host) applyNetworkSnapshot(message.snapshot); return; }
      if (message.type === "cribbage-host-transfer") { state.network.host = true; state.network.seat = message.seat; networkStartButton.hidden = true; cancelGameButton.hidden = false; networkStatus.textContent = "The previous host left. You are now hosting this game."; applyNetworkSnapshot(message.snapshot, true); return; }
      if (message.type === "cribbage-remote-action" && state.network.host) handleRemoteAction(message.seat, message.action || {});
      if (message.type === "cribbage-player-quit" && state.network.host) { const player = state.players[message.seat]; if (player) { player.control = "ai"; status.textContent = `${player.name} left. AI has taken over this seat.`; renderBoard(); queueAiTurn(); publishNetworkState(); } }
    });
    socket.addEventListener("close", () => { state.connectionSeats = state.connectionSeats.map((seat) => seat.seat === state.network.seat ? { ...seat, connected: false } : seat); renderConnections(); if (state.network.remote && state.network.sessionId) { networkStatus.textContent = "Connection lost. Reconnecting…"; window.clearTimeout(state.network.reconnect); state.network.reconnect = window.setTimeout(connectNetwork, 1500); } });
  }
  function networkSnapshot() { return { ...state, selected: [...state.selected], discardedSeats: [...state.discardedSeats], network: undefined, aiTimer: 0 }; }
  function publishNetworkState() { if (state.network.remote && state.network.host) networkSend({ type: "cribbage-state", snapshot: networkSnapshot() }); }
  function applyNetworkSnapshot(snapshot: any, full = false) { if (!snapshot) return; state.phase = snapshot.phase; state.variant = snapshot.variant; state.format = snapshot.format; state.players = snapshot.players || []; const revealRound = snapshot.view === "round-over"; if (!full && !revealRound) state.players.forEach((player: Player, index: number) => { if (index !== state.network.seat) { player.hand = []; player.scoringHand = []; } }); state.deck = snapshot.deck || []; state.crib = snapshot.crib || []; state.cut = snapshot.cut || null; state.roundResults = snapshot.roundResults || []; state.dealer = snapshot.dealer; state.active = snapshot.active; state.total = snapshot.total; state.pegged = snapshot.pegged || []; state.pegHistory = snapshot.pegHistory || []; state.peggingCallouts = snapshot.peggingCallouts || []; state.round = snapshot.round; state.winner = snapshot.winner || ""; state.teamScores = snapshot.teamScores || { 1: 0, 2: 0 }; state.selected.clear(); nextRoundButton.hidden = Boolean(state.winner); setPanels(revealRound ? "round-over" : "board"); renderBoard(); if (revealRound) renderRoundResults(); }
  function handleRemoteAction(seat: number, action: any) { if (seat !== state.active || state.players[seat]?.control !== "human") return; state.selected = new Set(action.selected || []); if (action.kind === "discard") applyDiscard(true); else if (action.kind === "play") { const card = state.players[seat].hand.find((candidate) => candidate.id === action.cardId); if (card) playCard(card, true); } else if (action.kind === "pass") passPegging(true); }

  function updateSetupUi() {
    const count = Number(playerCount.value);
    const teamOption = format.querySelector<HTMLOptionElement>('option[value="team"]');
    if (teamOption) teamOption.disabled = count !== 4;
    if (count !== 4) format.value = "individual";
    playerNames.querySelectorAll<HTMLElement>("[data-player-slot]").forEach((slot) => { slot.hidden = Number(slot.dataset.playerSlot) >= count; });
    playerNames.querySelectorAll<HTMLElement>("[data-team-slot]").forEach((slot) => { slot.hidden = format.value !== "team"; });
    modeNote.textContent = mode.value === "crazy" ? "Crazy rules: non-dealers pass into the dealer's eight-card pool, then the dealer keeps the best four and owns the other four as the crib." : "Standard rules: choose the correct discard for your player count, then peg to 31 and score each hand.";
  }

  function seatFromSetup(index: number): Player {
    const name = element<HTMLInputElement>(`#cribbage-player-${index + 1}`).value.trim() || `Player ${index + 1}`;
    const control = element<HTMLSelectElement>(`#cribbage-control-${index + 1}`).value as Control;
    const team = (Number(element<HTMLSelectElement>(`#cribbage-team-${index + 1}`).value) === 2 ? 2 : 1) as 1 | 2;
    return { name, control, team, score: 0, hand: [], scoringHand: [] };
  }

  function award(playerIndex: number, points: number) { if (points) { const player = state.players[playerIndex]; player.score += points; if (state.format === "team") state.teamScores[player.team] += points; } }
  function playerScore(player: Player) { return state.format === "team" ? state.teamScores[player.team] : player.score; }

  function renderScoreboard() {
    const rows = state.players.map((player, index) => { const item = document.createElement("div"); item.className = `cribbage-score ${index === state.active ? "is-active" : ""}`; item.innerHTML = `<span>${player.name}${player.control === "ai" ? " · AI" : ""}</span><strong>${playerScore(player)}</strong>`; return item; });
    if (state.format === "team") (Object.keys(state.teamScores) as Array<"1" | "2">).forEach((team) => { const item = document.createElement("div"); item.className = "cribbage-score cribbage-team-score"; item.innerHTML = `<span>Team ${team}</span><strong>${state.teamScores[Number(team) as 1 | 2]}</strong>`; rows.push(item); });
    scoreboard.replaceChildren(...rows);
  }

  function renderPeggingScoring() {
    peggingScoring.replaceChildren();
    if (state.phase !== "pegging") return;
    const points = state.peggingCallouts.reduce((total, line) => total + line.points, 0);
    const heading = document.createElement("strong");
    heading.textContent = state.peggingCallouts.length
      ? `This play: ${points} pegging point${points === 1 ? "" : "s"}`
      : "Pegging scoring appears here";
    peggingScoring.append(heading);
    if (!state.peggingCallouts.length) return;
    const list = document.createElement("div");
    list.className = "cribbage-pegging-callouts";
    list.replaceChildren(...state.peggingCallouts.map((line) => {
      const item = document.createElement("span");
      item.className = `cribbage-pegging-callout ${line.kind ? `is-${line.kind}` : ""}`;
      item.innerHTML = `<span>${line.label}</span><strong>+${line.points}</strong>`;
      return item;
    }));
    peggingScoring.append(list);
  }

  function renderRoundResults() {
    roundResults.replaceChildren();
    state.roundResults.forEach((result) => {
      const card = document.createElement("article");
      card.className = "cribbage-result-card";
      const heading = document.createElement("h3");
      heading.textContent = result.label;
      card.append(heading);
      const cards = document.createElement("div");
      cards.className = "cribbage-result-cards";
      cards.replaceChildren(...result.cards.map((playedCard, index) => {
        const item = document.createElement("span");
        item.className = `cribbage-result-card-face ${SUIT_COLORS[playedCard.suit]}`;
        item.textContent = `${cardName(playedCard)}${index === result.cards.length - 1 ? " · Cut" : ""}`;
        return item;
      }));
      card.append(cards);
      const list = document.createElement("ul");
      list.className = "cribbage-result-breakdown";
      if (result.lines.length) {
        list.replaceChildren(...result.lines.map((line) => {
          const item = document.createElement("li");
          item.innerHTML = `<span>${line.label}</span><strong>${line.points}</strong>`;
          return item;
        }));
      } else {
        const item = document.createElement("li");
        item.className = "is-empty";
        item.textContent = "No qualifying points";
        list.append(item);
      }
      card.append(list);
      const total = document.createElement("p");
      total.className = "cribbage-result-total";
      total.innerHTML = `<span>Total</span><strong>${result.points} points</strong>`;
      card.append(total);
      roundResults.append(card);
    });
  }

  function renderCard(card: Card, selected: boolean, playable: boolean) {
    const button = document.createElement("button"); button.type = "button"; button.className = `cribbage-card ${SUIT_COLORS[card.suit]} ${selected ? "is-selected" : ""}`; button.disabled = !playable; button.setAttribute("aria-label", `${cardName(card)}${selected ? ", selected" : ""}`); button.innerHTML = `<span>${card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : card.rank}</span><b>${card.suit}</b>`;
    button.addEventListener("click", () => { if (state.network.remote && !state.network.host) { if (state.phase === "pegging") networkSend({ type: "cribbage-action", action: { kind: "play", cardId: card.id } }); else { if (state.selected.has(card.id)) state.selected.delete(card.id); else if (state.selected.size < (state.phase === "dealer-select" ? 4 : discardCount(state.network.seat))) state.selected.add(card.id); renderBoard(); } return; } if (state.phase === "pegging") playCard(card); else { if (state.selected.has(card.id)) state.selected.delete(card.id); else if (state.selected.size < (state.phase === "dealer-select" ? 4 : discardCount(state.active))) state.selected.add(card.id); renderBoard(); } });
    return button;
  }

  function discardCount(playerIndex: number) { const player = state.players[playerIndex]; if (state.variant === "crazy" && playerIndex === state.dealer) return 0; return Math.max(0, player.hand.length - 4); }

  function renderPegTrack() {
    if (!pegHoles.childElementCount) { for (let score = 0; score <= 121; score += 1) { const hole = document.createElement("span"); hole.className = "cribbage-peg-hole"; const row = score <= 60 ? 1 : 2; const column = score <= 60 ? score + 1 : 122 - score; hole.style.gridRow = String(row); hole.style.gridColumn = String(column); hole.title = `${score} points`; pegHoles.append(hole); } }
    const entries = state.players.map((player, index) => { const peg = document.createElement("span"); const score = Math.max(0, Math.min(121, playerScore(player))); const row = score <= 60 ? 0 : 1; const column = score <= 60 ? score : 60 - (score - 61); peg.className = `cribbage-peg peg-${index}`; peg.style.left = `${(column / 60) * 100}%`; peg.style.top = `${row * 31 + 2}px`; peg.textContent = `${index + 1}`; peg.title = `${player.name}: ${score} points`; return peg; });
    pegs.replaceChildren(...entries);
    const groups = state.players.map((player, index) => { const row = document.createElement("div"); row.className = "cribbage-played-row"; const label = document.createElement("strong"); label.textContent = player.name; const cards = document.createElement("span"); cards.className = "cribbage-played-list"; const records = state.pegHistory.filter((record) => record.seat === index); cards.replaceChildren(...records.map((record) => { const card = document.createElement("span"); card.className = `cribbage-played-card ${SUIT_COLORS[record.card.suit]}`; card.textContent = cardName(record.card); return card; })); row.append(label, cards); return row; });
    playedCards.replaceChildren(...groups);
  }

  function renderBoard() {
    const activePlayer = state.players[state.active]; const player = state.network.remote ? state.players[state.network.seat] : activePlayer; if (!player) return;
    roundLabel.textContent = `Round ${state.round} · ${state.variant === "crazy" ? "Crazy" : "Standard"}${state.format === "team" ? " · 2 vs 2" : ""}`; dealerLabel.textContent = state.players[state.dealer]?.name || "—"; cutLabel.textContent = state.cut ? cardName(state.cut) : "—"; cribCount.textContent = `${state.crib.length} card${state.crib.length === 1 ? "" : "s"}`; totalLabel.textContent = `${state.total} / 31`; renderScoreboard(); renderPegTrack(); renderPeggingScoring();
    if (activePlayer?.control === "ai") { hand.innerHTML = `<p class="cribbage-private">${activePlayer.name} (AI) is choosing from a private hand…</p>`; cribAction.hidden = true; passButton.hidden = true; turnLabel.textContent = `${activePlayer.name} is thinking`; status.textContent = "AI uses only the cards and count available to its seat."; if (state.network.host || !state.network.remote) queueAiTurn(); else status.textContent = `Waiting for ${activePlayer.name} to finish.`; renderConnections(); quitButton.hidden = !state.network.remote; return; }
    const dealerSelect = state.phase === "dealer-select"; const canAct = !state.network.remote || state.network.host || state.active === state.network.seat; const needed = dealerSelect ? 4 : discardCount(state.active); hand.replaceChildren(...player.hand.map((card) => renderCard(card, state.selected.has(card.id), canAct && (state.phase === "pegging" ? cardValue(card) + state.total <= 31 : true))));
    if (state.phase === "discard") { turnLabel.textContent = `${activePlayer?.name || player.name}: choose ${needed} card${needed === 1 ? "" : "s"} to ${state.variant === "crazy" ? "pass to the dealer" : "pass to the crib"}`; status.textContent = canAct ? `${state.crib.length} crib cards placed so far.` : `Waiting for ${activePlayer?.name || "the other player"} to choose cards.`; cribAction.hidden = !canAct; cribAction.disabled = !canAct || state.selected.size !== needed; cribAction.textContent = state.variant === "crazy" ? `Pass ${needed} cards` : `Discard ${needed} card${needed === 1 ? "" : "s"}`; passButton.hidden = true; }
    else if (dealerSelect) { turnLabel.textContent = `${activePlayer?.name || player.name}: keep exactly 4 cards for your playing hand`; status.textContent = canAct ? "The other 4 cards will become your crib." : `Waiting for ${activePlayer?.name || "the dealer"} to choose a hand.`; cribAction.hidden = !canAct; cribAction.disabled = !canAct || state.selected.size !== 4; cribAction.textContent = "Keep selected 4"; passButton.hidden = true; }
    else { turnLabel.textContent = `${activePlayer?.name || player.name}'s turn to peg`; status.textContent = canAct ? (state.total === 0 ? "The count has reset. Play any card." : "Play a card without taking the count over 31.") : `${activePlayer?.name || "Opponent"} is pegging.`; cribAction.hidden = true; passButton.hidden = !canAct || !player.hand.every((card) => cardValue(card) + state.total > 31); }
    renderConnections(); quitButton.hidden = !state.network.remote;
  }

  function nextDiscardSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (!state.discardedSeats.has(index) && discardCount(index) > 0 && (state.variant !== "crazy" || index !== state.dealer)) return index; } return -1; }

  function dealRound() {
    state.deck = shuffle(makeDeck()); state.crib = []; state.cut = null; state.selected.clear(); state.phase = "discard"; state.total = 0; state.pegged = []; state.pegHistory = []; state.peggingCallouts = []; state.roundResults = []; state.discardedSeats.clear(); state.players.forEach((player) => { player.hand = []; player.scoringHand = []; });
    const counts = dealCounts(state.variant, state.players.length, state.dealer); const maxCards = Math.max(...counts); for (let cardIndex = 0; cardIndex < maxCards; cardIndex += 1) state.players.forEach((player, index) => { if (cardIndex < counts[index]) player.hand.push(state.deck.pop()!); });
    state.active = state.variant === "crazy" ? (state.dealer + 1) % state.players.length : state.dealer; setPanels("board"); renderBoard(); saveGame(); publishNetworkState();
  }

  function startGame() {
    window.clearTimeout(state.aiTimer); state.variant = mode.value === "crazy" ? "crazy" : "standard"; state.format = format.value === "team" && Number(playerCount.value) === 4 ? "team" : "individual"; state.players = Array.from({ length: Number(playerCount.value) }, (_, index) => seatFromSetup(index)); state.dealer = 0; state.round = 1; state.winner = ""; state.teamScores = { 1: 0, 2: 0 }; dealRound();
  }

  function finishStandardDiscard() { if (state.players.length === 3) state.crib.push(state.deck.pop()!); state.players.forEach((player) => { player.scoringHand = player.hand.slice(); }); finishPegging(); }
  function finishCrazyPasses() { state.phase = "dealer-select"; state.active = state.dealer; state.selected.clear(); renderBoard(); saveGame(); publishNetworkState(); }
  function finishCrazyDealerSelection() { const dealer = state.players[state.dealer]; const retained = dealer.hand.filter((card) => state.selected.has(card.id)); state.crib = dealer.hand.filter((card) => !state.selected.has(card.id)); dealer.hand = retained; dealer.scoringHand = retained.slice(); state.selected.clear(); finishPegging(); }

  function applyDiscard(fromNetwork = false) {
    if (state.network.remote && !state.network.host && !fromNetwork) { networkSend({ type: "cribbage-action", action: { kind: "discard", selected: [...state.selected] } }); return; }
    const player = state.players[state.active]; const required = state.phase === "dealer-select" ? 4 : discardCount(state.active); if (state.selected.size !== required) return;
    if (state.phase === "dealer-select") { finishCrazyDealerSelection(); return; }
    const passed = player.hand.filter((card) => state.selected.has(card.id)); player.hand = player.hand.filter((card) => !state.selected.has(card.id)); if (state.variant === "crazy") state.players[state.dealer].hand.push(...passed); else state.crib.push(...passed); state.discardedSeats.add(state.active); state.selected.clear(); const next = nextDiscardSeat(state.active); if (next < 0) { if (state.variant === "crazy") finishCrazyPasses(); else finishStandardDiscard(); } else { state.active = next; renderBoard(); saveGame(); publishNetworkState(); }
  }

  function finishPegging() { state.players.forEach((player) => { if (!player.scoringHand.length) player.scoringHand = player.hand.slice(); }); state.cut = state.deck.pop() || null; state.phase = "pegging"; state.active = (state.dealer + 1) % state.players.length; state.total = 0; state.pegged = []; state.peggingCallouts = []; renderBoard(); saveGame(); publishNetworkState(); }

  function chooseAiDiscard() {
    const player = state.players[state.active]; const keepCount = state.phase === "dealer-select" ? 4 : player.hand.length - discardCount(state.active); const keepIndices = chooseBestKeep(player.hand, keepCount, state.phase === "dealer-select"); state.selected = new Set(player.hand.filter((_, index) => state.phase === "dealer-select" ? keepIndices.includes(index) : !keepIndices.includes(index)).map((card) => card.id)); applyDiscard();
  }

  function peggingBreakdown(card: Card): ScoreLine[] {
    const lines: ScoreLine[] = [];
    const nextTotal = state.total + cardValue(card);
    if (nextTotal === 15) lines.push({ kind: "fifteen", label: "Fifteen", points: 2 });
    if (nextTotal === 31) lines.push({ kind: "thirty-one", label: "Thirty-one", points: 2 });
    let matching = 0;
    for (let index = state.pegged.length - 1; index >= 0 && state.pegged[index].rank === card.rank; index -= 1) matching += 1;
    if (matching === 1) lines.push({ kind: "pair", label: `Pair of ${rankLabel(card.rank)}s`, points: 2 });
    if (matching === 2) lines.push({ kind: "trips", label: `Three ${rankLabel(card.rank)}s`, points: 6 });
    if (matching >= 3) lines.push({ kind: "trips", label: `Four ${rankLabel(card.rank)}s`, points: 12 });
    const sequence = [...state.pegged, card];
    for (let length = sequence.length; length >= 3; length -= 1) {
      const ranks = sequence.slice(-length).map((playedCard) => playedCard.rank).sort((first, second) => first - second);
      if (new Set(ranks).size !== length) continue;
      if (ranks.every((rank, index) => index === 0 || rank === ranks[index - 1] + 1)) {
        lines.push({ kind: "run", label: `Run of ${length}`, points: length });
        break;
      }
    }
    return lines;
  }

  function peggingPoints(card: Card) { return peggingBreakdown(card).reduce((total, line) => total + line.points, 0); }
  function chooseAiPegging() {
    const player = state.players[state.active];
    const playable = player.hand.filter((card) => cardValue(card) + state.total <= 31);
    if (!playable.length) { passPegging(); return; }
    const scored = playable.filter((card) => peggingPoints(card) > 0);
    const choices = scored.length ? scored : playable;
    choices.sort((first, second) => {
      const pointDifference = peggingPoints(second) - peggingPoints(first);
      if (pointDifference) return pointDifference;
      if (!scored.length) {
        // When no card scores, shed a high card while avoiding common 5-point gifts.
        const firstRisk = (cardValue(first) === 5 ? 2 : 0) + ([10, 21, 26].includes(state.total + cardValue(first)) ? 1 : 0);
        const secondRisk = (cardValue(second) === 5 ? 2 : 0) + ([10, 21, 26].includes(state.total + cardValue(second)) ? 1 : 0);
        if (firstRisk !== secondRisk) return firstRisk - secondRisk;
        return cardValue(second) - cardValue(first);
      }
      return cardValue(first) - cardValue(second);
    });
    playCard(choices[0]);
  }
  function queueAiTurn() { if (state.aiTimer || state.view !== "board" || state.players[state.active]?.control !== "ai") return; state.aiTimer = window.setTimeout(() => { state.aiTimer = 0; if (state.phase === "pegging") chooseAiPegging(); else chooseAiDiscard(); }, 650); }

  function nextPeggingSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (state.players[index].hand.length && state.players[index].hand.some((card) => cardValue(card) + state.total <= 31)) return index; } return -1; }
  function playCard(card: Card, fromNetwork = false) {
    if (state.network.remote && !state.network.host && !fromNetwork) { networkSend({ type: "cribbage-action", action: { kind: "play", cardId: card.id } }); return; }
    if (state.phase !== "pegging" || cardValue(card) + state.total > 31) return;
    const lines = peggingBreakdown(card);
    const player = state.players[state.active];
    state.pegHistory.push({ seat: state.active, card });
    player.hand = player.hand.filter((candidate) => candidate.id !== card.id);
    state.pegged.push(card);
    state.total += cardValue(card);
    state.peggingCallouts = lines;
    award(state.active, lines.reduce((total, line) => total + line.points, 0));
    if (state.total === 31) { state.total = 0; state.pegged = []; }
    if (state.players.every((candidate) => candidate.hand.length === 0)) {
      if (state.total > 0) { award(state.active, 1); state.peggingCallouts = [...lines, { kind: "last", label: "Last card", points: 1 }]; }
      finishRound(); return;
    }
    const next = nextPeggingSeat(state.active);
    if (next < 0) {
      const lastPeggingSeat = state.pegHistory.at(-1)?.seat ?? state.active;
      award(lastPeggingSeat, 1);
      state.peggingCallouts = [...lines, { kind: "go", label: "Go", points: 1 }];
      state.total = 0; state.pegged = []; state.active = nextPeggingSeat(lastPeggingSeat);
      if (state.active < 0) state.active = state.players.findIndex((candidate) => candidate.hand.length > 0);
    } else state.active = next;
    renderBoard(); saveGame(); publishNetworkState();
  }
  function passPegging(fromNetwork = false) {
    if (state.network.remote && !state.network.host && !fromNetwork) { networkSend({ type: "cribbage-action", action: { kind: "pass" } }); return; }
    const next = nextPeggingSeat(state.active);
    if (next < 0) {
      const lastPeggingSeat = state.pegHistory.at(-1)?.seat ?? state.active;
      award(lastPeggingSeat, 1);
      state.peggingCallouts = [{ kind: "go", label: "Go", points: 1 }];
      state.total = 0; state.pegged = []; state.active = nextPeggingSeat(lastPeggingSeat);
      if (state.active < 0) state.active = state.players.findIndex((candidate) => candidate.hand.length > 0);
    } else state.active = next;
    renderBoard(); saveGame(); publishNetworkState();
  }

  function finishRound() {
    const cut = state.cut ? [state.cut] : [];
    state.roundResults = state.players.map((player, index) => {
      const cards = [...player.scoringHand, ...cut];
      const lines = scoreHandBreakdown(cards);
      award(index, lines.reduce((total, line) => total + line.points, 0));
      return { label: `${player.name}'s hand`, cards, lines, points: lines.reduce((total, line) => total + line.points, 0) };
    });
    const cribCards = [...state.crib, ...cut];
    const cribLines = scoreHandBreakdown(cribCards, true);
    const cribPoints = cribLines.reduce((total, line) => total + line.points, 0);
    award(state.dealer, cribPoints);
    state.roundResults.push({ label: `${state.players[state.dealer]?.name || "Dealer"}'s crib`, cards: cribCards, lines: cribLines, points: cribPoints });
    const winner = state.players.find((player) => playerScore(player) >= 121);
    const teamWinner = state.teamScores[1] >= 121 ? "Team 1" : state.teamScores[2] >= 121 ? "Team 2" : "";
    state.winner = state.format === "team" ? teamWinner : winner?.name || "";
    roundTitle.textContent = state.winner ? `${state.winner} wins the game!` : "Round complete";
    if (state.winner) {
      const localPlayer = state.network.remote ? state.players[state.network.seat] : null;
      const localWon = localPlayer && (state.format === "team" ? `Team ${localPlayer.team}` === state.winner : localPlayer.name === state.winner);
      roundMessage.textContent = localPlayer ? (localWon ? "You win! The game is over." : "You lose. The game is over.") : `Game over. ${state.winner} won; the final result is marked below.`;
    } else roundMessage.textContent = "Scores are updated. Rotate the deal for the next round.";
    roundScores.replaceChildren(...state.players.map((player) => {
      const isWinner = Boolean(state.winner) && (state.format === "team" ? `Team ${player.team}` === state.winner : player.name === state.winner);
      const row = document.createElement("div");
      row.className = isWinner ? "is-winner" : state.winner ? "is-loser" : "";
      row.innerHTML = `<span>${player.name}</span><strong>${playerScore(player)} points</strong>${state.winner ? `<em>${isWinner ? "WINNER" : "LOST"}</em>` : ""}`;
      return row;
    }));
    renderRoundResults();
    nextRoundButton.hidden = Boolean(state.winner);
    if (state.winner) localStorage.removeItem(SAVE_KEY); else saveGame();
    setPanels("round-over"); publishNetworkState();
  }

  function restoreSaved() { const saved = readSaved(); if (!saved) return; state.phase = saved.phase; state.variant = saved.variant; state.format = saved.format; state.players = saved.players; state.deck = saved.deck; state.crib = saved.crib; state.cut = saved.cut; state.roundResults = saved.roundResults || []; state.peggingCallouts = saved.peggingCallouts || []; state.selected = new Set(saved.selected || []); state.discardedSeats = new Set(saved.discardedSeats || []); state.dealer = saved.dealer; state.active = saved.active; state.total = saved.total; state.pegged = saved.pegged; state.pegHistory = saved.pegHistory || []; state.round = saved.round; state.winner = saved.winner || ""; state.teamScores = saved.teamScores || { 1: 0, 2: 0 }; nextRoundButton.hidden = Boolean(state.winner); setPanels("board"); renderBoard(); }
  function close() { window.clearTimeout(state.aiTimer); setPanels("closed"); }
  function prepareReport() { window.clearTimeout(state.aiTimer); state.aiTimer = 0; state.view = "closed"; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true; gameCanvas.hidden = false; }
  function restoreReport() { setPanels("options"); }

  multiplayerButton.addEventListener("click", () => { setPanels("network"); connectNetwork(); });
  refreshGamesButton.addEventListener("click", () => { connectNetwork(); networkSend({ type: "cribbage-list" }); });
  networkBackButton.addEventListener("click", () => setPanels("menu"));
  createGameButton.addEventListener("click", () => { connectNetwork(); const seats = Array.from({ length: Number(playerCount.value) }, (_, index) => { const seat = seatFromSetup(index); return { name: seat.name, control: seat.control, team: seat.team }; }); networkSend({ type: "cribbage-create", config: { variant: mode.value, playerCount: Number(playerCount.value), format: format.value, seats } }); createGameButton.disabled = true; networkStatus.textContent = "Creating game…"; });
  networkStartButton.addEventListener("click", () => { if (state.network.host) { startGame(); networkSend({ type: "cribbage-state", snapshot: networkSnapshot() }); } });
  cancelGameButton.addEventListener("click", () => { if (!state.network.host) return; networkSend({ type: "cribbage-cancel" }); networkStatus.textContent = "Cancelling game…"; });
  quitButton.addEventListener("click", () => { if (state.network.remote) { networkSend({ type: "cribbage-quit" }); state.network.remote = false; state.network.host = false; state.network.gameId = ""; state.network.sessionId = ""; state.network.seat = -1; localStorage.removeItem("badant-cribbage-network"); state.network.socket?.close(); state.network.socket = null; networkStartButton.hidden = true; cancelGameButton.hidden = true; createGameButton.disabled = false; setPanels("network"); connectNetwork(); } });
  mode.addEventListener("change", updateSetupUi); playerCount.addEventListener("change", updateSetupUi); format.addEventListener("change", updateSetupUi); element<HTMLButtonElement>("#select-cribbage").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-start").addEventListener("click", startGame); resumeButton.addEventListener("click", restoreSaved); element<HTMLButtonElement>("#cribbage-options").addEventListener("click", () => setPanels("options")); element<HTMLButtonElement>("#cribbage-options-back").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-menu-back").addEventListener("click", close); cribAction.addEventListener("click", () => { if (state.network.remote && !state.network.host) networkSend({ type: "cribbage-action", action: { kind: "discard", selected: [...state.selected] } }); else applyDiscard(); }); passButton.addEventListener("click", () => { if (state.network.remote && !state.network.host) networkSend({ type: "cribbage-action", action: { kind: "pass" } }); else passPegging(); }); nextRoundButton.addEventListener("click", () => { if (state.winner) return; state.round += 1; state.dealer = (state.dealer + 1) % state.players.length; dealRound(); }); element<HTMLButtonElement>("#cribbage-round-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-board-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-report-issue").addEventListener("click", () => window.dispatchEvent(new CustomEvent("cribbage-report-issue"))); homeButton.addEventListener("click", (event) => { if (state.view !== "closed") { event.stopImmediatePropagation(); close(); } }); window.addEventListener("cribbage-prepare-report", prepareReport); window.addEventListener("cribbage-restore-report", restoreReport); updateSetupUi(); setPanels("closed");

  return { open: () => setPanels("menu"), close, prepareReport, restoreReport };
}
