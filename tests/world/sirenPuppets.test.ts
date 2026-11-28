import { test } from "node:test";
import assert from "node:assert/strict";
import { CELL, MARCH_STEP, POSE_STRIDE, RIGS, TOTAL_PARTS, TROUPE, animate, compose, faceFrame, marchDistance, pivotOf, puppetBeat, rootPos, type PartDef } from "@/lib/world/sirenPuppets";

test("con rối: khung xương hợp lệ (cha đứng trước con), ≤ 32 bộ phận / con, tổng quad đủ nhỏ cho 1 lệnh vẽ", () => {
  for (const [sp, rig] of Object.entries(RIGS)) {
    assert.ok(rig.length <= 32, sp);
    rig.forEach((d, k) => {
      assert.ok(d.parent < k, `${sp}#${k}: cha phải đứng trước`);
      assert.ok(d.cell >= 0 && d.cell < 16);
    });
    assert.equal(rig.filter((d) => d.face).length, 1, `${sp}: đúng một mặt flipbook`);
  }
  assert.ok(TOTAL_PARTS > 150 && TOTAL_PARTS < 400, `${TOTAL_PARTS}`);
});

test("con rối: ghép 2D — con theo cha khi cha quay; dây treo (world) luôn rủ thẳng, chỉ lệch theo sway", () => {
  const rig: PartDef[] = [
    { cell: CELL.shank, parent: -1, ax: 0, ay: 1, px: 0.5, py: 0, h: 2, w: 0.2, z: 0 },
    { cell: CELL.face0, parent: 0, ax: 0, ay: 2, px: 0.5, py: 0.5, h: 0.5, w: 0.5, z: 0.1 },
    { cell: CELL.string, parent: 1, ax: 0, ay: 0, px: 0.5, py: 0, h: 5, w: 0.02, z: 0, world: true },
  ];
  const rot = new Float32Array(3);
  const sx = new Float32Array([1, 1, 1]);
  const out = new Float32Array(3 * POSE_STRIDE);
  compose(rig, rot, sx, 0, 0, out);
  assert.deepEqual([...pivotOf(1)].map((v) => +v.toFixed(5)), [0, 3, 0]);
  rot[0] = Math.PI / 2; // thân ngả trái 90°
  compose(rig, rot, sx, 0, 0, out);
  const [hx, hy] = pivotOf(1);
  assert.ok(Math.abs(hx + 2) < 1e-5 && Math.abs(hy - 1) < 1e-5, "đầu đi theo thân");
  assert.ok(Math.abs(out[2 * POSE_STRIDE + 2]) < 1e-6, "dây không quay theo cha");
  compose(rig, rot, sx, 0, 0.2, out);
  assert.ok(Math.abs(out[2 * POSE_STRIDE + 2] - 0.2) < 1e-6, "dây lệch theo sway");
  // tâm quad dây = điểm ghim + nửa chiều cao theo hướng dây
  assert.ok(Math.abs(out[2 * POSE_STRIDE + 1] - (1 + 2.5 * Math.cos(0.2))) < 1e-5);
});

test("con rối: diễu hành lao-tới-rồi-khựng — liên tục, đứng yên đúng mỗi beat, mỗi beat đúng một bước", () => {
  for (let b = 0; b < 6; b += 0.01) assert.ok(Math.abs(marchDistance(b + 0.01) - marchDistance(b)) < MARCH_STEP * 0.03);
  for (const b of [1, 2, 7]) {
    const v = (marchDistance(b + 1e-4) - marchDistance(b - 1e-4)) / 2e-4;
    assert.ok(Math.abs(v) < 1e-2, `vận tốc 0 tại beat ${b}: ${v}`);
    assert.ok(Math.abs(marchDistance(b) - b * MARCH_STEP) < 1e-9);
  }
  // quỹ đạo gốc liên tục cho mọi con rối (không nhảy giữa hai khung 60 Hz)
  const a = new Float32Array(3);
  const c = new Float32Array(3);
  for (const p of TROUPE)
    for (let b = 0; b < 40; b += 0.37) {
      rootPos(p, b, a);
      rootPos(p, b + 1.6 / 60, c);
      assert.ok(Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]) < 0.2, p.sp);
    }
});

test("con rối: đoàn diễu quanh ngoài mép đấu trường; hợp xướng canon lệch pha; Lissajous ở trong sân", () => {
  const o = new Float32Array(3);
  for (const p of TROUPE.filter((q) => q.sp === "hammer")) {
    rootPos(p, 3.3, o);
    const r = Math.hypot(o[0], o[2]);
    assert.ok(r > 15.8 && r < 18, "ngoài mép đấu trường (không che trận đánh)");
  }
  const choir = TROUPE.filter((q) => q.sp === "peg");
  const ys = choir.map((p) => (rootPos(p, 1, o), o[1]));
  assert.ok(new Set(ys.map((y) => y.toFixed(3))).size === choir.length, "mỗi giọng một độ cao (canon)");
  for (const p of TROUPE.filter((q) => q.sp === "metro"))
    for (let b = 0; b < 48; b += 1.3) {
      rootPos(p, b, o);
      assert.ok(Math.hypot(o[0] - p.cx, o[2] - p.cz) < 9.5, "trong sân khu");
    }
});

test("con rối: dáng đổi theo nhịp 12 Hz (puppetBeat), búa gõ xuống đúng beat; flipbook mặt 8 Hz", () => {
  const rot = new Float32Array(32);
  const sx = new Float32Array(32);
  const hammer = TROUPE[0];
  animate(hammer, 2.0, rot, sx);
  const onBeat = rot[5];
  animate(hammer, 2.5, rot, sx);
  assert.ok(onBeat < rot[5] - 0.3, "đầu búa gõ xuống ở đầu beat");
  // puppetBeat chỉ đổi 12 lần / giây
  const seen = new Set<number>();
  for (let t = 0; t < 1; t += 1 / 240) seen.add(puppetBeat(Math.floor(t * 12) / 12));
  assert.equal(seen.size, 12);
  // mặt: phần lớn mở mắt, có chớp và xoáy; giảm chuyển động → luôn mở mắt
  const count = [0, 0, 0];
  for (let i = 0; i < 2000; i++) count[faceFrame(i / 8, 0.31, i / 5, 0)]++;
  assert.ok(count[0] > 1500 && count[1] > 0 && count[2] > 0, count.join(","));
  for (let i = 0; i < 200; i++) assert.equal(faceFrame(i / 8, 0.31, i / 5, 1, true), 0);
});
