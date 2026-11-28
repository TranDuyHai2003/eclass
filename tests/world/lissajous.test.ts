import { test } from "node:test";
import assert from "node:assert/strict";
import { LH, closePeriod, harpToRoom, intervalName, lissajous, nearHarpBeam, ratio } from "@/lib/world/lissajous";

test("đàn Lissajous: tỉ lệ rút gọn + tên quãng (3:2 = quãng năm, 4:2 = quãng tám)", () => {
  assert.deepEqual(ratio(2, 3), [3, 2]);
  assert.equal(intervalName(3, 2, true), "quãng năm đúng");
  assert.equal(intervalName(4, 2, false), "octave");
  assert.equal(intervalName(6, 5, false), "minor third");
  assert.equal(intervalName(4, 4, true), "đồng âm");
});

test("đàn Lissajous: đường cong khép kín sau chu kỳ chung 2π/gcd(a, b); x có đúng a đỉnh mỗi 2π", () => {
  for (const [a, b] of [[3, 2], [5, 4], [4, 2], [1, 6]]) {
    const T = closePeriod(a, b);
    const p0 = lissajous(a, b, 0.7, 0.3);
    const p1 = lissajous(a, b, 0.7, 0.3 + T);
    assert.ok(Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) < 1e-9);
    let peaks = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * 2 * Math.PI;
      const x = (u: number) => lissajous(a, b, 0.7, u)[0];
      const h = (2 * Math.PI) / N;
      if (x(t) > x(t - h) && x(t) >= x(t + h)) peaks++;
    }
    assert.equal(peaks, a);
  }
});

test("đàn Lissajous: đứng đúng tia nào thì nhận tia đó", () => {
  LH.xs.forEach((bx, k) => {
    const [x, z] = harpToRoom(bx, LH.r - 0.55);
    assert.equal(nearHarpBeam(x, z, 0), k);
  });
  assert.equal(nearHarpBeam(0, 0, 0), null);
});
