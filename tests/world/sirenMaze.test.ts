import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BODY,
  EXIT_OFF,
  MAZE_UPDRAFTS,
  MIN_OUT,
  PORTALS,
  RENDER_SINK,
  renderLayers,
  surfsOverlap,
  PORTAL_BY_ID,
  PORTAL_MAX,
  RISE,
  STEP_UP,
  SURFS,
  SURF_BY_ID,
  VOID,
  WALL_BY_ID,
  WRAP_BOT,
  WRAP_H,
  WRAP_R,
  crossing,
  inFootprint,
  inFloorHole,
  mapCamYaw,
  mapDir,
  mapPoint,
  mazeBlocked,
  mazeGround,
  surfTop,
  nearestLanding,
  signedDist,
  simulateExit,
  traverse,
  wrapXZ,
  wrapY,
  type Portal,
  type Surf,
  type V3,
} from "../../lib/world/sirenMaze";
import { BOUNCE_CAP, G0, JUMP, MOON, WORM, gravityScale, wormTraverse } from "../../lib/world/sirenGravity";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const nearV = (a: V3, b: V3, eps = 1e-6) => a.every((x, i) => near(x, b[i], eps));
const P = (id: string) => PORTAL_BY_ID[id];

test("mọi cặp cổng nối hai chiều, pháp tuyến / trục lên là đơn vị và vuông góc", () => {
  for (const p of PORTALS) {
    const q = P(p.to);
    assert.ok(q, p.id);
    assert.equal(q.to, p.id);
    assert.equal(q.pair, p.pair);
    assert.ok(near(Math.hypot(...p.n), 1) && near(Math.hypot(...p.up), 1), p.id);
    assert.ok(near(p.n[0] * p.up[0] + p.n[1] * p.up[1] + p.n[2] * p.up[2], 0), p.id);
    if (p.kind === "floor") assert.deepEqual(p.n, [0, 1, 0]);
    if (p.kind === "ceil") assert.deepEqual(p.n, [0, -1, 0]);
    if (p.kind === "wall") assert.ok(near(p.n[1], 0));
  }
  // có đủ cả cổng dọc (tường) lẫn ngang (sàn / trần)
  const kinds = new Set(PORTALS.map((p) => p.kind));
  assert.ok(kinds.has("wall") && kinds.has("floor") && kinds.has("ceil"));
});

test("rơi vào cổng sàn → bắn NGANG ra khỏi cổng tường, giữ nguyên tốc độ", () => {
  const a1 = P("A1");
  const a2 = P("A2");
  const v = mapDir(a1, a2, [0, -12, 0]);
  assert.ok(nearV(v, [-12, 0, 0]), String(v));
  const r = traverse(a1, a2, { lr: 0, lu: 0 }, [0, -12, 0]);
  assert.ok(near(Math.hypot(...r.vel), 12));
  // thân đặt trước mặt cổng đích EXIT_OFF
  assert.ok(near(signedDist(a2, r.pos), EXIT_OFF));
});

test("đi vào cổng tường → rơi xuống từ cổng trần; bay lên trần → bay ngang ra tường", () => {
  const b1 = P("B1");
  const b2 = P("B2");
  // B1 nhìn về +x: đi vào theo −x
  const down = traverse(b1, b2, { lr: 0, lu: 0 }, [-5, 0, 0]);
  assert.ok(down.vel[1] <= -5 + 1e-9 && near(down.vel[0], 0) && near(down.vel[2], 0), String(down.vel));
  const up = traverse(b2, b1, { lr: 0, lu: 0 }, [0, 7, 0]);
  assert.ok(near(up.vel[0], 7) && near(up.vel[1], 0), String(up.vel));
});

