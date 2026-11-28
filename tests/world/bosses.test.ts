import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/world/rng";
import {
  SV,
  TELE_MS,
  MEASURE_TELE_MS,
  INTRO_MS,
  atkStage,
  bodyLen,
  cartOffset,
  cartsHit,
  foldLine,
  gapCenter,
  hitSurveyor,
  inBars,
  lineSide,
  lineText,
  makeFold,
  makeMeasure,
  makeRoute,
  makeSeal,
  makeSweep,
  newSurveyor,
  reflect,
  routeAt,
  routeDist,
  ruleText,
  sealStep,
  surveyorHurt,
  surveyorMul,
  tickSurveyor,
  worstEscapeMs,
  type Surveyor,
} from "@/lib/world/foldbackSurveyor";
import { BAGS2, RL, bestLane, drawLane, drawTimes, expectedGain, hitLedger, laneCenter, laneOf, laneProb, laneState, ledgerHurt, ledgerMul, newLedger, safeProb, spillDuration, tickLedger } from "@/lib/world/rainLedger";
import { LN, lcmPeriods, mothHeight, mothPeriod, nextDip, newEvent, nightKey, reachWindow, reachable, shouldStart, startEvent, tickEvent, waveSize } from "@/lib/world/lanternNight";
import { RECIPES, craft, recipeAvailable } from "@/lib/world/recipes";
import { ITEMS } from "@/lib/world/itemDefs";
import { addItem, countItem, emptyInv } from "@/lib/world/inventory";

// ───────────── Phép đối xứng trục ─────────────

test("đối xứng trục: tự nghịch, giữ khoảng cách, ℓ là trung trực của PP′", () => {
  const lines = [foldLine("x", 2), foldLine("z", -1), foldLine("diag", 2), foldLine("anti", -2)];
  const rng = createRng(7);
  for (const L of lines)
    for (let i = 0; i < 50; i++) {
      const u = rng.int(-9, 9);
      const v = rng.int(-9, 9);
      const p = reflect(L, u, v);
      const q = reflect(L, p.u, p.v);
      assert.deepEqual([q.u, q.v], [u, v], "(P′)′ = P");
      // khoảng cách tới ℓ bằng nhau, ngược phía
      assert.ok(Math.abs(lineSide(L, u, v) + lineSide(L, p.u, p.v)) < 1e-9);
      // trung điểm PP′ nằm trên ℓ, PP′ song song pháp tuyến (vuông góc ℓ)
      assert.ok(Math.abs(lineSide(L, (u + p.u) / 2, (v + p.v) / 2)) < 1e-9);
      const cross = (p.u - u) * L.b - (p.v - v) * L.a;
      assert.ok(Math.abs(cross) < 1e-9);
      // ô nguyên → ô nguyên (đứng được đúng tâm khối)
      assert.ok(Number.isInteger(p.u) && Number.isInteger(p.v));
    }
});

test("công thức HUD + quy tắc toạ độ đúng với phép đối xứng", () => {
  assert.equal(lineText(foldLine("x", 2)), "x = 2");
  assert.equal(lineText(foldLine("z", -1)), "z = −1");
  assert.equal(lineText(foldLine("diag", 2)), "z = x + 2");
  assert.equal(lineText(foldLine("anti", -2)), "z = −x − 2");
  assert.equal(lineText(foldLine("diag", 0)), "z = x");
  assert.equal(ruleText(foldLine("x", 2)), "(x; z) → (4 − x; z)");
  assert.equal(ruleText(foldLine("z", 0)), "(x; z) → (x; −z)");
  assert.equal(ruleText(foldLine("diag", 2)), "(x; z) → (z − 2; x + 2)");
  assert.equal(ruleText(foldLine("anti", -2)), "(x; z) → (−2 − z; −2 − x)");
  // kiểm quy tắc bằng số: (3; −1) qua z = x + 2 → (−3; 5)
  const p = reflect(foldLine("diag", 2), 3, -1);
  assert.deepEqual([p.u, p.v], [-3, 5]);
});

