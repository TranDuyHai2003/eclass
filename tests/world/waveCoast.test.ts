import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BELL_ANGLE,
  CYCLE,
  G,
  GLASS_N,
  LAGOON,
  LENGTHS,
  PUSH_J,
  RESONANT_L,
  SAFE_M,
  SEA,
  SEA_STEEP,
  SWELL,
  TIDE,
  bellStrike,
  coastClock,
  criticalAngle,
  deviation,
  gerstner,
  lagoonAmp,
  lagoonH,
  lagoonSafe,
  lagoonSlam,
  natPeriod,
  nodalX,
  pendAmp,
  prismPoly,
  pushQuality,
  refract2,
  seaHeight,
  stepPend,
  tideLevel,
  traceGlass,
  waitBelow,
  windowBelow,
  type Pend,
} from "@/lib/world/waves";
import {
  CAUSEWAY,
  CRYSTAL_A,
  CRYSTAL_B,
  EMITTER,
  GROTTO,
  ISLE,
  LEVER,
  LAGOON_STONE,
  BELL_STONE,
  PIER,
  PONTOON,
  PORTAL,
  PRISM,
  PRISM_STEPS,
  PUSH_SPOT,
  SPAWN,
  SWEEP_DEPTH,
  TIDE_STONE,
  WEIGHTS,
  WINCH,
  coastBlocked,
  coastGround,
  inLagoon,
  parseProgress,
  prismTarget,
  prismTrace,
  seaDepth,
  straightHits,
  sweepTarget,
} from "@/lib/world/coastWorld";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const MID = (LAGOON.s1.x + LAGOON.s2.x) / 2;

// ───────────── đồng hồ chung ─────────────
test("đồng hồ: quấn về 0 sau 240 s, mọi chu kỳ trong vùng chia hết 240 (shader không giật khi quấn)", () => {
  assert.ok(near(coastClock(0), 0));
  assert.ok(near(coastClock(239_500), 239.5));
  assert.ok(near(coastClock(240_000), 0));
  assert.ok(near(coastClock(960_000_000_123), coastClock(123), 1e-5));
  for (const T of [TIDE.T, LAGOON.T, SWELL.T, ...SEA.map((w) => w.T)]) assert.ok(near(CYCLE / T, Math.round(CYCLE / T), 1e-9), `T = ${T}`);
});

// ───────────── thuỷ triều + Lối Triều ─────────────
test("thuỷ triều: sin chậm −0,8 … 0,8; waitBelow / windowBelow khớp lấy mẫu", () => {
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = 0; t < TIDE.T; t += 0.01) {
    lo = Math.min(lo, tideLevel(t));
    hi = Math.max(hi, tideLevel(t));
  }
  assert.ok(near(lo, -0.8, 1e-3) && near(hi, 0.8, 1e-3));
  const y = CAUSEWAY.top + SWEEP_DEPTH;
  let n = 0;
  for (let t = 0; t < TIDE.T; t += 0.005) if (tideLevel(t) <= y) n++;
  assert.ok(Math.abs(n * 0.005 - windowBelow(y)) < 0.05);
  for (let t = 0; t < 60; t += 0.73) {
    const w = waitBelow(y, t);
    if (w === 0) assert.ok(tideLevel(t) <= y + 1e-9);
    else {
      assert.ok(tideLevel(t + w + 0.02) <= y, "sau khi chờ thì nước đã xuống");
      assert.ok(tideLevel(t + w - 0.05) > y, "không chờ dư");
    }
  }
  assert.equal(waitBelow(5, 3), 0);
  assert.equal(waitBelow(-5, 3), Infinity);
});

