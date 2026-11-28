import { test } from "node:test";
import assert from "node:assert/strict";
import { TORUS_L, closedLineLength, delta, launchAngles, segAabb, segHitsCapsule, segSphere, simulateArrow, stepBallistic, tiles, torusDelta, torusDist, wrap, wrapShift, type Ballistic } from "@/lib/world/torus";
import {
  BELL_BOX,
  BELL_PARTS,
  BELL_Y0,
  BRIDGES,
  CORNER_STONE,
  ISLAND_BY_ID,
  PORTAL,
  SENTINEL,
  SPAWN,
  STONE,
  TREES,
  arrowVsBellBox,
  arrowVsSentinel,
  onLand,
  parseProgress,
  sentinelFacing,
  shieldBlocks,
  torusBlocked,
  torusGround,
  turnToward,
} from "@/lib/world/torusWorld";

const L = TORUS_L;
const G = 9.8;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test("quấn toạ độ: mọi số về [−L/2, L/2), mép phải ≡ mép trái, không có −0", () => {
  assert.equal(wrap(24), -24);
  assert.equal(wrap(-24), -24);
  assert.equal(wrap(23.9), 23.9);
  assert.ok(near(wrap(49), 1));
  assert.ok(near(wrap(-25), 23));
  assert.ok(near(wrap(24 + 3 * L), -24));
  assert.ok(Object.is(wrap(-48), 0));
  for (let v = -200; v < 200; v += 0.37) {
    const w = wrap(v);
    assert.ok(w >= -L / 2 && w < L / 2, `${v} → ${w}`);
    assert.ok(near(((v - w) / L) % 1, 0, 1e-9) || near(Math.abs(((v - w) / L) % 1), 1, 1e-9));
  }
});

test("khoảng cách ngắn nhất trên xuyến: hai điểm sát hai mép đối chỉ cách nhau 2 m, không bao giờ quá L/√2", () => {
  assert.ok(near(torusDist(23, 0, -23, 0), 2));
  assert.deepEqual(torusDelta(23, 0, -23, 0), { dx: 2, dz: 0 });
  assert.ok(near(torusDist(23, 23, -23, -23), Math.SQRT2 * 2));
  assert.ok(near(delta(-20, 20), -8));
  let max = 0;
  for (let i = 0; i < 400; i++) {
    const a = [Math.sin(i * 1.7) * 30, Math.cos(i * 2.3) * 30];
    const b = [Math.sin(i * 0.9) * 30, Math.cos(i * 3.1) * 30];
    const d = torusDist(a[0], a[1], b[0], b[1]);
    assert.ok(near(d, torusDist(b[0], b[1], a[0], a[1]), 1e-9), "đối xứng");
    max = Math.max(max, d);
  }
  assert.ok(max <= (L / 2) * Math.SQRT2 + 1e-9);
});

test("quấn người chơi: lượng dời đúng bằng ±L (máy quay dời theo cùng lượng → không giật)", () => {
  assert.deepEqual(wrapShift(24.05, 3), { sx: -L, sz: 0 });
  assert.deepEqual(wrapShift(-24.2, -24.1), { sx: L, sz: L });
  assert.deepEqual(wrapShift(5, -7), { sx: 0, sz: 0 });
  // đi đều về phía đông: vị trí liên tục và vị trí đã quấn luôn đồng dư mod L
  let x = 20;
  let unwrapped = 20;
  for (let i = 0; i < 200; i++) {
    x += 0.4;
    unwrapped += 0.4;
    x += wrapShift(x, 0).sx;
    assert.ok(near(wrap(unwrapped), x, 1e-9));
  }
});

test("lưới vẽ: 3×3 = 9 ô, ô gốc đứng đầu; 5×5 = 25 ô", () => {
  assert.equal(tiles(1).length, 9);
  assert.deepEqual(tiles(1)[0], [0, 0]);
  assert.equal(tiles(2).length, 25);
});

