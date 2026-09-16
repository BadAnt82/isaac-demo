type CribbageView = "closed" | "menu" | "options" | "board" | "round-over";
type CribbagePhase = "discard" | "dealer-select" | "pegging";
type Variant = "standard" | "crazy";
type PlayFormat = "individual" | "team";
type Control = "human" | "ai";
type Card = { id: string; rank: number; suit: string };
type Player = { name: string; control: Control; team: 1 | 2; score: number; hand: Card[]; scoringHand: Card[] };

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
    discardedSeats: new Set<number>(),
    round: 1,
    winner: "",
    teamScores: { 1: 0, 2: 0 },
    aiTimer: 0,
  };

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
      gameCanvas.hidden = false; platform.hidden = false; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true;
      overlay.hidden = false; overlay.classList.add("is-platform"); overlay.classList.remove("is-cribbage"); homeButton.hidden = true; return;
    }
    gameCanvas.hidden = true; platform.hidden = true; menu.hidden = next !== "menu"; options.hidden = next !== "options"; board.hidden = next !== "board"; roundPanel.hidden = next !== "round-over";
    overlay.hidden = false; overlay.classList.remove("is-platform"); overlay.classList.add("is-cribbage"); homeButton.hidden = false;
    if (next === "menu") {
      updateSetupUi(); const saved = readSaved(); resumeButton.disabled = !saved; resumeButton.textContent = saved ? `Resume saved match (Round ${saved.round || 1})` : "Resume saved match";
    }
  }

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
    button.addEventListener("click", () => { if (state.phase === "pegging") playCard(card); else { if (state.selected.has(card.id)) state.selected.delete(card.id); else if (state.selected.size < (state.phase === "dealer-select" ? 4 : discardCount(state.active))) state.selected.add(card.id); renderBoard(); } });
    return button;
  }

  function discardCount(playerIndex: number) { const player = state.players[playerIndex]; if (state.variant === "crazy" && playerIndex === state.dealer) return 0; return Math.max(0, player.hand.length - 4); }

  function renderBoard() {
    const player = state.players[state.active]; if (!player) return;
    roundLabel.textContent = `Round ${state.round} · ${state.variant === "crazy" ? "Crazy" : "Standard"}${state.format === "team" ? " · 2 vs 2" : ""}`; dealerLabel.textContent = state.players[state.dealer]?.name || "—"; cutLabel.textContent = state.cut ? cardName(state.cut) : "—"; cribCount.textContent = `${state.crib.length} card${state.crib.length === 1 ? "" : "s"}`; totalLabel.textContent = `${state.total} / 31`; renderScoreboard();
    if (player.control === "ai") { hand.innerHTML = `<p class="cribbage-private">${player.name} (AI) is choosing from a private hand…</p>`; cribAction.hidden = true; passButton.hidden = true; turnLabel.textContent = `${player.name} is thinking`; status.textContent = "AI uses only the cards and count available to its seat."; queueAiTurn(); return; }
    const dealerSelect = state.phase === "dealer-select"; const needed = dealerSelect ? 4 : discardCount(state.active); hand.replaceChildren(...player.hand.map((card) => renderCard(card, state.selected.has(card.id), state.phase === "pegging" ? cardValue(card) + state.total <= 31 : true)));
    if (state.phase === "discard") { turnLabel.textContent = `${player.name}: choose ${needed} card${needed === 1 ? "" : "s"} to ${state.variant === "crazy" ? "pass to the dealer" : "pass to the crib"}`; status.textContent = `${state.crib.length} crib cards placed so far.`; cribAction.hidden = false; cribAction.disabled = state.selected.size !== needed; cribAction.textContent = state.variant === "crazy" ? `Pass ${needed} cards` : `Discard ${needed} card${needed === 1 ? "" : "s"}`; passButton.hidden = true; }
    else if (dealerSelect) { turnLabel.textContent = `${player.name}: keep exactly 4 cards for your playing hand`; status.textContent = "The other 4 cards will become your crib."; cribAction.hidden = false; cribAction.disabled = state.selected.size !== 4; cribAction.textContent = "Keep selected 4"; passButton.hidden = true; }
    else { turnLabel.textContent = `${player.name}'s turn to peg`; status.textContent = state.total === 0 ? "The count has reset. Play any card." : "Play a card without taking the count over 31."; cribAction.hidden = true; passButton.hidden = !player.hand.every((card) => cardValue(card) + state.total > 31); }
  }

  function nextDiscardSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (!state.discardedSeats.has(index) && discardCount(index) > 0 && (state.variant !== "crazy" || index !== state.dealer)) return index; } return -1; }

  function dealRound() {
    state.deck = shuffle(makeDeck()); state.crib = []; state.cut = null; state.selected.clear(); state.phase = "discard"; state.total = 0; state.pegged = []; state.discardedSeats.clear(); state.players.forEach((player) => { player.hand = []; player.scoringHand = []; });
    const counts = dealCounts(state.variant, state.players.length, state.dealer); const maxCards = Math.max(...counts); for (let cardIndex = 0; cardIndex < maxCards; cardIndex += 1) state.players.forEach((player, index) => { if (cardIndex < counts[index]) player.hand.push(state.deck.pop()!); });
    state.active = state.variant === "crazy" ? (state.dealer + 1) % state.players.length : state.dealer; setPanels("board"); renderBoard(); saveGame();
  }

  function startGame() {
    window.clearTimeout(state.aiTimer); state.variant = mode.value === "crazy" ? "crazy" : "standard"; state.format = format.value === "team" && Number(playerCount.value) === 4 ? "team" : "individual"; state.players = Array.from({ length: Number(playerCount.value) }, (_, index) => seatFromSetup(index)); state.dealer = 0; state.round = 1; state.winner = ""; state.teamScores = { 1: 0, 2: 0 }; dealRound();
  }

  function finishStandardDiscard() { if (state.players.length === 3) state.crib.push(state.deck.pop()!); state.players.forEach((player) => { player.scoringHand = player.hand.slice(); }); finishPegging(); }
  function finishCrazyPasses() { state.phase = "dealer-select"; state.active = state.dealer; state.selected.clear(); renderBoard(); saveGame(); }
  function finishCrazyDealerSelection() { const dealer = state.players[state.dealer]; const retained = dealer.hand.filter((card) => state.selected.has(card.id)); state.crib = dealer.hand.filter((card) => !state.selected.has(card.id)); dealer.hand = retained; dealer.scoringHand = retained.slice(); state.selected.clear(); finishPegging(); }

  function applyDiscard() {
    const player = state.players[state.active]; const required = state.phase === "dealer-select" ? 4 : discardCount(state.active); if (state.selected.size !== required) return;
    if (state.phase === "dealer-select") { finishCrazyDealerSelection(); return; }
    const passed = player.hand.filter((card) => state.selected.has(card.id)); player.hand = player.hand.filter((card) => !state.selected.has(card.id)); if (state.variant === "crazy") state.players[state.dealer].hand.push(...passed); else state.crib.push(...passed); state.discardedSeats.add(state.active); state.selected.clear(); const next = nextDiscardSeat(state.active); if (next < 0) { if (state.variant === "crazy") finishCrazyPasses(); else finishStandardDiscard(); } else { state.active = next; renderBoard(); saveGame(); }
  }

  function finishPegging() { state.players.forEach((player) => { if (!player.scoringHand.length) player.scoringHand = player.hand.slice(); }); state.cut = state.deck.pop() || null; state.phase = "pegging"; state.active = (state.dealer + 1) % state.players.length; state.total = 0; state.pegged = []; renderBoard(); saveGame(); }

  function chooseAiDiscard() {
    const player = state.players[state.active]; const keepCount = state.phase === "dealer-select" ? 4 : player.hand.length - discardCount(state.active); const keepIndices = chooseBestKeep(player.hand, keepCount, state.phase === "dealer-select"); state.selected = new Set(player.hand.filter((_, index) => state.phase === "dealer-select" ? keepIndices.includes(index) : !keepIndices.includes(index)).map((card) => card.id)); applyDiscard();
  }

  function peggingPoints(card: Card) { const nextTotal = state.total + cardValue(card); let points = nextTotal === 15 || nextTotal === 31 ? 2 : 0; let matching = 0; for (let index = state.pegged.length - 1; index >= 0 && state.pegged[index].rank === card.rank; index -= 1) matching += 1; points += matching === 1 ? 2 : matching === 2 ? 6 : matching >= 3 ? 12 : 0; return points; }
  function chooseAiPegging() { const player = state.players[state.active]; const playable = player.hand.filter((card) => cardValue(card) + state.total <= 31); if (!playable.length) { passPegging(); return; } playable.sort((first, second) => peggingPoints(second) - peggingPoints(first) || cardValue(first) - cardValue(second)); playCard(playable[0]); }
  function queueAiTurn() { if (state.aiTimer || state.view !== "board" || state.players[state.active]?.control !== "ai") return; state.aiTimer = window.setTimeout(() => { state.aiTimer = 0; if (state.phase === "pegging") chooseAiPegging(); else chooseAiDiscard(); }, 650); }

  function nextPeggingSeat(from: number) { for (let offset = 1; offset <= state.players.length; offset += 1) { const index = (from + offset) % state.players.length; if (state.players[index].hand.length && state.players[index].hand.some((card) => cardValue(card) + state.total <= 31)) return index; } return -1; }
  function playCard(card: Card) { if (state.phase !== "pegging" || cardValue(card) + state.total > 31) return; const points = peggingPoints(card); const player = state.players[state.active]; player.hand = player.hand.filter((candidate) => candidate.id !== card.id); state.pegged.push(card); state.total += cardValue(card); award(state.active, points); if (state.total === 31) { state.total = 0; state.pegged = []; } if (state.players.every((candidate) => candidate.hand.length === 0)) { finishRound(); return; } const next = nextPeggingSeat(state.active); if (next < 0) { award(state.active, 1); state.total = 0; state.pegged = []; state.active = state.players.findIndex((candidate) => candidate.hand.length > 0); } else state.active = next; renderBoard(); saveGame(); }
  function passPegging() { const next = nextPeggingSeat(state.active); if (next < 0) { award(state.active, 1); state.total = 0; state.pegged = []; state.active = state.players.findIndex((candidate) => candidate.hand.length > 0); } else state.active = next; renderBoard(); saveGame(); }

  function finishRound() { const cut = state.cut ? [state.cut] : []; state.players.forEach((player, index) => award(index, scoreHand([...player.scoringHand, ...cut]))); award(state.dealer, scoreHand([...state.crib, ...cut], true)); const winner = state.players.find((player) => playerScore(player) >= 121); const teamWinner = state.teamScores[1] >= 121 ? "Team 1" : state.teamScores[2] >= 121 ? "Team 2" : ""; state.winner = state.format === "team" ? teamWinner : winner?.name || ""; roundTitle.textContent = state.winner ? `${state.winner} wins the game!` : "Round complete"; roundMessage.textContent = state.winner ? "The winning seat or team reached 121 points first." : "Scores are updated. Rotate the deal for the next round."; roundScores.replaceChildren(...state.players.map((player) => { const row = document.createElement("div"); row.innerHTML = `<span>${player.name}</span><strong>${playerScore(player)} points</strong>`; return row; })); nextRoundButton.hidden = Boolean(state.winner); if (state.winner) localStorage.removeItem(SAVE_KEY); else saveGame(); setPanels("round-over"); }

  function restoreSaved() { const saved = readSaved(); if (!saved) return; state.phase = saved.phase; state.variant = saved.variant; state.format = saved.format; state.players = saved.players; state.deck = saved.deck; state.crib = saved.crib; state.cut = saved.cut; state.selected = new Set(saved.selected || []); state.discardedSeats = new Set(saved.discardedSeats || []); state.dealer = saved.dealer; state.active = saved.active; state.total = saved.total; state.pegged = saved.pegged; state.round = saved.round; state.winner = saved.winner || ""; state.teamScores = saved.teamScores || { 1: 0, 2: 0 }; nextRoundButton.hidden = Boolean(state.winner); setPanels("board"); renderBoard(); }
  function close() { window.clearTimeout(state.aiTimer); setPanels("closed"); }
  function prepareReport() { window.clearTimeout(state.aiTimer); state.aiTimer = 0; state.view = "closed"; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true; gameCanvas.hidden = false; }
  function restoreReport() { setPanels("options"); }

  mode.addEventListener("change", updateSetupUi); playerCount.addEventListener("change", updateSetupUi); format.addEventListener("change", updateSetupUi); element<HTMLButtonElement>("#select-cribbage").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-start").addEventListener("click", startGame); resumeButton.addEventListener("click", restoreSaved); element<HTMLButtonElement>("#cribbage-options").addEventListener("click", () => setPanels("options")); element<HTMLButtonElement>("#cribbage-options-back").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-menu-back").addEventListener("click", close); cribAction.addEventListener("click", applyDiscard); passButton.addEventListener("click", passPegging); nextRoundButton.addEventListener("click", () => { if (state.winner) return; state.round += 1; state.dealer = (state.dealer + 1) % state.players.length; dealRound(); }); element<HTMLButtonElement>("#cribbage-round-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-board-exit").addEventListener("click", () => setPanels("menu")); element<HTMLButtonElement>("#cribbage-report-issue").addEventListener("click", () => window.dispatchEvent(new CustomEvent("cribbage-report-issue"))); homeButton.addEventListener("click", (event) => { if (state.view !== "closed") { event.stopImmediatePropagation(); close(); } }); window.addEventListener("cribbage-prepare-report", prepareReport); window.addEventListener("cribbage-restore-report", restoreReport); updateSetupUi(); setPanels("closed");

  return { open: () => setPanels("menu"), close, prepareReport, restoreReport };
}
