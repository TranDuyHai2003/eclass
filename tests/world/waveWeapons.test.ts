import { test } from "node:test";
import assert from "node:assert/strict";
import {
  A_CHAIN, A_MAX, A_MIN, CREST_MUL, FULL_MS, LANCE_LAMBDAS, NODE_MUL, WAVE_V, bestLambda, chargeAmplitude, classify, crestDamage, crestEvent, crestMul,
  crestPositions, packetCovers, packetSpan, phaseFromDelay, phaseGap, resultantAmp, simulatePoint, standingPair, superpose, waveParams, type Packet,
} from "../../lib/world/sineLance";
import {
  BOB_MASS, G, PERFECT_S, SHIELD_LENGTHS, THETA_BASE, THETA_MAX, advance, angleAt, bashMul, blockFraction, counterMul, decay, keRatio, kineticMax, parryGrade,
  period, pump, quarter, releaseBurst, speedAt, timeToBottom,
} from "../../lib/world/pendShield";
import { MOVESETS } from "../../lib/world/combo";
import { WEAPON_DEFS } from "../../components/world/combat/items";
import { WEAPON_ELEMENT } from "../../lib/world/musicVoices";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
let pid = 1;
const pk = (o: Partial<Packet> = {}): Packet => ({ id: pid++, ox: 0, oz: 0, dx: 1, dz: 0, t0: 0, A: 1, lam: 2.4, v: WAVE_V, cycles: 3, range: 14, dmgK: 0.6, src: "charged", ...o });

// ───────────── Giáo Sin ─────────────

test("v = λ·f: ba nấc bước sóng cho tần số và chu kỳ đúng", () => {
  for (const lam of LANCE_LAMBDAS) {
    const w = waveParams(1, lam);
    assert.ok(near(w.lam * w.f, WAVE_V), `λf = v (${lam})`);
    assert.ok(near(w.T, lam / WAVE_V));
    assert.ok(near(w.omega / w.k, WAVE_V), "ω/k = v");
  }
});

test("nhát đâm: đỉnh (s = λ/4) ×1,5, nút (s = λ/2) ×0,7; đổi λ để đỉnh rơi đúng quái", () => {
  for (const lam of LANCE_LAMBDAS) {
    assert.ok(near(crestMul(lam / 4, lam), CREST_MUL, 1e-12));
    assert.ok(near(crestMul((3 * lam) / 4, lam), CREST_MUL, 1e-12));
    assert.ok(near(crestMul(lam / 2, lam), NODE_MUL, 1e-12));
  }
  // quái cách 2,4 m: λ = 3,2 đặt đỉnh đúng chỗ (3λ/4 = 2,4), λ = 2,4 / 1,6 lại đặt NÚT ở đó
  assert.equal(bestLambda(2.4), 3.2);
  assert.ok(near(crestMul(2.4, 2.4), NODE_MUL, 1e-12));
  assert.equal(bestLambda(1.8), 2.4);
  assert.equal(bestLambda(2.0), 1.6);
  assert.deepEqual(crestPositions(1.6, 3.6).map((x) => +x.toFixed(3)), [0.4, 1.2, 2, 2.8, 3.6]);
});

test("biên độ tụ lực tăng theo thời gian giữ, kẹp trong [A_MIN, A_MAX]", () => {
  assert.equal(chargeAmplitude(100, 380), A_CHAIN);
  assert.equal(chargeAmplitude(380, 380), A_MIN);
  assert.ok(near(chargeAmplitude(380 + FULL_MS / 2, 380), (A_MIN + A_MAX) / 2));
  assert.equal(chargeAmplitude(99999, 380), A_MAX);
});

test("bó sóng chạy với vận tốc v, dài cycles·λ, phủ làn rộng A + 0,7 m", () => {
  const p = pk({ A: 1, lam: 2, cycles: 3, range: 14 });
  assert.equal(packetSpan(p, 0), null);
  assert.deepEqual(packetSpan(p, 1), [0, 4]); // trước ở 4 m, sau ở −2 → kẹp 0
  assert.deepEqual(packetSpan(p, 3), [6, 12]);
  assert.ok(packetCovers(p, 8, 1.6, 3));
  assert.ok(!packetCovers(p, 8, 1.8, 3), "ngoài làn");
  assert.ok(!packetCovers(p, 5, 0, 3), "bó đã đi qua");
});

