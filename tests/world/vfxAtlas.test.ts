import { test } from "node:test";
import assert from "node:assert/strict";
import { bakeNoiseFlow, bakePuff, periodicFbm } from "../../lib/world/vfxAtlas";
import { hash32, mulberry32, vfxRand, vfxRange, vfxSeed } from "../../lib/world/vfxRng";
import { PUFF_CAP, climaxPulse, impactDip, puffAt, puffCount, type PuffState } from "../../lib/world/vfxBeats";

// ───────────── vfxRng ─────────────

test("mulberry32: cùng hạt giống → cùng chuỗi, khác hạt giống → khác chuỗi, luôn trong [0, 1)", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  let diff = 0;
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
    if (x !== c()) diff++;
  }
  assert.ok(diff > 990);
});

test("vfxRand: vfxSeed đặt lại dòng chung (ảnh chụp lặp lại được), trung bình ~0,5", () => {
  vfxSeed(7);
  const first = Array.from({ length: 64 }, () => vfxRand());
  vfxSeed(7);
  const again = Array.from({ length: 64 }, () => vfxRand());
  assert.deepEqual(first, again);
  vfxSeed(1);
  let s = 0;
  for (let i = 0; i < 20000; i++) s += vfxRand();
  assert.ok(Math.abs(s / 20000 - 0.5) < 0.01);
  for (let i = 0; i < 200; i++) {
    const r = vfxRange(2, 5);
    assert.ok(r >= 2 && r < 5);
  }
});

test("hash32: không âm, 32 bit, ít va chạm trên 10k số liên tiếp", () => {
  const seen = new Set<number>();
  for (let i = 0; i < 10000; i++) {
    const h = hash32(i);
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 0xffffffff);
    seen.add(h);
  }
  assert.ok(seen.size > 9990);
});

// ───────────── vfxAtlas ─────────────

/** chênh lệch lớn nhất giữa hai điểm ảnh kề nhau trong ô, và qua đường nối (cột cuối ↔ cột đầu, hàng cuối ↔ hàng đầu) */
function seams(d: Uint8Array, size: number, ch: number) {
  let inner = 0;
  let seam = 0;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const v = d[(j * size + i) * 4 + ch];
      const r = d[(j * size + ((i + 1) % size)) * 4 + ch];
      const u = d[(((j + 1) % size) * size + i) * 4 + ch];
      const dd = Math.max(Math.abs(v - r), Math.abs(v - u));
      if (i === size - 1 || j === size - 1) seam = Math.max(seam, dd);
      else inner = Math.max(inner, dd);
    }
  return { inner, seam };
}

test("periodicFbm lặp liền ô: f(0, y) = f(1, y), trong [0, 1]", () => {
  for (let k = 0; k < 20; k++) {
    const y = k / 20;
    const a = periodicFbm(0, y, 4, 4, 3);
    const b = periodicFbm(1 - 1e-9, y, 4, 4, 3);
    assert.ok(Math.abs(a - b) < 1e-4);
    assert.ok(a >= 0 && a <= 1);
  }
});

test("bakeNoiseFlow: tất định, đúng cỡ, mọi kênh lặp liền ô (đường nối không gắt hơn bên trong)", () => {
  const size = 64;
  const a = bakeNoiseFlow(size, 7);
  const b = bakeNoiseFlow(size, 7);
  assert.equal(a.length, size * size * 4);
  assert.deepEqual(a, b);
  for (let ch = 0; ch < 4; ch++) {
    const { inner, seam } = seams(a, size, ch);
    assert.ok(seam <= inner + 2, `kênh ${ch}: đường nối ${seam} > bên trong ${inner}`);
  }
});

