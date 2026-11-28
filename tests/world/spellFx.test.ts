import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPELL_PALETTE,
  SPELL_PARTICLES,
  AURA_SPARKS,
  StableMatch,
  crestHeight,
  envelope,
  idealGlyph,
  lodTier,
  parabolaPath,
  projectedPx,
  revealWindow,
  sinePath,
  spellParticles,
  spiralPath,
  stepPath,
  tierFeedback,
} from "../../lib/world/spellFx";
import { recognize } from "../../lib/world/sigil";

const near = (a: number, b: number, e = 1e-5) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

test("spellFx: bảng màu đủ 5 phép, mã hex hợp lệ, thân khác nhau từng phép", () => {
  const bodies = new Set<string>();
  for (const p of Object.values(SPELL_PALETTE)) {
    for (const c of [p.core, p.body, p.ink, p.accent]) assert.match(c, /^#[0-9A-F]{6}$/i);
    bodies.add(p.body.toLowerCase());
  }
  assert.equal(bodies.size, 5);
});

test("spellFx: envelope lên → giữ → tắt, 0 ngoài khoảng", () => {
  assert.equal(envelope(-1, 10, 40, 100), 0);
  near(envelope(10, 10, 40, 100), 1);
  near(envelope(30, 10, 40, 100), 1); // đang giữ
  near(envelope(50, 10, 40, 100), 1); // hết giữ
  near(envelope(100, 10, 40, 100), 0.25); // giữa pha tắt: (1 − 0,5)²
  assert.equal(envelope(151, 10, 40, 100), 0);
  near(envelope(0, 0, 45, 100), 1); // rise 0 → bật ngay
  assert.ok(envelope(5, 10, 40, 100) > 0.5); // outCubic lên nhanh
});

test("spellFx: revealWindow — đầu tới 1, đuôi đuổi theo, hết thì tail ≥ head", () => {
  const a = revealWindow(0, 40, 85, 100);
  assert.equal(a.head, 0);
  assert.equal(a.tail, 0);
  const b = revealWindow(40, 40, 85, 100);
  near(b.head, 1);
  assert.equal(b.tail, 0);
  const c = revealWindow(185, 40, 85, 100);
  assert.ok(c.tail >= c.head);
});

test("spellFx: stepPath — bậc thang từ A tới B, điểm cuối đúng B, đoạn ngang giữ độ cao", () => {
  const out = new Float32Array(32 * 3);
  const n = stepPath(out, 0, 1, 0, 6, 2, 0, 3, 0.4, 1.7);
  assert.equal(n, 7);
  near(out[0], 0);
  near(out[1], 1);
  near(out[(n - 1) * 3], 6);
  near(out[(n - 1) * 3 + 1], 2);
  // các cặp (đi ngang, nhảy dọc): điểm 2k+1 cùng độ cao với điểm 2k; điểm 2k+2 cùng x với điểm 2k+1
  for (let k = 0; k < 3; k++) {
    near(out[(2 * k + 1) * 3 + 1], out[2 * k * 3 + 1]);
    near(out[(2 * k + 2) * 3], out[(2 * k + 1) * 3]);
  }
  // x tăng dần (đi về phía B)
  for (let i = 1; i < n; i++) assert.ok(out[i * 3] >= out[(i - 1) * 3] - 1e-6);
  // tất định theo seed
  const out2 = new Float32Array(32 * 3);
  stepPath(out2, 0, 1, 0, 6, 2, 0, 3, 0.4, 1.7);
  assert.deepEqual(out, out2);
});

test("spellFx: stepPath không ghi tràn bộ đệm nhỏ", () => {
  const out = new Float32Array(5 * 3);
  const n = stepPath(out, 0, 0, 0, 1, 0, 0, 10, 0.3, 0);
  assert.equal(n, 5); // tối đa 2 bậc
  near(out[(n - 1) * 3], 1);
});

test("spellFx: spiralPath — bán kính r0 → r1, nằm trên mặt đất", () => {
  const out = new Float32Array(28 * 3);
  const n = spiralPath(out, 28, 1.15, 2.7, 0.3, 0.5);
  assert.equal(n, 28);
  near(Math.hypot(out[0], out[2]), 2.7, 1e-4);
  near(Math.hypot(out[(n - 1) * 3], out[(n - 1) * 3 + 2]), 0.3, 1e-4);
  for (let i = 0; i < n; i++) assert.equal(out[i * 3 + 1], 0);
});

test("spellFx: sinePath — đúng số đỉnh, ghim hai đầu khi pinned", () => {
  const out = new Float32Array(65 * 3);
  const n = sinePath(out, 65, 4, 1, 2, 0, true);
  near(out[1], 0);
  near(out[(n - 1) * 3 + 1], 0, 1e-4);
  near(out[(n - 1) * 3], 4);
  let crossings = 0;
  for (let i = 2; i < n - 1; i++) if (Math.sign(out[i * 3 + 1]) !== Math.sign(out[(i - 1) * 3 + 1]) && out[i * 3 + 1] !== 0) crossings++;
  assert.equal(crossings, 3); // 2 chu kỳ → đổi dấu 3 lần ở giữa
});

test("spellFx: crestHeight ghim hai mép, dương ở giữa, tỉ lệ biên độ", () => {
  near(crestHeight(0, 1.3, 0.4), 0);
  near(crestHeight(1, 1.3, 0.4), 0, 1e-9);
  for (let u = 0.05; u < 1; u += 0.05) assert.ok(crestHeight(u, 1, 0.7) >= 0);
  near(crestHeight(0.5, 2, 0.3), 2 * crestHeight(0.5, 1, 0.3));
});

test("spellFx: parabolaPath khớp đúng điểm rơi của thiên thạch (v = (Δ + ½gT²ŷ)/T)", () => {
  const g = 9.8;
  const T = 0.75;
  const target = { x: 3, y: 0, z: 8 };
  const from = { x: target.x - 4, y: target.y + 14, z: target.z - 3 };
  const v = { x: (target.x - from.x) / T, y: (target.y - from.y + 0.5 * g * T * T) / T, z: (target.z - from.z) / T };
  const out = new Float32Array(24 * 3);
  const n = parabolaPath(out, 24, from, v, g, 0, T);
  near(out[0], from.x, 1e-4);
  near(out[1], from.y, 1e-4);
  near(out[(n - 1) * 3], target.x, 1e-4);
  near(out[(n - 1) * 3 + 1], target.y, 1e-4);
  near(out[(n - 1) * 3 + 2], target.z, 1e-4);
  // phần còn lại từ t0 = T/2: điểm đầu là vị trí lúc T/2
  parabolaPath(out, 24, from, v, g, T / 2, T);
  near(out[1], from.y + v.y * (T / 2) - 0.5 * g * (T / 2) ** 2, 1e-4);
});

test("spellFx: glyph chuẩn của mỗi phép được bộ nhận dạng nhận đúng phép đó", () => {
  const out = new Float32Array(80 * 2);
  for (const id of ["shield", "bolt", "vortex", "meteor", "wave"] as const) {
    const n = idealGlyph(id, out, 80);
    const pts = Array.from({ length: n }, (_, i) => ({ x: 200 + out[i * 2] * 200, y: 200 + out[i * 2 + 1] * 200 }));
    assert.equal(recognize(pts)?.id, id, id);
    for (let i = 0; i < n * 2; i++) assert.ok(Math.abs(out[i]) <= 0.5 + 1e-6);
  }
});

test("spellFx: glyph đảo chiều (dir = −1) vẫn cùng phép", () => {
  const out = new Float32Array(80 * 2);
  for (const id of ["shield", "bolt", "vortex", "meteor", "wave"] as const) {
    const n = idealGlyph(id, out, 80, -1);
    const pts = Array.from({ length: n }, (_, i) => ({ x: 200 + out[i * 2] * 200, y: 200 + out[i * 2 + 1] * 200 }));
    assert.equal(recognize(pts)?.id, id, id);
  }
});

test("spellFx: StableMatch chỉ báo khi kết quả giữ ≥ stableMs", () => {
  const m = new StableMatch<string>(75);
  assert.equal(m.push("bolt", 0), null);
  assert.equal(m.push("bolt", 60), null);
  assert.equal(m.push("bolt", 80), "bolt");
  assert.equal(m.push("wave", 90), null); // đổi → đếm lại
  assert.equal(m.push("wave", 170), "wave");
  assert.equal(m.push(null, 200), null);
  m.reset();
  assert.equal(m.push("wave", 300), null);
});

test("spellFx: phản hồi bậc — Perfect nhiều vòng nhất, Rough rung", () => {
  assert.equal(tierFeedback("Perfect").rings, 3);
  assert.equal(tierFeedback("Good").rings, 2);
  assert.equal(tierFeedback("OK").rings, 1);
  assert.equal(tierFeedback("Rough").shake, true);
  assert.ok(tierFeedback("Perfect").sparks > tierFeedback("Rough").sparks);
});

test("spellFx: ngân sách hạt tăng theo mức, đúng trần nghiên cứu (điện thoại / laptop)", () => {
  for (const [id, caps] of Object.entries(SPELL_PARTICLES)) {
    assert.ok(caps[0] <= caps[1] && caps[1] <= caps[2], id);
    assert.equal(spellParticles(id as keyof typeof SPELL_PARTICLES, 2), caps[2]);
  }
  assert.deepEqual([SPELL_PARTICLES.meteor[0], SPELL_PARTICLES.meteor[2]], [16, 30]);
  assert.deepEqual([SPELL_PARTICLES.shield[0], SPELL_PARTICLES.shield[2]], [8, 16]);
  assert.deepEqual([AURA_SPARKS[0], AURA_SPARKS[2]], [4, 8]);
});

test("spellFx: projectedPx và LOD có trễ", () => {
  // vật 2 m cách 10 m, fov 60°, màn 800 px: 2 · (1/tan30°) · 400 / 10 ≈ 138,6 px
  near(projectedPx(2, 10, 60, 800), (2 * (1 / Math.tan(Math.PI / 6)) * 400) / 10, 1e-6);
  assert.equal(lodTier(100), 2);
  assert.equal(lodTier(30, 2), 1);
  assert.equal(lodTier(10, 2), 0);
  // trễ: ở 46 px đang mức 2 thì giữ 2, đang mức 1 thì chưa lên 2
  assert.equal(lodTier(46, 2), 2);
  assert.equal(lodTier(46, 1), 1);
  assert.equal(lodTier(22, 1), 1);
  assert.equal(lodTier(22, 0), 0);
});