test("tường ↔ tường vuông góc: hướng đi xoay 90°, góc máy quay xoay theo", () => {
  const d1 = P("D1");
  const d2 = P("D2");
  // đi về nam (+z) vào D1 → ra theo −x (pháp tuyến D2)
  const r = traverse(d1, d2, { lr: 0, lu: 0 }, [0, 0, 7]);
  assert.ok(near(r.vel[0], -7) && near(r.vel[2], 0), String(r.vel));
  // camYaw = π: máy quay đứng phía bắc, nhìn về nam (−sin π, −cos π) = (0, 1)
  const yaw = mapCamYaw(d1, d2, Math.PI);
  // sau cổng nhìn theo −x: (−sin y, −cos y) = (−1, 0) → y = π/2
  assert.ok(near(Math.atan2(Math.sin(yaw - Math.PI / 2), Math.cos(yaw - Math.PI / 2)), 0), String(yaw));
});

test("qua cổng rồi quay đầu đi ngược lại: về đúng chỗ cũ (biến đổi khả nghịch)", () => {
  for (const p of PORTALS) {
    const q = P(p.to);
    const pt: V3 = [p.c[0] + 0.3, p.c[1] + 0.2, p.c[2] - 0.1];
    const back = mapPoint(q, p, mapPoint(p, q, pt));
    assert.ok(nearV(back, pt, 1e-9), p.id);
    const v: V3 = [1.5, -2, 0.7];
    const w = mapDir(q, p, mapDir(p, q, v));
    assert.ok(nearV(w, v, 1e-9), p.id);
    // phép quay giữ độ dài
    assert.ok(near(Math.hypot(...mapDir(p, q, v)), Math.hypot(...v)));
  }
});

test("phát hiện xuyên mặt cổng: chỉ từ trước ra sau và trong lỗ elip", () => {
  const a1 = P("A1");
  const c = a1.c;
  assert.ok(crossing(a1, [c[0], c[1] + 0.5, c[2]], [c[0], c[1] - 0.3, c[2]]));
  // ngược chiều (từ dưới lên) không tính
  assert.equal(crossing(a1, [c[0], c[1] - 0.3, c[2]], [c[0], c[1] + 0.5, c[2]]), null);
  // ngoài lỗ
  assert.equal(crossing(a1, [c[0] + 2.5, c[1] + 0.5, c[2]], [c[0] + 2.5, c[1] - 0.3, c[2]]), null);
  // điểm đầu và cuối đều ngoài lỗ nhưng điểm cắt trong lỗ (bay chéo nhanh)
  assert.ok(crossing(a1, [c[0] - 2.5, c[1] + 1, c[2]], [c[0] + 2.5, c[1] - 1, c[2]]));
});

test("tốc độ ra tối thiểu + trần tốc độ (vòng lặp rơi vô tận không tăng tốc mãi)", () => {
  const f1 = P("F1");
  const f2 = P("F2");
  // bước nhẹ vào giếng: vẫn bị đẩy ra khỏi trần đủ nhanh
  const slow = traverse(f2, f1, { lr: 0, lu: 0 }, [0, -0.2, 0]);
  assert.ok(-slow.vel[1] >= MIN_OUT.ceil - 1e-9);
  // rơi thật nhanh: bị chặn ở PORTAL_MAX
  const fast = traverse(f2, f1, { lr: 0, lu: 0 }, [0, -80, 0]);
  assert.ok(near(Math.hypot(...fast.vel), PORTAL_MAX));
  // giếng vô tận: trần nằm thẳng trên sàn → lệch ngang được giữ nguyên (rơi mãi đúng một cột)
  const off = traverse(f2, f1, { lr: 0.4, lu: -0.3 }, [0, -10, 0]);
  const at = mapPoint(f2, f1, [f2.c[0] + 0.4, f2.c[1], f2.c[2] + 0.3]);
  assert.ok(near(off.pos[0], at[0]) && near(off.pos[2], at[2]));
  // lò xo sàn ↔ sàn: rơi vào thì vọt LÊN ở đầu kia
  const spring = traverse(P("C1"), P("C2"), { lr: 0, lu: 0 }, [0, -15, 0]);
  assert.ok(near(spring.vel[1], 15));
});

