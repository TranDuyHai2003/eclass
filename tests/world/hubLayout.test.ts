import { test } from "node:test";
import assert from "node:assert/strict";
import { AXES, COLLIDERS, DUMMIES, FOUNTAINS, GATES, HUB_WALK_R, INTERACT, NPC, PLATFORM_H, POOL, PROPS, SPAWN, creatureSpot, hubBlocked, hubGround, isBed, pathDistance } from "../../lib/world/hubLayout";

/** BFS trên lưới 0,5 m từ điểm vào: điểm (x, z) có tới được không (đứng cạnh, trong 1,2 m) */
function reachable() {
  const S = 0.5;
  const N = Math.ceil((HUB_WALK_R * 2) / S);
  const idx = (i: number, j: number) => i * N + j;
  const ok = new Uint8Array(N * N);
  const seen = new Uint8Array(N * N);
  const X = (i: number) => -HUB_WALK_R + i * S;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) ok[idx(i, j)] = hubBlocked(X(i), X(j)) ? 0 : 1;
  const q: number[] = [];
  const si = Math.round((SPAWN.x + HUB_WALK_R) / S);
  const sj = Math.round((SPAWN.z + HUB_WALK_R) / S);
  q.push(idx(si, sj));
  seen[idx(si, sj)] = 1;
  while (q.length) {
    const c = q.pop()!;
    const i = Math.floor(c / N);
    const j = c % N;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const k = idx(a, b);
      if (!seen[k] && ok[k]) {
        seen[k] = 1;
        q.push(k);
      }
    }
  }
  return (x: number, z: number) => {
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) if (seen[idx(i, j)] && Math.hypot(X(i) - x, X(j) - z) < 1.2) return true;
    return false;
  };
}

test("điểm vào trống, mọi điểm tương tác / NPC / sinh vật / quái tập đều tới được", () => {
  assert.ok(!hubBlocked(SPAWN.x, SPAWN.z));
  const can = reachable();
  for (const [k, p] of Object.entries(INTERACT)) assert.ok(can(p.x, p.z), k);
  for (const [k, p] of Object.entries(NPC)) assert.ok(can(p.x, p.z), k);
  for (let i = 0; i < 5; i++) assert.ok(can(...creatureSpot(i)), `creature ${i}`);
  for (const d of DUMMIES) assert.ok(can(d[0], d[1]), `dummy ${d}`);
});

test("điểm tương tác không bị chặn và cách nhau ≥ 4 m (không tranh nhau nút F)", () => {
  const pts = Object.values(INTERACT);
  for (const p of pts) assert.ok(!hubBlocked(p.x, p.z), JSON.stringify(p));
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) >= 4);
});

test("lối đá toả tia thông suốt: tim đường không vướng cây / đèn / ghế", () => {
  for (const [ax, az] of AXES)
    for (let r = POOL.rim + 0.5; r < 26; r += 0.25) {
      const x = ax * r;
      const z = az * r;
      for (const c of COLLIDERS) assert.ok(Math.hypot(x - c.x, z - c.z) > c.r + 0.9, `(${x.toFixed(1)}, ${z.toFixed(1)})`);
    }
});

test("cây mọc trong bồn cỏ, không trên lối; đèn không trong bồn", () => {
  for (const p of PROPS) {
    if (p.kind === "tree" || p.kind === "blossom") {
      assert.ok(isBed(p.x, p.z), `${p.kind} ${p.x},${p.z}`);
      assert.ok(pathDistance(p.x, p.z) > 4);
    }
  }
  assert.ok(PROPS.filter((p) => p.kind === "tree" || p.kind === "blossom").length >= 12);
});

test("mặt đất: hồ lội được (đáy dưới mặt nước), thành hồ ngồi được, bệ cổng 3 bậc", () => {
  assert.ok(hubGround(5, 0) < POOL.water && !hubBlocked(5, 0));
  assert.equal(hubGround(7.8, 0), POOL.rimH);
  for (const g of GATES) {
    assert.equal(hubGround(g.x, g.z), PLATFORM_H);
    assert.equal(hubGround(g.x + (g.r - 0.2), g.z), 0.15);
  }
  assert.equal(hubGround(20, 5), 0);
  assert.ok(hubBlocked(0, 0), "đế tượng đài");
  assert.ok(hubBlocked(0, 35), "lan can");
});

test("đài phun nằm giữa bồn hoa, không chạm cây, không lấn lối đi", () => {
  assert.equal(FOUNTAINS.length, 4);
  for (const f of FOUNTAINS) {
    assert.ok(isBed(f.x, f.z));
    assert.ok(pathDistance(f.x, f.z) > f.r + 0.8);
    for (const p of PROPS) if (p.kind === "tree" || p.kind === "blossom") assert.ok(Math.hypot(p.x - f.x, p.z - f.z) > f.r + 1.5, `${p.x},${p.z}`);
  }
});