test("một bó đi qua một điểm: số lần đỉnh trúng = 2 × số bước sóng, |y| ≈ A", () => {
  const p = pk({ A: 0.8, lam: 2.4, cycles: 3 });
  const r = simulatePoint([p], 6, 0, 0, 6, 1 / 240);
  assert.ok(r.hits >= 5 && r.hits <= 6, `hits ${r.hits}`);
  assert.ok(r.maxY <= 0.8 + 1e-9 && r.maxY > 0.79, `maxY ${r.maxY}`);
});

test("chồng chập: hai bó cùng chỗ cách nhau đúng 1 chu kỳ → tăng cường (biên độ cộng), nửa chu kỳ → triệt tiêu", () => {
  const T = waveParams(1, 2.4).T;
  const a = pk({ t0: 0, cycles: 6 });
  const inPhase = pk({ t0: T, cycles: 6 });
  const anti = pk({ t0: T / 2, cycles: 6 });
  // điểm 6 m, lúc cả hai bó đã phủ
  const t = 6 / WAVE_V + T + 0.2;
  const c = superpose([a, inPhase], 6, 0, t);
  assert.equal(c.n, 2);
  assert.ok(near(c.amp, 2, 1e-9), `amp ${c.amp}`);
  assert.equal(classify(c), "constructive");
  const d = superpose([a, anti], 6, 0, t);
  assert.ok(d.amp < 1e-9, `amp ${d.amp}`);
  assert.equal(classify(d), "destructive");
  // mô phỏng: tăng cường gần gấp đôi |y| mỗi đỉnh; triệt tiêu thì không trúng lần nào trong vùng chồng
  const tA = 6 / WAVE_V + T + 0.05;
  const tB = 6 / WAVE_V + 6 * T - 0.05;
  const rc = simulatePoint([a, inPhase], 6, 0, tA, tB, 1 / 240);
  const rd = simulatePoint([a, anti], 6, 0, tA, tB, 1 / 240);
  assert.ok(rc.maxY > 1.95, `constructive maxY ${rc.maxY}`);
  assert.equal(rd.hits, 0);
});

test("lệch pha từ độ trễ: Δφ = 2π·Δt/T; công thức biên độ tổng hợp", () => {
  assert.ok(near(phaseFromDelay(0.6, 0.6), 0, 1e-9) || near(phaseFromDelay(0.6, 0.6), 2 * Math.PI, 1e-9));
  assert.ok(near(phaseFromDelay(0.3, 0.6), Math.PI, 1e-9));
  assert.ok(near(phaseGap(phaseFromDelay(1.2, 0.6)), 0, 1e-9));
  assert.ok(near(resultantAmp(1, 1, 0), 2));
  assert.ok(near(resultantAmp(1, 1, Math.PI), 0, 1e-9));
  assert.ok(near(resultantAmp(1, 1, Math.PI / 2), Math.SQRT2));
});

test("đỉnh: dy/dt đổi dấu và |y| đủ lớn; sát thương ∝ |y|, tăng cường ×1,3", () => {
  assert.ok(crestEvent(1, -1, 0.8));
  assert.ok(!crestEvent(1, 1, 0.8));
  assert.ok(!crestEvent(1, -1, 0.05), "gần nút / triệt tiêu: không tính");
  const single = crestDamage(10, { y: 1, dmgK: 0.6, amp: 1, sumA: 1, n: 1 });
  const twice = crestDamage(10, { y: 2, dmgK: 0.6, amp: 2, sumA: 2, n: 2 });
  assert.ok(near(single, 6));
  assert.ok(near(twice, 2 * 6 * 1.3));
});

test("sóng dừng: nút đứng yên (không trúng), bụng đập với biên độ 2A", () => {
  const lam = 2.4;
  const [p1, p2] = standingPair(900, 0, 0, 1, 0, 0, 0.6, lam, 2 * lam, 0.5, 6);
  const t0 = (2 * lam) / WAVE_V + 0.02;
  const t1 = (6 * lam) / WAVE_V - 0.02;
  // bụng tại s = λ/2 (cos(k·s − k·D/2) = ±1), nút tại s = λ/4
  const anti = simulatePoint([p1, p2], lam / 2, 0, t0, t1, 1 / 240);
  const node = simulatePoint([p1, p2], lam / 4, 0, t0, t1, 1 / 240);
  assert.ok(anti.maxY > 1.15, `antinode ${anti.maxY}`);
  assert.ok(anti.hits >= 4);
  assert.equal(node.hits, 0);
});

// ───────────── Khiên Con lắc ─────────────

