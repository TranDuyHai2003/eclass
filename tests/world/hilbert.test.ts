import { test } from "node:test";
import assert from "node:assert/strict";
import { moveOld, occupantAfter, roomNumber, roomPlace } from "../../lib/world/hilbert";

test("hilbert: đánh số phòng ↔ vị trí cửa (lẻ trái, chẵn phải)", () => {
  assert.equal(roomNumber(0, 0, "left"), 1);
  assert.equal(roomNumber(0, 0, "right"), 2);
  assert.equal(roomNumber(2, 3, "right"), 24);
  for (let n = 1; n < 200; n++) {
    const p = roomPlace(n);
    assert.equal(roomNumber(p.g, p.j, p.side), n);
  }
});

test("hilbert: 1 khách mới — mọi người sang n+1, phòng 1 trống cho khách mới", () => {
  assert.deepEqual(occupantAfter("one", 1), { kind: "new", k: 1 });
  assert.deepEqual(occupantAfter("one", 5), { kind: "old", from: 4 });
  assert.equal(moveOld("one", 41), 42);
});

test("hilbert: xe buýt vô hạn — n → 2n, phòng lẻ cho khách mới, không ai trùng", () => {
  const seen = new Set<string>();
  for (let n = 1; n <= 100; n++) {
    const o = occupantAfter("bus", n)!;
    const key = JSON.stringify(o);
    assert.ok(!seen.has(key));
    seen.add(key);
  }
  assert.deepEqual(occupantAfter("bus", 7), { kind: "new", k: 4 });
});

test("hilbert: vô hạn xe buýt — luỹ thừa nguyên tố, mỗi người một phòng riêng", () => {
  assert.deepEqual(occupantAfter("buses", 8), { kind: "old", from: 3 });
  assert.deepEqual(occupantAfter("buses", 9), { kind: "new", k: 1, seat: 2 });
  assert.deepEqual(occupantAfter("buses", 125), { kind: "new", k: 2, seat: 3 });
  assert.equal(occupantAfter("buses", 6), null); // vẫn còn vô hạn phòng trống
});
