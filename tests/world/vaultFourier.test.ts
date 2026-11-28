import { test } from "node:test";
import assert from "node:assert/strict";
import { DETENTS, errOf, fClear, fDial, fInit, fTick, nudge, pedestal, sample, snap, stageDef } from "../../lib/world/vault/fourier";

test("sai số hệ số = sai số L2 tích phân số trên một chu kỳ (các sin trực giao)", () => {
  const ks = [1, 2, 3, 4];
  const tg = [1, 0.5, -1 / 3, 0.25];
  const amp = [0.8, 0.6, -0.1, 0];
  const M = 4000;
  let num = 0;
  let den = 0;
  for (let i = 0; i < M; i++) {
    const x = ((i + 0.5) / M) * Math.PI * 2;
    num += (sample(amp, ks, x) - sample(tg, ks, x)) ** 2;
    den += sample(tg, ks, x) ** 2;
  }
  assert.ok(Math.abs(errOf(amp, tg) - Math.sqrt(num / den)) < 1e-6);
});

test("núm: nấc 0, ±1/k, ±m/12; giá trị đích của mọi màn đều nằm đúng trên một nấc", () => {
  assert.equal(snap(0.2), 1 / 5);
  assert.equal(snap(0.34), Math.round((1 / 3) * 1e6) / 1e6);
  assert.equal(snap(9), 1);
  assert.equal(snap(Number.NaN), 0);
  assert.equal(DETENTS[0], -1);
  assert.equal(DETENTS[DETENTS.length - 1], 1);
  assert.ok(nudge(0, 1) > 0 && nudge(0, -1) < 0);
  assert.equal(nudge(1, 1), 1);
  for (let s = 0; s < 3; s++)
    for (let n = 2; n <= 4; n++) for (const t of stageDef(s, n).tg) assert.ok(Math.abs(snap(t) - t) < 1e-6, `màn ${s + 1} N ${n}: ${t}`);
});

test("Gibbs: tổng 4 hoạ âm lẻ của sóng vuông vọt quá chiều cao π/4", () => {
  const ks = [1, 3, 5, 7];
  const a = ks.map((k) => 1 / k);
  let max = 0;
  for (let i = 0; i < 20000; i++) max = Math.max(max, sample(a, ks, (i / 20000) * Math.PI));
  assert.ok(max > Math.PI / 4, `đỉnh ${max}`);
  assert.ok(max < (Math.PI / 4) * 1.2);
});

test("màn 2 là sóng vuông (chỉ ống lẻ), màn 3 là răng cưa có bục Nhạc trưởng", () => {
  assert.deepEqual(stageDef(1, 4).ks, [1, 3, 5, 7]);
  assert.deepEqual(stageDef(2, 4).ks, [1, 2, 3]);
  assert.deepEqual(stageDef(2, 4).tg, [1, -1 / 2, 1 / 3]);
  assert.equal(stageDef(2, 2).cond, true);
});

test("núm chỉ xoay được khi đứng trên đúng bệ; ống không ai đứng thì câm", () => {
  const st = fInit(0, 2);
  const p0 = pedestal(st, 0);
  const p1 = pedestal(st, 1);
  assert.equal(fDial(st, 0, 1, p1.x, p1.z), false);
  assert.equal(fDial(st, 0, 1, p0.x, p0.z), true);
  assert.equal(fDial(st, 1, 0.5, p1.x, p1.z), true);
  // đã đặt đúng nhưng chỉ một người đứng → ống 2 câm → chưa đạt
  fTick(st, [[p0.x, 0, p0.z], null], 0.1);
  assert.ok(st.err > 0.1);
  for (let i = 0; i < 25; i++) fTick(st, [[p0.x, 0, p0.z], [p1.x, 0, p1.z]], 0.1);
  assert.equal(st.err, 0);
  assert.equal(fClear(st), true);
});