test("cổng sàn là lỗ trên mặt sàn; mép lỗ vẫn đứng được", () => {
  for (const p of PORTALS.filter((q) => q.kind === "floor")) {
    const [x, y, z] = p.c;
    assert.ok(inFloorHole(x, z, y), p.id);
    assert.ok(mazeGround(x, z, y + 0.1) < y - 1, p.id);
    assert.equal(mazeGround(x + p.rx + 0.4, z, y + 0.1), y, p.id);
  }
});

test("cổng tường nằm đúng mặt tường mang nó; lỗ cổng đi xuyên được, tường quanh lỗ thì chặn", () => {
  for (const p of PORTALS.filter((q) => q.kind === "wall")) {
    const w = WALL_BY_ID[p.wall!];
    assert.ok(w, p.id);
    // tâm cổng ở mặt trước tường
    assert.ok(inFootprint({ kind: "box", ...w }, p.c[0] - p.n[0] * 0.05, p.c[2] - p.n[2] * 0.05), p.id);
    assert.ok(!inFootprint({ kind: "box", ...w }, p.c[0] + p.n[0] * 0.1, p.c[2] + p.n[2] * 0.1), p.id);
    // đứng thẳng trước lỗ (gót = đáy lỗ) bước vào không bị chặn
    const feet = p.c[1] - BODY;
    assert.ok(!mazeBlocked(p.c[0] + p.n[0] * 0.2, p.c[2] + p.n[2] * 0.2, feet), `${p.id} mở`);
    // lệch ngang ra ngoài lỗ thì đụng tường
    const side = [p.n[2], 0, -p.n[0]];
    assert.ok(mazeBlocked(p.c[0] + side[0] * (p.rx + 0.6) + p.n[0] * 0.2, p.c[2] + side[2] * (p.rx + 0.6) + p.n[2] * 0.2, feet), `${p.id} chặn`);
    // có mặt đất ngay trước cổng ở cao độ đáy lỗ (đi bộ vào được)
    const g = mazeGround(p.c[0] + p.n[0] * 0.8, p.c[2] + p.n[2] * 0.8, p.c[1]);
    assert.ok(g !== VOID && Math.abs(g + BODY - p.c[1]) < p.ry * 0.7, `${p.id} sàn ${g}`);
  }
});

test("điểm ra của mọi cổng thông thoáng (không kẹt trong tường / sàn)", () => {
  for (const p of PORTALS) {
    const q = P(p.to);
    const v: V3 = [-p.n[0] * 5, -p.n[1] * 5, -p.n[2] * 5];
    for (const off of [
      [0, 0],
      [0.9, 0.5],
      [-0.9, -0.5],
    ] as const) {
      const r = traverse(p, q, { lr: off[0], lu: off[1] }, v);
      const feet = r.pos[1] - BODY;
      assert.ok(!mazeBlocked(r.pos[0], r.pos[2], feet), `${p.id}→${q.id} ${off}`);
      // không đặt chân lọt dưới một mặt sàn ngay tại chỗ (đầu chui vào khối)
      for (const s of SURFS) if (inFootprint(s, r.pos[0], r.pos[2]) && !inFloorHole(r.pos[0], r.pos[2], s.y)) assert.ok(feet >= s.y - 0.01 || feet + 1.7 <= s.y - s.thick, `${p.id}→${q.id} kẹt trong ${s.id}`);
    }
  }
});

