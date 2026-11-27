import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX, chambers, closedPolicy, createGas, demonPolicy, energy, gasEntropy, openPolicy, stepGas } from "../../lib/world/maxwell";

const run = (policy: Parameters<typeof stepGas>[2], seconds: number, seed = 1867) => {
  const g = createGas(140, seed);
  const e0 = energy(g);
  const s0 = gasEntropy(g);
  for (let t = 0; t < seconds * 120; t++) stepGas(g, 1 / 120, policy);
  return { g, e0, s0 };
};

test("elastic walls conserve energy and keep every molecule inside the box", () => {
  const { g, e0 } = run(openPolicy, 20);
  assert.ok(Math.abs(energy(g) - e0) / e0 < 1e-4);
  for (let i = 0; i < g.n; i++) {
    assert.ok(Math.abs(g.px[i]) <= BOX.hx && g.py[i] >= 0 && g.py[i] <= BOX.h && Math.abs(g.pz[i]) <= BOX.hz);
  }
});

test("a shut door (and no demon) keeps both chambers apart and costs no bits", () => {
  const { g } = run(null, 15);
  const c = chambers(g);
  assert.equal(c.nL, 70);
  assert.equal(c.nR, 70);
  assert.equal(g.bits, 0);
  const { g: g2 } = run(closedPolicy, 15);
  assert.equal(chambers(g2).nL, 70);
  assert.ok(g2.bits > 0, "a demon that keeps the door closed still has to look");
});

test("the demon sorts: right gets hot, left gets cold, gas entropy drops — but bits outnumber it", () => {
  const { g, s0 } = run(demonPolicy, 90);
  const c = chambers(g);
  assert.ok(c.tR - c.tL > 0.25, `ΔT = ${c.tR - c.tL}`);
  const dS = gasEntropy(g) - s0;
  assert.ok(dS < 0, "gas entropy decreases");
  // Landauer: xoá mỗi bit sinh ít nhất k ln 2 entropy → phải ≥ lượng entropy khí đã giảm
  assert.ok(g.bits * Math.log(2) > -dS, `bits ${g.bits} vs −ΔS ${-dS}`);
  assert.ok(g.passed > 0);
});

test("an always-open door shows no lasting temperature split", () => {
  const { g } = run(openPolicy, 90, 7);
  const c = chambers(g);
  assert.ok(Math.abs(c.tR - c.tL) < 0.35, `ΔT = ${c.tR - c.tL}`);
});