test("Khiên Đối xứng: cọc cùng phía, ảnh trong đấu trường, cách xa nhau, tất định theo seed", () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = makeSeal(createRng(seed), seed % 2 ? ["x", "z"] : ["diag", "anti"], 3, false, 0);
    assert.equal(s.stakes.length, 3);
    const side = Math.sign(lineSide(s.line, s.stakes[0].u, s.stakes[0].v));
    const pts = [...s.stakes, ...s.images];
    for (let i = 0; i < 3; i++) {
      const d = lineSide(s.line, s.stakes[i].u, s.stakes[i].v);
      assert.equal(Math.sign(d), side);
      assert.ok(Math.abs(d) >= 1.5 && Math.abs(d) <= 6);
      assert.ok(Math.abs(s.images[i].u) <= 8 && Math.abs(s.images[i].v) <= 8);
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].u - pts[j].u, pts[i].v - pts[j].v) >= 2.5 - 1e-9);
    const again = makeSeal(createRng(seed), seed % 2 ? ["x", "z"] : ["diag", "anti"], 3, false, 0);
    assert.deepEqual(again.stakes, s.stakes);
  }
});

test("ghim: phải đứng lên ẢNH đủ 0,6 s; đứng lên chính cọc không tính (và bị nhắc)", () => {
  const s = makeSeal(createRng(3), ["x"], 2, true, 0);
  const st = s.stakes[0];
  for (let t = 0; t < 2000; t += 50) assert.equal(sealStep(s, st.u, st.v, 50, t), -1);
  assert.ok(s.wrongAt > 0, "đứng trên cọc → nhắc");
  const im = s.images[0];
  let got = -1;
  let t = 0;
  for (; t < 1000 && got < 0; t += 50) got = sealStep(s, im.u + 0.3, im.v - 0.3, 50, t);
  assert.equal(got, 0);
  assert.ok(t >= SV.PIN_MS && t <= SV.PIN_MS + 100);
  // rời ảnh giữa chừng → đếm lại
  sealStep(s, s.images[1].u, s.images[1].v, 400, 2000);
  sealStep(s, 0, 0, 50, 2050);
  assert.equal(s.hold[1], 0);
});

// ───────────── Đòn đánh của Kẻ Khảo sát ─────────────

test("lộ trình theo độ dài cung + khoảng cách", () => {
  const r = makeRoute([0, 0, 4, 0, 4, 3]);
  assert.equal(r.len, 7);
  const o = { u: 0, v: 0 };
  routeAt(r, 5, o);
  assert.deepEqual([o.u, o.v], [4, 1]);
  routeAt(r, 9, o); // đi tiếp thẳng sau điểm cuối
  assert.deepEqual([o.u, o.v], [4, 5]);
  assert.equal(routeDist(r, 2, 1), 1);
});

test("Quét Làn: dải đi qua chỗ người chơi; toa chỉ trúng khi đi ngang qua; báo trước đủ để thoát", () => {
  for (let seed = 1; seed < 30; seed++) {
    const rng = createRng(seed);
    const pu = rng.int(-9, 9);
    const pv = rng.int(-9, 9);
    const a = makeSweep(rng, pu, pv, 0, 1);
    assert.ok(routeDist(a.route!, pu, pv) < 1e-6, "dải phủ đúng chỗ người chơi");
    assert.ok(a.tele >= 1000);
    assert.ok(worstEscapeMs("sweep") < a.tele * 0.5, "đứng giữa dải vẫn kịp bước ra");
    // trong lúc báo trước: không trúng
    assert.equal(cartsHit(a, a.tele - 1, pu, pv), null);
    // có lúc toa đi qua người đứng yên
    let hit = false;
    for (let t = a.tele; t < a.tele + a.dur; t += 20) if (cartsHit(a, t, pu, pv)) hit = true;
    assert.ok(hit);
    // đứng ngoài dải (cách ≥ LANE_HALF) thì không bao giờ trúng
    const r = a.route!;
    const du = (r.pts[2] - r.pts[0]) / r.len;
    const dv = (r.pts[3] - r.pts[1]) / r.len;
    const qu = pu - dv * (SV.LANE_HALF + 0.05);
    const qv = pv + du * (SV.LANE_HALF + 0.05);
    for (let t = a.tele; t < a.tele + a.dur; t += 20) assert.equal(cartsHit(a, t, qu, qv), null);
  }
  assert.ok(SV.HIT_R <= SV.LANE_HALF, "báo trước phủ kín vùng va chạm");
});

