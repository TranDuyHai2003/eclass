import { test } from "node:test";
import assert from "node:assert/strict";
import { N_PLANKS, THEORIES, originalShare, replaceOrder, replacedSet, shipBComplete, verdict } from "../../lib/world/theseus";

test("replacement order is a fixed permutation of every plank", () => {
  const o = replaceOrder();
  assert.equal(o.length, N_PLANKS);
  assert.deepEqual([...o].sort((a, b) => a - b), Array.from({ length: N_PLANKS }, (_, i) => i));
  assert.deepEqual(replaceOrder(), o);
  assert.notDeepEqual(o, Array.from({ length: N_PLANKS }, (_, i) => i));
});

test("replaced set grows one plank at a time and clamps", () => {
  assert.equal(replacedSet(0).size, 0);
  assert.equal(replacedSet(5).size, 5);
  assert.equal(replacedSet(99).size, N_PLANKS);
  assert.equal(originalShare(6), 0.75);
  assert.equal(originalShare(-3), 1);
  assert.ok(!shipBComplete(23) && shipBComplete(24));
});

test("theories disagree exactly where the paradox bites", () => {
  assert.deepEqual(verdict("matter", 3), { a: "yes", b: "no" });
  assert.deepEqual(verdict("matter", 12), { a: "both", b: "both" });
  assert.deepEqual(verdict("matter", 24), { a: "no", b: "yes" });
  assert.deepEqual(verdict("continuity", 24), { a: "yes", b: "no" });
  assert.deepEqual(verdict("fourd", 0), { a: "yes", b: "no" });
  assert.deepEqual(verdict("fourd", 24), { a: "both", b: "both" });
  // ở cuối, không có hai học thuyết "đáp án đơn" nào cùng chỉ một tàu: liên tục ↔ vật chất đối nghịch
  assert.notDeepEqual(verdict("continuity", 24), verdict("matter", 24));
  for (const t of THEORIES) assert.ok(verdict(t, 10));
});
