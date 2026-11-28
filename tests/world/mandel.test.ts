import { test } from "node:test";
import assert from "node:assert/strict";
import { PAD_R, PAD_SCALE, PAD_SHIFT, escapeTime, mandelPadC } from "@/lib/world/mandel";

test("bục Julia: tâm bục ↔ c = −0,375 (trong cardioid), ngoài bục / quá cao → null", () => {
  const c = mandelPadC(0, 0, 0, 56)!;
  assert.ok(Math.abs(c[0] + PAD_SHIFT) < 1e-12 && Math.abs(c[1]) < 1e-12);
  assert.equal(escapeTime(c[0], c[1]), 200);
  assert.equal(mandelPadC(PAD_R + 0.01, 0, 0, 56), null);
  assert.equal(mandelPadC(0, 0, 0.8, 56), null);
});

test("bục Julia: điểm trên hình khắc cardioid (toạ độ cục bộ) cho đúng c trên biên tập M", () => {
  const b = 56;
  const r = (b * Math.PI) / 180;
  for (let k = 0; k < 24; k++) {
    const t = (k / 24) * Math.PI * 2;
    const cr = Math.cos(t) / 2 - Math.cos(2 * t) / 4;
    const ci = Math.sin(t) / 2 - Math.sin(2 * t) / 4;
    // hình khắc: x cục bộ = (Re c + 0,375)·s, z cục bộ = −Im c·s; bục xoay −b → đổi ra thế giới
    const lx = (cr + PAD_SHIFT) * PAD_SCALE;
    const lz = -ci * PAD_SCALE;
    const dx = lx * Math.cos(r) - lz * Math.sin(r);
    const dz = lx * Math.sin(r) + lz * Math.cos(r);
    const c = mandelPadC(dx, dz, 0, b)!;
    assert.ok(Math.abs(c[0] - cr) < 1e-9 && Math.abs(c[1] - ci) < 1e-9);
  }
});

test("thời gian thoát: 0 và −1 thuộc M, 1 và 0,5 + 0,5i thoát nhanh", () => {
  assert.equal(escapeTime(0, 0), 200);
  assert.equal(escapeTime(-1, 0), 200);
  assert.ok(escapeTime(1, 0) < 5);
  assert.ok(escapeTime(0.5, 0.5) < 10);
});