test("Gập Ngược: chặng 2 là ảnh đối xứng của chặng 1 qua đường gấp", () => {
  for (let seed = 1; seed < 30; seed++) {
    const rng = createRng(seed);
    const a = makeFold(rng, rng.int(-6, 6), rng.int(-6, 6), 0, 2);
    const [au, av, tu, tv, bu, bv] = a.route!.pts;
    const L = a.fold!;
    // T nằm trên ℓ
    assert.ok(Math.abs(lineSide(L, tu, tv)) < 1e-9);
    // B nằm trên tia T → ảnh(A)
    const im = reflect(L, au, av);
    const cross = (bu - tu) * (im.v - tv) - (bv - tv) * (im.u - tu);
    assert.ok(Math.abs(cross) < 1e-6);
    assert.ok((bu - tu) * (im.u - tu) + (bv - tv) * (im.v - tv) >= 0);
    // đoàn toa quay ngoắt ≥ 100°
    const d1 = Math.atan2(tv - av, tu - au);
    const d2 = Math.atan2(bv - tv, bu - tu);
    const turn = Math.abs(Math.atan2(Math.sin(d2 - d1), Math.cos(d2 - d1)));
    assert.ok(turn > (100 * Math.PI) / 180, `turn ${turn}`);
  }
});

test("Thả Thước: thanh 1 phủ người chơi, khe an toàn, báo trước đủ", () => {
  for (let seed = 1; seed < 30; seed++) {
    const rng = createRng(seed);
    const pu = rng.int(-9, 9);
    const pv = rng.int(-9, 9);
    const a = makeMeasure(rng, pu, pv, 0, 3);
    const b = a.bars!;
    assert.ok(inBars(b, b.ou, b.ov), "người chơi đang đứng trên thanh");
    const g = gapCenter(b);
    assert.ok(!inBars(b, g.u, g.v, 0.4), "khe an toàn (cả khi lệch 0,4 m)");
    assert.ok(Math.abs(g.u) <= SV.HALF && Math.abs(g.v) <= SV.HALF);
    assert.ok(worstEscapeMs("measure") < MEASURE_TELE_MS[3] * 0.5);
  }
});

test("pha 3: tiếng vọng — toa cuối cách một khoảng trống", () => {
  assert.equal(cartOffset(SV.ECHO_FROM, true) - cartOffset(SV.ECHO_FROM - 1, true), SV.GAP + SV.ECHO_GAP);
  assert.equal(bodyLen(true) - bodyLen(false), SV.ECHO_GAP);
});

// ───────────── Máy trạng thái Kẻ Khảo sát ─────────────

function run(s: Surveyor, from: number, to: number, pu = 0, pv = 0, step = 50) {
  const ev: string[] = [];
  for (let t = from; t <= to; t += step) {
    const e = tickSurveyor(s, t, pu, pv);
    if (e) ev.push(e);
  }
  return ev;
}

test("Kẻ Khảo sát: chào sân → đánh; giáp ×0,35, hạ toa đầu sau Thả Thước ×1,3", () => {
  const s = newSurveyor(11, 0);
  assert.equal(surveyorMul(s, 0), 0, "đang chào sân: chưa đánh được");
  const ev = run(s, 0, INTRO_MS + 200);
  assert.equal(s.mode, "fight");
  assert.ok(ev.includes("tele"));
  assert.equal(surveyorMul(s, INTRO_MS + 200), SV.MUL.armored);
  // chạy tới khi gặp Thả Thước rồi xét pha hồi chiêu
  let t = INTRO_MS + 200;
  while (!(s.atk && s.atk.kind === "measure") && t < 60000) tickSurveyor(s, (t += 50), 0, 0);
  const a = s.atk!;
  const rec = a.t0 + a.tele + a.dur + 10;
  assert.equal(atkStage(a, rec), "recover");
  assert.equal(surveyorMul(s, rec), SV.MUL.lowered);
});

test("Kẻ Khảo sát: tới 2/3 máu dựng khiên (miễn nhiễm, máu không tụt qua ngưỡng), ghim đủ ảnh → choáng ×1,6, pha 2", () => {
  const s = newSurveyor(5, 0);
  run(s, 0, INTRO_MS + 100);
  // một đòn cực mạnh không được bỏ qua câu đố
  s.atk = null;
  s.mode = "fight";
  s.modeAt = 0;
  // ép giáp thường: cần đòn đang hồi chiêu để có hệ số — dùng hệ số giáp
  const dealt = hitSurveyor(s, 1e6, INTRO_MS + 100);
  assert.ok(dealt > 0);
  assert.ok(s.hp <= s.maxHp * (2 / 3) && s.hp >= s.maxHp * (2 / 3) - 2, `hp ${s.hp}`);
  const ev = run(s, INTRO_MS + 150, INTRO_MS + 300);
  assert.ok(ev.includes("seal"));
  assert.equal(s.mode, "seal");
  assert.equal(surveyorMul(s, INTRO_MS + 300), 0, "khiên: miễn nhiễm");
  assert.equal(hitSurveyor(s, 500, INTRO_MS + 300), 0);
  const seal = s.seal!;
  assert.ok(seal.ghost, "khiên 1 có bóng gương");
  assert.ok(seal.line.kind === "x" || seal.line.kind === "z");
  // đứng lên từng ảnh
  let t = INTRO_MS + 400;
  const evs: string[] = [];
  for (const im of seal.images)
    for (let k = 0; k < 20; k++) {
      const e = tickSurveyor(s, (t += 50), im.u, im.v);
      if (e) evs.push(e);
    }
  assert.ok(evs.includes("pin") && evs.includes("fold"));
  assert.equal(s.mode, "stun");
  assert.equal(s.phase, 2);
  assert.equal(surveyorMul(s, t), SV.MUL.stun);
});

