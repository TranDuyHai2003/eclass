import { test } from "node:test";
import assert from "node:assert/strict";
import { SWIM, isSwimming, swimVy, wadeFactor } from "@/lib/world/swim";

test("bơi: chỉ bơi khi ngập sâu trên nước đủ sâu; nhịp đạp sát mặt nước thì thôi bơi để trèo bờ", () => {
  assert.equal(isSwimming(null, -5, -20, 0), false, "không có nước");
  assert.equal(isSwimming(-2.2, -2.5, -20, 0), false, "ngập 0,3 m — chưa bơi");
  assert.equal(isSwimming(-2.2, -3.4, -20, 0), true, "ngập 1,2 m trên biển sâu");
  assert.equal(isSwimming(-2.2, -3.4, -2.9, 0), false, "đáy nông (0,7 m) → lội, không bơi");
  assert.equal(isSwimming(-2.2, -3.2, -20, 5), false, "đạp nước bật lên sát mặt → tạm thôi bơi");
  assert.equal(isSwimming(-2.2, -6, -20, 5), true, "đạp nước dưới sâu vẫn đang bơi");
});

test("bơi: hệ số tốc độ bơi / lội / khô", () => {
  assert.equal(wadeFactor(-2.2, -3.4, true), SWIM.slow);
  assert.equal(wadeFactor(-2.2, -2.6, false), SWIM.wadeSlow);
  assert.equal(wadeFactor(-2.2, -1, false), 1);
  assert.equal(wadeFactor(null, -1, false), 1);
});

test("bơi: thả nổi hội tụ về mặt nước − 1,2 m (đầu nhô lên); lặn đi xuống nhưng không xuyên đáy; |vy| ≤ 3", () => {
  let y = -8;
  let vy = 0;
  for (let i = 0; i < 600; i++) {
    vy = swimVy({ surface: -2.2, y, floor: -20, vy, dive: false, t: 0, dt: 1 / 60 });
    y += vy / 60;
    assert.ok(Math.abs(vy) <= SWIM.maxV + 1e-9);
  }
  assert.ok(Math.abs(y - (-2.2 - SWIM.float)) < 0.05, `nổi tới ${y}`);
  for (let i = 0; i < 900; i++) {
    vy = swimVy({ surface: -2.2, y, floor: -6, vy, dive: true, t: 0, dt: 1 / 60 });
    y += vy / 60;
  }
  assert.ok(y < -5.5 && y >= -6 + 0.29, `lặn tới gần đáy, không xuyên: ${y}`);
});
