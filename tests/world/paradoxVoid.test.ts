import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_ISLES, BRIDGES, EXIT, FAR, HUB, ISLES, OUTER, node, voidGround } from "../../lib/world/paradoxVoid";

test("đảo tâm, đảo cổng và 10 đảo trạm đều đứng được ở tâm", () => {
  assert.equal(voidGround(HUB.x, HUB.z), HUB.h);
  assert.equal(voidGround(EXIT.x, EXIT.z), EXIT.h);
  for (const s of [...ISLES, ...Object.values(OUTER), ...Object.values(FAR)]) assert.equal(voidGround(s.x, s.z), s.h);
});

test("các đảo không chồng lên nhau", () => {
  const all = ALL_ISLES;
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) > all[i].r + all[j].r + 0.5, `${i}-${j}`);
});

test("giữa hai đảo nối cầu đi được liền mạch; ngoài cầu là vực", () => {
  for (const [a, b] of BRIDGES) {
    const A = node(a);
    const B = node(b);
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const g = voidGround(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t);
      assert.notEqual(g, null, `${a}->${b} t=${t}`);
    }
    // lệch ngang 2 m khỏi giữa cầu → vực
    const mx = (A.x + B.x) / 2;
    const mz = (A.z + B.z) / 2;
    const L = Math.hypot(B.x - A.x, B.z - A.z);
    const nx = -(B.z - A.z) / L;
    const nz = (B.x - A.x) / L;
    const mid = Math.hypot(mx - HUB.x, mz - HUB.z);
    if (mid > HUB.r + 2) assert.equal(voidGround(mx + nx * 2, mz + nz * 2), null, `${a}->${b} lateral`);
  }
});

test("mọi đảo đều tới được từ đảo tâm", () => {
  const seen = new Set<string>(["hub"]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [a, b] of BRIDGES) {
      const [sa, sb] = [String(a), String(b)];
      if (seen.has(sa) !== seen.has(sb)) {
        seen.add(sa);
        seen.add(sb);
        grew = true;
      }
    }
  }
  // mọi đảo trừ đảo trời z2b và Đỉnh Vô Cực z5 (lên bằng luồng gió) đều tới được bằng cầu
  assert.equal(seen.size, ALL_ISLES.length - 2);
});

test("chòm sao ∞: 10 điểm trên lemniscate (x² + y²)² = x² − y², hai thuỳ đối xứng", async () => {
  const { lemniscate } = await import("../../lib/world/paradoxVoid");
  const p = lemniscate(10);
  assert.equal(p.length, 10);
  for (const [x, y] of p) assert.ok(Math.abs((x * x + y * y) ** 2 - (x * x - y * y)) < 1e-9);
  assert.equal(p.filter(([x]) => x > 0).length, 5);
});
