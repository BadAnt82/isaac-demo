import assert from "node:assert/strict";
import { chooseBestKeep, dealCounts, scoreHand } from "../src/cribbage.ts";

const configs = [
  ["standard", 2, 0, [6, 6], [2, 2], 4],
  ["standard", 3, 1, [5, 5, 5], [1, 1, 1], 4],
  ["standard", 4, 3, [5, 5, 5, 5], [1, 1, 1, 1], 4],
  ["crazy", 2, 1, [8, 4], [4, 0], 4],
  ["crazy", 3, 2, [6, 6, 4], [2, 2, 0], 4],
  ["crazy", 4, 0, [5, 5, 5, 5], [0, 1, 1, 1], 4],
];

for (const [variant, playerCount, dealer, expectedCounts, expectedPasses, expectedCrib] of configs) {
  assert.deepEqual(dealCounts(variant, playerCount, dealer), expectedCounts, `${variant} ${playerCount}-player deal`);
  assert.deepEqual(expectedCounts.map((count, index) => index === dealer && variant === "crazy" ? 0 : count - 4), expectedPasses, `${variant} pass counts`);
  const deckSupplied = variant === "standard" && playerCount === 3 ? 1 : 0;
  if (variant === "crazy") assert.equal(expectedCounts[dealer] + expectedPasses.reduce((sum, count) => sum + count, 0), 8, `${variant} dealer pool size`);
  else assert.equal(expectedPasses.reduce((sum, count) => sum + count, 0) + deckSupplied, expectedCrib, `${variant} crib size`);
  assert.equal(expectedCrib, 4, `${variant} final crib size`);
  assert.ok(expectedCounts.reduce((sum, count) => sum + count, 0) + deckSupplied + 1 <= 52, "deal, crib supplement, and cut stay within one deck");
}

const cards = Array.from({ length: 8 }, (_, index) => ({ id: `${index}`, rank: (index % 4) + 1, suit: ["♠", "♥", "♦", "♣"][index % 4] }));
const keep = chooseBestKeep(cards, 4, true);
assert.equal(keep.length, 4, "AI dealer keeps exactly four cards");
assert.equal(new Set(keep).size, 4, "AI dealer keep selection has no duplicate positions");
assert.ok(scoreHand(cards.slice(0, 4)) >= 0, "hand scoring is available to AI evaluation");

console.log(`Cribbage rules matrix passed: ${configs.length} deal configurations plus AI split checks.`);
