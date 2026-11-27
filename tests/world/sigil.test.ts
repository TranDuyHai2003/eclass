import { test } from "node:test";
import assert from "node:assert/strict";
import { recognize, tier } from "../../lib/world/sigil";

const N = 80;
const shape = (f: (t: number) => [number, number]) => Array.from({ length: N }, (_, i) => f(i / (N - 1))).map(([x, y]) => ({ x, y }));

test("sigil: đường tròn → khiên, vẽ chuẩn được điểm cao", () => {
  const r = recognize(shape((t) => [200 + 100 * Math.cos(t * 2 * Math.PI), 200 + 100 * Math.sin(t * 2 * Math.PI)]));
  assert.equal(r?.id, "shield");
  assert.ok((r?.score ?? 0) > 0.85);
});

test("sigil: zigzag → sét", () => {
  const pts = [[0, 0], [40, 120], [80, 0], [120, 120], [160, 0]].flatMap(([x, y], i, a) => (i ? Array.from({ length: 16 }, (_, k) => [a[i - 1][0] + ((x - a[i - 1][0]) * k) / 15, a[i - 1][1] + ((y - a[i - 1][1]) * k) / 15]) : []));
  assert.equal(recognize(pts.map(([x, y]) => ({ x, y })))?.id, "bolt");
});

test("sigil: xoắn ốc 2,5 vòng → lỗ đen", () => {
  const r = recognize(shape((t) => [200 + (10 + 120 * t) * Math.cos(t * 5 * Math.PI), 200 + (10 + 120 * t) * Math.sin(t * 5 * Math.PI)]));
  assert.equal(r?.id, "vortex");
});

test("sigil: parabol ∩ → thiên thạch", () => {
  const r = recognize(shape((t) => [t * 240, 200 - 180 * (1 - (2 * t - 1) ** 2)]));
  assert.equal(r?.id, "meteor");
  assert.ok((r?.score ?? 0) > 0.8);
});

test("sigil: sóng sin → sóng chồng chập", () => {
  assert.equal(recognize(shape((t) => [t * 300, 150 + 60 * Math.sin(t * 4 * Math.PI)]))?.id, "wave");
});

test("sigil: nét quá nhỏ hoặc nguệch ngoạc → không nhận", () => {
  assert.equal(recognize(shape((t) => [t * 10, t * 10])), null);
  assert.equal(recognize(shape((t) => [t * 200, t * 200])), null);
});

test("sigil: bậc chính xác", () => {
  assert.deepEqual(tier(0.95), { label: "Perfect", mult: 1.5 });
  assert.equal(tier(0.3).mult, 0.6);
});
