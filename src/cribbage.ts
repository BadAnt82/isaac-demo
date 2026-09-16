type CribbageView = "closed" | "menu" | "options" | "board" | "round-over";
type CribbagePhase = "discard" | "pegging";
type Card = { id: string; rank: number; suit: string };
type Player = { name: string; score: number; hand: Card[]; scoringHand: Card[] };

const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_COLORS: Record<string, string> = { "♥": "red", "♦": "red", "♠": "black", "♣": "black" };

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
  return SUITS.flatMap((suit) => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 1}`, rank: i + 1, suit })));
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function scoreHand(cards: Card[]) {
  let score = 0;
  for (let mask = 1; mask < (1 << cards.length); mask += 1) {
    let total = 0;
    for (let i = 0; i < cards.length; i += 1) if (mask & (1 << i)) total += cardValue(cards[i]);
    if (total === 15) score += 2;
  }
  for (let i = 0; i < cards.length; i += 1) for (let j = i + 1; j < cards.length; j += 1) if (cards[i].rank === cards[j].rank) score += 2;
  const unique = [...new Set(cards.map((card) => card.rank))].sort((a, b) => a - b);
  let run = 1;
  let bestRun = 1;
  for (let i = 1; i < unique.length; i += 1) {
    run = unique[i] === unique[i - 1] + 1 ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  }
  if (bestRun >= 3) score += bestRun;
  return score;
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
  const playerNames = element<HTMLElement>("#cribbage-player-names");
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
    players: [] as Player[],
    deck: [] as Card[],
    crib: [] as Card[],
    cut: null as Card | null,
    selected: new Set<string>(),
    dealer: 0,
    active: 0,
    total: 0,
    pegged: [] as Card[],
    passed: new Set<number>(),
    round: 1,
    winner: "" as string,
  };

  function setPanels(next: CribbageView) {
    state.view = next;
    if (next === "closed") {
      gameCanvas.hidden = false;
      platform.hidden = false;
      menu.hidden = true;
      options.hidden = true;
      board.hidden = true;
      roundPanel.hidden = true;
      overlay.hidden = false;
      overlay.classList.add("is-platform");
      overlay.classList.remove("is-cribbage");
      homeButton.hidden = true;
      return;
    }
    gameCanvas.hidden = true;
    platform.hidden = true;
    menu.hidden = next !== "menu";
    options.hidden = next !== "options";
    board.hidden = next !== "board";
    roundPanel.hidden = next !== "round-over";
    overlay.hidden = false;
    overlay.classList.remove("is-platform");
    overlay.classList.add("is-cribbage");
    homeButton.hidden = false;
    if (next === "menu") updatePlayerSlots();
  }

  function updatePlayerSlots() {
    const count = Number(playerCount.value);
    playerNames.querySelectorAll<HTMLElement>("[data-player-slot]").forEach((slot) => { slot.hidden = Number(slot.dataset.playerSlot) >= count; });
  }

  function namesFromSetup() {
    const count = Number(playerCount.value);
    return Array.from({ length: count }, (_, i) => {
      const input = element<HTMLInputElement>(`#cribbage-player-${i + 1}`);
      return input.value.trim() || `Player ${i + 1}`;
    });
  }

  function renderScoreboard() {
    scoreboard.replaceChildren(...state.players.map((player, index) => {
      const item = document.createElement("div");
      item.className = `cribbage-score ${index === state.active ? "is-active" : ""}`;
      item.innerHTML = `<span>${player.name}</span><strong>${player.score}</strong>`;
      return item;
    }));
  }

  function renderCard(card: Card, selected: boolean, playable: boolean) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cribbage-card ${SUIT_COLORS[card.suit]} ${selected ? "is-selected" : ""}`;
    button.disabled = !playable;
    button.setAttribute("aria-label", `${cardName(card)}${selected ? ", selected" : ""}`);
    button.innerHTML = `<span>${card.rank === 1 ? "A" : card.rank === 11 ? "J" : card.rank === 12 ? "Q" : card.rank === 13 ? "K" : card.rank}</span><b>${card.suit}</b>`;
    button.addEventListener("click", () => {
      if (state.phase === "discard") {
        if (state.selected.has(card.id)) state.selected.delete(card.id);
        else if (state.selected.size < 2) state.selected.add(card.id);
        renderBoard();
      } else if (state.phase === "pegging") playCard(card);
    });
    return button;
  }

  function renderBoard() {
    const player = state.players[state.active];
    if (!player) return;
    roundLabel.textContent = `Round ${state.round} · ${mode.options[mode.selectedIndex]?.textContent || "Classic"}`;
    dealerLabel.textContent = state.players[state.dealer]?.name || "—";
    cutLabel.textContent = state.cut ? cardName(state.cut) : "—";
    cribCount.textContent = `${state.crib.length} card${state.crib.length === 1 ? "" : "s"}`;
    totalLabel.textContent = `${state.total} / 31`;
    renderScoreboard();
    hand.replaceChildren(...player.hand.map((card) => renderCard(card, state.selected.has(card.id), state.phase === "pegging" && cardValue(card) + state.total <= 31 || state.phase === "discard")));
    if (state.phase === "discard") {
      turnLabel.textContent = `${player.name}: choose two cards for the crib`;
      status.textContent = `${state.crib.length} of ${state.players.length * 2} crib cards chosen.`;
      cribAction.hidden = false;
      cribAction.disabled = state.selected.size !== 2;
      passButton.hidden = true;
    } else {
      turnLabel.textContent = `${player.name}'s turn to peg`;
      status.textContent = state.total === 0 ? "The count has reset. Play any card." : "Play a card without taking the count over 31.";
      cribAction.hidden = true;
      passButton.hidden = !player.hand.every((card) => cardValue(card) + state.total > 31);
    }
  }

  function dealRound() {
    state.deck = shuffle(makeDeck());
    state.crib = [];
    state.cut = null;
    state.selected.clear();
    state.phase = "discard";
    state.active = state.dealer;
    state.total = 0;
    state.pegged = [];
    state.passed.clear();
    state.players.forEach((player) => { player.hand = []; player.scoringHand = []; });
    for (let card = 0; card < 6; card += 1) state.players.forEach((player) => player.hand.push(state.deck.pop()!));
    setPanels("board");
    renderBoard();
  }

  function startGame() {
    state.players = namesFromSetup().map((name) => ({ name, score: 0, hand: [], scoringHand: [] }));
    state.dealer = 0;
    state.round = 1;
    state.winner = "";
    dealRound();
  }

  function finishDiscard() {
    state.players.forEach((player) => { player.scoringHand = player.hand.slice(); });
    state.cut = state.deck.pop() || null;
    state.phase = "pegging";
    state.active = (state.dealer + 1) % state.players.length;
    state.total = 0;
    state.pegged = [];
    state.passed.clear();
    status.textContent = `Cut card: ${state.cut ? cardName(state.cut) : "—"}. Pegging begins.`;
    renderBoard();
  }

  function chooseCrib() {
    if (state.selected.size !== 2) return;
    const player = state.players[state.active];
    player.hand = player.hand.filter((card) => {
      if (!state.selected.has(card.id)) return true;
      state.crib.push(card);
      return false;
    });
    state.selected.clear();
    if (state.active === state.players.length - 1) finishDiscard();
    else { state.active += 1; renderBoard(); }
  }

  function nextPeggingPlayer(from: number) {
    for (let offset = 1; offset <= state.players.length; offset += 1) {
      const index = (from + offset) % state.players.length;
      if (state.players[index].hand.length && state.players[index].hand.some((card) => cardValue(card) + state.total <= 31)) return index;
    }
    return -1;
  }

  function scorePeg(card: Card) {
    if (state.total === 15 || state.total === 31) state.players[state.active].score += 2;
    let matchingBefore = 0;
    for (let i = state.pegged.length - 2; i >= 0 && state.pegged[i].rank === card.rank; i -= 1) matchingBefore += 1;
    if (matchingBefore >= 1) state.players[state.active].score += matchingBefore === 1 ? 2 : matchingBefore === 2 ? 6 : 12;
    const recent = state.pegged.slice(-7).map((played) => played.rank);
    for (let length = Math.min(recent.length, 7); length >= 3; length -= 1) {
      const run = recent.slice(-length);
      if (new Set(run).size === length && Math.max(...run) - Math.min(...run) === length - 1) { state.players[state.active].score += length; break; }
    }
  }

  function playCard(card: Card) {
    if (state.phase !== "pegging" || cardValue(card) + state.total > 31) return;
    const player = state.players[state.active];
    player.hand = player.hand.filter((candidate) => candidate.id !== card.id);
    state.pegged.push(card);
    state.total += cardValue(card);
    scorePeg(card);
    state.passed.clear();
    if (state.total === 31) { state.total = 0; state.pegged = []; }
    if (state.players.every((candidate) => candidate.hand.length === 0)) { finishRound(); return; }
    const next = nextPeggingPlayer(state.active);
    if (next < 0) {
      state.players[state.active].score += 1;
      state.total = 0;
      state.pegged = [];
      state.active = state.players.findIndex((candidate) => candidate.hand.length > 0);
    } else state.active = next;
    renderBoard();
  }

  function passPegging() {
    const next = nextPeggingPlayer(state.active);
    if (next < 0) {
      state.players[state.active].score += 1;
      state.total = 0;
      state.pegged = [];
      state.active = state.players.findIndex((candidate) => candidate.hand.length > 0);
    } else state.active = next;
    renderBoard();
  }

  function finishRound() {
    const cut = state.cut ? [state.cut] : [];
    state.players.forEach((player) => { player.score += scoreHand([...player.scoringHand, ...cut]); });
    const dealer = state.players[state.dealer];
    dealer.score += scoreHand([...state.crib, ...cut]);
    const winner = state.players.find((player) => player.score >= 121);
    state.winner = winner?.name || "";
    nextRoundButton.hidden = Boolean(state.winner);
    roundTitle.textContent = winner ? `${winner.name} wins the game!` : "Round complete";
    roundMessage.textContent = winner ? "They reached 121 points first." : "Scores are updated. Deal another round when you are ready.";
    roundScores.replaceChildren(...state.players.map((player) => { const row = document.createElement("div"); row.innerHTML = `<span>${player.name}</span><strong>${player.score} points</strong>`; return row; }));
    setPanels("round-over");
  }

  function nextRound() {
    if (state.winner) return;
    nextRoundButton.hidden = false;
    state.round += 1;
    state.dealer = (state.dealer + 1) % state.players.length;
    dealRound();
  }

  function close() { setPanels("closed"); }
  function prepareReport() { state.view = "closed"; menu.hidden = true; options.hidden = true; board.hidden = true; roundPanel.hidden = true; gameCanvas.hidden = false; }
  function restoreReport() { setPanels("options"); }

  playerCount.addEventListener("change", updatePlayerSlots);
  element<HTMLButtonElement>("#select-cribbage").addEventListener("click", () => setPanels("menu"));
  element<HTMLButtonElement>("#cribbage-start").addEventListener("click", startGame);
  element<HTMLButtonElement>("#cribbage-options").addEventListener("click", () => setPanels("options"));
  element<HTMLButtonElement>("#cribbage-options-back").addEventListener("click", () => setPanels("menu"));
  element<HTMLButtonElement>("#cribbage-menu-back").addEventListener("click", close);
  cribAction.addEventListener("click", chooseCrib);
  passButton.addEventListener("click", passPegging);
  element<HTMLButtonElement>("#cribbage-next-round").addEventListener("click", nextRound);
  element<HTMLButtonElement>("#cribbage-round-exit").addEventListener("click", () => setPanels("menu"));
  element<HTMLButtonElement>("#cribbage-board-exit").addEventListener("click", () => setPanels("menu"));
  element<HTMLButtonElement>("#cribbage-report-issue").addEventListener("click", () => window.dispatchEvent(new CustomEvent("cribbage-report-issue")));
  homeButton.addEventListener("click", (event) => { if (state.view !== "closed") { event.stopImmediatePropagation(); close(); } });
  window.addEventListener("cribbage-prepare-report", prepareReport);
  window.addEventListener("cribbage-restore-report", restoreReport);
  setPanels("closed");

  return { open: () => setPanels("menu"), close, prepareReport, restoreReport };
}