test("Lối Triều: chỉ lội qua lúc nước ròng — cửa sổ đủ chạy qua nhưng phải canh; nước lớn thì bị cuốn", () => {
  const y = CAUSEWAY.top + SWEEP_DEPTH;
  const win = windowBelow(y);
  const len = CAUSEWAY.x1 - CAUSEWAY.x0;
  // chạy khi lội: 7 m/s × 0,62
  const cross = len / (7 * 0.62);
  assert.ok(win > cross * 2, `cửa sổ ${win.toFixed(1)} s đủ rộng (qua mất ${cross.toFixed(1)} s)`);
  assert.ok(win < TIDE.T * 0.45, "nhưng không phải lúc nào cũng qua được");
  // nước ròng nhất: mọi điểm trên đỉnh doi cát nông hơn SWEEP; nước lớn nhất: giữa doi cát sâu quá
  const low = TIDE.mid - TIDE.amp;
  const high = TIDE.mid + TIDE.amp;
  for (let x = CAUSEWAY.x0; x <= CAUSEWAY.x1; x += 0.25) {
    assert.ok(seaDepth(x, 0, low) < SWEEP_DEPTH, `x = ${x}`);
    assert.ok(!coastBlocked(x, 0));
  }
  for (let x = 8; x <= 24; x += 0.5) assert.ok(seaDepth(x, 0, high) > SWEEP_DEPTH, `x = ${x}`);
  // ra khỏi doi cát (z = ±4) là biển thẳm
  for (let x = 12; x <= 24; x += 2) assert.ok(coastBlocked(x, 4) && coastBlocked(x, -4));
  // đảo, bãi đáp, cầu tàu luôn khô
  for (const [x, z] of [
    [ISLE.x, ISLE.z],
    [SPAWN.x, SPAWN.z],
    [PORTAL.x, PORTAL.z],
    [TIDE_STONE.x + 1, TIDE_STONE.z],
    [PUSH_SPOT.x, PUSH_SPOT.z],
    [0, 21],
  ])
    assert.ok(seaDepth(x, z, high) < 0, `${x},${z}`);
});

test("sóng cuốn: từ giữa doi cát lúc nước lớn bị đẩy về đất liền khô, không vào chỗ bị chặn", () => {
  const high = 0.8;
  for (const [x, z] of [
    [15, 0],
    [5, 0.8],
    [24, -1],
    [2, 10],
  ]) {
    const p = sweepTarget(x, z, high);
    assert.ok(p.x < x);
    assert.ok(seaDepth(p.x, p.z, high) < 0.1);
    assert.ok(!coastBlocked(p.x, p.z));
  }
});

// ───────────── biển Gerstner ─────────────
test("biển: tổng độ dốc ≤ 0,6, nước sâu ω² = g·k; giải ngược độ cao khớp mặt đã dời (logic = hình)", () => {
  assert.ok(SEA_STEEP <= 0.6);
  for (const w of SEA) assert.ok(near(w.w * w.w, G * w.k, 1e-9));
  let worst = 0;
  for (let i = 0; i < 400; i++) {
    const u = -10 + ((i * 37) % 60);
    const v = -40 + ((i * 53) % 80);
    const t = (i * 0.731) % CYCLE;
    const p = gerstner(u, v, t);
    const h = seaHeight(p.x, p.z, t) - tideLevel(t);
    worst = Math.max(worst, Math.abs(h - p.y));
  }
  assert.ok(worst < 1e-4, `sai số ${worst}`);
  // gần bờ sóng nhỏ hơn ngoài khơi
  let a0 = 0;
  let a1 = 0;
  for (let t = 0; t < 12; t += 0.05) {
    a0 = Math.max(a0, Math.abs(gerstner(-8, 0, t).y));
    a1 = Math.max(a1, Math.abs(gerstner(30, 0, t).y));
  }
  assert.ok(a0 < a1 * 0.35);
});

// ───────────── Đầm Giao thoa ─────────────
test("giao thoa: M = |2A cos((kΔ − φ)/2)| đúng là biên độ lớn nhất theo thời gian", () => {
  for (const [x, z, phi] of [
    [-2, -30, 0],
    [3, -25, 0],
    [-7.3, -38, Math.PI],
    [0.4, -21, 1.1],
  ]) {
    let m = 0;
    for (let t = 0; t < LAGOON.T; t += 0.002) m = Math.max(m, Math.abs(lagoonH(x, z, t, phi)));
    assert.ok(near(m, lagoonAmp(x, z, phi), 2e-3), `${x},${z}`);
  }
});

test("Đầm Giao thoa: cùng pha thì đi thẳng đường giữa bị sóng đánh; đảo pha thì đường giữa lặng", () => {
  let slams = 0;
  for (let z = LAGOON.z1 - 0.5; z > LAGOON.z0 + 0.5; z -= 0.25) {
    assert.ok(near(lagoonAmp(MID, z, 0), 2 * LAGOON.A, 1e-9), "đường giữa là bụng sóng");
    assert.ok(lagoonAmp(MID, z, Math.PI) < 1e-9, "đảo pha → đường giữa là nút");
    assert.ok(!coastBlocked(MID, z));
  }
  // đi bộ 4 m/s dọc đường giữa từ bờ nam tới hai nguồn
  const speed = 2.5;
  for (let t = 0, z = LAGOON.z1 - 0.5; z > LAGOON.s1.z + 1.2; t += 1 / 60, z -= speed / 60) {
    if (lagoonSlam(MID, z, t, 0)) slams++;
    assert.ok(!lagoonSlam(MID, z, t, Math.PI));
  }
  assert.ok(slams > 10, `bị đánh ${slams} khung`);
});