test("chu kỳ T = 2π√(L/g), không phụ thuộc khối lượng; dây dài gấp 4 → chu kỳ gấp đôi", () => {
  assert.ok(near(period(1), 2 * Math.PI * Math.sqrt(1 / G)));
  assert.ok(near(period(4 * 0.25) / period(0.25), 2, 1e-12));
  assert.ok(near(quarter(0.45), period(0.45) / 4));
  // mọi nấc: T/4 nằm trong thời gian báo trước đòn quái (450 ms) → kịp buông lắc sau khi thấy báo
  for (const L of SHIELD_LENGTHS) assert.ok(quarter(L) > 0.2 && quarter(L) < 0.45, `T/4(${L}) = ${quarter(L)}`);
});

test("buông từ đỉnh: tới đáy sau đúng T/4 — đỡ hoàn hảo ở đó, gần biên chỉ đỡ yếu", () => {
  for (const L of SHIELD_LENGTHS) {
    const T = period(L);
    let psi = 0;
    const dt = 1 / 600;
    for (let t = 0; t < T / 4 - 1e-9; t += dt) psi = advance(psi, dt, L);
    assert.ok(timeToBottom(psi, L) < 0.005, `L ${L}`);
    assert.equal(parryGrade(psi, L), "perfect");
    assert.equal(parryGrade(0, L), "weak");
    assert.equal(parryGrade(Math.PI, L), "weak");
    // ngay ngoài cửa sổ hoàn hảo
    const off = Math.PI / 2 + ((PERFECT_S + 0.02) / T) * 2 * Math.PI;
    assert.notEqual(parryGrade(off, L), "perfect");
  }
  assert.equal(blockFraction("perfect"), 1);
  assert.ok(blockFraction("good") > blockFraction("weak"));
});

test("bảo toàn cơ năng: ½mv² ở đáy = mgL(1 − cos θ₀); tỉ lệ động năng 1 ở đáy, 0 ở biên", () => {
  const L = 0.45;
  const th0 = 0.8;
  const v = speedAt(L, th0, 0);
  assert.ok(near(0.5 * BOB_MASS * v * v, kineticMax(L, th0), 1e-12));
  assert.ok(near(speedAt(L, th0, th0), 0));
  assert.ok(near(keRatio(th0, Math.PI / 2), 1, 1e-12));
  assert.ok(near(keRatio(th0, 0), 0, 1e-12));
  assert.ok(near(angleAt(th0, 0), th0));
  assert.ok(near(bashMul(th0, Math.PI / 2), 1.5) && near(bashMul(th0, 0), 0.6));
});

test("phản đòn ∝ động năng: dây dài hơn / biên độ lớn hơn → phản mạnh hơn", () => {
  const [S, M, Lg] = SHIELD_LENGTHS;
  assert.ok(counterMul(Lg, THETA_BASE) > counterMul(M, THETA_BASE));
  assert.ok(counterMul(M, THETA_BASE) > counterMul(S, THETA_BASE));
  assert.ok(counterMul(M, 0.9) > counterMul(M, THETA_BASE));
  assert.ok(near(counterMul(M, THETA_BASE), 2.8, 1e-12), "dây giữa, biên độ nền = mốc tham chiếu");
  assert.ok(counterMul(Lg, THETA_MAX) <= 1.2 + 1.6 * 3 + 1e-12, "chặn trên");
});

test("cộng hưởng: đỡ hoàn hảo liên tiếp tăng biên độ (tối đa θ_MAX), không đẩy thì tắt dần về nền", () => {
  let th = THETA_BASE;
  const seq: number[] = [];
  for (let i = 0; i < 6; i++) {
    th = pump(th, i);
    seq.push(th);
  }
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] >= seq[i - 1]);
  assert.equal(seq[seq.length - 1], THETA_MAX);
  const later = decay(THETA_MAX, 30);
  assert.ok(later < THETA_BASE + 0.01 && later >= THETA_BASE);
  assert.ok(decay(0.9, 1) < 0.9 && decay(0.9, 1) > THETA_BASE);
  const lo = releaseBurst(0.45, THETA_BASE);
  const hi = releaseBurst(0.45, THETA_MAX);
  assert.ok(hi.r > lo.r && hi.mul > lo.mul);
});

// ───────────── Tích hợp dữ liệu ─────────────

test("hai vũ khí mới có trong bảng vũ khí, thế võ và nguyên tố âm thanh", () => {
  for (const id of ["lance", "shield"]) {
    assert.ok(id in WEAPON_DEFS, id);
    assert.ok(MOVESETS[id], id);
    assert.ok(WEAPON_ELEMENT[id], id);
  }
});
