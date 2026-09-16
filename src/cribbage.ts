type CribbageView = "closed" | "menu" | "options" | "network" | "board" | "round-over";
type CribbagePhase = "discard" | "dealer-select" | "pegging";
type Variant = "standard" | "crazy";
type PlayFormat = "individual" | "team";
type Control = "human" | "ai";
type Card = { id: string; rank: number; suit: string };
type Player = { name: string; control: Control; team: 1 | 2; score: number; hand: Card[]; scoringHand: Card[] };
type NetworkSeat = { seat: number; name: string; control: Control; team: 1 | 2; connected: boolean; available?: boolean; quit?: boolean };
type PegRecord = { seat: number; card: Card };

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

export function scoreHand(cards: Card[], crib = false) {
  let score = 0;
  for (let mask = 1; mask < (1 << cards.length); mask += 1) {
    let total = 0;
    for (let index = 0; index < cards.length; index += 1) if (mask & (1 << index)) total += cardValue(cards[index]);
    if (total === 15) score += 2;
  }
  for (let first = 0; first < cards.length; first += 1) for (let second = first + 1; second < cards.length; second += 1) if (cards[first].rank === cards[second].rank) score += 2;
  const counts = new Map<number, number>();
  cards.forEach((card) => counts.set(card.rank, (counts.get(card.rank) || 0) + 1));
  const unique = [...counts.keys()].sort((a, b) => a - b);
  let bestRun = 1;
  for (let start = 0; start < unique.length; start += 1) {
    let end = start + 1;
    while (end < unique.length && unique[end] === unique[end - 1] + 1) end += 1;
    if (end - start >= 3) {
      let multiplier = 1;
      for (let index = start; index < end; index += 1) multiplier *= counts.get(unique[index]) || 1;
      bestRun = Math.max(bestRun, (end - start) * multiplier);
    }
  }
  score += bestRun > 1 ? bestRun : 0;
  if (cards.length >= 5) {
    const firstFour = cards.slice(0, 4).every((card) => card.suit === cards[0].suit);
    if (firstFour) score += crib ? (cards.every((card) => card.suit === cards[0].suit) ? 5 : 0) : (cards[4].suit === cards[0].suit ? 5 : 4);
    if (!crib && cards.some((card) => card.rank === 11 && card.suit === cards[4].suit)) score += 1;
  }
  return score;
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
  const pegs = element<HTMLElement>("#cribbage-pegs");
  const playedCards = element<HTMLElement>("#cribbage-played-cards");
  const state = {
    view: "closed" as CribbageView,
    phase: "discard" as CribbagePhase,
    variant: "standard" as Variant,
    format: "individual" as PlayFormat,
    players: [] as Player[],
    deck: [] as Card[],
    crib: [] as Card[],
    cut: null as Card | null,
    selected: new Set<string>(),
    dealer: 0,
    active: 0,
    total: 0,
    pegged: [] as Card[],
    pegHistory: [] as PegRecord[],
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
  function renderNetworkList(games: Array<{ gameId: string; variant: Variant; playerCount: number; format: PlayFormat; seats: NetworkSeat[]; started: boolean }> = []) {
    networkList.replaceChildren(...games.map((game) => { const row = document.createElement("div"); row.className = "cribbage-network-game"; const open = game.seats.filter((seat) => seat.available).length; row.innerHTML = `<strong>${game.gameId}</strong><span>${game.variant === "crazy" ? "Crazy" : "Standard"} · ${game.format === "team" ? "2 vs 2" : "Individual"} · ${open} open seat${open === 1 ? "" : "s"}</span>`; const join = document.createElement("button"); join.type = "button"; join.textContent = "Join"; join.disabled = game.started || open === 0; join.addEventListener("click", () => { state.network.gameId = game.gameId; state.network.remote = true; networkSend({ type: "cribbage-join", gameId: game.gameId, sessionId: state.network.gameId === game.gameId ? state.network.sessionId : undefined }); networkStatus.textContent = `Joining ${game.gameId}…`; }); row.append(join); return row; }));
  }
  function networkUrl() { return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/cribbage`; }
  function connectNetwork() {
    if (state.network.socket && state.network.socket.readyState !== WebSocket.CLOSED) return;
    const socket = new WebSocket(networkUrl()); state.network.socket = socket;
    socket.addEventListener("open", () => { networkStatus.textContent = "Connected. Choose a game or create one."; networkSend({ type: "cribbage-list" }); if (state.network.gameId && state.network.sessionId) networkSend({ type: "cribbage-join", gameId: state.network.gameId, sessionId: state.network.sessionId }); });
    socket.addEventListener("message", (event) => { let message: any; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "cribbage-lobby-list") { renderNetworkList(message.games || []); return; }
      if (message.type === "cribbage-error") { networkStatus.textContent = message.message; return; }
      if (message.type === "cribbage-created" || message.type === "cribbage-joined") { state.network.gameId = message.gameId; state.network.sessionId = message.sessionId; state.network.seat = message.seat; state.network.host = Boolean(message.host); state.network.remote = true; networkStartButton.hidden = !state.network.host; localStorage.setItem("badant-cribbage-network", JSON.stringify({ gameId: message.gameId, sessionId: message.sessionId })); networkStatus.textContent = state.network.host ? `Game ${message.gameId} created. Share this code, then wait for players.` : `Joined ${message.gameId}. Waiting for the host to deal.`; return; }
      if (message.type === "cribbage-ready") { if (state.network.host) { startGame(); networkSend({ type: "cribbage-state", snapshot: networkSnapshot() }); } return; }
      if (message.type === "cribbage-connection") { state.connectionSeats = message.seats || []; renderConnections(); networkStatus.textContent = state.connectionSeats.filter((seat: NetworkSeat) => seat.connected && seat.control === "human").length >= 1 ? "Players can reconnect if their connection drops." : networkStatus.textContent; return; }
      if (message.type === "cribbage-state") { if (!state.network.host) applyNetworkSnapshot(message.snapshot); return; }
      if (message.type === "cribbage-host-transfer") { state.network.host = true; state.network.seat = message.seat; networkStatus.textContent = "The previous host left. You are now hosting this game."; applyNetworkSnapshot(message.snapshot, true); return; }
      if (message.type === "cribbage-remote-action" && state.network.host) handleRemoteAction(message.seat, message.action || {});
      if (message.type === "cribbage-player-quit" && state.network.host) { const player = state.players[message.seat]; if (player) { player.control = "ai"; status.textContent = `${player.name} left. AI has taken over this seat.`; renderBoard(); queueAiTurn(); publishNetworkState(); } }
    });
    socket.addEventListener("close", () => { state.connectionSeats = state.connectionSeats.map((seat) => seat.seat === state.network.seat ? { ...seat, connected: false } : seat); renderConnections(); if (state.network.remote && state.network.sessionId) { networkStatus.textContent = "Connection lost. Reconnecting…"; window.clearTimeout(state.network.reconnect); state.network.reconnect = window.setTimeout(connectNetwork, 1500); } });
  }
  function networkSnapshot() { return { ...state, selected: [...state.selected], discardedSeats: [...state.discardedSeats], network: undefined, aiTimer: 0 }; }
  function publishNetworkState() { if (state.network.remote && state.network.host) networkSend({ type: "cribbage-state", snapshot: networkSnapshot() }); }
  function applyNetworkSnapshot(snapshot: any, full = false) { if (!snapshot) return; state.phase = snapshot.phase; state.variant = snapshot.variant; state.format = snapshot.format; state.players = snapshot.players || []; if (!full) state.players.forEach((player: Player, index: number) => { if (index !== state.network.seat) { player.hand = []; player.scoringHand = []; } }); state.deck = snapshot.deck || []; state.crib = snapshot.crib || []; state.cut = snapshot.cut || null; state.dealer = snapshot.dealer; state.active = snapshot.active; state.total = snapshot.total; state.pegged = snapshot.pegged || []; state.pegHistory = snapshot.pegHistory || []; state.round = snapshot.round; state.winner = snapshot.winner || ""; state.teamScores = snapshot.teamScores || { 1: 0, 2: 0 }; state.selected.clear(); nextRoundButton.hidden = Boolean(state.winner); setPanels(snapshot.view === "round-over" ? "round-over" : "board"); renderBoard(); }
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

  function renderCard(card: Card, selected: boolean, playable: boolean) {
    const button = document.createElement("button"); button.type = "button"; button.className = `cribbage-card ${SUIT_COLORS[card.suit]} ${selected ? "is-selected" : ""}`; button.disabled = !playable; button.setAttribute("aria-label", `${cardName(card)}${selected ? ", selected" : ""}`); button.innerHTML = `<span>${card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : card.rank}</span><b>${card.suit}</b>`;
    button.addEventListener("click", () => { if (state.network.remote && !state.network.host) { if (state.phase === "pegging") networkSend({ type: "cribbage-action", action: { kind: "play", cardId: card.id } }); else { if (state.selected.has(card.id)) state.selected.delete(card.id); else if (state.selected.size < (state.phase === "dealer-select" ? 4 : discardCount(state.network.seat))) state.selected.add(card.id); renderBoard(); } return; } if (state.phase === "pegging") playCard(card); else { if (state.selected.has(card.id)) state.selected.delete(card.id); else if (state.selected.size < (state.phase === "dealer-select" ? 4 : discardCount(state.active))) state.selected.add(card.id); renderBoard(); } });
    return button;
  }

  function discardCount(playerIndex: number) { const player = state.players[playerIndex]; if (state.variant === "crazy" && playerIndex === state.dealer) return 0; return Math.max(0, player.hand.length - 4); }

  function renderPegTrack() {
    const entries = state.players.map((player, index) => { const peg = document.createElement("span"); peg.className = `cribbage-peg peg-${index}`; peg.style.left = `${Math.min(100, (playerScore(player) / 121) * 100)}%`; peg.textContent = `${index + 1}`; peg.title = `${player.name}: ${playerScore(player)} points`; return peg; });
    pegs.replaceChildren(...entries);
    const groups = state.players.map((player, index) => { const row = document.createElement("div"); row.className = "cribbage-played-row"; const label = document.createElement("strong"); label.textContent = player.name; const cards = document.createElement("span"); cards.className = "cribbage-played-list"; const records = state.pegHistory.filter((record) => record.seat === index); cards.replaceChildren(...records.map((record) => { const card = document.createElement("span"); card.className = `cribbage-played-card ${SUIT_COLORS[record.card.suit]}`; card.textContent = cardName(record.card); return card; })); row.append(label, cards); return row; });
    playedCards.replaceChildren(...groups);
  }

  function renderBoard() {
    const activePlayer = state.players[state.active]; const player = state.network.remote && !state.network.host ? state.players[state.network.seat] : activePlayer; if (!player) return;
    roundLabel.textContent = `Round ${state.round} · ${state.variant === "crazy" ? "Crazy" : "Standard"}${state.format === "team" ? " · 2 vs 2" : ""}`; dealerLabel.textContent = state.players[state.dealer]?.name || "—"; cutLabel.textContent = state.cut ? cardName(state.cut) : "—"; cribCount.textContent = `${state.crib.length} card${state.crib.length === 1 ? "" : "s"}`; totalLabel.textContent = `${state.total} / 31`; renderScoreboard(); renderPegTrack();
    if (player.control === "ai" && (!state.network.remote || state.network.host)) { hand.innerHTML = `<p class="cribbage-private">${player.name} (AI) is choosing from a private hand…</p>`; cribAction.hidden = true; passButton.hidden = true; turnLabel.textContent = `${player.name} is thinking`; status.textContent = "AI uses only the cards and count available to its seat."; queueAiTurn(); return; }
    const dealerSelect = state.phase === "dealer-select"; const canAct = !state.network.remote || state.network.host || state.active === state.network.seat; const needed = dealerSelect ? 4 : discardCount(state.active); hand.replaceChildren(...player.hand.map((card) => renderCard(card, state.selected.has(card.id), canAct && (state.phase === "pegging" ? cardValue(card) + state.total <= 31 : true))));
    if (state.phase === "discard") { turnLabel.textContent = `${activePlayer?.name || player.name}: choose ${needed} card${needed === 1 ? "" : "s"} to ${state.variant === "crazy" ? "pass to the dealer" : "pass to the crib"}`; status.textContent = canAct ? `${state.crib.length} crib cards placed so far.` : `Waiting for ${activePlayer?.name || "the other player"} to choose cards.`; cribAction.hidden = !canAct; cribAction.disabled = !canAct || state.selected.size !== needed; cribAction.textContent = state.variant === "crazy" ? `Pass ${needed} cards` : `Discard ${needed} card${needed === 1 ? "" : "s"}`; passButton.hidden = true; }
    else if (dealerSelect) { turnLabel.textContent = `${player.name}: keep exactly 4 cards for your playing hand`; status.textContent = canAct ? "The other 4 cards will become your crib." : `Waiting for ${activePlayer?.name || "the dealer"} to choose a hand.`; cribAction.hidden = !canAct; cribAction.disabled = !canAct || state.selected.size !== 4; cribAction.textContent = "Keep selected 4"; passButton.hidden = true; }
    else { turnLabel.textContent = `${activePlayer?.name || player.name}'s turn to peg`; status.textContent = canAct ? (state.total === 0 ? "The count has reset. Play any card." : "Play a card without taking the count over 31.") : `${activePlayer?.name || "Opponent"} is pegging.`; cribAction.hidden = true; passButton.hidden = !canAct || !player.hand.every((card) => cardValue(card) + state.total > 31); }
    renderConnections(); quitButton.hidden = !state.network.remote;
  }

  function nextDiscardSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (!state.discardedSeats.has(index) && discardCount(index) > 0 && (state.variant !== "crazy" || index !== state.dealer)) return index; } return -1; }

  function dealRound() {
    state.deck = shuffle(makeDeck()); state.crib = []; state.cut = null; state.selected.clear(); state.phase = "discard"; state.total = 0; state.pegged = []; state.pegHistory = []; state.discardedSeats.clear(); state.players.forEach((player) => { player.hand = []; player.scoringHand = []; });
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

  function finishPegging() { state.players.forEach((player) => { if (!player.scoringHand.length) player.scoringHand = player.hand.slice(); }); state.cut = state.deck.pop() || null; state.phase = "pegging"; state.active = (state.dealer + 1) % state.players.length; state.total = 0; state.pegged = []; renderBoard(); saveGame(); publishNetworkState(); }

  function chooseAiDiscard() {
    const player = state.players[state.active]; const keepCount = state.phase === "dealer-select" ? 4 : player.hand.length - discardCount(state.active); const keepIndices = chooseBestKeep(player.hand, keepCount, state.phase === "dealer-select"); state.selected = new Set(player.hand.filter((_, index) => state.phase === "dealer-select" ? keepIndices.includes(index) : !keepIndices.includes(index)).map((card) => card.id)); applyDiscard();
  }

  function peggingPoints(card: Card) { const nextTotal = state.total + cardValue(card); let points = nextTotal === 15 || nextTotal === 31 ? 2 : 0; let matching = 0; for (let index = state.pegged.length - 1; index >= 0 && state.pegged[index].rank === card.rank; index -= 1) matching += 1; points += matching === 1 ? 2 : matching === 2 ? 6 : matching >= 3 ? 12 : 0; return points; }
  function chooseAiPegging() { const player = state.players[state.active]; const playable = player.hand.filter((card) => cardValue(card) + state.total <= 31); if (!playable.length) { passPegging(); return; } playable.sort((first, second) => peggingPoints(second) - peggingPoints(first) || cardValue(first) - cardValue(second)); playCard(playable[0]); }
  function queueAiTurn() { if (state.aiTimer || state.view !== "board" || state.players[state.active]?.control !== "ai") return; state.aiTimer = window.setTimeout(() => { state.aiTimer = 0; if (state.phase === "pegging") chooseAiPegging(); else chooseAiDiscard(); }, 650); }

  function nextPeggingSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (state.players[index].hand.length && state.players[index].hand.some((card) => cardValue(card) + state.total <= 31)) return index; } return -1; }
  function playCard(card: Card, fromNetwork = false) { if (state.network.remote && !state.network.host && !fromNetwork) { networkSend({ type: "cribbage-action", action: { kind: "play", cardId: card.id } }); return; } if (state.phase !== "pegging" || cardValue(card) + state.total > 31) return; const points = peggingPoints(card); const player = state.players[state.active]; state.pegHistory.push({ seat: state.active, card }); player.hand = player.hand.filter((candidate) => candidate.id !== card.id); state.pegged.push(card); state.total += cardValue(card); award(state.active, points); if (state.total === 31) { state.total = 0; state.pegged = []; } if (state.players.every((candidate) => candidate.hand.length === 0)) { finishRound(); return; } const next = nextPeggingSeat(state.active); if (next < 0) { award(state.active, 1); state.total = 0; state.pegged = []; state.active = state.players.findIndex((candidate) => candidate.hand.length > 0); } else state.active = next; renderBoard(); saveGame(); publishNetworkState(); }
  function passPegging(fromNetwork = false) { if (state.network.remote && !state.network.host && !fromNetwork) { networkSend({ type: "cribbage-action", action: { kind: "pass" } }); return; } const next = nextPeggingSeat(state.active); if (next < 0) { award(state.active, 1); state.total = 0; state.pegged = []; state.active = state.players.findIndex((candidate) => candidate.hand.length > 0); } else state.active = next; renderBoard(); saveGame(); publishNetworkState(); }

  function finishRound() { const cut = state.cut ? [state.cut] : []; state.players.forEach((player, index) => award(index, scoreHand([...player.scoringHand, ...cut]))); award(state.dealer, scoreHand([...state.crib, ...cut], true)); const winner = state.players.find((player) => playerScore(player) >= 121); const teamWinner = state.teamScores[1] >= 121 ? "Team 1" : state.teamScores[2] >= 121 ? "Team 2" : ""; state.winner = state.format === "team" ? teamWinner : winner?.name || ""; roundTitle.textContent = state.winner ? `${state.winner} wins the game!` : "Round complete"; roundMessage.textContent = state.winner ? "The winning seat or team reached 121 points first." : "Scores are updated. Rotate the deal for the next round."; roundScores.replaceChildren(...state.players.map((player) => { const row = document.createElement("div"); row.innerHTML = `<span>${player.name}</span><strong>${playerScore(player)} points</strong>`; return row; })); nextRoundButton.hidden = Boolean(state.winner); if (state.winner) localStorage.removeItem(SAVE_KEY); else saveGame(); setPanels("round-over"); publishNetworkState(); }

  function restoreSaved() { const saved = readSaved(); if (!saved) return; state.phase = saved.phase; state.variant = saved.variant; state.format = saved.format; state.players = saved.players; state.deck = saved.deck; state.crib = saved.crib; state.cut = saved.cut; state.selected = new Set(saved.selected || []); state.discardedSeats = new Set(saved.discardedSeats || []); state.dealer = saved.dealer; state.active = saved.active; state.total = saved.total; state.pegged = saved.pegged; state.pegHistory = saved.pegHistory || []; state.round = saved.round; state.winner = saved.winner || ""; state.teamScores = saved.teamScores || { 1: 0, 2: 0 }; nextRoundButton.hidden = Boolean(state.winner); setPanels("board"); renderBoard(); }
  function close() { window.clearTimeout(state.aiTimer); setPanels("closed"); }
  function prepareReport() { window.clearTimeout(state.aiTimer); state.aiTimer = 0; state.view = "closed"; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true; gameCanvas.hidden = false; }
  function restoreReport() { setPanels("options"); }

  multiplayerButton.addEventListener("click", () => { setPanels("network"); connectNetwork(); });
  refreshGamesButton.addEventListener("click", () => { connectNetwork(); networkSend({ type: "cribbage-list" }); });
  networkBackButton.addEventListener("click", () => setPanels("menu"));
  createGameButton.addEventListener("click", () => { connectNetwork(); const seats = Array.from({ length: Number(playerCount.value) }, (_, index) => { const seat = seatFromSetup(index); return { name: seat.name, control: seat.control, team: seat.team }; }); networkSend({ type: "cribbage-create", config: { variant: mode.value, playerCount: Number(playerCount.value), format: format.value, seats } }); createGameButton.disabled = true; networkStatus.textContent = "Creating game…"; });
  networkStartButton.addEventListener("click", () => { if (state.network.host) { startGame(); networkSend({ type: "cribbage-state", snapshot: networkSnapshot() }); } });
  quitButton.addEventListener("click", () => { if (state.network.remote) { networkSend({ type: "cribbage-quit" }); state.network.remote = false; setPanels("menu"); } });
  mode.addEventListener("change", updateSetupUi); playerCount.addEventListener("change", updateSetupUi); format.addEventListener("change", updateSetupUi); element<HTMLButtonElement>("#select-cribbage").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-start").addEventListener("click", startGame); resumeButton.addEventListener("click", restoreSaved); element<HTMLButtonElement>("#cribbage-options").addEventListener("click", () => setPanels("options")); element<HTMLButtonElement>("#cribbage-options-back").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-menu-back").addEventListener("click", close); cribAction.addEventListener("click", () => { if (state.network.remote && !state.network.host) networkSend({ type: "cribbage-action", action: { kind: "discard", selected: [...state.selected] } }); else applyDiscard(); }); passButton.addEventListener("click", () => { if (state.network.remote && !state.network.host) networkSend({ type: "cribbage-action", action: { kind: "pass" } }); else passPegging(); }); nextRoundButton.addEventListener("click", () => { if (state.winner) return; state.round += 1; state.dealer = (state.dealer + 1) % state.players.length; dealRound(); }); element<HTMLButtonElement>("#cribbage-round-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-board-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-report-issue").addEventListener("click", () => window.dispatchEvent(new CustomEvent("cribbage-report-issue"))); homeButton.addEventListener("click", (event) => { if (state.view !== "closed") { event.stopImmediatePropagation(); close(); } }); window.addEventListener("cribbage-prepare-report", prepareReport); window.addEventListener("cribbage-restore-report", restoreReport); updateSetupUi(); setPanels("closed");

  return { open: () => setPanels("menu"), close, prepareReport, restoreReport };
}
