import { test } from "node:test";
import assert from "node:assert/strict";
import { CURVES, FACTS, buffonHit, buffonPi, dft, epicycleAt, galtonBin, pendEnergy, pendStep, sampleCurve, sieve, ulam, type Pend } from "../../lib/world/loadToys";

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

test("Fourier: cộng đủ các vòng tròn vẽ lại đúng đường cong", () => {
  for (const id of CURVES) {
    const P = sampleCurve(id, 64);
    const E = dft(P);
    for (let i = 0; i < 64; i += 7) {
      const [x, y] = epicycleAt(E, i / 64);
      assert.ok(Math.hypot(x - P[i][0], y - P[i][1]) < 1e-9, id);
    }
    // vòng to đứng trước
    for (let k = 1; k < E.length; k++) assert.ok(E[k - 1].amp >= E[k].amp);
  }
});

test("kim Buffon: 200 000 kim → ước lượng π sai < 0,05", () => {
  const r = rng(7);
  let hits = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) if (buffonHit(r)) hits++;
  assert.ok(Math.abs(buffonPi(N, hits) - Math.PI) < 0.05);
  assert.equal(buffonPi(10, 0), Infinity);
});

test("sàng nguyên tố + xoắn Ulam", () => {
  const p = sieve(100);
  const primes = [...p.keys()].filter((i) => p[i]);
  assert.equal(primes.length, 25);
  assert.deepEqual(primes.slice(0, 6), [2, 3, 5, 7, 11, 13]);
  // ô liền kề cho mọi số liên tiếp, không trùng ô
  const seen = new Set<string>();
  for (let k = 1; k <= 400; k++) {
    const [x, y] = ulam(k);
    assert.ok(!seen.has(`${x},${y}`));
    seen.add(`${x},${y}`);
    if (k > 1) {
      const [a, b] = ulam(k - 1);
      assert.equal(Math.abs(a - x) + Math.abs(b - y), 1, `k=${k}`);
    }
  }
});

test("bảng Galton: trung bình ≈ n/2, phương sai ≈ n/4 (phân phối nhị thức → chuông)", () => {
  const r = rng(3);
  const n = 12;
  const N = 40000;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < N; i++) {
    const k = galtonBin(r, n);
    s += k;
    s2 += k * k;
  }
  const m = s / N;
  assert.ok(Math.abs(m - n / 2) < 0.05);
  assert.ok(Math.abs(s2 / N - m * m - n / 4) < 0.08);
});

test("con lắc kép: bảo toàn năng lượng; lệch 1e-9 rad → sau 20 s khác hẳn (hỗn loạn)", () => {
  const a: Pend = [2.2, 2.5, 0, 0];
  const b: Pend = [2.2 + 1e-9, 2.5, 0, 0];
  const E0 = pendEnergy(a);
  for (let i = 0; i < 20000; i++) {
    pendStep(a, 0.001);
    pendStep(b, 0.001);
  }
  assert.ok(Math.abs(pendEnergy(a) - E0) < 1e-3 * Math.abs(E0));
  assert.ok(Math.abs(a[1] - b[1]) > 0.1);
});

test("mỗi sự thật đều có bản tiếng Việt và tiếng Anh", () => {
  assert.ok(FACTS.length >= 12);
  for (const f of FACTS) assert.ok(f.vi.length > 20 && f.en.length > 20);
});
