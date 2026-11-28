import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAP,
  STAGE_TIMEOUT,
  STABLE_FRAMES,
  approach,
  counterOf,
  createLoadTracker,
  harmonicsAt,
  noiseOf,
  pctOf,
  riemannN,
  riemannSum,
  samplesAt,
  squareWavePartial,
  type LoadInput,
} from "../../lib/world/loadProgress";

const base = (o: Partial<LoadInput> = {}): LoadInput => ({
  now: 0,
  scene: "hub",
  active: true,
  loaded: 0,
  total: 10,
  quietMs: 0,
  mounted: false,
  build: null,
  shadersDone: false,
  stableFrames: 0,
  ...o,
});

test("tiến độ: đi đúng thứ tự giai đoạn, chỉ 100 % khi mọi giai đoạn xong", () => {
  const tr = createLoadTracker();
  let s = tr.update(base({ loaded: 5 }));
  assert.equal(s.stage, "assets");
  assert.ok(s.target > 0 && s.target < 0.5);
  // tải xong hết tệp nhưng loader chưa rảnh đủ lâu → vẫn là assets
  s = tr.update(base({ now: 100, active: false, loaded: 10, quietMs: 50 }));
  assert.equal(s.stage, "assets");
  s = tr.update(base({ now: 400, active: false, loaded: 10, quietMs: 300 }));
  assert.equal(s.stage, "build");
  s = tr.update(base({ now: 500, active: false, loaded: 10, quietMs: 400, mounted: true }));
  assert.equal(s.stage, "shaders");
  s = tr.update(base({ now: 600, active: false, loaded: 10, quietMs: 500, mounted: true, shadersDone: true, stableFrames: 2 }));
  assert.equal(s.stage, "settle");
  assert.ok(s.target <= CAP && !s.ready);
  assert.ok(pctOf(s.target, s.ready) < 100);
  s = tr.update(base({ now: 700, active: false, loaded: 10, quietMs: 600, mounted: true, shadersDone: true, stableFrames: STABLE_FRAMES }));
  assert.equal(s.stage, "ready");
  assert.ok(s.ready);
  assert.equal(s.target, 1);
  assert.deepEqual(s.timedOut, []);
});

test("tiến độ: đơn điệu — thêm tệp vào hàng đợi không làm thanh lùi", () => {
  const tr = createLoadTracker();
  const a = tr.update(base({ loaded: 8, total: 10 })).target;
  const b = tr.update(base({ now: 50, loaded: 8, total: 40 })).target;
  assert.ok(b >= a);
});

test("tiến độ: không bao giờ chạm 100 % khi chưa xong, dù số tệp đủ", () => {
  const tr = createLoadTracker();
  const s = tr.update(base({ active: false, loaded: 10, quietMs: 1000, mounted: true, shadersDone: true, stableFrames: 0 }));
  assert.ok(!s.ready);
  assert.ok(s.target <= CAP);
  assert.equal(pctOf(0.9999, false), 99);
  assert.equal(pctOf(1, true), 100);
});

test("tiến độ: Vùng Kỳ quan chờ đủ chunk gần", () => {
  const tr = createLoadTracker();
  const inp = (n: number, o: Partial<LoadInput> = {}) => base({ scene: "expanse", now: n, active: false, loaded: 10, quietMs: 500, mounted: true, ...o });
  let s = tr.update(inp(0, { build: { done: 3, need: 29 } }));
  assert.equal(s.stage, "build");
  const t1 = s.target;
  s = tr.update(inp(100, { build: { done: 20, need: 29 } }));
  assert.equal(s.stage, "build");
  assert.ok(s.target > t1);
  s = tr.update(inp(200, { build: { done: 29, need: 29 }, shadersDone: true, stableFrames: STABLE_FRAMES }));
  assert.ok(s.ready);
});

