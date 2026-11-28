import { test } from "node:test";
import assert from "node:assert/strict";
import { ARENA_R, standingDanger } from "@/lib/world/boss";
import {
  BREAK_K,
  DEATH_SIMPLIFY,
  DEATH_VANISH,
  INTRO_DRAW,
  INTRO_FORM,
  SIREN_EPI,
  bossLook,
  epicycleJoints,
  epicycleTip,
  harmonicKMax,
  standingDangerDrawn,
  termWeight,
  type BossLook,
} from "@/lib/world/epicycle";

const look = (): BossLook => ({ draw: 0, kMax: 0, shrink: 0, chain: 0, trail: 0, dissolve: 0, spin: 0 });

test("Sóng dừng (Chladni): vùng nguy hiểm VẼ trên sàn trùng đúng luật standingDanger ở mọi điểm mẫu", () => {
  let n = 0;
  for (let x = -ARENA_R - 1; x <= ARENA_R + 1; x += 0.173) {
    for (let z = -ARENA_R - 1; z <= ARENA_R + 1; z += 0.211) {
      assert.equal(standingDangerDrawn(x, z), standingDanger(Math.hypot(x, z)), `lệch tại (${x.toFixed(3)}, ${z.toFixed(3)})`);
      n++;
    }
  }
  // dọc bán kính thật mịn (gần các ngưỡng |sin| = 0,5 và r = 2, r = R − 0,5)
  for (let r = 0; r <= ARENA_R; r += 0.0037) {
    assert.equal(standingDangerDrawn(r, 0), standingDanger(r));
    n++;
  }
  assert.ok(n > 30000);
});

test("epicycle: đủ hệ số tái dựng đường viền khép kín, chuỗi khớp kết thúc đúng tại ngọn bút", () => {
  const e = SIREN_EPI;
  assert.ok(e.n >= 32);
  const joints = new Float32Array((e.n + 1) * 2);
  const tip = new Float32Array(2);
  const a = new Float32Array(2);
  const b = new Float32Array(2);
  epicycleTip(e, 0, e.kTop, 1, a);
  epicycleTip(e, 1, e.kTop, 1, b);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4, "đường viền khép kín (t = 0 ≡ t = 1)");
  for (const t of [0.1, 0.37, 0.8]) {
    const cnt = epicycleJoints(e, t, e.kTop, 1.6, joints);
    epicycleTip(e, t, e.kTop, 1.6, tip);
    assert.equal(cnt, e.n + 1);
    assert.ok(Math.abs(joints[(cnt - 1) * 2] - tip[0]) < 1e-4 && Math.abs(joints[(cnt - 1) * 2 + 1] - tip[1]) < 1e-4);
  }
  // biên độ giảm dần (vẽ to trước nhỏ sau)
  for (let i = 1; i < e.n; i++) assert.ok(e.amp[i] <= e.amp[i - 1] + 1e-6);
  // hình bao ~ kích thước boss (cao 3,8 m trong không gian mô hình)
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 200; i++) {
    epicycleTip(e, i / 200, e.kTop, 1, tip);
    minY = Math.min(minY, tip[1]);
    maxY = Math.max(maxY, tip[1]);
  }
  assert.ok(maxY - minY > 3 && maxY - minY < 4.5, `cao ${maxY - minY}`);
});

test("epicycle: mất hoạ âm bậc cao trước — trọng số theo |k|, kMax theo số hoạ âm còn sống", () => {
  assert.equal(termWeight(3, 10), 1);
  assert.equal(termWeight(-12, 10), 0);
  assert.ok(Math.abs(termWeight(11, 10.5) - 0.5) < 1e-9);
  const top = SIREN_EPI.kTop;
  assert.equal(harmonicKMax(8, top), top);
  assert.equal(harmonicKMax(1, top), 2);
  for (let h = 1; h < 8; h++) assert.ok(harmonicKMax(h, top) < harmonicKMax(h + 1, top));
});

test("boss: xuất hiện = bút vẽ đường viền rồi thân hiện dần; gục = bậc giảm đơn điệu về 1 rồi biến mất", () => {
  const L = look();
  const top = SIREN_EPI.kTop;
  bossLook(L, 0, 1e6, 0, 0, 0, top, top);
  assert.equal(L.draw, 0);
  assert.ok(L.dissolve > 2, "chưa thấy thân");
  bossLook(L, INTRO_DRAW / 2, 1e6, 0, 0, 0, top, top);
  assert.ok(Math.abs(L.draw - 0.5) < 1e-9);
  bossLook(L, INTRO_DRAW + INTRO_FORM + 1, 1e6, 0, 0, 0, top, top);
  assert.equal(L.dissolve, 0);
  assert.equal(L.chain, 0);
  // gục
  let prev = Infinity;
  for (let t = 0; t <= DEATH_SIMPLIFY + DEATH_VANISH; t += 50) {
    bossLook(L, 1e9, 1e6 + t, 0, 0, 1e6, top, top);
    assert.ok(L.kMax <= prev + 1e-9, "bậc không tăng lại");
    prev = L.kMax;
  }
  assert.ok(Math.abs(prev - 1) < 1e-6);
  assert.equal(L.shrink, 0);
});

test("boss: BREAK vỡ xuống bậc thấp rồi dựng lại trước khi hết BREAK", () => {
  const L = look();
  const top = SIREN_EPI.kTop;
  const at = 1e6;
  const until = at + 6000;
  bossLook(L, 1e9, at + 1000, at, until, 0, top, top);
  assert.ok(Math.abs(L.kMax - BREAK_K) < 1e-6);
  assert.ok(L.dissolve > 1);
  bossLook(L, 1e9, until - 1, at, until, 0, top, top);
  assert.ok(L.kMax > top - 0.1);
  assert.ok(L.dissolve < 0.01);
  bossLook(L, 1e9, until + 10, at, until, 0, top, top);
  assert.equal(L.chain, 0);
});
