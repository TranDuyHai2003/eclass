import { test } from "node:test";
import assert from "node:assert/strict";
import { keptAt, peeledAt, stats, triVerts } from "@/lib/world/sierpPaper";

const area = (s: number) => (Math.sqrt(3) / 4) * s * s;

test("cấp n giữ 3ⁿ tam giác cạnh S/2ⁿ; tổng diện tích = (3/4)ⁿ diện tích ban đầu", () => {
  for (let n = 0; n <= 5; n++) {
    const k = keptAt(6, n);
    assert.equal(k.length, 3 ** n);
    const tot = k.reduce((a, t) => a + area(t.s), 0);
    assert.ok(Math.abs(tot / area(6) - (3 / 4) ** n) < 1e-9);
    assert.ok(Math.abs(stats(n).area - (3 / 4) ** n) < 1e-12);
  }
});

test("bóc ở cấp n: 3ⁿ⁻¹ tam giác ngược, cộng với phần giữ lại đúng bằng diện tích cấp trước", () => {
  for (let n = 1; n <= 4; n++) {
    const p = peeledAt(6, n);
    assert.equal(p.length, 3 ** (n - 1));
    assert.ok(p.every((t) => !t.up));
    const kept = keptAt(6, n).reduce((a, t) => a + area(t.s), 0);
    const peeled = p.reduce((a, t) => a + area(t.s), 0);
    const prev = keptAt(6, n - 1).reduce((a, t) => a + area(t.s), 0);
    assert.ok(Math.abs(kept + peeled - prev) < 1e-9);
  }
  assert.equal(peeledAt(6, 0).length, 0);
});

test("mọi tam giác con nằm trong tam giác lớn; đáy tam giác lớn trên trục x", () => {
  const big = triVerts({ x: 0, y: (6 * Math.sqrt(3)) / 2 / 3, s: 6, up: true });
  assert.ok(Math.abs(big[0][1]) < 1e-9 && Math.abs(big[1][1]) < 1e-9);
  const inside = ([px, py]: [number, number]) => py >= -1e-9 && py <= Math.sqrt(3) * (3 - Math.abs(px)) + 1e-9;
  for (const t of keptAt(6, 3)) for (const v of triVerts(t)) assert.ok(inside(v), `${v}`);
});

test("chu vi tăng (3/2)ⁿ trong khi diện tích giảm — nghịch lý fractal", () => {
  const s5 = stats(5);
  assert.ok(s5.perimeter > 7 && s5.area < 0.25);
  assert.equal(s5.count, 243);
  assert.equal(s5.peeled, 81);
});