test("tiến độ: giai đoạn treo quá hạn được bỏ qua (ghi timedOut), tải tệp thì không", () => {
  const tr = createLoadTracker();
  const inp = (n: number) => base({ now: n, active: false, loaded: 10, quietMs: 500, mounted: true, shadersDone: false, stableFrames: STABLE_FRAMES });
  tr.update(inp(0));
  let s = tr.update(inp(STAGE_TIMEOUT.shaders - 10));
  assert.equal(s.stage, "shaders");
  s = tr.update(inp(STAGE_TIMEOUT.shaders + 10));
  assert.ok(s.ready);
  assert.deepEqual(s.timedOut, ["shaders"]);
  const tr2 = createLoadTracker();
  tr2.update(base());
  assert.equal(tr2.update(base({ now: 120000 })).stage, "assets");
  // cảnh chưa gắn → build không quá hạn
  const tr3 = createLoadTracker();
  const nm = (n: number) => base({ now: n, active: false, loaded: 10, quietMs: 500, mounted: false });
  tr3.update(nm(0));
  assert.equal(tr3.update(nm(60000)).stage, "build");
});

test("lò xo hiển thị: đuổi theo mục tiêu, không vượt, không lùi", () => {
  let x = 0;
  let v = 0;
  let prev = 0;
  for (let i = 0; i < 120; i++) {
    [x, v] = approach(x, v, 0.6, 1 / 60);
    assert.ok(x >= prev && x <= 0.6);
    prev = x;
  }
  assert.ok(x > 0.59);
  // mục tiêu thấp hơn (không xảy ra với tracker, nhưng vẫn an toàn) → đứng yên
  [x, v] = approach(x, v, 0.2, 1 / 60);
  assert.ok(x >= prev);
  // khung dài (máy khựng 100 ms) vẫn ổn định
  [x, v] = approach(0, 0, 1, 0.1);
  assert.ok(x > 0 && x <= 1 && Number.isFinite(v));
});

test("hội tụ Monte Carlo: N gấp đôi theo tiến độ, nhiễu ∝ 1/√N", () => {
  assert.equal(samplesAt(0), 1);
  assert.equal(samplesAt(1), 4096);
  assert.ok(samplesAt(0.5) === 64);
  assert.ok(Math.abs(noiseOf(4) - 0.5) < 1e-12);
  assert.ok(noiseOf(4096) < noiseOf(64));
  // ước lượng Monte Carlo thật: sai số trung bình giảm cỡ 1/√N
  const rng = ((seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647))(11);
  const err = (n: number) => {
    let e = 0;
    for (let r = 0; r < 200; r++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += rng();
      e += Math.abs(s / n - 0.5);
    }
    return e / 200;
  };
  const r = err(16) / err(1024);
  assert.ok(r > 5 && r < 12, `tỉ lệ ${r}`); // √(1024/16) = 8
});

test("Riemann: thêm hình chữ nhật → tổng tiến về tích phân", () => {
  const f = (x: number) => x * x;
  const exact = 1 / 3;
  let prev = Infinity;
  for (const p of [0, 0.3, 0.6, 1]) {
    const e = Math.abs(riemannSum(f, 0, 1, riemannN(p)) - exact);
    assert.ok(e <= prev);
    prev = e;
  }
  assert.ok(prev < 0.005);
  assert.equal(counterOf("riemann", 1).n, 128);
});

test("Fourier: thêm hoạ âm → tiến về sóng vuông (xa chỗ nhảy)", () => {
  const sq = (x: number) => Math.sign(Math.sin(x));
  const err = (n: number) => {
    let e = 0;
    for (let i = 1; i < 40; i++) {
      const x = 0.4 + (i / 40) * 2.3; // trong (0,4; 2,7) ⊂ (0, π)
      e = Math.max(e, Math.abs(squareWavePartial(x, n) - sq(x)));
    }
    return e;
  };
  assert.ok(err(harmonicsAt(1)) < err(harmonicsAt(0)));
  assert.ok(err(16) < 0.1);
  assert.equal(harmonicsAt(0), 1);
  assert.equal(harmonicsAt(1), 16);
});