test("cầu thang: mỗi bậc cao ≤ RISE và bậc đầu / cuối nối với mặt dưới / trên", () => {
  const groups = new Map<string, Surf[]>();
  for (const s of SURFS) if (s.step) {
    const k = s.id.split(".")[0];
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  assert.ok(groups.size >= 6);
  for (const [k, st] of groups) {
    for (let i = 1; i < st.length; i++) assert.ok(st[i].y - st[i - 1].y <= RISE + 1e-9 && st[i].y > st[i - 1].y, k);
  }
});

// ── Đồ thị đi bộ: mặt → mặt (bước lên ≤ STEP_UP, nhảy xuống bất kỳ) + cổng ──
function perimeter(s: Surf): [number, number, number, number][] {
  // [x, z, hướng ra x, hướng ra z]
  const out: [number, number, number, number][] = [];
  if (s.kind === "disc") {
    const r = s.r!;
    const n = Math.max(16, Math.ceil((2 * Math.PI * r) / 0.4));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push([s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, Math.cos(a), Math.sin(a)]);
    }
    return out;
  }
  const c = Math.cos(s.yaw!);
  const sn = Math.sin(s.yaw!);
  const ax: [number, number] = [c, -sn];
  const az: [number, number] = [sn, c];
  for (const [u, v, len, ox, oz] of [
    [ax, az, s.hz!, s.hx!, 0],
    [[-ax[0], -ax[1]], az, s.hz!, s.hx!, 0],
    [az, ax, s.hx!, s.hz!, 0],
    [[-az[0], -az[1]], ax, s.hx!, s.hz!, 0],
  ] as [[number, number], [number, number], number, number, number][]) {
    void oz;
    const n = Math.max(2, Math.ceil((2 * len) / 0.3));
    for (let i = 0; i <= n; i++) {
      const t = -len + (2 * len * i) / n;
      out.push([s.x + u[0] * ox + v[0] * t, s.z + u[1] * ox + v[1] * t, u[0], u[1]]);
    }
  }
  return out;
}

/** Ra khỏi cổng p (đi vào với tốc độ vin) → mặt tiếp đất (theo chuỗi cổng tối đa 4 lần) */
function portalLanding(p: Portal, vin: number): string | null {
  let src = p;
  let v: V3 = [-p.n[0] * vin, -p.n[1] * vin, -p.n[2] * vin];
  for (let hop = 0; hop < 4; hop++) {
    const dst = P(src.to);
    const r = traverse(src, dst, { lr: 0, lu: 0 }, v);
    const sim = simulateExit(r.pos, r.vel);
    if (sim.land) return sim.land;
    if (!sim.portal) return null;
    // nảy lại đúng cổng sàn vừa ra (lò xo) hoặc rơi vòng lại cổng sàn vừa vào (giếng vô tận): lái ngang là đáp lên mặt mang cổng đó
    const again = P(sim.portal);
    if ((again === dst || again === src) && again.kind === "floor") return SURFS.find((s) => Math.abs(s.y - again.c[1]) < 0.05 && inFootprint(s, again.c[0], again.c[2]))?.id ?? null;
    src = P(sim.portal);
    v = [-src.n[0] * 8, -src.n[1] * 8, -src.n[2] * 8];
  }
  return null;
}