test("đạn đạo quấn mép trùng với bay thẳng trong mặt phẳng (mod L)", () => {
  const a: Ballistic = { x: 20, y: 2, z: -22, vx: 31, vy: 6, vz: -9 };
  const free = { ...a };
  let wraps = 0;
  for (let i = 0; i < 90; i++) {
    const s = stepBallistic(a, 1 / 60, G);
    if (s.sx || s.sz) wraps++;
    free.vy -= G / 60;
    free.x += free.vx / 60;
    free.y += free.vy / 60;
    free.z += free.vz / 60;
    assert.ok(near(a.x, wrap(free.x), 1e-6) && near(a.z, wrap(free.z), 1e-6) && near(a.y, free.y, 1e-9));
    assert.ok(a.x >= -L / 2 && a.x < L / 2 && a.z >= -L / 2 && a.z < L / 2);
  }
  assert.ok(wraps >= 2, "đi qua cả mép dọc lẫn mép ngang");
});

test("hai góc ném cùng trúng (Arc Bow): đối xứng quanh 45° khi cùng độ cao, quá tầm thì vô nghiệm", () => {
  const v = 34;
  const ang = launchAngles(L, 0, v, G)!;
  assert.ok(ang);
  assert.ok(near(ang[0] + ang[1], Math.PI / 2, 1e-9));
  assert.equal(launchAngles((v * v) / G + 1, 0, v, G), null);
});

test("à há: bắn thẳng ra trước, sau một vòng L mũi tên trúng lưng chính mình", () => {
  const P = { x: 3, z: -2, y: 0 };
  const v = 34;
  const from: Ballistic = { x: P.x + 0.6, y: P.y + 1.4, z: P.z, vx: 0, vy: 0, vz: 0 };
  // góc thấp để về đúng ngang ngực (1,1 m) sau quãng L − 0,6
  const [lo] = launchAngles(L - 0.6, 1.1 - 1.4, v, G)!;
  from.vx = v * Math.cos(lo);
  from.vy = v * Math.sin(lo);
  let flown = 0;
  const r = simulateArrow(from, {
    g: G,
    dt: 1 / 120,
    maxT: 3,
    ground: () => -60,
    hit: (ax, ay, az, bx, by, bz) => {
      flown += Math.hypot(bx - ax, bz - az);
      return flown > 3 && segHitsCapsule(ax, ay, az, bx, by, bz, P.x, P.z, P.y + 0.2, P.y + 1.75, 0.45);
    },
  });
  assert.equal(r.end, "hit");
  assert.equal(r.wraps, 1);
  assert.ok(r.dist > L - 2 && r.dist < L + 1, `bay ${r.dist.toFixed(1)} m`);
  // trúng từ phía SAU: lúc chạm, mũi tên đang bay cùng hướng mặt người chơi (+x)
  assert.ok(from.vx > 0);
});

test("va chạm đoạn thẳng: hộp, cầu, thân người sát mép (ảnh gần nhất)", () => {
  const box = { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] };
  assert.ok(near(segAabb(-1, 0.5, 0.5, 2, 0.5, 0.5, box)!, 1 / 3));
  assert.equal(segAabb(-1, 2, 0.5, 2, 2, 0.5, box), null);
  assert.ok(near(segSphere(-2, 0, 0, 2, 0, 0, 0, 0, 0, 1)!, 0.25));
  assert.equal(segSphere(-2, 3, 0, 2, 3, 0, 0, 0, 0, 1), null);
  // người đứng ở x = 23,8; mũi tên bay ở phía bên kia mép (x ≈ −24) vẫn trúng
  assert.ok(segHitsCapsule(-23.2, 1, 0, -24.4, 1, 0, 23.8, 0, 0, 2, 0.45));
  assert.ok(!segHitsCapsule(-23.2, 3, 0, -24.4, 3, 0, 23.8, 0, 0, 2, 0.45));
});

test("đường thẳng hướng nguyên (p, q) trên xuyến khép lại sau L·√(p²+q²)/gcd", () => {
  assert.equal(closedLineLength(1, 0), L);
  assert.ok(near(closedLineLength(1, 1), L * Math.SQRT2));
  assert.ok(near(closedLineLength(2, 1), L * Math.sqrt(5)));
  assert.ok(near(closedLineLength(2, 2), L * Math.SQRT2));
});

// ───────────── Bố cục + câu đố ─────────────

test("điểm xuất hiện, Bia Xuyến, cổng về, bia Bốn Góc đều trên đất; chỗ xuất hiện không bị chặn", () => {
  for (const p of [SPAWN, STONE, PORTAL]) assert.ok(onLand(p.x, p.z, false));
  assert.ok(onLand(CORNER_STONE.x, CORNER_STONE.z, false));
  assert.ok(!torusBlocked(SPAWN.x, SPAWN.z, false));
  assert.ok(!torusBlocked(PORTAL.x, PORTAL.z, false));
});

