import { test } from "node:test";
import assert from "node:assert/strict";
import { ANAM, PLANE, makeShards, portrait, projectToPlane, rayFor, viewPoint, type V3 } from "@/lib/world/anamorph";

test("điểm nhìn khớp công thức máy quay của Hub (sau lưng người chơi, phía tây, thấp hơn đầu)", () => {
  const [x, y, z] = viewPoint();
  assert.ok(x < ANAM.x - 3, `x ${x}`);
  assert.ok(Math.abs(z - ANAM.z) < 1e-9);
  assert.ok(y > 0.5 && y < 1.3, `y ${y}`);
});

test("TỪ ĐIỂM NHÌN, mọi mảnh chiếu đúng vào vùng màu của chính nó trên bức tranh (phép chiếu xuyên tâm)", () => {
  const shards = makeShards(400);
  assert.equal(shards.length, 400);
  for (const s of shards) {
    const [u, v] = projectToPlane(s.pos);
    const tone = portrait(u / PLANE.hw, v / PLANE.hh);
    assert.equal(tone, s.tone);
  }
});

test("trôi dọc tia (đổi độ sâu) không đổi hình chiếu; mảnh luôn ở trên mặt sân và trong sân", () => {
  const V = viewPoint();
  for (const s of makeShards(200, 3)) {
    const t2 = s.t + 1.3;
    const p2: V3 = [V[0] + s.dir[0] * t2, V[1] + s.dir[1] * t2, V[2] + s.dir[2] * t2];
    const a = projectToPlane(s.pos);
    const b = projectToPlane(p2);
    assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
    assert.ok(s.pos[1] >= 0.3);
    assert.ok(Math.abs(s.pos[0]) < 19.5 && Math.abs(s.pos[2]) < 19.5, `ngoài sân ${s.pos}`);
  }
  const d = rayFor(0, 0);
  assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
});

test("bức chân dung có đủ các mảng: hai nửa mặt, mắt, miệng, tóc", () => {
  assert.equal(portrait(-0.3, -0.1), "rose");
  assert.equal(portrait(0.35, -0.1), "slate");
  assert.equal(portrait(0.32, 0.2), "ink");
  assert.equal(portrait(0.02, -0.45), "vermilion");
  assert.equal(portrait(0, 0.75), "ink");
  assert.equal(portrait(0.95, 0.95), null);
});