test("Kẻ Khảo sát: khiên 2 là đường chéo, không có bóng; hết giờ → hồi máu + bật bóng gợi ý", () => {
  const s = newSurveyor(9, 0);
  s.mode = "fight";
  s.sealsDone = 1;
  s.phase = 2;
  s.hp = Math.floor(s.maxHp / 3);
  const ev = run(s, 0, 100);
  assert.ok(ev.includes("seal"));
  const seal = s.seal!;
  assert.ok(seal.line.kind === "diag" || seal.line.kind === "anti");
  assert.equal(seal.stakes.length, 3);
  assert.equal(seal.ghost, false);
  const hp0 = s.hp;
  const ev2 = run(s, 150, SV.SEAL_MS + 400, 0, 0, 100);
  assert.ok(ev2.includes("fail"));
  assert.ok(s.hp > hp0 && s.hp <= s.maxHp * (2 / 3));
  assert.equal(s.seal!.ghost, true);
  assert.equal(s.seal!.tries, 1);
  // khiên 2 vẫn Quét Làn (giữ áp lực)
  assert.ok(ev2.includes("tele"));
});

test("Kẻ Khảo sát: trúng người chơi tối đa một lần mỗi đòn; phá khiên 2 → pha 3 → hạ được", () => {
  const s = newSurveyor(2, 0);
  s.mode = "fight";
  s.nextAt = 0;
  tickSurveyor(s, 10, 0, 0);
  const a = s.atk!;
  let dmg = 0;
  for (let t = 10; t < a.t0 + a.tele + a.dur; t += 10) dmg += surveyorHurt(s, t, a.bars ? a.bars.ou : 0, a.bars ? a.bars.ov : 0);
  assert.equal(dmg, SV.DMG[a.kind]);
  s.sealsDone = 2;
  s.phase = 3;
  s.mode = "stun";
  s.modeAt = 100000;
  while (s.hp > 0) hitSurveyor(s, 500, 100001);
  assert.deepEqual(run(s, 100002, 100100), ["dead"]);
  assert.equal(TELE_MS[3] >= 1000, true);
});

// ───────────── Sổ Mưa ─────────────

test("xác suất: rút theo trọng số khớp p = w/Σw (tần suất quan sát hội tụ)", () => {
  const w = [1, 1, 2, 4];
  assert.equal(laneProb(w, 3), 0.5);
  assert.equal(safeProb(w, 0, 2), (7 / 8) ** 2);
  const rng = createRng(42);
  const n = 40000;
  const c = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) c[drawLane(w, rng.next())]++;
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(c[i] / n - laneProb(w, i)) < 0.01);
  assert.equal(drawLane(w, 0), 0);
  assert.equal(drawLane(w, 0.999999), 3);
});

test("kỳ vọng: rút 1 lần chọn làn rủi ro cao, rút 2 lần chọn làn giữa (cùng một túi)", () => {
  const w = [4, 2, 1, 1];
  const pay = [4, 2, 1, 1];
  assert.equal(expectedGain(w, pay, 0, 1), 2);
  assert.equal(bestLane(w, pay, 1), 0);
  assert.equal(bestLane(w, pay, 2), 1);
  // pha 1 (mọi làn 1 điểm): làn ít hạt nhất luôn tốt nhất
  assert.equal(bestLane([1, 1, 2, 4], [1, 1, 1, 1], 1), 0);
  for (const b of BAGS2) assert.equal(b.w.length, 4);
});