test("đảo vắt qua mép: hai nửa ở hai mép đối của ô là CÙNG một hòn đảo", () => {
  // Đảo Mép Đông–Tây tâm (24, 6): điểm x = 23 và x = −23 đều trên đảo, cùng độ cao với ảnh của nó
  assert.ok(onLand(23, 6, false) && onLand(-23, 6, false));
  assert.ok(near(torusGround(25, 6, false), torusGround(-23, 6, false)));
  // Đảo Bốn Góc: cả bốn góc ô
  for (const [x, z] of [
    [23.5, 23.5],
    [-23.5, 23.5],
    [23.5, -23.5],
    [-23.5, -23.5],
  ])
    assert.ok(onLand(x, z, false), `${x},${z}`);
});

test("đi mãi về phía đông theo cầu là vòng về Đảo Neo từ phía tây; về phía bắc thì vòng về từ phía nam", () => {
  const walk = (pts: [number, number][]) => {
    for (let k = 0; k < pts.length - 1; k++)
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t;
        const z = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
        assert.ok(onLand(x, z, false), `rơi ở (${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
  };
  const ce = BRIDGES.find((b) => b.id === "ce")!;
  const ec = BRIDGES.find((b) => b.id === "ec")!;
  // toạ độ liên tục (không quấn): đi từ tâm Đảo Neo qua cầu, qua đảo mép, qua mép x = 24, qua cầu thứ hai, về Đảo Neo (≡ tâm + L)
  walk([
    [0, 2.5],
    [ce.ax, ce.az],
    [ce.bx, ce.bz],
    [24, 6],
    [ec.ax + L, ec.az],
    [ec.bx + L, ec.bz],
    [L, 2.5],
  ]);
  const cn = BRIDGES.find((b) => b.id === "cn")!;
  const nc = BRIDGES.find((b) => b.id === "nc")!;
  walk([
    [-2.5, 0],
    [cn.ax, cn.az],
    [cn.bx, cn.bz],
    [-4, -24],
    [nc.ax, nc.az - L],
    [nc.bx, nc.bz - L],
    [-2.5, -L],
  ]);
});

/** các ô đất đi tới được từ chỗ xuất hiện (bước 0,5 m; cho phép nhảy qua khe ≤ 5,5 m) */
function reachable(lit: boolean): Set<string> {
  const S = 0.5;
  const N = L / S;
  const key = (i: number, j: number) => `${((i % N) + N) % N},${((j % N) + N) % N}`;
  const land = (i: number, j: number) => onLand(-L / 2 + i * S, -L / 2 + j * S, lit);
  const start: [number, number] = [Math.round((SPAWN.x + L / 2) / S), Math.round((SPAWN.z + L / 2) / S)];
  const seen = new Set([key(...start)]);
  const q = [start];
  const J = 11; // bước nhảy tối đa 5,5 m (chạy 7 m/s × 0,67 s bay ≈ 4,7 m)
  while (q.length) {
    const [i, j] = q.pop()!;
    for (let di = -J; di <= J; di++)
      for (let dj = -J; dj <= J; dj++) {
        if (di * di + dj * dj > J * J) continue;
        const ni = (((i + di) % N) + N) % N;
        const nj = (((j + dj) % N) + N) % N;
        const k = key(ni, nj);
        if (seen.has(k) || !land(ni, nj)) continue;
        seen.add(k);
        q.push([ni, nj]);
      }
  }
  return seen;
}

test("cổng tri thức: Đảo Bốn Góc KHÔNG tới được (kể cả nhảy 5,5 m) cho tới khi rung Chuông; sau đó có cầu sáng", () => {
  const S = 0.5;
  const corner = (r: Set<string>) => {
    // ô bất kỳ trong bán kính 2 m quanh tâm Đảo Bốn Góc
    for (const k of r) {
      const [i, j] = k.split(",").map(Number);
      if (torusDist(-L / 2 + i * S, -L / 2 + j * S, 24, 24) < 2) return true;
    }
    return false;
  };
  assert.ok(!corner(reachable(false)), "chưa rung Chuông mà đã tới được Đảo Bốn Góc");
  assert.ok(corner(reachable(true)), "đã rung Chuông mà không tới được");
  // các đảo khác đều tới được ngay từ đầu
  const r0 = reachable(false);
  const has = (x: number, z: number) => {
    const i = Math.round((wrap(x) + L / 2) / S) % (L / S);
    const j = Math.round((wrap(z) + L / 2) / S) % (L / S);
    return r0.has(`${i},${j}`);
  };
  assert.ok(has(24, 6) && has(-4, 24) && has(-9, -5));
});

test("Hộp Chuông: bắn thẳng vào từ phía tây chỉ trúng vách; quay lưng bắn về phía tây thì vòng qua mép chui vào miệng hộp", () => {
  const v = 34;
  const shoot = (x: number, z: number, dirX: number, angle: number) => {
    const y0 = torusGround(x, z, false);
    const from: Ballistic = { x: x + dirX * 0.6, y: y0 + 1.4, z, vx: dirX * v * Math.cos(angle), vy: v * Math.sin(angle), vz: 0 };
    let res: "bell" | "wall" | null = null;
    simulateArrow(from, {
      g: G,
      dt: 1 / 120,
      maxT: 3,
      ground: (gx, gz) => torusGround(gx, gz, false),
      hit: (ax, ay, az, bx, by, bz) => (res = arrowVsBellBox(ax, ay, az, bx, by, bz)) !== null,
    });
    return res;
  };
  const z = BELL_BOX.z;
  // chỗ đứng ở mép tây Đảo Neo trên Hàng Chuông
  const westX = -8.6;
  assert.ok(onLand(westX, z, false));
  // bắn thẳng về phía đông, nhiều góc → luôn chạm vách tây của hộp (hoặc rơi)
  for (let a = -0.05; a <= 0.12; a += 0.01) assert.notEqual(shoot(westX, z, 1, a), "bell");
  assert.equal(shoot(westX, z, 1, 0.02), "wall");
  // quay lưng bắn về phía tây: góc thấp hợp lý → chuông
  const d = westX - -L / 2 + (L / 2 - BELL_BOX.open) + 2.6;
  const dy = BELL_Y0 + 1.3 - (torusGround(westX, z, false) + 1.4);
  const [lo] = launchAngles(d, dy, v, G)!;
  assert.equal(shoot(westX, z, -1, lo), "bell");
});

test("Hộp Chuông: không có chỗ đứng nào trước miệng hộp để bắn thẳng vào (nêm 22° phía đông toàn biển mây)", () => {
  const tan = Math.tan((22 * Math.PI) / 180);
  for (let x = BELL_BOX.open + 0.2; x < BELL_BOX.open + 16; x += 0.25)
    for (let z = -14; z <= 4; z += 0.25) {
      if (Math.abs(z - BELL_BOX.z) > (x - BELL_BOX.open) * tan + BELL_BOX.half) continue;
      assert.ok(!onLand(x, z, true), `có đất ở (${x}, ${z})`);
    }
  // hộp đứng trên mũi đá: đáy lòng hộp trên đất, miệng chìa ra biển mây
  assert.ok(onLand(BELL_BOX.back + 0.3, BELL_BOX.z, false));
  assert.ok(BELL_PARTS.inside.max[0] === BELL_BOX.open);
  // lối vào chuông hẹp: từ mép miệng hộp, góc lệch lớn nhất tới pha lê < 22°
  const dz = BELL_BOX.half + BELL_BOX.bell.half;
  const dx = BELL_BOX.open - (BELL_BOX.back + BELL_BOX.bell.depth);
  assert.ok(Math.atan2(dz, dx) < (22 * Math.PI) / 180);
  // mũi tên lao chéo 35° vào miệng hộp: chạm vách chứ không tới chuông
  const a = (35 * Math.PI) / 180;
  const ex = BELL_BOX.open + 3 * Math.cos(a);
  const ez = BELL_BOX.z + 0.3 + 3 * Math.sin(a);
  assert.equal(arrowVsBellBox(ex, BELL_Y0 + 1.3, ez, BELL_BOX.back - 1, BELL_Y0 + 1.3, ez - (ex - BELL_BOX.back + 1) * Math.tan(a)), "wall");
  // người chơi không đi xuyên hộp
  assert.ok(torusBlocked((BELL_BOX.back + BELL_BOX.open) / 2, BELL_BOX.z, false));
});

test("mọi cây đứng trên đất, không chắn chỗ xuất hiện / máy quay sau lưng lúc mới vào", () => {
  for (const t of TREES) assert.ok(onLand(t.x, t.z, false), `cây ${t.x},${t.z} lơ lửng`);
  // máy quay mặc định nằm sau lưng chỗ xuất hiện ~4,6 m (nhìn về bắc) — không được chui vào tán cây
  for (const t of TREES) assert.ok(torusDist(t.x, t.z, SPAWN.x, SPAWN.z + 4.6) > 2.2, `cây ${t.x},${t.z} che máy quay`);
});

test("Hàng Chuông thông thoáng: không cây nào chắn đường bay quanh xuyến của dòng z = −5", () => {
  for (const t of TREES) assert.ok(Math.abs(wrap(t.z) - BELL_BOX.z) > 2.3 || Math.abs(wrap(t.x)) > 12, `cây ${t.x},${t.z}`);
  // các đảo khác không chạm dòng z = −5 (mũi tên vòng qua mép không đâm vào đất)
  for (let x = -24; x < 24; x += 0.25) {
    if (Math.abs(x) < 12) continue;
    assert.ok(!onLand(x, BELL_BOX.z, true), `đất ở x = ${x}`);
  }
});

test("Mắt Canh: khiên quay theo vectơ NGẮN NHẤT; bắn thẳng bị chặn, mũi tên vòng qua mép trúng lưng", () => {
  // người chơi đứng ngay bên kia mép x (−23 ≡ 25): Mắt Canh ở (24, 24) nhìn sang +x chứ không nhìn ngược 47 m về −x
  const f = sentinelFacing(-23, 24);
  assert.ok(near(f.x, 1) && near(f.z, 0));
  // đứng trên cầu sáng phía bắc (z = 15,5): nó nhìn về −z
  const P = { x: 24, z: 15.5 };
  const g = sentinelFacing(P.x, P.z);
  assert.ok(near(g.z, -1) && near(g.x, 0));
  assert.ok(shieldBlocks(g.x, g.z, 0, 1), "bắn thẳng (+z) vào mặt → chặn");
  assert.ok(!shieldBlocks(g.x, g.z, 0, -1), "bay theo hướng nó nhìn (tới từ sau lưng) → trúng");
  assert.ok(!shieldBlocks(g.x, g.z, 1, 0), "tới từ bên hông → trúng");
  // mô phỏng: quay lưng (bắn −z) từ cầu sáng → mũi tên vòng qua mép z, chạm thân nó
  const y0 = torusGround(P.x, P.z, true);
  const yS = ISLAND_BY_ID.corner.top + ISLAND_BY_ID.corner.dome;
  const v = 34;
  const [lo] = launchAngles(L - (24 - P.z) - 0.6 - 0.4, yS + SENTINEL.cy - (y0 + 1.4), v, G)!;
  let hitVz = 0;
  const r = simulateArrow(
    { x: P.x, y: y0 + 1.4, z: P.z - 0.6, vx: 0, vy: v * Math.sin(lo), vz: -v * Math.cos(lo) },
    {
      g: G,
      dt: 1 / 120,
      maxT: 3,
      ground: (x, z) => torusGround(x, z, true),
      hit: (ax, ay, az, bx, by, bz) => {
        const t = arrowVsSentinel(ax, ay, az, bx, by, bz, yS);
        if (t !== null) hitVz = bz - az;
        return t !== null;
      },
    },
  );
  assert.equal(r.end, "hit");
  // đi đường dài quanh xuyến (> 30 m) thay vì 8,5 m thẳng mặt; Mắt Canh đứng đúng góc ô nên chạm nó ngay tại mép
  assert.ok(r.dist > 30, `bay ${r.dist.toFixed(1)} m`);
  assert.ok(!shieldBlocks(g.x, g.z, 0, hitVz), "tới từ sau lưng");
});

test("cầu năng lượng của Mắt Canh: bắn trượt người chơi thì bay hết một vòng L và trúng lưng chính nó", () => {
  const yS = ISLAND_BY_ID.corner.top + ISLAND_BY_ID.corner.dome;
  const f = { x: 0, z: -1 };
  // bắn ở độ cao ngực người chơi đứng trên cầu sáng (thấp hơn mặt Đảo Bốn Góc) — vẫn chạm thân nó khi vòng về
  const o: Ballistic = { x: SENTINEL.x + f.x * 1.3, y: yS + SENTINEL.body.y0 + 0.4, z: SENTINEL.z + f.z * 1.3, vx: f.x * SENTINEL.orbSpeed, vy: 0, vz: f.z * SENTINEL.orbSpeed };
  let age = 0;
  const r = simulateArrow(o, {
    g: 0,
    dt: 1 / 60,
    maxT: SENTINEL.orbLife,
    hit: (ax, ay, az, bx, by, bz) => {
      age += 1 / 60;
      return age > 1 && arrowVsSentinel(ax, ay, az, bx, by, bz, yS) !== null;
    },
  });
  assert.equal(r.end, "hit");
  assert.ok(age < SENTINEL.orbLife && age > (L - 4) / SENTINEL.orbSpeed);
});

test("hồi quy: đứng yên trên cầu sáng KHÔNG thắng được — cầu bay ngang ngực người chơi nên trúng bạn trước khi vòng về", () => {
  const P = { x: 24, z: 15.2 };
  const py = torusGround(P.x, P.z, true);
  const yS = ISLAND_BY_ID.corner.top + ISLAND_BY_ID.corner.dome;
  const chest = Math.min(yS + SENTINEL.body.y1 - 0.3, Math.max(yS + SENTINEL.body.y0 + 0.3, py + 1.15));
  const f = sentinelFacing(P.x, P.z);
  let hitMe = false;
  simulateArrow(
    { x: SENTINEL.x + f.x * 1.5, y: chest, z: SENTINEL.z + f.z * 1.5, vx: f.x * SENTINEL.orbSpeed, vy: 0, vz: f.z * SENTINEL.orbSpeed },
    {
      g: 0,
      dt: 1 / 60,
      maxT: SENTINEL.orbLife,
      hit: (ax, ay, az, bx, by, bz) => (hitMe = segHitsCapsule(ax, ay, az, bx, by, bz, P.x, P.z, py + 0.1, py + 1.8, 0.5)),
    },
  );
  assert.ok(hitMe);
});

test("Mắt Canh xoay khiên có giới hạn tốc độ", () => {
  let yaw = 0;
  yaw = turnToward(yaw, 1, 0, 0.1);
  assert.ok(near(yaw, SENTINEL.turn * 0.1));
  for (let i = 0; i < 40; i++) yaw = turnToward(yaw, 1, 0, 0.1);
  assert.ok(near(yaw, Math.PI / 2, 1e-6));
});

test("tiến trình đọc từ localStorage an toàn", () => {
  assert.deepEqual(parseProgress(null), { crossed: false, selfHit: false, bell: false, warden: false });
  assert.deepEqual(parseProgress("{oops"), { crossed: false, selfHit: false, bell: false, warden: false });
  assert.deepEqual(parseProgress('{"bell":true,"warden":"yes"}'), { crossed: false, selfHit: false, bell: true, warden: false });
});

test("cổng Quần đảo Xuyến ở Quảng trường: chỗ đứng đi tới được, khung ngoài lan can, quay vào tâm, không đè cổng / cửa khác", async () => {
  const { INTERACT, TORUS_DOOR, STUDY_DOOR, VAULT_DOOR, GATES, HUB_WALK_R, hubBlocked } = await import("@/lib/world/hubLayout");
  assert.ok(!hubBlocked(TORUS_DOOR.x, TORUS_DOOR.z));
  assert.deepEqual(INTERACT.torus, { x: TORUS_DOOR.x, z: TORUS_DOOR.z });
  assert.ok(Math.hypot(TORUS_DOOR.dx, TORUS_DOOR.dz) > HUB_WALK_R);
  const fx = Math.sin(TORUS_DOOR.yaw);
  const fz = Math.cos(TORUS_DOOR.yaw);
  assert.ok(fx * -TORUS_DOOR.dx + fz * -TORUS_DOOR.dz > 0.99 * Math.hypot(TORUS_DOOR.dx, TORUS_DOOR.dz));
  for (const d of [STUDY_DOOR, VAULT_DOOR]) assert.ok(Math.hypot(d.x - TORUS_DOOR.x, d.z - TORUS_DOOR.z) > 8);
  for (const g of GATES) assert.ok(Math.hypot(g.x - TORUS_DOOR.x, g.z - TORUS_DOOR.z) > g.r + 4, g.id);
});
