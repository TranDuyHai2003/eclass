import { test } from "node:test";
import assert from "node:assert/strict";
import { bfsReachable, ghoulDamageMul, ghoulTarget, greedyPath, greedyStep, lairBlocked, lairCells, LAIR_R } from "@/lib/world/greedyGhoul";
import { bestPlan, factorize, isPrime, MAX_COUNT, newWarden, OPEN_MS, QUIET_MS, SHIELDS, tileGrid, wardenHit, wardenOpen, wardenTick, type WardenState } from "@/lib/world/primeWarden";
import { binomPmf, choose, crabDamageMul, expectedInLane, galtonLane, laneAngle, laneOfAngle, pebbleTimes, ROWS, SPREAD, TELE_MS, volleyDuration, volleyLanes, VOLLEY } from "@/lib/world/galtonCrab";
import { mulberry32 } from "@/lib/world/monty";

// ───────────── Ma Tham Lam ─────────────

const open = () => false;

test("tham lam: đất trống → đi thẳng tới người chơi, không kẹt", () => {
  const r = greedyPath(0, 0, 6, 3, open);
  assert.equal(r.stuck, false);
  const [li, lj] = r.path[r.path.length - 1];
  assert.deepEqual([li, lj], [6, 3]);
  // mỗi bước khoảng cách giảm ngặt
  for (let k = 1; k < r.path.length; k++) {
    const a = Math.hypot(6 - r.path[k - 1][0], 3 - r.path[k - 1][1]);
    const b = Math.hypot(6 - r.path[k][0], 3 - r.path[k][1]);
    assert.ok(b < a);
  }
});

test("sào huyệt: 3 chữ U, 27 ô rào, tâm tổ trống, miệng U quay vào trong", () => {
  const cells = lairCells();
  assert.equal(cells.length, 27);
  assert.equal(new Set(cells.map((c) => c.join(","))).size, 27);
  assert.equal(lairBlocked(0, 0), false);
  // chữ U hướng +x: lưng i = 6, lòng (4..5, −1..1) trống, miệng i = 3 trống
  for (let j = -2; j <= 2; j++) assert.ok(lairBlocked(6, j));
  for (let i = 4; i <= 5; i++) for (let j = -1; j <= 1; j++) assert.equal(lairBlocked(i, j), false);
  assert.equal(lairBlocked(3, 0), false);
  // đối xứng: hướng −x và +z cũng có lưng rào
  assert.ok(lairBlocked(-6, 0));
  assert.ok(lairBlocked(0, 6));
  assert.equal(lairBlocked(0, -6), false);
});

test("cực tiểu địa phương: đứng sau lưng chữ U → con ma kẹt trong lòng U dù đường vòng vẫn có", () => {
  const r = greedyPath(0, 0, 8.6, 0.4, lairBlocked);
  assert.equal(r.stuck, true);
  const [i, j] = r.path[r.path.length - 1];
  assert.ok(i >= 4 && i <= 5 && Math.abs(j) <= 1, `kẹt ở ${i},${j}`);
  assert.equal(greedyStep(i, j, 8.6, 0.4, lairBlocked).stuck, true);
  // BFS (tìm đường đầy đủ) vẫn tới được → kẹt là do THAM LAM, không phải do hết đường
  assert.ok(bfsReachable(i, j, 9, 0, lairBlocked));
});

test("đứng lệch ra khỏi bóng chữ U → con ma đi vòng qua được (không kẹt)", () => {
  const r = greedyPath(0, 0, 8, 4, lairBlocked);
  assert.equal(r.stuck, false);
  assert.deepEqual(r.path[r.path.length - 1], [8, 4]);
});

test("không cắt góc rào khi đi chéo", () => {
  const wall = (i: number, j: number) => (i === 1 && j === 0) || (i === 0 && j === 1);
  const s = greedyStep(0, 0, 5, 5, wall);
  assert.notDeepEqual([s.i, s.j], [1, 1]);
});

test("ngoài sào huyệt → quay về tổ; hệ số sát thương: kẹt ×2,2, đang lao ×0,35", () => {
  assert.deepEqual(ghoulTarget(3, 4), [3, 4]);
  assert.deepEqual(ghoulTarget(LAIR_R + 1, 0), [0, 0]);
  assert.equal(ghoulDamageMul(true), 2.2);
  assert.equal(ghoulDamageMul(false), 0.35);
});

// ───────────── Hộ Vệ Nguyên Tố ─────────────

function burst(s: WardenState, n: number, t0: number): number {
  for (let k = 0; k < n; k++) wardenHit(s, t0 + k * 200);
  return t0 + (n - 1) * 200 + QUIET_MS + 1;
}

test("số nguyên tố / phân tích thừa số / lưới gạch", () => {
  assert.deepEqual([2, 3, 5, 7, 11, 13].map(isPrime), [true, true, true, true, true, true]);
  assert.deepEqual([0, 1, 4, 9, 12, 15].map(isPrime), [false, false, false, false, false, false]);
  assert.deepEqual(factorize(12), [2, 2, 3]);
  assert.deepEqual(factorize(30), [2, 3, 5]);
  assert.deepEqual(factorize(13), [13]);
  assert.deepEqual(tileGrid(12), [3, 4]);
  assert.deepEqual(tileGrid(7), [1, 7]);
  assert.deepEqual(tileGrid(9), [3, 3]);
  for (const n of SHIELDS) {
    const [r, c] = tileGrid(n);
    assert.equal(r * c, n);
    assert.equal(r === 1, isPrime(n), `${n}`);
    assert.equal(bestPlan(n).reduce((a, b) => a * b, 1), n);
  }
});