test("bến: làn theo toạ độ", () => {
  assert.equal(laneOf(-7.9, 0), 0);
  assert.equal(laneOf(7.9, 0), 3);
  assert.equal(laneOf(8.1, 0), -1);
  assert.equal(laneOf(0, RL.HALF_LEN + 0.5), -1);
  for (let i = 0; i < 4; i++) assert.equal(laneOf(laneCenter(i), 0), i);
});

test("Sổ Mưa: cược làn an toàn → cộng điểm; Sổ đầy → xả lũ → lộ trống ×1,8", () => {
  const l = newLedger(1, 0);
  assert.equal(ledgerMul(l), 0);
  let t = 0;
  // người chơi luôn chọn làn ít bị rút nhất ngay trước lúc chốt
  const events: string[] = [];
  while (l.mode !== "exposed" && t < 120000) {
    t += 50;
    const lane = l.draw ? bestLane(l.bag.w, l.bag.pay, l.draw.k) : 0;
    // tránh mưa: nếu làn mình bị rút thì đứng ngoài bến
    const st = laneState(l, t, lane);
    const pu = st ? 20 : laneCenter(lane);
    const e = tickLedger(l, t, pu, -5);
    ledgerHurt(l, t, pu, -5);
    if (e) events.push(e);
  }
  assert.equal(l.mode, "exposed");
  assert.ok(events.includes("tally") && events.includes("spill") && events.includes("exposed"));
  assert.ok(l.points >= RL.NEED[0]);
  assert.equal(ledgerMul(l), RL.MUL.exposed);
  assert.equal(l.counts.reduce((a, b) => a + b, 0), l.draws);
});

test("Sổ Mưa: mưa trúng đúng làn bị rút, chỉ trong lúc mưa, một lần; niêm ×0,12", () => {
  const l = newLedger(3, 0);
  l.mode = "fight";
  l.nextAt = 0;
  tickLedger(l, 1, 0, 0);
  const d = l.draw!;
  const T = drawTimes(d.k);
  const lane = d.lanes[0];
  const u = laneCenter(lane);
  assert.equal(ledgerHurt(l, d.t0 + T.rain(0) - 5, u, 0), 0, "báo trước: chưa đau");
  assert.ok(T.rain(0) - T.reveal(0) >= 1000, "lộ làn ≥ 1 s trước khi mưa");
  assert.equal(ledgerHurt(l, d.t0 + T.rain(0) + 10, u, 0), RL.DMG.rain);
  assert.equal(ledgerHurt(l, d.t0 + T.rain(0) + 30, u, 0), 0);
  const other = laneCenter((lane + 1) % 4);
  const l2 = newLedger(3, 0);
  l2.mode = "fight";
  l2.nextAt = 0;
  tickLedger(l2, 1, 0, 0);
  assert.equal(ledgerHurt(l2, d.t0 + T.rain(0) + 10, other, 0), 0);
  assert.equal(hitLedger(l2, 100), Math.round(100 * RL.MUL.sealed));
  assert.ok(spillDuration() > RL.SPILL_TELE_MS);
});

test("Sổ Mưa: sang pha 2 (rút 2 lần, điểm khác nhau) khi còn ≤ 50 % máu", () => {
  const l = newLedger(4, 0);
  l.mode = "exposed";
  l.modeAt = 0;
  hitLedger(l, l.maxHp * 0.3);
  assert.ok(l.hp <= l.maxHp / 2);
  const e = tickLedger(l, RL.EXPOSED_MS + 1, 0, 0);
  assert.equal(e, "phase2");
  assert.equal(l.phase, 2);
  l.nextAt = 0;
  tickLedger(l, RL.EXPOSED_MS + 2000, 0, 0);
  assert.equal(l.draw!.k, 2);
});

// ───────────── Đêm Đèn lồng ─────────────

test("Đèn lồng: khoá theo đêm (sau nửa đêm vẫn là đêm hôm trước), chỉ mở sau khi hạ boss 1", () => {
  assert.equal(nightKey(2026, 11, 28, 21), "2026-11-28");
  assert.equal(nightKey(2026, 11, 29, 2), "2026-11-28");
  assert.equal(nightKey(2026, 12, 1, 3), "2026-11-30");
  assert.equal(shouldStart({ night: true, cleared: 1, key: "a", lastKey: null, busy: false }), true);
  assert.equal(shouldStart({ night: true, cleared: 0, key: "a", lastKey: null, busy: false }), false);
  assert.equal(shouldStart({ night: true, cleared: 2, key: "a", lastKey: "a", busy: false }), false);
  assert.equal(shouldStart({ night: false, cleared: 2, key: "a", lastKey: null, busy: false }), false);
  assert.equal(shouldStart({ night: true, cleared: 2, key: "a", lastKey: null, busy: true }), false);
});