test("Đầm Giao thoa: KHÔNG đảo pha vẫn qua được nếu đi theo đường nút hyperbol r₁ − r₂ = λ/2 (đến tận khe giữa hai nguồn)", () => {
  const half = LAGOON.lambda / 2;
  let prev: number | null = null;
  for (let z = LAGOON.z1 - 0.4; z > LAGOON.z0 + 0.1; z -= 0.2) {
    const x = nodalX(half, z);
    assert.ok(x !== null, `z = ${z}`);
    assert.ok(inLagoon(x!, z));
    assert.ok(!coastBlocked(x!, z), `${x},${z}`);
    for (let t = 0; t < LAGOON.T; t += 0.05) assert.ok(!lagoonSlam(x!, z, t, 0));
    assert.ok(lagoonSafe(x!, z, 0));
    // bước liền nhau (không phải nhảy)
    if (prev !== null) assert.ok(Math.abs(x! - prev) < 0.5);
    prev = x;
  }
  // dải lặng đủ rộng để đi ở giữa đầm (≥ 0,6 m)
  const z = -30;
  const x = nodalX(half, z)!;
  let w = 0;
  for (let dx = -2; dx <= 2; dx += 0.01) if (lagoonSafe(x + dx, z, 0)) w += 0.01;
  assert.ok(w > 0.6, `rộng ${w.toFixed(2)} m`);
  // đứng ở bụng sóng: trong 1 chu kỳ bị đánh; đứng ở nút: 10 s không sao
  let hit = false;
  for (let t = 0; t < LAGOON.T; t += 1 / 60) hit ||= lagoonSlam(MID, -30, t, 0);
  assert.ok(hit);
  for (let t = 0; t < 10; t += 1 / 60) assert.ok(!lagoonSlam(x, -30, t, 0));
  assert.ok(SAFE_M < LAGOON.A);
});

test("Hang Nàng Tiên Cá chỉ tới được bằng cách lội qua đầm (BFS lưới 0,5 m)", () => {
  const reach = (allowLagoon: boolean) => {
    const S = 0.5;
    const key = (i: number, j: number) => `${i},${j}`;
    const q: [number, number][] = [[Math.round(SPAWN.x / S), Math.round(SPAWN.z / S)]];
    const seen = new Set([key(q[0][0], q[0][1])]);
    while (q.length) {
      const [i, j] = q.pop()!;
      if (j * S < GROTTO.z + 1.5) return true;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const a = i + di;
        const b = j + dj;
        const k = key(a, b);
        if (seen.has(k)) continue;
        const x = a * S;
        const z = b * S;
        if (coastBlocked(x, z) || (!allowLagoon && inLagoon(x, z)) || seaDepth(x, z, -0.8) > SWEEP_DEPTH) continue;
        seen.add(k);
        q.push([a, b]);
      }
    }
    return false;
  };
  assert.equal(reach(false), false);
  assert.equal(reach(true), true);
});

// ───────────── con lắc cộng hưởng ─────────────
const run = (L: number, m: number, secs: number, t0 = 0, p: Pend = { th: 0, om: 0 }) => {
  let max = 0;
  let t = t0;
  const n = Math.round(secs * 120);
  for (let i = 0; i < n; i++) {
    stepPend(p, L, m, t);
    t += 1 / 120;
    max = Math.max(max, Math.abs(p.th));
  }
  return { p, max };
};

