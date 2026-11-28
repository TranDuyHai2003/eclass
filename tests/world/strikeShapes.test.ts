import { test } from "node:test";
import assert from "node:assert/strict";
import { KNIGHT_CELLS, STRIKE_BEATS, beatAt, catenary, hash01, isKnightCell, lodCount, newBeat, strikeDuration, tendril, zigzagCrack, type StrikeShape } from "../../lib/world/strikeShapes";

const SHAPES = Object.keys(STRIKE_BEATS) as StrikeShape[];

test("beatAt: đủ 5 pha theo thứ tự, mép vẽ xong trước nín thở, kết thúc phase 5 với glow / heat = 0", () => {
  const b = newBeat();
  for (const s of SHAPES) {
    const spec = STRIKE_BEATS[s];
    const total = strikeDuration(spec);
    let prev = 0;
    for (let t = 0; t <= total + 20; t += 5) {
      beatAt(t, spec, b);
      assert.ok(b.phase >= prev, `${s}: pha lùi tại ${t}`);
      prev = b.phase;
      assert.ok(Number.isFinite(b.glow) && b.glow >= 0 && b.glow <= 2.61, `${s}: glow ${b.glow}`);
      assert.ok(b.heat >= 0 && b.heat <= 1 && b.erode >= 0 && b.erode <= 1);
      if (b.phase >= 1) assert.equal(b.draw, 1);
    }
    beatAt(total + 1, spec, b);
    assert.equal(b.phase, 5);
    assert.equal(b.glow, 0);
    assert.equal(b.heat, 0);
  }
});

test("beatAt: nín thở tụt sáng, cao trào vọt lên đỉnh 2,6 (giảm chuyển động: 1,3)", () => {
  const spec = STRIKE_BEATS.rupture;
  const b = newBeat();
  beatAt(spec.tele + spec.hold - 1, spec, b);
  const dip = b.glow;
  assert.ok(dip < 0.5);
  beatAt(spec.tele + spec.hold + spec.climax * 0.25, spec, b);
  assert.ok(Math.abs(b.glow - 2.6) < 0.05);
  beatAt(spec.tele + spec.hold + spec.climax * 0.25, spec, b, true);
  assert.ok(b.glow <= 1.31);
  // tắt bất đối xứng: cuối cao trào còn < 1,6
  beatAt(spec.tele + spec.hold + spec.climax - 1, spec, b);
  assert.ok(b.glow < 1.6 && b.glow > 1);
});

test("beatAt: nguội — nhiệt giảm đơn điệu, xói tăng đơn điệu", () => {
  const spec = STRIKE_BEATS.crater;
  const b = newBeat();
  const c0 = spec.tele + spec.hold + spec.climax + spec.sustain;
  let h = 2;
  let e = -1;
  for (let t = c0; t < c0 + spec.cool; t += 10) {
    beatAt(t, spec, b);
    assert.equal(b.phase, 4);
    assert.ok(b.heat <= h + 1e-9 && b.erode >= e - 1e-9);
    h = b.heat;
    e = b.erode;
  }
});

test("zigzagCrack: bắt đầu ở tâm, mũi ĐÚNG bán kính len (mép = vùng trúng), lệch ngang xen kẽ, tất định", () => {
  const out = new Float32Array(30);
  const n = zigzagCrack(out, 1, 0.5, -2, 0.7, 3.2, 7, 0.22, 42);
  assert.equal(n, 8);
  assert.ok(Math.abs(out[0] - 1) < 1e-6 && Math.abs(out[2] + 2) < 1e-6);
  const ex = out[(n - 1) * 3] - 1;
  const ez = out[(n - 1) * 3 + 2] + 2;
  assert.ok(Math.abs(Math.hypot(ex, ez) - 3.2) < 1e-5);
  // mọi điểm trong vòng bán kính (+ biên lệch ngang)
  for (let i = 0; i < n; i++) assert.ok(Math.hypot(out[i * 3] - 1, out[i * 3 + 2] + 2) <= 3.2 + 0.23);
  // độ cao nằm đất
  for (let i = 0; i < n; i++) assert.equal(out[i * 3 + 1], 0.5);
  const again = new Float32Array(30);
  zigzagCrack(again, 1, 0.5, -2, 0.7, 3.2, 7, 0.22, 42);
  assert.deepEqual(out, again);
  // không vượt bộ đệm
  const small = new Float32Array(9);
  assert.equal(zigzagCrack(small, 0, 0, 0, 0, 1, 7, 0.2, 1), 3);
});

test("catenary: hai đầu đúng A, B; võng sâu nhất ở giữa đúng sag; đối xứng", () => {
  const out = new Float32Array(19 * 3);
  const n = catenary(out, 0, 1, 0, 4, 1, 0, 0.5, 19);
  assert.equal(n, 19);
  assert.ok(Math.abs(out[1] - 1) < 1e-9 && Math.abs(out[(n - 1) * 3 + 1] - 1) < 1e-9);
  assert.ok(Math.abs(out[(n - 1) * 3] - 4) < 1e-9);
  const mid = (n - 1) / 2;
  assert.ok(Math.abs(out[mid * 3 + 1] - 0.5) < 1e-9);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(out[i * 3 + 1] - out[(n - 1 - i) * 3 + 1]) < 1e-9);
});

test("tendril: mọc từ mép r0 vào r1, grow = 0 thu về một điểm ở mép", () => {
  const out = new Float32Array(16 * 3);
  const n = tendril(out, 0, 0, 0, 0, 3, 0.4, 0.35, 0.9, 1, 16);
  assert.ok(Math.abs(Math.hypot(out[0], out[2]) - 3) < 1e-5);
  assert.ok(Math.abs(Math.hypot(out[(n - 1) * 3], out[(n - 1) * 3 + 2]) - 0.4) < 1e-5);
  tendril(out, 0, 0, 0, 0, 3, 0.4, 0.35, 0.9, 0, 16);
  for (let i = 0; i < n; i++) assert.ok(Math.abs(Math.hypot(out[i * 3], out[i * 3 + 2]) - 3) < 1e-5);
});

test("KNIGHT_CELLS = đúng 8 ô nước Mã, khớp isKnightCell (và luật |dx|·|dz| = 2 dùng trong shader)", () => {
  assert.equal(KNIGHT_CELLS.length, 8);
  let n = 0;
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      const k = isKnightCell(x, z);
      assert.equal(k, KNIGHT_CELLS.some(([a, b]) => a === x && b === z));
      // shader: |x|·|y| = 2 trong bàn 5×5
      if (Math.abs(x) <= 2 && Math.abs(z) <= 2) assert.equal(k, Math.abs(x) * Math.abs(z) === 2);
      if (k) n++;
    }
  assert.equal(n, 8);
});

test("hash01 trong [0, 1) và tất định; lodCount giảm theo mức, ≥ min", () => {
  for (let i = 0; i < 500; i++) {
    const h = hash01(i);
    assert.ok(h >= 0 && h < 1);
    assert.equal(h, hash01(i));
  }
  assert.equal(lodCount(10, 2), 10);
  assert.equal(lodCount(10, 1), 7);
  assert.equal(lodCount(10, 0), 4);
  assert.equal(lodCount(2, 0, 3), 3);
});

test("mọi hình có thời lượng hợp lý (≤ 2 s) và pha báo trước > 0", () => {
  for (const s of SHAPES) {
    const d = strikeDuration(STRIKE_BEATS[s]);
    assert.ok(d > 200 && d <= 2000, `${s}: ${d}`);
    assert.ok(STRIKE_BEATS[s].tele > 0);
  }
});
