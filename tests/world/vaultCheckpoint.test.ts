import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKPOINT_TTL, parseCheckpoint } from "@/lib/world/vault/checkpoint";
import { jumpTo, newRun, seatJoin, addEcho } from "@/lib/world/vault/run";

test("điểm lưu một mình: hợp lệ thì đọc được, hết hạn / hỏng / ngoài khoảng / màn đầu → null", () => {
  const now = 1_800_000_000_000;
  const ok = JSON.stringify({ seed: 123, n: 3, ch: 2, sg: 1, at: now - 1000 });
  assert.deepEqual(parseCheckpoint(ok, now), { seed: 123, n: 3, ch: 2, sg: 1, at: now - 1000 });
  assert.equal(parseCheckpoint(JSON.stringify({ seed: 1, n: 3, ch: 2, sg: 0, at: now - CHECKPOINT_TTL - 1 }), now), null);
  assert.equal(parseCheckpoint("{", now), null);
  assert.equal(parseCheckpoint(JSON.stringify({ seed: 1, n: 3, ch: 99, sg: 0, at: now }), now), null);
  assert.equal(parseCheckpoint(JSON.stringify({ seed: 1, n: 1, ch: 2, sg: 0, at: now }), now), null);
  assert.equal(parseCheckpoint(JSON.stringify({ seed: 1, n: 2, ch: 0, sg: 0, at: now }), now), null);
  assert.equal(parseCheckpoint(null, now), null);
});

test("điểm lưu một mình: dựng lại cùng hạt giống + số ghế rồi nhảy tới đúng phòng / màn", () => {
  const now = 1_800_000_000_000;
  const r = newRun("SOLO", 777, now, true);
  seatJoin(r, "me", "A", now);
  addEcho(r);
  addEcho(r);
  jumpTo(r, 2, 1, now);
  assert.equal(r.phase, "play");
  assert.equal(r.ch, 2);
  assert.equal(r.sg, 1);
  assert.equal(r.n, 3);
  assert.equal(r.seed, 777);
});
