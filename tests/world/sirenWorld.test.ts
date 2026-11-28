import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BARRIER_DUR,
  BARRIER_DUR_REDUCED,
  COLLAGE_COLS,
  COLLAGE_LAYERS,
  COLLAGE_ROWS,
  REST_ZONE,
  WATERFALLS,
  barrierProgress,
  collageLayout,
  fallLoop,
  needleTarget,
  pieceAlive,
  recordAngle,
  restAmount,
} from "@/lib/world/sirenWorld";
import { GATES, PORTALS, SURFS, WRAP_R, inFootprint } from "@/lib/world/sirenMaze";
import { HARMONY_COURT } from "@/lib/world/sirenMusic";
import { HARMONIC_BPM } from "@/lib/world/harmonicState";

test("trời cắt dán: bố cục xác định, đủ mảnh, ô atlas hợp lệ, lớp xa dùng bóng xa, lớp gần có cặp khung A/B", () => {
  const a = collageLayout();
  const b = collageLayout();
  assert.deepEqual(a, b);
  assert.equal(a.length, COLLAGE_LAYERS.reduce((s, l) => s + l.count, 0));
  for (const p of a) {
    assert.ok(p.cell >= 0 && p.cell < COLLAGE_COLS * COLLAGE_ROWS);
    const col = p.cell % COLLAGE_COLS;
    if (p.layer < 2) {
      assert.ok(col >= 4, "lớp xa: tờ B");
      assert.equal(p.cellB, p.cell);
    } else {
      assert.ok(col < 4 && col % 2 === 0, "lớp gần: khung A ở cột chẵn tờ A");
      assert.equal(p.cellB, p.cell + 1);
    }
    assert.ok(p.rank >= 0 && p.rank < 1);
  }
});

test("trời cắt dán: lớp gần luôn ở ngoài mê cung (không mảnh nào lọt vào tầm chơi dù máy quay ở mép)", () => {
  for (const L of COLLAGE_LAYERS) {
    // máy quay xa tâm nhất ≈ WRAP_R → tâm lớp lệch (1 − follow)·WRAP_R khỏi máy quay
    const minDist = L.radius - (1 - L.follow) * WRAP_R - L.size / 2;
    assert.ok(minDist > 45, `lớp r=${L.radius}: còn ${minDist.toFixed(1)} m`);
  }
  // lớp xa hơn bám máy quay nhiều hơn (thị sai giảm dần theo độ xa)
  for (let i = 1; i < COLLAGE_LAYERS.length; i++) {
    assert.ok(COLLAGE_LAYERS[i].radius < COLLAGE_LAYERS[i - 1].radius);
    assert.ok(COLLAGE_LAYERS[i].follow < COLLAGE_LAYERS[i - 1].follow);
  }
});

test("phân rã: chưa phân rã thì đủ mảnh; càng phân rã càng ít; gần gục chỉ còn bóng xa nhất", () => {
  const ps = collageLayout();
  const alive = (d: number) => ps.reduce((s, p) => s + pieceAlive(p.rank, p.layer, d), 0);
  assert.equal(alive(0), ps.length);
  let prev = alive(0);
  for (let d = 0.1; d <= 1.0001; d += 0.1) {
    const n = alive(d);
    assert.ok(n <= prev + 1e-9, `d=${d.toFixed(1)} tăng mảnh`);
    prev = n;
  }
  const end = ps.filter((p) => pieceAlive(p.rank, p.layer, 1) > 0);
  assert.ok(end.length > 0 && end.every((p) => p.layer === 0), "cao trào bằng sự biến mất: chỉ còn lớp xa");
  // mượt: một bước nhỏ của d không làm mảnh nào nhảy quá 0,2
  for (const p of ps) assert.ok(Math.abs(pieceAlive(p.rank, p.layer, 0.5) - pieceAlive(p.rank, p.layer, 0.52)) < 0.2);
});

test("thác ký hiệu: vòng rơi → bay ngược liên tục, lật gương khi bay ngược", () => {
  assert.deepEqual(fallLoop(0), [1, 1, 1]);
  const [, yb] = fallLoop(0.4999);
  assert.ok(yb < 0.01, "đáy khi hết nửa rơi");
  const [side, y, flip] = fallLoop(0.75);
  assert.equal(side, -1);
  assert.equal(flip, -1);
  assert.ok(y > 0.45 && y < 0.55);
  assert.ok(fallLoop(0.9999)[1] > 0.99, "về đỉnh trước khi rơi vòng mới");
  assert.deepEqual(fallLoop(1.25), fallLoop(0.25));
  // rơi nhanh dần
  const v1 = fallLoop(0.05)[1] - fallLoop(0.1)[1];
  const v2 = fallLoop(0.4)[1] - fallLoop(0.45)[1];
  assert.ok(v2 > v1);
});

