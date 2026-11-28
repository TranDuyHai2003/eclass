import { test } from "node:test";
import assert from "node:assert/strict";
import { QUALITY_GRACE_MS, capGfx, newQualityGate, qualityStep, farAccept, farReplan, outlineOn, portalPassOrder, portalPeriodMs, portalSlots, printsAlive, reflectionPlan, renderDpr, waterMaxSteps, type FarTileState } from "@/lib/world/perfGate";

test("cổng Siren: máy yếu chỉ mặt xoáy; laptop 1 ô 12 Hz; cao 2 ô 30 Hz", () => {
  assert.equal(portalSlots("low", true), 0);
  assert.equal(portalSlots("mid", true), 1);
  assert.equal(portalSlots("high", false), 1);
  assert.equal(portalSlots("high", true), 2);
  assert.ok(portalPeriodMs("mid") >= 1000 / 15 && portalPeriodMs("mid") <= 1000 / 10);
  assert.ok(Math.abs(portalPeriodMs("high") - 1000 / 30) < 1e-9);
});

test("cổng Siren: tối đa MỘT lượt vẽ mỗi khung — hai ô cùng đến hạn thì luân phiên, ô cũ nhất trước", () => {
  const P = 1000 / 30;
  const slots = [
    { active: true, at: 0 },
    { active: true, at: 0 },
  ];
  // mô phỏng 60 khung ở 20 FPS (cả hai ô luôn đến hạn): người gọi vẽ ô đầu danh sách rồi dừng
  const counts = [0, 0];
  for (let f = 1; f <= 60; f++) {
    const now = f * 50;
    const order = portalPassOrder(slots, now, P);
    assert.ok(order.length <= 2);
    if (order.length) {
      const i = order[0];
      slots[i].at = now;
      counts[i]++;
    }
  }
  // luân phiên đều: mỗi ô ~nửa số khung, tổng = số khung (một lượt / khung)
  assert.equal(counts[0] + counts[1], 60);
  assert.ok(Math.abs(counts[0] - counts[1]) <= 1);
});

test("cổng Siren: ô chưa đến hạn / không gắn cổng thì không vẽ; ô hỏng (khung quá nhỏ) không chặn ô kia", () => {
  const P = 1000 / 12;
  assert.deepEqual(portalPassOrder([{ active: true, at: 1000 }], 1050, P), []);
  assert.deepEqual(portalPassOrder([{ active: false, at: 0 }], 5000, P), []);
  // ô 0 cũ hơn đứng đầu, ô 1 vẫn có trong danh sách để người gọi thử tiếp nếu ô 0 không vẽ được
  assert.deepEqual(portalPassOrder([{ active: true, at: 10 }, { active: true, at: 500 }], 2000, P), [0, 1]);
  assert.deepEqual(portalPassOrder([{ active: true, at: 900 }, { active: true, at: 100 }], 2000, P), [1, 0]);
});

test("hồ Hub: phản chiếu tắt ở máy yếu, 10 Hz laptop, 20 Hz máy mạnh; không bật khi người dùng tắt", () => {
  assert.deepEqual(reflectionPlan("low", true), { on: false, periodMs: 100 });
  assert.deepEqual(reflectionPlan("mid", true), { on: true, periodMs: 100 });
  assert.deepEqual(reflectionPlan("high", true), { on: true, periodMs: 50 });
  assert.equal(reflectionPlan("high", false).on, false);
  assert.equal(waterMaxSteps("low"), 1);
  assert.equal(waterMaxSteps("mid"), 2);
});

test("tự hạ chất lượng: hạ cả các cờ đắt, không bao giờ bật thêm", () => {
  const ultra = { reflections: true, shadows: true, ao: true, godrays: true, dof: true, bloom: true, vfx: 2 as const, scale: 1 };
  assert.deepEqual(capGfx(ultra, "high"), ultra);
  const mid = capGfx(ultra, "mid");
  assert.equal(mid.ao || mid.godrays || mid.dof || mid.shadows, false);
  assert.equal(mid.reflections, true);
  assert.equal(mid.vfx, 1);
  assert.equal(mid.scale, 1);
  const low = capGfx(ultra, "low");
  assert.equal(low.reflections || low.bloom || low.shadows, false);
  assert.equal(low.vfx, 0);
  const off = { reflections: false, shadows: false, ao: false, godrays: false, dof: false, bloom: false, vfx: 0 as const };
  for (const q of ["low", "mid", "high"] as const) assert.deepEqual(capGfx(off, q), off);
});

test("DPR dễ đoán: độ phân giải động có tác dụng ở DPR 1,25; không siêu lấy mẫu trên màn DPR 1; điện thoại vẫn ≥ 1", () => {
  const MID: [number, number] = [1.25, 1.75];
  // laptop DPR 1,25: drs 0,8 → 1,0 (trước đây vẫn 1,25)
  assert.ok(Math.abs(renderDpr(1.25, MID, 1, 0.8) - 1) < 1e-9);
  assert.equal(renderDpr(1.25, MID, 1, 1), 1.25);
  // màn DPR 1 ở mức vừa: 1 (trước đây 1,25)
  assert.equal(renderDpr(1, MID, 1, 1), 1);
  // mức cao được siêu lấy mẫu
  assert.equal(renderDpr(1, [1.5, 2], 1, 1, true), 1.5);
  // điện thoại DPR 3 ở mức thấp: kẹp 1,5
  assert.equal(renderDpr(3, [1, 1.5], 1, 1), 1.5);
  assert.equal(renderDpr(NaN, MID, 1, 1), 1);
  assert.ok(renderDpr(1, MID, 0.1, 0.1) >= 0.5);
});