test("con lắc: T = 2π√(L/g); chiều dài cộng hưởng với sóng lừng 3 s ≈ 2,23 m nằm trong các nấc tời", () => {
  assert.ok(near(natPeriod(RESONANT_L), SWELL.T, 1e-9));
  assert.ok(LENGTHS.some((L) => Math.abs(L - RESONANT_L) < 0.02));
  // dao động tự do biên độ nhỏ: đo chu kỳ qua hai lần đi qua đáy cùng chiều
  for (const L of [0.9, 2.24, 4.4]) {
    const p: Pend = { th: 0.05, om: 0 };
    let t = 0;
    const cross: number[] = [];
    let prev = p.th;
    while (cross.length < 3 && t < 30) {
      stepPend(p, L, 1, t, 1 / 120, false);
      t += 1 / 120;
      if (prev < 0 && p.th >= 0) cross.push(t);
      prev = p.th;
    }
    const T = cross[2] - cross[1];
    assert.ok(Math.abs(T - natPeriod(L)) / natPeriod(L) < 0.01, `L = ${L}: ${T}`);
  }
});

test("con lắc: khối lượng triệt tiêu — quả nặng và quả nhẹ lắc y hệt", () => {
  const a = run(2.24, 0.3, 20).p;
  const b = run(2.24, 40, 20).p;
  assert.ok(near(a.th, b.th, 1e-9) && near(a.om, b.om, 1e-9));
});

test("cộng hưởng: chỉ dây 2,24 m để sóng tự lắc tới chuông (≤ 25 s); dây khác 2 phút không chạm", () => {
  for (const L of LENGTHS) {
    const ok = Math.abs(L - RESONANT_L) < 0.02;
    if (ok) {
      let t = 0;
      const p: Pend = { th: 0, om: 0 };
      while (Math.abs(p.th) < BELL_ANGLE && t < 25) {
        stepPend(p, L, 1, t);
        t += 1 / 120;
      }
      assert.ok(Math.abs(p.th) >= BELL_ANGLE, `L = ${L} không tới chuông`);
    } else {
      // bắt đầu ở nhiều pha khác nhau của sóng
      for (const t0 of [0, 0.7, 1.9]) assert.ok(run(L, 1, 120, t0).max < BELL_ANGLE * 0.85, `L = ${L}`);
    }
  }
});

test("đẩy tay: đẩy đúng nhịp (lúc qua đáy theo chiều đẩy) thì dây nào cũng tới chuông; đẩy ngược nhịp thì không", () => {
  for (const L of [0.9, 4.4]) {
    const sim = (policy: (p: Pend) => boolean) => {
      const p: Pend = { th: 0, om: 0 };
      let t = 0;
      let last = -1;
      let max = 0;
      for (let i = 0; i < 120 * 40; i++) {
        if (t - last > 0.45 && policy(p)) {
          p.om += PUSH_J;
          last = t;
        }
        stepPend(p, L, 1, t);
        t += 1 / 120;
        max = Math.max(max, Math.abs(p.th));
      }
      return max;
    };
    const good = sim((p) => p.om >= 0 && pushQuality(p, L) > 0.85 && Math.abs(p.th) < 0.05);
    const bad = sim((p) => p.om < 0 && Math.abs(p.th) < 0.05);
    assert.ok(good >= BELL_ANGLE, `L = ${L}: đúng nhịp ${good}`);
    assert.ok(bad < BELL_ANGLE * 0.6, `L = ${L}: ngược nhịp ${bad}`);
  }
  // chạm chuông: dội lại, không vượt quá góc chuông
  const q: Pend = { th: BELL_ANGLE + 0.05, om: 1.2 };
  assert.equal(bellStrike(q), 1);
  assert.ok(near(q.th, BELL_ANGLE) && q.om < 0);
  assert.equal(bellStrike({ th: 0.1, om: 3 }), 0);
  // pendAmp = biên độ lắc thật (không cưỡng bức, không ma sát gần đúng)
  const p: Pend = { th: 0.4, om: 0 };
  assert.ok(near(pendAmp(p, 2), 0.4, 1e-9));
});

// ───────────── khúc xạ + lăng kính ─────────────
test("Snell: n₁ sin θ₁ = n₂ sin θ₂; quá góc tới hạn thì phản xạ toàn phần", () => {
  const n = 1.5;
  for (const deg of [0, 10, 30, 60, 85]) {
    const a = (deg * Math.PI) / 180;
    const d = { x: Math.sin(a), z: -Math.cos(a) };
    const t = refract2(d, { x: 0, z: 1 }, 1, n)!;
    assert.ok(near(Math.sin(a), n * Math.abs(t.x), 1e-9));
  }
  const c = criticalAngle(n);
  assert.ok(near(c, 41.81, 0.01));
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return refract2({ x: Math.sin(a), z: -Math.cos(a) }, { x: 0, z: 1 }, n, 1);
  };
  assert.ok(at(c - 0.5) !== null);
  assert.equal(at(c + 0.5), null);
});

