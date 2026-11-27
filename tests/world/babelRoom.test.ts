import { test } from "node:test";
import assert from "node:assert/strict";
import { BR, babelFree, babelSpot, bookTransform, wrapX } from "../../lib/world/babelRoom";

test("babelRoom: đi được trong phòng, bị chặn bởi giá sách và lan can giếng", () => {
  assert.equal(babelFree(-2.6, 2.0), true); // giữa sàn
  assert.equal(babelFree(0, 0), false); // giữa giếng
  assert.equal(babelFree(0, 1.6), false); // sát lan can
  assert.equal(babelFree(2.0, -3.6), false); // xuyên giá sách phía bắc-đông
});

test("babelRoom: cửa → hành lang → phòng kế tiếp (lặp vô hạn theo x)", () => {
  assert.equal(babelFree(BR.AP, 0), true); // ngưỡng cửa đông
  assert.equal(babelFree(BR.AP, 1.2), false); // tường cạnh cửa
  assert.equal(babelFree(BR.AP + 1.5, 0), true); // giữa hành lang
  assert.equal(babelFree(BR.AP + 1.5, 0.9), false); // vách hành lang
  const far = BR.PERIOD * 7 - 2.6;
  assert.equal(babelFree(far, 2.0), babelFree(-2.6, 2.0));
  assert.equal(wrapX(BR.PERIOD * 3 + 1).k, 3);
});

test("babelRoom: điểm tương tác — tường sách, cầu thang, gương", () => {
  const s = babelSpot(-1.2, 3.0);
  assert.equal(s?.kind, "shelf");
  assert.deepEqual(babelSpot(BR.STAIR.x, -0.6), { kind: "stair" });
  assert.deepEqual(babelSpot(BR.AP + BR.HALL_L / 2, 0.5), { kind: "mirror" });
  assert.equal(babelSpot(-2.6, 0), null);
});

test("babelRoom: sách nằm trong giá (cách tâm ≈ trung đoạn − nửa chiều sâu giá)", () => {
  for (let w = 0; w < 4; w++) {
    const b = bookTransform(w, 2, 16);
    const r = Math.hypot(b.x, b.z);
    assert.ok(Math.abs(r - (BR.AP - BR.CASE_D / 2 - 0.02)) < 0.15);
  }
});
