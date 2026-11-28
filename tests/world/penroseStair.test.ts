import { test } from "node:test";
import assert from "node:assert/strict";
import { doorOpen, ESC, escherStart, escherStep, FLIGHT_RISE, FLIGHT_RUN, floorsClimbed, heightGained, LAP_H, landingIndex, lapShift, shepardVoices, stairBase, stairCell, stairGround } from "../../lib/world/penroseStair";

/** đi dọc tâm lối đi theo chiều leo, trả các độ cao gốc gặp được */
function walkLap(step = 0.05): number[] {
  const { X0, X1, Z0, Z1, W } = ESC;
  const c = W / 2;
  const pts: [number, number][] = [];
  for (let z = Z0 + c; z <= Z1 - c; z += step) pts.push([X1 - c, z]); // L0 → F0 → L1
  for (let x = X1 - c; x >= X0 + c; x -= step) pts.push([x, Z1 - c]); // → F1 → L2
  for (let z = Z1 - c; z >= Z0 + c; z -= step) pts.push([X0 + c, z]); // → F2 → L3
  for (let x = X0 + c; x <= X1 - c; x += step) pts.push([x, Z0 + c]); // → F3 → L0
  return pts.map(([x, z]) => stairBase(x, z)!);
}

test("penrose: kích thước — 4 đợt × 10 cổ bậc × 0,16 m = 6,4 m mỗi vòng; giếng vuông khớp", () => {
  assert.ok(Math.abs(FLIGHT_RUN - 2.7) < 1e-12);
  assert.ok(Math.abs(FLIGHT_RISE - 1.6) < 1e-12);
  assert.ok(Math.abs(LAP_H - 6.4) < 1e-12);
  assert.ok(Math.abs(ESC.X1 - ESC.X0 - (2 * ESC.W + FLIGHT_RUN)) < 1e-9);
  assert.ok(Math.abs(ESC.Z1 - ESC.Z0 - (2 * ESC.W + FLIGHT_RUN)) < 1e-9);
});

test("penrose: đi một vòng theo chiều leo — chỉ lên (mỗi lần ≤ 0,16 m), rồi 'tụt' đúng 6,4 m ở mối nối", () => {
  const h = walkLap();
  let drops = 0;
  for (let i = 1; i < h.length; i++) {
    const d = h[i] - h[i - 1];
    if (d < 0) {
      drops++;
      assert.ok(Math.abs(d + LAP_H - ESC.rise) < 1e-9, `mối nối ${d}`); // 6,24 → 0 (= +0,16 ở vòng trên)
    } else assert.ok(d <= ESC.rise + 1e-9);
  }
  assert.equal(drops, 1);
  assert.equal(Math.max(...h), LAP_H - ESC.rise);
  // 4 chiếu nghỉ ở 0 / 1,6 / 3,2 / 4,8
  assert.deepEqual(
    [stairCell(ESC.X1 - 1, ESC.Z0 + 1), stairCell(ESC.X1 - 1, ESC.Z1 - 1), stairCell(ESC.X0 + 1, ESC.Z1 - 1), stairCell(ESC.X0 + 1, ESC.Z0 + 1)].map((c) => c && c.kind === "landing" && +c.base.toFixed(6)),
    [0, 1.6, 3.2, 4.8],
  );
  assert.equal(stairBase((ESC.X0 + ESC.X1) / 2, (ESC.Z0 + ESC.Z1) / 2), null); // giếng giữa
});

test("penrose: mặt đất liên tục qua mối nối — bước lên từ bậc 6,24 tới chiếu nghỉ L0 của vòng trên (11,4)", () => {
  const top = stairGround(ESC.X1 - ESC.W - 0.1, ESC.Z0 + 1, ESC.y0 + 6.24);
  assert.ok(Math.abs(top! - (ESC.y0 + 6.24)) < 1e-9);
  const l0 = stairGround(ESC.X1 - 1, ESC.Z0 + 1, ESC.y0 + 6.24);
  assert.ok(Math.abs(l0! - (ESC.y0 + LAP_H)) < 1e-9);
  // đi xuống từ L0 (vòng 0) xuống bậc cuối của F3 thuộc vòng −1
  const down = stairGround(ESC.X1 - ESC.W - 0.1, ESC.Z0 + 1, ESC.y0);
  assert.ok(Math.abs(down! - (ESC.y0 - ESC.rise)) < 1e-9);
  // không "nhảy cóc" lên vòng trên khi đang ở dưới
  assert.ok(Math.abs(stairGround(ESC.X1 - 1, ESC.Z1 - 1, ESC.y0 + 1.5)! - (ESC.y0 + 1.6)) < 1e-9);
  assert.ok(Math.abs(stairGround(ESC.X1 - 1, ESC.Z1 - 1, ESC.y0 + 0.9)! - (ESC.y0 + 1.6 - LAP_H)) < 1e-9);
});