test("lăng kính đều: góc lệch nhỏ nhất đúng công thức δ = 2·asin(n·sin 30°) − 60°", () => {
  const n = GLASS_N.g;
  let best = Infinity;
  for (let r = 0; r < Math.PI * 2; r += 0.0005) {
    const tr = traceGlass({ x: -3, z: 0 }, { x: 1, z: 0 }, prismPoly(0, 0, 1.2, r), n);
    if (!tr.hitPrism || tr.tir) continue;
    best = Math.min(best, Math.abs(deviation({ x: 1, z: 0 }, tr.dir)));
  }
  const expect = 2 * ((Math.asin(n * 0.5) * 180) / Math.PI) - 60;
  assert.ok(Math.abs(best - expect) < 0.05, `${best} vs ${expect}`);
  // tím lệch nhiều hơn đỏ (tán sắc)
  const dev = (nn: number) => deviation({ x: 1, z: 0 }, traceGlass({ x: -3, z: 0 }, { x: 1, z: 0 }, prismPoly(0, 0, 1.2, (75 * Math.PI) / 180), nn).dir);
  assert.ok(Math.abs(dev(GLASS_N.b)) > Math.abs(dev(GLASS_N.r)));
});

test("Hải đăng: bắn thẳng không trúng; xoay lăng kính có ≥ 2 nấc trúng tinh thể A; tinh thể B CHỈ sáng nhờ phản xạ toàn phần", () => {
  assert.equal(straightHits(), false);
  const hitsA: number[] = [];
  const hitsB: number[] = [];
  for (let s = 0; s < PRISM_STEPS; s++) {
    const tr = prismTrace(s);
    assert.ok(tr.hitPrism, `nấc ${s}: tia luôn đi vào lăng kính`);
    const h = prismTarget(s);
    if (h === "A") hitsA.push(s);
    if (h === "B") {
      hitsB.push(s);
      assert.ok(tr.tir >= 1, `nấc ${s}`);
    }
  }
  // hai góc tới khác nhau cho cùng góc lệch (như hai góc bắn của Cung Parabol)
  const angles = new Set(hitsA.map((s) => Math.round(prismTrace(s).inAngle)));
  assert.ok(angles.size >= 2, `A: ${hitsA.join(",")}`);
  assert.ok(hitsA.length <= PRISM_STEPS / 4, "không phải nấc nào cũng trúng");
  assert.ok(hitsB.length >= 1, "B");
  // nấc đầu chưa giải sẵn
  assert.equal(prismTarget(0), null);
  // mọi thứ đứng trên mặt đảo phẳng
  for (const p of [EMITTER, PRISM, CRYSTAL_A, CRYSTAL_B]) assert.ok(Math.hypot(p.x - ISLE.x, p.z - ISLE.z) < ISLE.flat);
});

// ───────────── bố cục ─────────────
test("bố cục: các trạm bấm F đứng được (không bị chặn, không ngập), tiến trình đọc an toàn", () => {
  for (const [name, p] of Object.entries({ PORTAL, LEVER, WINCH, WEIGHTS, PUSH_SPOT, SPAWN, GROTTO, prismNorth: { x: PRISM.x, z: PRISM.z - 1.3 } })) {
    assert.ok(!coastBlocked(p.x, p.z), name);
    assert.ok(seaDepth(p.x, p.z, 0.8) < 0.05, name);
  }
  for (const [name, p] of Object.entries({ TIDE_STONE, LAGOON_STONE, BELL_STONE })) assert.ok(!coastBlocked(p.x + 1.1, p.z), name);
  for (const p of [WINCH, WEIGHTS, PUSH_SPOT]) assert.ok(p.x >= PONTOON.x0 - 1 && p.z >= PONTOON.z0 && p.z <= PONTOON.z1);
  assert.equal(coastGround(0, 21), PIER.top);
  assert.ok(coastGround(LEVER.x, LEVER.z) > LAGOON.water);
  assert.deepEqual(parseProgress(null), { islet: false, lit: false, tir: false, bell: false, lagoon: false });
  assert.deepEqual(parseProgress("{bad"), { islet: false, lit: false, tir: false, bell: false, lagoon: false });
  assert.equal(parseProgress('{"lit":true,"bell":1}').lit, true);
  assert.equal(parseProgress('{"lit":true,"bell":1}').bell, false);
});
