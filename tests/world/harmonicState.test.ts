import { test } from "node:test";
import assert from "node:assert/strict";
import { HARMONIC_BPM, chladni, quantize, springStep, squareSeries, updateHarmonic, type HarmonicState } from "@/lib/world/harmonicState";

const fresh = (): HarmonicState => ({ time: 0, beat: 0, beatPhase: 0, bar: 0, puppetTime: 0, stopTime: 0, collageTime: 0, decomposition: 0, dissonance: 0, harmonics: 8 });

test("hoạ âm: đồng hồ nhạc + thời gian lượng tử hoá 12 / 8 / 4 Hz", () => {
  const s = updateHarmonic(fresh(), 10.3, 1, 1, 1 / 60);
  assert.ok(Math.abs(s.beat - (10.3 * HARMONIC_BPM) / 60) < 1e-9);
  assert.equal(s.bar, Math.floor(s.beat / 4));
  assert.ok(s.beatPhase >= 0 && s.beatPhase < 1);
  assert.equal(s.puppetTime, quantize(10.3, 12));
  assert.ok(Math.abs(s.stopTime - 10.25) < 1e-9);
  assert.ok(Math.abs(s.collageTime - 10.25) < 1e-9);
});

test("hoạ âm: phân rã theo máu boss (đầy máu = 0; gần gục → 1, còn 1 hoạ âm), đi mượt không nhảy", () => {
  const s = fresh();
  updateHarmonic(s, 0, 1, 1, 1 / 60);
  assert.equal(s.decomposition, 0);
  assert.equal(s.harmonics, 8);
  const before = s.decomposition;
  updateHarmonic(s, 0, 0.05, 3, 1 / 60);
  assert.ok(s.decomposition - before < 0.05, "một khung không nhảy vọt");
  for (let i = 0; i < 600; i++) updateHarmonic(s, i / 60, 0.05, 3, 1 / 60);
  assert.ok(s.decomposition > 0.99 && s.dissonance > 0.99);
  assert.equal(s.harmonics, 1);
});

test("lò xo: ζ < 1 vượt đích rồi hội tụ; ζ = 1 không vượt; ổn định với dt lớn", () => {
  const a = { x: 0, v: 0 };
  let over = false;
  for (let i = 0; i < 240; i++) {
    springStep(a, 1, 12, 0.35, 1 / 60);
    if (a.x > 1.02) over = true;
  }
  assert.ok(over && Math.abs(a.x - 1) < 0.01);
  const b = { x: 0, v: 0 };
  let max = 0;
  for (let i = 0; i < 240; i++) max = Math.max(max, springStep(b, 1, 12, 1, 1 / 60).x);
  assert.ok(max <= 1 + 1e-6 && Math.abs(b.x - 1) < 0.01);
  const c = { x: 0, v: 0 };
  for (let i = 0; i < 20; i++) springStep(c, 1, 40, 0.3, 0.5);
  assert.ok(Number.isFinite(c.x) && Math.abs(c.x - 1) < 0.2, `dt lớn vẫn ổn định: ${c.x}`);
});

test("Chladni: đối xứng phản xứng, đường chéo luôn là nút; m = n triệt tiêu", () => {
  assert.ok(Math.abs(chladni(0.3, 0.3, 3, 5)) < 1e-12, "đường chéo x = y là nút");
  assert.ok(Math.abs(chladni(0.2, 0.7, 3, 5) + chladni(0.7, 0.2, 3, 5)) < 1e-12);
  assert.ok(Math.abs(chladni(0.4, -0.1, 4, 4)) < 1e-12);
});

test("chuỗi vuông: càng nhiều hoạ âm càng gần sóng vuông (±1)", () => {
  const e1 = Math.abs(squareSeries(Math.PI / 2, 1) - 1);
  const e8 = Math.abs(squareSeries(Math.PI / 2, 8) - 1);
  assert.ok(e8 < e1 && e8 < 0.1);
});
