import { test } from "node:test";
import assert from "node:assert/strict";
import { ATK, LAMBDA, hitBoss, hitNode, newBoss, standingDanger, tickBoss } from "../../lib/world/boss";

test("boss: sóng dừng — nút sóng (r = nλ/2) an toàn, bụng sóng nguy hiểm", () => {
  assert.equal(standingDanger(LAMBDA * 2), false); // nút
  assert.equal(standingDanger(LAMBDA * 2 + LAMBDA / 4), true); // bụng
  assert.equal(standingDanger(1), false); // quá gần boss: không có sóng
});

test("boss: rút Coherence về 0 → vỡ thế 6 s, sát thương ×1,5", () => {
  const b = newBoss(1, 0);
  const t0 = 1_000; // inPhase(1000) = false → rút 1×
  hitBoss(b, b.cohMax + 1, t0);
  assert.ok(b.brokenUntil > t0);
  const before = b.hp;
  const r = hitBoss(b, 100, t0 + 10);
  assert.equal(r.dealt, 150);
  assert.equal(before - b.hp, 150);
});

test("boss: nút giao thoa vỡ lệch nhau > 1 s thì hồi lại; vỡ cùng lúc thì mất khiên", () => {
  const b = newBoss(2, 0);
  b.hp = b.maxHp * 0.4; // pha 2
  b.nextAt = 0;
  tickBoss(b, 100); // chuyển pha
  tickBoss(b, 100); // đòn đầu pha 2 = twin
  assert.equal(b.atk, "twin");
  assert.ok(b.shield);
  hitNode(b, 0, 1e6, 200);
  tickBoss(b, 1400); // > 1 s mà nút 1 chưa vỡ → nút 0 hồi
  assert.ok(b.nodes[0] > 0);
  hitNode(b, 0, 1e6, 1500);
  hitNode(b, 1, 1e6, 1600);
  tickBoss(b, 1650);
  assert.equal(b.shield, false);
  assert.ok(ATK.twin.tele > 0);
});