test("Đèn lồng: ngân sách diễn viên ≤ 24", () => {
  assert.equal(waveSize(2, 12), 8);
  assert.equal(waveSize(2, 20), 4);
  assert.equal(waveSize(0, 0), 4);
  for (let live = 0; live < 24; live++) for (let w = 0; w < 3; w++) assert.ok(live + waveSize(w, live) <= LN.ACTOR_CAP);
});

test("bướm: hàm tuần hoàn — thấp nhất tại φ + kT, cửa sổ với tới, BCNN(2, 3) = 6", () => {
  const T = 2.4;
  const phi = 0.7;
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(mothHeight(phi + k * T, T, phi) - LN.LOW_Y) < 1e-9);
  assert.ok(Math.abs(mothHeight(phi + T / 2, T, phi) - LN.HIGH_Y) < 1e-9);
  assert.ok(Math.abs(nextDip(1.0, T, phi) - (phi + T)) < 1e-9);
  assert.ok(Math.abs(nextDip(phi, T, phi) - phi) < 1e-9);
  const w = reachWindow(T);
  assert.ok(reachable(mothHeight(phi + w - 1e-6, T, phi)));
  assert.ok(!reachable(mothHeight(phi + w + 1e-3, T, phi)));
  assert.equal(lcmPeriods([2, 3]), 6);
  assert.equal(lcmPeriods([2.4]), 2.4);
  // đợt 3: hai đàn cùng sà tại t = 6 s
  const a = mothPeriod(2, 0);
  const b = mothPeriod(2, 1);
  assert.deepEqual([a, b], [2, 3]);
  assert.ok(Math.abs(mothHeight(6, a, 0) - LN.LOW_Y) < 1e-9 && Math.abs(mothHeight(6, b, 0) - LN.LOW_Y) < 1e-9);
});

test("Đèn lồng: 3 đợt → xong (thưởng đủ), rời xa → tan", () => {
  const e = newEvent();
  startEvent(e, 0, 0, 0);
  const ev: string[] = [];
  let alive = 0;
  for (let t = 0; t < 60000 && e.state !== "done"; t += 100) {
    const r = tickEvent(e, t, 100, alive, 3, true);
    if (r === "spawn") alive = 4;
    else if (e.state === "wave" && t - e.waveAt > 1500) alive = 0;
    if (r) ev.push(r);
  }
  assert.deepEqual(ev, ["spawn", "cleared", "spawn", "cleared", "spawn", "done"]);
  assert.equal(e.rewarded, LN.REWARD[0] + LN.REWARD[1] + LN.REWARD[2]);
  const f = newEvent();
  startEvent(f, 0, 0, 0);
  let r: string | null = null;
  for (let t = 0; t < 20000 && r !== "failed"; t += 100) r = tickEvent(f, t, 100, 3, 60, true);
  assert.equal(r, "failed");
});

// ───────────── Tiến trình: vật phẩm + Máy Ép Hoa văn ─────────────

test("tiến trình: mảnh gương → Máy Ép Hoa văn (bàn) → Thẻ Rút (máy ép); trạm hand < bench < press", () => {
  for (const id of ["mirror_shard", "survey_lens", "phase_silk", "pattern_press", "draw_token", "chance_amber", "observatory_seal", "amber_pick"]) assert.ok(ITEMS[id], id);
  const press = RECIPES.find((r) => r.id === "pattern_press")!;
  const token = RECIPES.find((r) => r.id === "draw_token")!;
  assert.equal(recipeAvailable(token, "bench"), false);
  assert.equal(recipeAvailable(token, "press"), true);
  assert.equal(recipeAvailable(RECIPES.find((r) => r.id === "plank")!, "press"), true);
  let inv = emptyInv();
  inv = addItem(inv, "mirror_shard", 4).inv;
  inv = addItem(inv, "ratio_copper", 1).inv;
  inv = addItem(inv, "phase_silk", 2).inv;
  inv = addItem(inv, "int_crystal", 1).inv;
  const r1 = craft(inv, press, 1, "bench");
  assert.ok(r1.ok);
  if (!r1.ok) return;
  assert.equal(countItem(r1.inv, "pattern_press"), 1);
  const r2 = craft(r1.inv, token, 1, "press");
  assert.ok(r2.ok);
  if (r2.ok) assert.equal(countItem(r2.inv, "draw_token"), 1);
});
