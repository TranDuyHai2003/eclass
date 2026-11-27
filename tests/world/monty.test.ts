import { test } from "node:test";
import assert from "node:assert/strict";
import { addRound, EMPTY_TALLY, hostOpens, mulberry32, otherDoor, playRound, rate, simulate } from "../../lib/world/monty";

test("MC never opens the picked door or the car", () => {
  const rand = mulberry32(7);
  for (let i = 0; i < 2000; i++) {
    for (const n of [3, 10, 100]) {
      const r = playRound(n, i % 2 === 0, rand);
      assert.equal(r.opened.length, n - 2);
      assert.ok(!r.opened.includes(r.pick));
      assert.ok(!r.opened.includes(r.car));
      assert.notEqual(r.keep, r.pick);
    }
  }
});

test("a wrong first pick leaves exactly the car closed", () => {
  for (let car = 0; car < 3; car++)
    for (let pick = 0; pick < 3; pick++) if (pick !== car) assert.equal(otherDoor(3, car, pick), car);
  assert.deepEqual(hostOpens(3, 0, 2), [1]);
});

test("a right first pick leaves a uniformly random goat door", () => {
  const rand = mulberry32(42);
  const seen = [0, 0, 0];
  for (let i = 0; i < 9000; i++) seen[otherDoor(3, 1, 1, rand)]++;
  assert.equal(seen[1], 0);
  assert.ok(Math.abs(seen[0] - 4500) < 300 && Math.abs(seen[2] - 4500) < 300);
});

test("switching wins about 2/3 with 3 doors and 99/100 with 100 doors", () => {
  const t3 = simulate(30000, 3, mulberry32(1));
  assert.ok(Math.abs(rate(t3.swapWin, t3.swapN) - 2 / 3) < 0.015);
  assert.ok(Math.abs(rate(t3.stayWin, t3.stayN) - 1 / 3) < 0.015);
  const t100 = simulate(5000, 100, mulberry32(2));
  assert.ok(rate(t100.swapWin, t100.swapN) > 0.98);
  assert.ok(rate(t100.stayWin, t100.stayN) < 0.02);
});

test("tally bookkeeping", () => {
  let t = addRound(EMPTY_TALLY, true, true);
  t = addRound(t, false, false);
  assert.deepEqual(t, { stayWin: 0, stayN: 1, swapWin: 1, swapN: 1 });
  assert.equal(rate(0, 0), 0);
});