test("bakeNoiseFlow: trường xoáy (G, B) trung bình ~0,5 (không trôi một phía) và dùng hết dải", () => {
  const size = 64;
  const d = bakeNoiseFlow(size, 7);
  for (const ch of [1, 2]) {
    let s = 0;
    let lo = 255;
    let hi = 0;
    for (let i = 0; i < size * size; i++) {
      const v = d[i * 4 + ch];
      s += v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const mean = s / (size * size) / 255;
    assert.ok(Math.abs(mean - 0.5) < 0.05, `kênh ${ch} lệch ${mean}`);
    assert.ok(lo < 40 && hi > 215);
  }
});

test("bakePuff: alpha = 0 ở toàn bộ mép ô (không lộ cạnh vuông), đặc ở tâm, sáng trên > tối dưới", () => {
  const size = 64;
  const d = bakePuff(size, 11);
  for (let i = 0; i < size; i++)
    for (const [x, y] of [
      [i, 0],
      [i, size - 1],
      [0, i],
      [size - 1, i],
    ]) assert.equal(d[(y * size + x) * 4 + 3], 0);
  const c = (size / 2) * size + size / 2;
  assert.ok(d[c * 4 + 3] > 200);
  // hàng trên (y lớn = lên) sáng hơn hàng dưới trong vùng đặc
  const row = (y: number) => {
    let s = 0;
    let n = 0;
    for (let x = size / 4; x < (3 * size) / 4; x++) {
      const o = (y * size + x) * 4;
      if (d[o + 3] > 128) {
        s += d[o];
        n++;
      }
    }
    return n ? s / n : 0;
  };
  assert.ok(row(Math.round(size * 0.7)) > row(Math.round(size * 0.3)));
});

// ───────────── vfxBeats ─────────────

test("impactDip: 1 khi còn xa, tụt về sàn đúng lúc chạm, đơn điệu", () => {
  assert.equal(impactDip(1), 1);
  assert.equal(impactDip(0.09), 1);
  assert.equal(impactDip(0), 0.3);
  assert.equal(impactDip(Number.NaN), 0.3);
  let prev = 2;
  for (let t = 0.2; t >= 0; t -= 0.01) {
    const v = impactDip(t);
    assert.ok(v <= prev + 1e-9);
    prev = v;
  }
});

test("climaxPulse: vọt lên đỉnh trong attack, tắt bất đối xứng, về đúng 0", () => {
  assert.equal(climaxPulse(-1), 0);
  assert.equal(climaxPulse(30), 2.6);
  assert.ok(climaxPulse(15) > 1.2 && climaxPulse(15) < 1.4);
  assert.equal(climaxPulse(30 + 420), 0);
  // tắt nhanh đầu: ở 25 % thời gian tắt đã mất > 50 % độ sáng
  assert.ok(climaxPulse(30 + 105) < 1.3);
  let prev = 99;
  for (let a = 30; a <= 450; a += 10) {
    const v = climaxPulse(a);
    assert.ok(v <= prev + 1e-9 && v >= 0);
    prev = v;
  }
});

test("puffAt: nở nhanh rồi chậm, nguội dần, xói tăng, hết đời thì tắt hẳn; không cấp phát (ghi vào out)", () => {
  const o: PuffState = { scale: 0, alpha: 0, heat: 0, erode: 0 };
  const r = puffAt(0, o);
  assert.equal(r, o);
  assert.ok(r.scale >= 0.4 && r.heat === 1 && r.erode === 0 && r.alpha === 0);
  puffAt(0.18, o);
  assert.ok(o.scale > 0.99 && o.scale < 1.01);
  puffAt(0.5, o);
  assert.ok(o.heat < 0.05 && o.erode > 0 && o.alpha === 1);
  puffAt(1, o);
  assert.equal(o.alpha, 0);
  let prevS = 0;
  let prevH = 2;
  for (let k = 0; k <= 1; k += 0.02) {
    puffAt(k, o);
    assert.ok(o.scale >= prevS - 1e-9 && o.heat <= prevH + 1e-9);
    prevS = o.scale;
    prevH = o.heat;
  }
});

test("PUFF_CAP / puffCount: tăng theo mức, mức thấp vẫn có tối thiểu", () => {
  assert.ok(PUFF_CAP[0] < PUFF_CAP[1] && PUFF_CAP[1] < PUFF_CAP[2]);
  assert.ok(PUFF_CAP[2] <= 32);
  assert.equal(puffCount(0, 2), 0);
  assert.equal(puffCount(12, 2), 12);
  assert.equal(puffCount(12, 0, 3), 4);
  assert.equal(puffCount(2, 0, 2), 2);
});