test("thác ký hiệu: không chắn mặt đi, cổng hay cầu; nằm trong màn sân khấu", () => {
  for (const w of WATERFALLS) {
    assert.ok(Math.hypot(w.x, w.z) + w.width < WRAP_R - 2);
    for (const s of SURFS) assert.ok(!inFootprint(s, w.x, w.z, w.width + 2), `thác (${w.x}, ${w.z}) đè ${s.id}`);
    for (const p of PORTALS) assert.ok(Math.hypot(p.c[0] - w.x, p.c[2] - w.z) > w.width + 6);
  }
});

test("Dấu lặng: lõi = 1, ngoài vành = 0, mượt; không đè cổng / cổng động / sân Hoà âm; dưới sàn Lồng Escher", () => {
  const Z = REST_ZONE;
  assert.equal(restAmount(Z.x, 1, Z.z), 1);
  assert.equal(restAmount(Z.x + Z.outer + 0.1, 1, Z.z), 0);
  assert.equal(restAmount(Z.x, 20, Z.z), 0, "trong Lồng Escher (y ≥ 8) không im lặng");
  assert.equal(restAmount(0, 1, 0), 0, "đấu trường không bị ảnh hưởng");
  let prev = 1;
  for (let d = 0; d <= Z.outer + 1; d += 0.25) {
    const v = restAmount(Z.x + d, 1, Z.z);
    assert.ok(v <= prev + 1e-12 && prev - v < 0.15, `nhảy ở d=${d}`);
    prev = v;
  }
  for (const p of PORTALS) assert.ok(Math.hypot(p.c[0] - Z.x, p.c[2] - Z.z) > Z.outer || p.c[1] > Z.y1 + 2 || p.c[1] < Z.y0 - 2, `cổng ${p.id}`);
  for (const g of GATES) assert.ok(Math.hypot(g.x - Z.x, g.z - Z.z) > Z.outer + g.r);
  assert.ok(Math.hypot(HARMONY_COURT.x - Z.x, HARMONY_COURT.z - Z.z) > Z.outer + HARMONY_COURT.r);
  // đứng được: đảo góc Đông Bắc nằm trong lõi
  assert.ok(SURFS.some((s) => s.id.startsWith("k") && inFootprint(s, Z.x, Z.z)));
});

test("đĩa than: quay khoá nhịp (1 vòng / ô nhịp); kim trong dải rãnh, bất hoà làm cào nhiều hơn", () => {
  assert.ok(Math.abs(recordAngle(4) + Math.PI * 2) < 1e-12);
  // một ô nhịp ở 96 BPM = 2,5 s
  assert.ok(Math.abs((4 * 60) / HARMONIC_BPM - 2.5) < 1e-12);
  let calm = 0;
  let wild = 0;
  for (let i = 0; i < 400; i++) {
    const beat = i * 0.37;
    const st = Math.floor((beat * 60) / HARMONIC_BPM * 8) / 8;
    const a = needleTarget(beat, st, 0);
    const b = needleTarget(beat, st, 1);
    assert.ok(a > -0.2 && a < 0.2 && b > -0.25 && b < 0.25);
    calm += Math.abs(a - needleTarget(beat, st + 0.125, 0));
    wild += Math.abs(b - needleTarget(beat, st + 0.125, 1));
  }
  assert.ok(wild > calm * 2);
});

test("kết giới: 1,2–1,8 s, giảm chuyển động ngắn hơn, null khi xong", () => {
  assert.ok(BARRIER_DUR >= 1.2 && BARRIER_DUR <= 1.8);
  assert.ok(BARRIER_DUR_REDUCED < BARRIER_DUR);
  assert.equal(barrierProgress(0, false), 0);
  assert.ok(Math.abs((barrierProgress(BARRIER_DUR / 2, false) ?? 0) - 0.5) < 1e-9);
  assert.equal(barrierProgress(BARRIER_DUR, false), null);
  assert.equal(barrierProgress(BARRIER_DUR_REDUCED, true), null);
});