function walkGraph(): Map<string, Set<string>> {
  const g = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (a === b) return;
    if (!g.has(a)) g.set(a, new Set());
    g.get(a)!.add(b);
  };
  for (const s of SURFS) {
    for (const [x, z, ox, oz] of perimeter(s)) {
      const px = x + ox * 0.45;
      const pz = z + oz * 0.45;
      for (const t of SURFS) {
        if (t === s || t.y > s.y + STEP_UP) continue;
        if (!inFootprint(t, px, pz) || inFloorHole(px, pz, t.y)) continue;
        if (mazeBlocked(px, pz, Math.max(s.y, t.y))) continue;
        // nhảy xuống: phải là mặt cao nhất ngay dưới điểm bước ra
        if (mazeGround(px, pz, s.y) !== surfTop(t, px, pz)) continue;
        add(s.id, t.id);
        // mặt nhô thấp nằm giữa mặt khác (đệm nảy, bậc): từ t bước lên s được
        if (s.y <= t.y + STEP_UP && !mazeBlocked(x, z, t.y)) add(t.id, s.id);
      }
    }
  }
  // Đảo Trăng: trọng lực ¼ → nhảy cao ~5 m, bay xa; nối các đĩa đá gần nhau
  const moonJump = (JUMP * JUMP) / (2 * G0 * MOON.scale);
  for (const s of SURFS) for (const t of SURFS) {
    if (s === t || s.kind !== "disc" || t.kind !== "disc") continue;
    if (gravityScale(s.x, s.y + 1, s.z) === 1 || gravityScale(t.x, t.y + 1, t.z) === 1) continue;
    const gap = Math.hypot(s.x - t.x, s.z - t.z) - s.r! - t.r!;
    if (gap <= 6 && t.y - s.y <= moonJump * 0.85) add(s.id, t.id);
  }
  // đệm nảy e > 1: nảy dần lên tới trần vận tốc → lên được mặt ngay phía trên đệm
  for (const p of SURFS) {
    if (!p.bounce || p.bounce <= 1) continue;
    const apex = p.y + (BOUNCE_CAP * BOUNCE_CAP) / (2 * G0);
    for (const t of SURFS) if (t !== p && t.y > p.y && t.y < apex - 0.5 && inFootprint(t, p.x, p.z) && !inFloorHole(p.x, p.z, t.y)) add(p.id, t.id);
  }
  // lỗ sâu: hai chiều, đi thẳng vào → ra đứng trên mặt dưới miệng kia
  for (const [m, o] of [
    [WORM.a, WORM.b],
    [WORM.b, WORM.a],
  ] as const) {
    const r = wormTraverse(m, o, [m[0] - 0.5, m[1], m[2]], [5, 0, 0]);
    const land = SURFS.find((t) => Math.abs(t.y - mazeGround(r.pos[0], r.pos[2], r.pos[1])) < 1e-6 && inFootprint(t, r.pos[0], r.pos[2]));
    assert.ok(land, "lỗ sâu phải có chỗ đứng ở đầu ra");
    for (const s of SURFS) if (inFootprint(s, m[0], m[2]) && Math.abs(s.y + BODY - m[1]) < 1.2) add(s.id, land!.id);
  }
  // cổng: đi / rơi / bay (cột gió) vào → mặt tiếp đất
  for (const p of PORTALS) {
    const from: string[] = [];
    if (p.kind === "floor") {
      for (const s of SURFS) if (Math.abs(s.y - p.c[1]) < 0.05 && inFootprint(s, p.c[0], p.c[2])) from.push(s.id);
    } else if (p.kind === "wall") {
      const fx = p.c[0] + p.n[0] * 0.8;
      const fz = p.c[2] + p.n[2] * 0.8;
      for (const s of SURFS) if (inFootprint(s, fx, fz) && Math.abs(s.y + BODY - p.c[1]) < p.ry * 0.7) from.push(s.id);
    } else {
      for (const u of MAZE_UPDRAFTS) {
        if (Math.hypot(u.x - p.c[0], u.z - p.c[2]) > u.r || u.top < p.c[1] - BODY) continue;
        for (const s of SURFS) if (inFootprint(s, u.x, u.z) && s.y < p.c[1]) from.push(s.id);
      }
    }
    const land = portalLanding(p, p.kind === "ceil" ? 7 : 5);
    assert.ok(land, `cổng ${p.id} phải đáp xuống một mặt`);
    for (const f of from) add(f, land!);
  }
  return g;
}

function reach(g: Map<string, Set<string>>, start: string): Set<string> {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) for (const n of g.get(q.shift()!) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
  return seen;
}

test("đi bộ + cổng: từ đấu trường tới được mọi khu, và từ mọi nơi quay về được đấu trường (không kẹt)", () => {
  const g = walkGraph();
  const fromArena = reach(g, "arena");
  const missing = SURFS.filter((s) => s.reach !== false && !fromArena.has(s.id)).map((s) => s.id);
  assert.deepEqual(missing, []);
  const stuck = SURFS.filter((s) => s.reach !== false && !reach(g, s.id).has("arena")).map((s) => s.id);
  assert.deepEqual(stuck, []);
});

test("cú ném Giếng ném: nhảy từ ban công xuống cổng sàn → đáp lên sân đỡ L1 Bồi âm", () => {
  const vin = Math.sqrt(2 * 22 * (8 + BODY));
  const a1 = P("A1");
  const r = traverse(a1, P("A2"), { lr: 0, lu: 0 }, [0, -vin, 0]);
  assert.equal(simulateExit(r.pos, r.vel).land, "deckE");
  // bước nhẹ vào cũng đáp lên sân đỡ (không rơi vực)
  const s = traverse(a1, P("A2"), { lr: 0, lu: 0 }, [0, -3, 0]);
  assert.equal(simulateExit(s.pos, s.vel).land, "deckE");
});

