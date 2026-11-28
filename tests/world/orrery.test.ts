import { test } from "node:test";
import assert from "node:assert/strict";
import { daysSinceJ2000, ECC_STEPS, equalAreaWedges, heliocentric, keplerRatio, meanAnomaly, nearOrrery, nextEcc, nextTimeStep, orbitXY, PLANETS, polygonArea, simDays, solveKepler, TIME_STEPS, trueAnomaly, visRadius } from "../../lib/world/orrery";
import { ORR } from "../../lib/world/tessRoom";

test("orrery: Newton giải đúng M = E − e·sin E (kể cả tâm sai lớn, M âm / nhiều vòng)", () => {
  for (const e of [0, 0.0167, 0.2056, 0.6, 0.9, 0.97]) {
    for (let M = -7; M <= 13; M += 0.37) {
      const E = solveKepler(M, e);
      assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-9, `e=${e} M=${M}`);
    }
  }
  // giá trị kinh điển (Vallado): M = 235,4°, e = 0,4 → E ≈ 220,512°
  const E = solveKepler((235.4 * Math.PI) / 180, 0.4);
  assert.ok(Math.abs((E * 180) / Math.PI - 220.512) < 0.01);
  // tròn: E = M
  assert.equal(solveKepler(1.234, 0), 1.234);
});

test("orrery: điểm cận nhật / viễn nhật ở r = a(1 − e) / a(1 + e), Mặt Trời ở tiêu điểm", () => {
  const a = 2;
  const e = 0.5;
  assert.deepEqual(orbitXY(a, e, 0).map((v) => +v.toFixed(9)), [1, 0]);
  const [x, y] = orbitXY(a, e, Math.PI);
  assert.ok(Math.abs(Math.hypot(x, y) - 3) < 1e-9);
  // dị thường thật ở E = π/2: cos ν = (cos E − e)/(1 − e cos E) = −e
  assert.ok(Math.abs(Math.cos(trueAnomaly(Math.PI / 2, e)) + e) < 1e-9);
});

test("orrery: định luật 3 — T²/a³ ≈ 1 năm²/AU³ cho cả 6 hành tinh (số liệu thật)", () => {
  for (const p of PLANETS) assert.ok(Math.abs(keplerRatio(p) - 1) < 0.003, `${p.id} ${keplerRatio(p)}`);
});

test("orrery: định luật 2 — 12 quạt thời gian bằng nhau có diện tích bằng nhau (e = 0,8)", () => {
  const a = 2.5;
  const e = 0.8;
  const w = equalAreaWedges(a, e, 12, 64);
  const areas = w.map(polygonArea);
  const total = Math.PI * a * a * Math.sqrt(1 - e * e);
  for (const A of areas) assert.ok(Math.abs(A - total / 12) / (total / 12) < 0.01, `${A} vs ${total / 12}`);
  // quạt gần cận nhật "mập", gần viễn nhật "dài" — nhưng góc quét khác hẳn nhau
  const ang = (poly: [number, number][]) => {
    const d = Math.atan2(poly[poly.length - 1][1], poly[poly.length - 1][0]) - Math.atan2(poly[1][1], poly[1][0]);
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  };
  assert.ok(ang(w[0]) > 5 * ang(w[6]));
});

test("orrery: sau đúng một chu kỳ hành tinh về chỗ cũ; Trái Đất ở cận nhật đầu tháng 1", () => {
  for (const p of PLANETS) {
    const a = heliocentric(p, 1234.5);
    const b = heliocentric(p, 1234.5 + p.T);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-6);
  }
  const earth = PLANETS.find((p) => p.id === "earth")!;
  // 2024-01-03 (cận nhật thật)
  const d = daysSinceJ2000(Date.UTC(2024, 0, 3));
  const M = ((meanAnomaly(earth, d) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  assert.ok(M < 0.05 || M > 2 * Math.PI - 0.05, `M=${M}`);
  assert.ok(Math.abs(heliocentric(earth, d).r - (1 - earth.e)) < 1e-4);
});

test("orrery: cần gạt thời gian ×1 … ×10⁶, núm tâm sai quay vòng, tỉ lệ hiển thị vừa máy Ø6", () => {
  assert.equal(TIME_STEPS[0], 1);
  assert.equal(TIME_STEPS[TIME_STEPS.length - 1], 1e6);
  assert.equal(nextTimeStep(1), 10);
  assert.equal(nextTimeStep(1e6), 1);
  // ×10⁶: 1 giây thật ≈ 11,57 ngày
  assert.ok(Math.abs(simDays(1, 1e6) - 11.574) < 0.001);
  assert.equal(nextEcc(ECC_STEPS[ECC_STEPS.length - 1]), 0);
  assert.equal(nextEcc(0.3), 0.6);
  // bán kính hiển thị tăng dần, Sao Thổ ở mép máy, cận nhật Sao Thuỷ còn ngoài Mặt Trời (r 0,35)
  const r = PLANETS.map((p) => visRadius(p.a));
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1]);
  assert.ok(Math.abs(r[r.length - 1] - 3) < 1e-9);
  assert.ok(r[0] * (1 - PLANETS[0].e) > 0.6);
});

test("orrery: điểm tương tác ở cần gạt / núm tâm sai trong phòng Thiên văn đồ", () => {
  assert.equal(nearOrrery(ORR.cx + ORR.lever[0] + 0.8, ORR.lever[1], 0), "lever");
  assert.equal(nearOrrery(ORR.cx + ORR.dial[0], ORR.dial[1] - 0.9, 0), "dial");
  assert.equal(nearOrrery(ORR.cx, 0, 0), null);
  assert.equal(nearOrrery(ORR.cx + ORR.lever[0], ORR.lever[1], 5), null);
});
