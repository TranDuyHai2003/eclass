import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_KEYS, fireFlicker, lampFactor, localHour, sampleDay } from "@/lib/world/dayCycle";

test("tại đúng mốc giờ trả đúng giá trị mốc; giữa hai mốc nằm giữa", () => {
  const noon = sampleDay(12);
  assert.equal(noon.sunK, 1);
  assert.equal(noon.ambK, 0.48);
  const mid = sampleDay(10.5);
  assert.ok(mid.sunK > 0.85 && mid.sunK < 1);
});

test("vòng qua nửa đêm (23h → 0h) mượt; giờ âm / ≥ 24 quy về [0, 24)", () => {
  const a = sampleDay(23.5);
  assert.ok(a.ambK >= 0.12 && a.ambK <= 0.12 + 1e-9);
  assert.deepEqual(sampleDay(-1), sampleDay(23));
  assert.deepEqual(sampleDay(24), sampleDay(0));
  // liên tục: hai thời điểm sát nhau chênh rất ít
  for (let h = 0; h < 24; h += 0.25) {
    const x = sampleDay(h);
    const y = sampleDay(h + 0.01);
    assert.ok(Math.abs(x.sunK - y.sunK) < 0.02 && Math.abs(x.zen[2] - y.zen[2]) < 0.02, `nhảy tại ${h}`);
  }
});

test("đêm tối hơn ngày: nắng 0, ánh môi trường thấp, trời thiên đỉnh sẫm", () => {
  const n = sampleDay(1);
  const d = sampleDay(12);
  assert.equal(n.sunK, 0);
  assert.ok(n.ambK < d.ambK / 3);
  assert.ok(n.zen[2] < d.zen[2]);
  assert.ok(DAY_KEYS.every((k, i) => i === 0 || k.h > DAY_KEYS[i - 1].h));
});

test("giờ Việt Nam từ UTC; đèn bật khi mặt trời dưới −2°, tắt khi trên −6° chiều ngược", () => {
  assert.equal(localHour(new Date(Date.UTC(2026, 10, 27, 13, 30))), 20.5);
  assert.equal(localHour(new Date(Date.UTC(2026, 10, 27, 20, 0))), 3);
  assert.equal(lampFactor(10), 0);
  assert.equal(lampFactor(-10), 1);
  const mid = lampFactor(-4);
  assert.ok(mid > 0 && mid < 1);
  for (let t = 0; t < 5; t += 0.1) assert.ok(fireFlicker(t) > 0.77 && fireFlicker(t) < 1.03);
});