test("địa hình xa: đổi tâm liên tục không làm ô đang chờ mắc kẹt (lỗi want.length = 0)", () => {
  const tiles = new Map<string, FarTileState>();
  // lần 1: cần 3 ô, worker chỉ kịp nhận 1
  let keep = new Set(["0,0,2", "64,0,2", "128,0,4"]);
  let plan = farReplan(tiles, keep);
  assert.deepEqual(plan.queue.sort(), [...keep].sort());
  for (const k of plan.queue) tiles.set(k, { mesh: false, pending: false });
  tiles.get("0,0,2")!.pending = true;
  // lần 2 (đổi tâm, vẫn cần cùng các ô): hai ô chưa giao việc PHẢI được xếp lại
  plan = farReplan(tiles, keep);
  assert.deepEqual(plan.queue.sort(), ["128,0,4", "64,0,2"]);
  assert.deepEqual(plan.drop, []);
  // lần 3: ô 128 đổi bậc chi tiết 4 → 8; ô 64 không còn cần
  tiles.get("128,0,4")!.mesh = true;
  keep = new Set(["0,0,2", "128,0,8"]);
  plan = farReplan(tiles, keep);
  assert.deepEqual(plan.drop, ["64,0,2"]); // ô cũ khác bậc (128,0,4) được giữ tới khi ô mới về
  assert.deepEqual(plan.queue, ["128,0,8"]); // 0,0,2 đang dựng → không giao lại
});

test("địa hình xa: kết quả cũ không được cài (không xoá ô bậc chi tiết mới hơn cùng chỗ)", () => {
  const keep = new Set(["128,0,8"]);
  assert.equal(farAccept("128,0,4", keep), false);
  assert.equal(farAccept("128,0,8", keep), true);
});

test("vết chân ướt: hết hạn thì ngừng cập nhật", () => {
  assert.equal(printsAlive(1000, 5000, 9000), true);
  assert.equal(printsAlive(1000, 10001, 9000), false);
});

test("viền MToon: nhân vật mình luôn có; NPC xa / máy yếu tắt; có trễ 26 ↔ 30 m", () => {
  assert.equal(outlineOn(100, false, false, "low"), true);
  assert.equal(outlineOn(5, true, true, "low"), false);
  assert.equal(outlineOn(20, true, true, "mid"), true);
  assert.equal(outlineOn(28, true, true, "mid"), true); // đang bật: giữ tới 30 m
  assert.equal(outlineOn(28, false, true, "mid"), false); // đang tắt: phải vào dưới 26 m mới bật
  assert.equal(outlineOn(25, false, true, "high"), true);
  assert.equal(outlineOn(31, true, true, "high"), false);
});

test("tự hạ chất lượng: không hạ trong ân hạn sau màn chờ / khi đang tải (khựng biên dịch lúc vào cảnh)", () => {
  const g = newQualityGate();
  // đang tải (readyAt = 0): bao nhiêu lần decline cũng không hạ
  for (let t = 1000; t < 30000; t += 2500) assert.equal(qualityStep(g, "decline", t, 0, true, false), null);
  // màn chờ tắt lúc 30 s: trong 9 s đầu vẫn không hạ dù FPS thấp liên tục
  for (let t = 30000; t < 30000 + QUALITY_GRACE_MS; t += 2500) assert.equal(qualityStep(g, "decline", t, 30000, true, false), null);
});

test("tự hạ chất lượng: cần thấp liên tục ≥ 5 s và độ phân giải động đã xuống đáy; một lần incline / khoảng lặng làm đứt chuỗi", () => {
  const ready = 1000;
  const t0 = ready + QUALITY_GRACE_MS + 1;
  let g = newQualityGate();
  assert.equal(qualityStep(g, "decline", t0, ready, true, false), null);
  assert.equal(qualityStep(g, "decline", t0 + 2500, ready, true, false), null);
  assert.equal(qualityStep(g, "decline", t0 + 5000, ready, true, false), "down");
  // drs chưa xuống đáy: không hạ
  g = newQualityGate();
  for (let k = 0; k < 6; k++) assert.equal(qualityStep(g, "decline", t0 + k * 2500, ready, false, false), null);
  // incline xen giữa: đếm lại
  g = newQualityGate();
  qualityStep(g, "decline", t0, ready, true, false);
  qualityStep(g, "incline", t0 + 2500, ready, true, false);
  assert.equal(qualityStep(g, "decline", t0 + 5000, ready, true, false), null);
  assert.equal(qualityStep(g, "decline", t0 + 7500, ready, true, false), null);
  assert.equal(qualityStep(g, "decline", t0 + 10000, ready, true, false), "down");
  // khoảng lặng > 4 s (FPS lửng lơ): đứt chuỗi
  g = newQualityGate();
  qualityStep(g, "decline", t0, ready, true, false);
  assert.equal(qualityStep(g, "decline", t0 + 6000, ready, true, false), null);
});

test("tự nâng lại chất lượng: chỉ khi trước đó đã tự hạ, cần cao liên tục ≥ 15 s (trễ lớn hơn hạ)", () => {
  const ready = 1000;
  const t0 = ready + QUALITY_GRACE_MS + 1;
  let g = newQualityGate();
  for (let k = 0; k <= 8; k++) assert.equal(qualityStep(g, "incline", t0 + k * 2500, ready, true, false), null);
  g = newQualityGate();
  const out: (string | null)[] = [];
  for (let k = 0; k <= 6; k++) out.push(qualityStep(g, "incline", t0 + k * 2500, ready, true, true));
  assert.deepEqual(out, [null, null, null, null, null, null, "up"]);
});
