import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIDGE_HALF, FOG_Y, LOOK_Y, bridgeGeos, degrees, graphFor, kBlocked, kClear, kGround, kInit, kRewind, kStep, kStuck, locate, minTrails, oddVertices } from "../../lib/world/vault/konigsberg";
import { rng } from "../../lib/world/vault/geom";
import { eulerTrails, walkTrail } from "./vaultHelpers";

test("Königsberg 1736: bậc 5/3/3/3 → 4 đảo lẻ → cần 2 sợi chỉ", () => {
  const g = graphFor(1, 2);
  assert.deepEqual(degrees(g), [5, 3, 3, 3]);
  assert.equal(oddVertices(g).length, 4);
  assert.equal(minTrails(g), 2);
});

test("Kaliningrad ngày nay (màn 2, N = 3): 5 cầu, đúng 2 đảo lẻ → 1 sợi chỉ", () => {
  const g = graphFor(1, 3);
  assert.deepEqual(degrees(g).slice(0, 4), [3, 2, 2, 3]);
  assert.equal(g.bridges.length, 5 + 7);
});

test("định lý quyết định đội hình: mọi màn × mọi N cần ĐÚNG N sợi chỉ", () => {
  for (let s = 0; s < 3; s++)
    for (let n = 2; n <= 4; n++) {
      const g = graphFor(s, n);
      assert.equal(minTrails(g), n, `màn ${s + 1}, N = ${n}`);
      assert.equal(eulerTrails(g).length, n, `tách sợi chỉ màn ${s + 1}, N = ${n}`);
    }
  // Đại đồ thị N = 4: vòng 8 đảo bậc 3 (lẻ) + đảo giữa bậc 8 (chẵn)
  const w = graphFor(2, 4);
  assert.equal(degrees(w)[0], 8);
  assert.equal(oddVertices(w).length, 8);
});

test("hình học: cầu không chồng lên nhau, mặt cầu nối mượt với mặt đảo, đài cao 9 m", () => {
  for (let s = 0; s < 3; s++)
    for (let n = 2; n <= 4; n++) {
      const g = graphFor(s, n);
      const geos = bridgeGeos(g);
      geos.forEach((geo, e) => {
        for (let k = 1; k < geo.pts.length / 2 - 1; k++) {
          const x = geo.pts[k * 2];
          const z = geo.pts[k * 2 + 1];
          const loc = locate(g, x, 0.3, z);
          if (loc.k === "island") continue;
          assert.equal(loc.k, "bridge", `màn ${s} N ${n} cầu ${e} điểm ${k}`);
          if (loc.k === "bridge") assert.equal(loc.e, e, `cầu ${e} lẫn với cầu ${loc.e} (màn ${s}, N ${n})`);
        }
        assert.ok(geo.t0 > 0 && geo.t1 < 1 && geo.t0 < geo.t1);
      });
      // đài quan sát không đè lên đảo / cầu nào (phải lượn xuống)
      assert.equal(kGround(g, g.look.x, g.look.z, LOOK_Y), LOOK_Y);
      // ra ngoài mọi đảo / cầu ở tầm thấp = vực sương
      assert.equal(kGround(g, g.look.x + 200, g.look.z, 0), FOG_Y);
    }
});

test("đi qua cầu (mẫu 10 Hz có nhiễu) → cầu sáng; quay đầu giữa cầu → không tính", () => {
  const g = graphFor(1, 2);
  const st = kInit(1, 2);
  const [plan] = eulerTrails(g);
  const r = rng(7);
  const pts = walkTrail(g, { start: plan.start, edges: [plan.edges[0]] }, 0.3, r);
  for (const p of pts) kStep(st, 0, p[0], p[1], p[2]);
  assert.equal(st.lit[plan.edges[0]], 0);
  assert.equal(st.tr[0].e.length, 1);
  // ghế 1: lên cầu khác rồi quay về
  const st2 = kInit(1, 2);
  const b = g.bridges[0];
  const A = g.islands[b.a];
  kStep(st2, 1, A.x, 0, A.z);
  const geo = bridgeGeos(g)[0];
  const mid = geo.pts.length / 2;
  kStep(st2, 1, geo.pts[mid - 1], 0.6, geo.pts[mid]);
  kStep(st2, 1, A.x, 0, A.z);
  assert.ok(st2.lit.every((s) => s < 0));
});

test("không ai đi lại cầu đã sáng (va chạm), tua lại thì cầu tắt", () => {
  const g = graphFor(1, 2);
  const st = kInit(1, 2);
  const [plan] = eulerTrails(g);
  for (const p of walkTrail(g, { start: plan.start, edges: plan.edges.slice(0, 2) }, 0)) kStep(st, 0, p[0], p[1], p[2]);
  const e = plan.edges[0];
  const geo = bridgeGeos(g)[e];
  const m = geo.pts.length / 2;
  assert.equal(kBlocked(g, st.lit, geo.pts[m - 1], geo.pts[m], 0.5), true);
  // đảo vẫn đi được, sương thì không, trên cao (đang lượn) thì tự do
  const I = g.islands[0];
  assert.equal(kBlocked(g, st.lit, I.x, I.z, 0), false);
  assert.equal(kBlocked(g, st.lit, I.x, I.z + I.r + BRIDGE_HALF + 3, 0), true);
  assert.equal(kBlocked(g, st.lit, I.x, I.z + I.r + BRIDGE_HALF + 3, 8), false);
  kRewind(st, 0);
  assert.ok(st.lit.every((s) => s < 0));
  assert.equal(st.tr[0].a, -1);
  assert.equal(st.rew, 1);
});

test("bắt đầu ở đảo chẵn của thị trấn nhỏ → thắt nút (kẹt) trước khi hết cầu", () => {
  const g = graphFor(0, 2);
  const st = kInit(0, 2);
  // thị trấn 0: đảo 1 bậc 2 (chẵn). Đi 1→2→0→1 (cầu 1, 4, 0) → về đảo 1: còn cầu 1–… đã hết? đảo 1 có cầu 0 và 1 đều sáng
  const path = [1, 4, 0];
  const pts = walkTrail(g, { start: 1, edges: path }, 0);
  for (const p of pts) kStep(st, 0, p[0], p[1], p[2]);
  assert.equal(st.tr[0].a, 1);
  assert.equal(kStuck(st, 0), true);
  assert.equal(kClear(st), false);
});

test("mỗi màn × N: N người đi theo cách tách sợi chỉ → xong màn", () => {
  for (let s = 0; s < 3; s++)
    for (let n = 2; n <= 4; n++) {
      const g = graphFor(s, n);
      const st = kInit(s, n);
      const plans = eulerTrails(g);
      plans.forEach((p, seat) => {
        for (const q of walkTrail(g, p, 0.2, rng(seat + 11))) kStep(st, seat, q[0], q[1], q[2]);
      });
      assert.equal(kClear(st), true, `màn ${s + 1}, N = ${n}`);
    }
});

test("đi hết cầu của thị trấn mình = sợi chỉ hoàn thành, KHÔNG báo thắt nút (thị trấn kia còn cầu)", () => {
  const g = graphFor(0, 2);
  const st = kInit(0, 2);
  for (const p of walkTrail(g, { start: 0, edges: [0, 1, 2, 3, 4] }, 0)) kStep(st, 0, p[0], p[1], p[2]);
  assert.equal(st.tr[0].e.length, 5);
  assert.equal(kStuck(st, 0), false);
  assert.equal(kClear(st), false);
});