test("penrose: quấn vòng giữ người chơi trong [−0,4; 6,15) quanh y0, dời đúng bội của 6,4; không dao động qua lại", () => {
  assert.equal(lapShift(ESC.y0), 0);
  assert.equal(lapShift(ESC.y0 + 6.08), 0); // bậc áp chót của F3
  assert.equal(lapShift(ESC.y0 + 6.24), -LAP_H); // bậc cuối F3 → vòng −1 (−0,16)
  assert.equal(lapShift(ESC.y0 + LAP_H - 1e-6), -LAP_H); // bám tiệm cận lên chiếu nghỉ L0 của vòng trên
  assert.equal(lapShift(ESC.y0 + LAP_H), -LAP_H);
  assert.equal(lapShift(ESC.y0 - 0.16), 0);
  assert.equal(lapShift(ESC.y0 - 0.32), 0);
  assert.equal(lapShift(ESC.y0 - 0.48), LAP_H);
  assert.equal(lapShift(ESC.y0 + 3 * LAP_H + 1), -3 * LAP_H);
  for (const y of [-20, -3, 4, 5.5, 11.15, 11.39, 13, 40]) {
    const r = y + lapShift(y) - ESC.y0;
    assert.ok(r >= -0.4 && r < LAP_H - 0.25, `${y}`);
    assert.equal(lapShift(y + lapShift(y)), 0, `ổn định ${y}`);
  }
});

test("penrose: bộ đếm — leo 4 đợt về đúng chỗ cũ, độ cao tăng 0 m; cửa chỉ mở khi đi XUỐNG tới", () => {
  let s = escherStart();
  assert.equal(doorOpen(s), true);
  // leo một vòng: chiếu nghỉ mở 1, 2, 3, rồi L0 sau khi quấn (laps = 1)
  const L0 = [ESC.X1 - 1, ESC.Z0 + 1] as const;
  const L1 = [ESC.X1 - 1, ESC.Z1 - 1] as const;
  for (const idx of [1, 2, 3]) s = escherStep(s, idx);
  s = escherStep(s, landingIndex(L0[0], L0[1], ESC.y0, 1)!);
  assert.equal(floorsClimbed(s), 4);
  assert.equal(heightGained(), 0);
  assert.equal(doorOpen(s), false); // leo lên tới: cửa đã thành tường
  s = escherStep(s, landingIndex(L1[0], L1[1], ESC.y0 + 1.6, 1)!);
  assert.equal(floorsClimbed(s), 5);
  s = escherStep(s, landingIndex(L0[0], L0[1], ESC.y0, 1)!);
  assert.equal(floorsClimbed(s), 4);
  assert.equal(doorOpen(s), true); // đi xuống tới: lối ra
  // đứng yên trên cùng chiếu nghỉ không đổi trạng thái
  assert.equal(escherStep(s, 4), s);
  // giữa đợt thang không phải chiếu nghỉ
  assert.equal(landingIndex(ESC.X1 - 1, (ESC.Z0 + ESC.Z1) / 2, ESC.y0 + 0.8, 0), null);
});

test("penrose: âm Shepard — 7 giọng cách nhau quãng tám, phổ lặp lại sau mỗi vòng (một quãng tám)", () => {
  const a = shepardVoices(0.3);
  const b = shepardVoices(1.3);
  assert.equal(a.length, 7);
  const key = (v: { hz: number; amp: number }[]) => v.map((x) => `${x.hz.toFixed(6)}:${x.amp.toFixed(6)}`).sort().join("|");
  assert.equal(key(a), key(b));
  // leo lên một chút: mọi giọng có biên độ đáng kể đều cao lên
  const c = shepardVoices(0.35);
  for (let i = 0; i < 7; i++) if (a[i].amp > 0.05) assert.ok(c[i].hz > a[i].hz);
  // giọng nhảy từ đỉnh về đáy chỉ khi gần như im
  for (let i = 0; i < 7; i++) {
    const before = shepardVoices(0.999)[i];
    const after = shepardVoices(1.001)[i];
    if (after.hz < before.hz) assert.ok(before.amp < 0.01 && after.amp < 0.01);
  }
});
