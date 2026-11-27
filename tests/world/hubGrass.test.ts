import { test } from "node:test";
import assert from "node:assert/strict";
import { BLADE_STRIDE, N_SECT, grassBlades, patchField } from "@/lib/world/hubGrass";
import { GARDEN, isBed } from "@/lib/world/hubLayout";

const all = (count: number) => {
  const per = grassBlades(count);
  const out: number[][] = [];
  per.forEach((a) => {
    for (let i = 0; i < a.length; i += BLADE_STRIDE) out.push(Array.from(a.slice(i, i + BLADE_STRIDE)));
  });
  return { per, out };
};

test("gieo đủ số lá, chia 12 hình quạt, cùng hạt giống → cùng kết quả", () => {
  const { per, out } = all(7000);
  assert.equal(per.length, N_SECT);
  assert.equal(out.length, 7000);
  assert.deepEqual(grassBlades(500)[3], grassBlades(500)[3]);
});

test("mọi lá nằm trong bồn cỏ hoặc vườn; cờ vườn đúng", () => {
  for (const [x, z, g] of all(5000).out) {
    const inG = Math.hypot(x - GARDEN.x, z - GARDEN.z) < GARDEN.r;
    assert.ok(isBed(x, z) || inG, `lá lạc ra lối đi tại ${x.toFixed(2)},${z.toFixed(2)}`);
    if (g === 1) assert.ok(inG);
  }
});

test("dáng lá theo số liệu nghiên cứu: cao 12–45 cm, ~7% lá cao > 35 cm, rộng 2,5–5 cm, nghiêng 0,15–0,65", () => {
  const { out } = all(6000);
  let tall = 0;
  for (const [, , , , h, w, lean] of out) {
    assert.ok(h >= 0.12 - 1e-6 && h <= 0.45 + 1e-6);
    assert.ok(w >= 0.025 - 1e-6 && w <= 0.05 + 1e-6);
    assert.ok(lean >= 0.15 - 1e-6 && lean <= 0.65 + 1e-6);
    if (h > 0.35) tall++;
  }
  const f = tall / out.length;
  assert.ok(f > 0.04 && f < 0.1, `tỉ lệ lá cao ${f}`);
});

test("phân bố theo mảng: mật độ chỗ dày gấp nhiều lần chỗ thưa", () => {
  const { out } = all(18000);
  let dense = 0;
  let sparse = 0;
  for (const [x, z] of out) {
    const p = patchField(x, z);
    if (p > 0.75) dense++;
    else if (p < 0.25) sparse++;
  }
  assert.ok(dense > sparse * 2, `dày ${dense} / thưa ${sparse}`);
});