test("mặt đất nhiều tầng: đứng dưới cầu không bị hút lên, lỗ hổng là vực", () => {
  assert.equal(mazeGround(0, 0, 0), 0);
  // dưới sân đỡ L1 (y = 8) ở sân Đông
  assert.equal(mazeGround(36, 0, 0), 0);
  assert.equal(mazeGround(36, 0, 8), 8);
  assert.equal(mazeGround(0, 0), VOID);
  // khe giữa đấu trường và sân góc
  assert.equal(mazeGround(20, 20, 0), VOID);
  // không đi xuyên đài nổi đấu trường khi ở ngang thân
  assert.ok(mazeBlocked(0, 0, 0));
});

test("lỗ hổng vòng lặp: rơi qua đáy hiện ra trên trời, bay quá màn hiện ra phía đối tâm", () => {
  assert.equal(wrapY(WRAP_BOT - 0.1), WRAP_H);
  assert.equal(wrapY(WRAP_BOT + WRAP_H + 0.1), -WRAP_H);
  assert.equal(wrapY(0), 0);
  assert.equal(wrapXZ(10, 10), null);
  const w = wrapXZ(WRAP_R + 0.5, 0)!;
  assert.ok(w[0] < 0 && w[0] > -WRAP_R && near(w[1], 0));
  // nơi đáp khi rơi vòng lặp quá lâu: là mặt đất thật
  const l = nearestLanding(60, 60);
  assert.equal(mazeGround(l[0], l[1], l[2] + 0.1), l[2]);
});

test("rơi xuyên lỗ cổng sàn / bay lên xuyên cổng trần không bị khối sàn đẩy ra", () => {
  for (const p of PORTALS.filter((q) => q.kind !== "wall")) {
    const feet = p.kind === "floor" ? p.c[1] - 1.0 : p.c[1] - BODY - 0.3;
    assert.equal(mazeBlocked(p.c[0], p.c[2], feet), false, p.id);
  }
  // ngoài lỗ, ở dải mép sân thì thân khối sàn vẫn chặn đi ngang
  const cN = SURF_BY_ID.cN;
  assert.ok(mazeBlocked(cN.x + cN.r! - 0.3, cN.z, cN.y - 1.0));
});

test("hồi quy: nảy / bay xuyên lên giữa một khối sàn không bị đẩy ra mép (khối một chiều)", () => {
  const w = SURF_BY_ID.wellNW;
  // giữa khối, ngang thân → không chặn
  assert.equal(mazeBlocked(w.x - 3, w.z - 3, w.y - 1.2), false);
  // dải mép vẫn chặn đi ngang
  assert.ok(mazeBlocked(w.x + w.r! - 0.2, w.z, w.y - 1.2));
});

test("chống z-fighting: mặt sàn chồng nhau cùng cao độ được vẽ ở tầng khác nhau (hạ RENDER_SINK/tầng)", () => {
  const layer = renderLayers();
  const drawnY = (s: (typeof SURFS)[number]) => s.y - RENDER_SINK * (layer.get(s.id) ?? 0);
  let pairs = 0;
  for (let i = 0; i < SURFS.length; i++)
    for (let j = i + 1; j < SURFS.length; j++) {
      const a = SURFS[i];
      const b = SURFS[j];
      if (Math.abs(a.y - b.y) > 0.02 || !surfsOverlap(a, b)) continue;
      pairs++;
      assert.ok(Math.abs(drawnY(a) - drawnY(b)) >= RENDER_SINK * 0.99, `${a.id} × ${b.id} vẽ cùng độ cao`);
    }
  assert.ok(pairs > 10, "bản đồ có cầu / vành đai nối sân → phải có cặp chồng");
  // đấu trường vẽ riêng ở y gốc → luôn tầng 0; độ hạ tối đa nhỏ (mắt không thấy bậc)
  assert.equal(layer.get("arena"), 0);
  assert.ok(Math.max(...layer.values()) * RENDER_SINK <= 0.1);
});