test("khiên 12: loạt 3 rồi 4 → 12 → 4 → 1, vỡ khiên 5 s rồi hồi số mới", () => {
  const s = newWarden(0);
  assert.equal(s.n, 12);
  let t = burst(s, 3, 1000);
  assert.equal(wardenTick(s, t - 2), null); // chưa đủ quãng nghỉ
  assert.deepEqual(wardenTick(s, t), { kind: "divide", by: 3, n: 4 });
  t = burst(s, 4, t + 100);
  assert.deepEqual(wardenTick(s, t), { kind: "break", by: 4 });
  assert.ok(wardenOpen(s, t + 10));
  assert.equal(wardenHit(s, t + 10), "open"); // khiên vỡ: đòn gây sát thương thật, không đếm
  assert.equal(s.count, 0);
  const r = wardenTick(s, t + OPEN_MS);
  assert.deepEqual(r, { kind: "reshield", n: SHIELDS[1] });
  assert.equal(s.n, 7);
});

test("khiên nguyên tố 7: loạt 2 hay 3 bị phản đòn, chỉ đúng 7 đòn liền mới vỡ", () => {
  const s = newWarden(1);
  assert.equal(s.n, 7);
  let t = burst(s, 2, 0);
  assert.deepEqual(wardenTick(s, t), { kind: "reject", count: 2 });
  t = burst(s, 3, t);
  assert.deepEqual(wardenTick(s, t), { kind: "reject", count: 3 });
  t = burst(s, 8, t);
  assert.deepEqual(wardenTick(s, t), { kind: "reject", count: 8 });
  assert.equal(s.n, 7);
  t = burst(s, 7, t);
  assert.deepEqual(wardenTick(s, t), { kind: "break", by: 7 });
});

test("loạt 1 đòn: chia cho 1 chẳng đổi gì; loạt quá dài tự chốt", () => {
  const s = newWarden(0);
  let t = burst(s, 1, 0);
  assert.deepEqual(wardenTick(s, t), { kind: "one" });
  assert.equal(s.n, 12);
  for (let k = 0; k <= MAX_COUNT; k++) wardenHit(s, t + k);
  t += MAX_COUNT;
  const r = wardenTick(s, t);
  assert.equal(r?.kind, "reject");
});

// ───────────── Cua Chuông (bàn Galton) ─────────────

test("nhị thức: C(8,k) và tổng xác suất = 1, đối xứng, đỉnh ở giữa", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => choose(8, k)), [1, 8, 28, 56, 70]);
  let sum = 0;
  for (let k = 0; k <= ROWS; k++) sum += binomPmf(ROWS, k);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  for (let k = 0; k <= ROWS; k++) assert.equal(binomPmf(ROWS, k), binomPmf(ROWS, ROWS - k));
  assert.ok(binomPmf(ROWS, 4) > 0.27 && binomPmf(ROWS, 0) < 0.005);
  // giữa ăn ~5,5 viên / loạt, đuôi ~0,08
  assert.ok(expectedInLane(4) > 5 && expectedInLane(0) < 0.1);
});

test("mô phỏng 20 000 viên: tần suất khớp nhị thức (bàn Galton thật)", () => {
  const r = mulberry32(7);
  const hist = new Array(ROWS + 1).fill(0);
  const N = 20000;
  for (let i = 0; i < N; i++) hist[galtonLane(r)]++;
  for (let k = 0; k <= ROWS; k++) assert.ok(Math.abs(hist[k] / N - binomPmf(ROWS, k)) < 0.012, `máng ${k}: ${hist[k] / N}`);
});

test("loạt sỏi tất định theo hạt giống, đúng số viên, máng trong 0..8", () => {
  const a = volleyLanes(3.25);
  const b = volleyLanes(3.25);
  assert.deepEqual(a, b);
  assert.equal(a.length, VOLLEY);
  assert.ok(a.every((k) => k >= 0 && k <= ROWS));
});

test("máng ↔ góc: giữa = hướng nhìn, đuôi = ngang hông, sau lưng không có máng", () => {
  assert.equal(laneAngle(4), 0);
  assert.ok(Math.abs(laneAngle(0) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(laneAngle(8) - Math.PI / 2) < 1e-9);
  for (let k = 0; k <= ROWS; k++) assert.equal(laneOfAngle(laneAngle(k) + SPREAD * 0.3), k);
  assert.equal(laneOfAngle(Math.PI), -1);
});

test("đánh cua: trước mặt có mai ×0,3, hông ×1,5", () => {
  assert.equal(crabDamageMul(0), 0.3);
  assert.equal(crabDamageMul(0.5), 0.3);
  assert.equal(crabDamageMul(Math.PI / 2), 1.5);
  assert.equal(crabDamageMul(-2), 1.5);
});

test("mốc thời gian loạt sỏi: báo trước rồi thả lần lượt", () => {
  assert.equal(pebbleTimes(0).drop, TELE_MS);
  assert.ok(pebbleTimes(1).drop > pebbleTimes(0).drop);
  assert.ok(volleyDuration() > pebbleTimes(VOLLEY - 1).land);
});
