import { test } from "node:test";
import assert from "node:assert/strict";
import { groundSpeedFromFeet, locoClip, strideTimeScale, type FootSample } from "@/lib/world/stride";

/** chu kỳ đi tổng hợp: chân trụ lùi đều với tốc độ v, chân bước vung lên phía trước */
function walkCycle(v: number, period = 1, n = 48): FootSample[] {
  const out: FootSample[] = [];
  const half = period / 2;
  const S = (v * half) / 2; // nửa sải
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * period;
    const ph = (t % period) / half; // 0…2
    const stance = (p: number) => S - v * p * half; // trụ: từ +S lùi về −S
    const swing = (p: number) => -S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * p)); // vung: −S → +S
    const lift = (p: number) => 0.12 * Math.sin(Math.PI * p);
    if (ph < 1) out.push({ t, lz: stance(ph), ly: 0.08, rz: swing(ph), ry: 0.08 + lift(ph) });
    else out.push({ t, lz: swing(ph - 1), ly: 0.08 + lift(ph - 1), rz: stance(ph - 1), ry: 0.08 });
  }
  return out;
}

test("ước lượng đúng tốc độ mặt đất của clip (đi 1,4 m/s, chạy 3,8 m/s)", () => {
  assert.ok(Math.abs(groundSpeedFromFeet(walkCycle(1.4)) - 1.4) < 0.05);
  assert.ok(Math.abs(groundSpeedFromFeet(walkCycle(3.8, 0.7)) - 3.8) < 0.1);
});

test("hồi quy: mô hình quay ngược (trục trước = −z cục bộ) vẫn đo đúng", () => {
  const flipped = walkCycle(1.4).map((x) => ({ ...x, lz: -x.lz, rz: -x.rz }));
  assert.ok(Math.abs(groundSpeedFromFeet(flipped) - 1.4) < 0.05);
});

test("không có chân trụ rõ ràng → 0; tốc độ phát = thật / clip, có giới hạn", () => {
  assert.equal(groundSpeedFromFeet([]), 0);
  assert.equal(strideTimeScale(2.8, 1.4), 2);
  assert.equal(strideTimeScale(10, 1.4), 2.4);
  assert.equal(strideTimeScale(0, 1.4), 0.45);
  assert.equal(strideTimeScale(3, 0), 1);
});

test("chọn clip theo vận tốc thật, có trễ quanh ngưỡng", () => {
  assert.equal(locoClip(1.2, null), "walk");
  assert.equal(locoClip(4, null), "run");
  assert.equal(locoClip(7, null), "sprint");
  // sát ngưỡng 2,2: đang đi thì vẫn đi, đang chạy thì vẫn chạy
  assert.equal(locoClip(2.3, "walk"), "walk");
  assert.equal(locoClip(2.1, "run"), "run");
  assert.equal(locoClip(5.3, "run"), "run");
  assert.equal(locoClip(5.0, "sprint"), "sprint");
});
