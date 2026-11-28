import { test } from "node:test";
import assert from "node:assert/strict";
import { DS, fringeSpacing, intensity, nearSlit, sampleHit, slitToRoom } from "@/lib/world/doubleSlit";
import { mulberry32 } from "@/lib/world/monty";
import { dirOf } from "@/lib/world/tessRoom";

const hist = (d: number, det: boolean, n = 40000, bins = 80) => {
  const r = mulberry32(42);
  const h = new Array(bins).fill(0);
  for (let i = 0; i < n; i++) {
    const [u] = sampleHit(r, d, det);
    h[Math.min(bins - 1, Math.floor(((u + 1) / 2) * bins))]++;
  }
  return h;
};
const binOf = (u: number, bins = 80) => Math.min(bins - 1, Math.floor(((u + 1) / 2) * bins));

test("khe Young: không dò → có vân tối giữa các vân sáng (cường độ ~0 ở u = Δu/2)", () => {
  const d = 0.8;
  const h = hist(d, false);
  const dark = h[binOf(fringeSpacing(d) / 2)];
  const bright = h[binOf(0)];
  assert.ok(dark < bright * 0.12, `tối ${dark} / sáng ${bright}`);
});

test("khe Young: bật máy dò đường đi → vân biến mất (chỗ vân tối trở nên sáng gần bằng giữa)", () => {
  const d = 0.8;
  const h = hist(d, true);
  const dark = h[binOf(fringeSpacing(d) / 2)];
  const bright = h[binOf(0)];
  assert.ok(dark > bright * 0.6, `${dark} / ${bright}`);
  assert.ok(Math.abs(intensity(fringeSpacing(d) / 2, d, false)) < 1e-12);
});

test("khe Young: khe xa nhau hơn → vân sít hơn (Δ ∝ 1/d); hạt luôn trên màn", () => {
  assert.ok(fringeSpacing(1.2) < fringeSpacing(0.5));
  assert.ok(Math.abs(fringeSpacing(0.5) / fringeSpacing(1.0) - 2) < 1e-9);
  const r = mulberry32(3);
  for (let i = 0; i < 2000; i++) {
    const [u, v] = sampleHit(r, 1.2, false);
    assert.ok(Math.abs(u) <= 1 && Math.abs(v) <= 1);
  }
});

test("khe Young: khung thí nghiệm nằm đúng phương vị, bệ điều khiển nhận đúng", () => {
  const [x, z] = slitToRoom(0, DS.rScreen);
  const [dx, dz] = dirOf(DS.bearing);
  assert.ok(Math.abs(x - dx * DS.rScreen) < 1e-9 && Math.abs(z - dz * DS.rScreen) < 1e-9);
  const [sx, sz] = slitToRoom(DS.stations.gap.x, DS.stations.gap.z);
  assert.equal(nearSlit(sx, sz, 0), "gap");
  const [tx, tz] = slitToRoom(DS.stations.detector.x, DS.stations.detector.z);
  assert.equal(nearSlit(tx, tz, 0), "detector");
  assert.equal(nearSlit(0, 0, 0), null);
});
