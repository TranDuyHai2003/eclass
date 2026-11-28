import { test } from "node:test";
import assert from "node:assert/strict";
import { BINS, GB, ballAt, binX, expected, galtonRun, pegY, runDuration, stackPos, tStart } from "@/lib/world/galtonBoard";

const stats = (c: number[]) => {
  const n = c.reduce((a, b) => a + b, 0);
  const m = c.reduce((a, b, k) => a + b * k, 0) / n;
  const v = c.reduce((a, b, k) => a + b * (k - m) ** 2, 0) / n;
  return { n, m, v };
};

test("bảng Galton: p = ½ → trung bình ≈ np = 5, phương sai ≈ np(1−p) = 2,5 (gộp nhiều lượt)", () => {
  const c = new Array(BINS).fill(0);
  for (let s = 1; s <= 20; s++) galtonRun(s, 0.5).counts.forEach((x, k) => (c[k] += x));
  const { n, m, v } = stats(c);
  assert.equal(n, 20 * GB.balls);
  assert.ok(Math.abs(m - 5) < 0.1, `mean ${m}`);
  assert.ok(Math.abs(v - 2.5) < 0.2, `var ${v}`);
});

test("bảng Galton: nghiêng p = 0,7 → chuông lệch phải (μ ≈ 7), tổng kỳ vọng = số viên", () => {
  const c = new Array(BINS).fill(0);
  for (let s = 1; s <= 20; s++) galtonRun(s, 0.7).counts.forEach((x, k) => (c[k] += x));
  assert.ok(Math.abs(stats(c).m - 7) < 0.1);
  let e = 0;
  for (let k = 0; k < BINS; k++) e += expected(k, 0.7);
  assert.ok(Math.abs(e - GB.balls) < 1e-6);
});

test("bảng Galton: đường bay liền mạch, nằm trong bảng, đậu đúng chỗ, không vượt nóc máng", () => {
  const run = galtonRun(7, 0.5);
  for (let i = 0; i < GB.balls; i += 17) {
    assert.equal(ballAt(run, i, tStart(i) - 0.01), null);
    let prev = ballAt(run, i, tStart(i))!;
    for (let t = tStart(i); t < runDuration(); t += 0.005) {
      const q = ballAt(run, i, t)!;
      assert.ok(Math.hypot(q[0] - prev[0], q[1] - prev[1]) < 0.12, `nhảy cóc ở viên ${i}, t ${t}`);
      assert.ok(Math.abs(q[0]) <= binX(GB.rows) + 0.1 && q[1] >= GB.binY && q[1] <= GB.hopperY + 0.01);
      prev = q;
    }
    const end = ballAt(run, i, runDuration())!;
    const sp = stackPos(run.bin[i], run.slot[i]);
    assert.deepEqual(end, sp);
  }
  // chồng cao nhất vẫn dưới nóc vách máng và dưới hàng đinh cuối
  const top = Math.max(...run.counts.map((c, k) => stackPos(k, c - 1)[1]));
  assert.ok(top + GB.ballR < GB.binTop && GB.binTop < pegY(GB.rows - 1));
});

test("bảng Galton: bệ nút / cần nhận đúng, cần nghiêng xoay vòng ½ → 0,7 → 0,3 → ½", async () => {
  const { GB_STATIONS, nearGalton, nextTilt } = await import("@/lib/world/galtonBoard");
  const at = (b: number, r: number): [number, number] => [Math.sin((b * Math.PI) / 180) * r, -Math.cos((b * Math.PI) / 180) * r];
  const d = at(GB_STATIONS.drop.b, GB_STATIONS.drop.r);
  const t = at(GB_STATIONS.tilt.b, GB_STATIONS.tilt.r);
  assert.equal(nearGalton(d[0], d[1], 0), "drop");
  assert.equal(nearGalton(t[0], t[1], 0), "tilt");
  assert.equal(nearGalton(t[0], t[1], 5), null);
  assert.equal(nearGalton(0, 0, 0), null);
  assert.equal(nextTilt(nextTilt(nextTilt(0.5))), 0.5);
});
