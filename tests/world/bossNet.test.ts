import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { BR, pickHost, slotNear, takeToken, validFight, validHit } from "@/lib/world/bossRelay";
import { applyLantern, applyLedger, applySurveyor, clockShift, mothSlot, packLantern, packLedger, packSurveyor, surveyorEvent, type SvSeen } from "@/lib/world/bossNet";
import { SV, attackTarget, cartsHit, newSurveyor, sealStepAll, surveyorHurt, tickSurveyor } from "@/lib/world/foldbackSurveyor";
import { RL, drawTimes, laneCenter, ledgerGain, ledgerHurt, newLedger, tickLedger } from "@/lib/world/rainLedger";
import { LN, newEvent, startEvent } from "@/lib/world/lanternNight";

// ───────────── Quy tắc server ─────────────

test("server: kiểm yêu cầu triệu hồi (loại, số hữu hạn, seed nguyên, hướng 0..3)", () => {
  assert.deepEqual(validFight({ kind: "surveyor", cx: 1.234, cz: -5, y: 10, seed: 7, rot: 2 }), { kind: "surveyor", cx: 1.23, cz: -5, y: 10, seed: 7, rot: 2 });
  assert.equal(validFight({ kind: "dragon", cx: 0, cz: 0, y: 0, seed: 1 }), null);
  assert.equal(validFight({ kind: "ledger", cx: NaN, cz: 0, y: 0, seed: 1 }), null);
  assert.equal(validFight({ kind: "ledger", cx: 0, cz: 0, y: 0, seed: 1.5 }), null);
  assert.equal(validFight({ kind: "ledger", cx: 0, cz: 0, y: 0, seed: 1, rot: 9 }), null);
  assert.equal(validFight("x"), null);
  assert.equal(validFight({ kind: "lantern", cx: 0, cz: 0, y: 0, seed: 3 })?.rot, 0);
});

test("server: chọn chủ mới = người gần tâm nhất trong bán kính (hoà → id nhỏ); không ai → null", () => {
  const c = [
    { id: "b", x: 10, z: 0 },
    { id: "a", x: -10, z: 0 },
    { id: "c", x: 3, z: 4 },
  ];
  assert.equal(pickHost(0, 0, c, 60), "c");
  assert.equal(pickHost(0, 0, c.slice(0, 2), 60), "a");
  assert.equal(pickHost(0, 0, c, 4), null);
  assert.equal(pickHost(0, 0, [], 60), null);
  assert.equal(slotNear([{ cx: 0, cz: 0 }, { cx: 100, cz: 0 }], 90, 0, BR.GAP_R), 1);
  assert.equal(slotNear([{ cx: 0, cz: 0 }], 200, 0, BR.GAP_R), -1);
});

test("server: giới hạn tốc độ + kẹp đòn", () => {
  const b = { tokens: 2, at: 0 };
  assert.ok(takeToken(b, 0, 1, 2));
  assert.ok(takeToken(b, 0, 1, 2));
  assert.ok(!takeToken(b, 100, 1, 2));
  assert.ok(takeToken(b, 1100, 1, 2));
  assert.deepEqual(validHit({ k: "b", d: 999 }), { k: "b", d: BR.HIT_MAX });
  assert.deepEqual(validHit({ k: "m3", d: -4 }), { k: "m3", d: 0 });
  assert.equal(validHit({ k: "m9", d: 4 }), null);
  assert.equal(validHit({ k: "b", d: "x" }), null);
});

test("realtime/bossrelay.mjs (server) chạy được và trả cùng kết quả với bản TypeScript", async () => {
  const url = "file://" + join(__dirname, "..", "..", "realtime", "bossrelay.mjs").replace(/\\/g, "/");
  const mod = (await (new Function("u", "return import(u)") as (u: string) => Promise<Record<string, (...a: unknown[]) => unknown>>)(url)) as Record<string, (...a: unknown[]) => unknown>;
  const req = { kind: "ledger", cx: 3.333, cz: 4, y: 1, seed: 9, rot: 1 };
  assert.deepEqual(mod.validFight(req), validFight(req));
  assert.equal(mod.pickHost(0, 0, [{ id: "z", x: 1, z: 0 }, { id: "y", x: 0, z: 2 }], 60), pickHost(0, 0, [{ id: "z", x: 1, z: 0 }, { id: "y", x: 0, z: 2 }], 60));
});

// ───────────── Đồng hồ ─────────────

test("đồng hồ: đổi mốc máy chủ → server → máy khách giữ đúng thời điểm thật", () => {
  // máy chủ: performance.now = 5 000 lúc Date.now = 1 000 000, server nhanh hơn 300 ms
  const shHost = clockShift(5000, 1_000_000, 300);
  // máy khách: performance.now = 90 000 cùng lúc (Date.now lệch 50 ms), server nhanh hơn 250 ms so với khách
  const shGuest = clockShift(90_000, 1_000_050, 250);
  const tHost = 6000; // 1 s sau ở máy chủ
  const server = tHost + shHost;
  const tGuest = server - shGuest;
  assert.equal(tGuest, 91_000);
});

// ───────────── Kẻ Khảo sát: chủ đóng gói, khách áp ─────────────

function hostAndGuest(seed: number) {
  const host = newSurveyor(seed, 0);
  const guest = newSurveyor(999, 0);
  return { host, guest, shH: 1000, shG: -2000 };
}

test("Kẻ Khảo sát: khách áp gói → cùng đòn, cùng vùng trúng, cùng khiên; cờ trúng giữ cục bộ", () => {
  const { host, guest, shH, shG } = hostAndGuest(4);
  host.mode = "fight";
  host.nextAt = 0;
  tickSurveyor(host, 10, 2, 3);
  const a = host.atk!;
  applySurveyor(guest, JSON.parse(JSON.stringify(packSurveyor(host, shH))), shG);
  const g = guest.atk!;
  // cùng thời điểm thật: t_khách = t_chủ + shH − shG
  const d = shH - shG;
  assert.equal(g.kind, a.kind);
  assert.ok(Math.abs(g.t0 - (a.t0 + d)) < 1);
  // vùng nguy hiểm giống hệt tại cùng thời điểm thật
  for (let t = a.t0; t < a.t0 + a.tele + a.dur; t += 37)
    for (const [u, v] of [[2, 3], [0, 0], [-5, 4]]) {
      if (a.route) assert.equal(cartsHit(g, t + d, u, v), cartsHit(a, t, u, v));
    }
  // người ở máy khách bị trúng một lần; gói tới sau (cùng đòn) không xoá cờ
  let dmg = 0;
  for (let t = a.t0; t < a.t0 + a.tele + a.dur; t += 20) {
    dmg += surveyorHurt(guest, t + d, g.bars ? g.bars.ou : 2, g.bars ? g.bars.ov : 3);
    applySurveyor(guest, packSurveyor(host, shH), shG);
  }
  assert.equal(dmg, SV.DMG[a.kind]);
  // khiên
  host.mode = "fight";
  host.atk = null;
  host.hp = Math.floor(host.maxHp * 0.6);
  tickSurveyor(host, 20, 0, 0);
  applySurveyor(guest, packSurveyor(host, shH), shG);
  assert.equal(guest.mode, "seal");
  assert.deepEqual(guest.seal!.stakes, host.seal!.stakes);
  assert.deepEqual(guest.seal!.images, host.seal!.images);
  assert.equal(guest.seal!.ghost, host.seal!.ghost);
});

test("Kẻ Khảo sát: hai người chia nhau ghim ảnh; đòn nhắm lần lượt từng người", () => {
  const s = newSurveyor(8, 0);
  s.mode = "fight";
  s.hp = Math.floor(s.maxHp * 0.6);
  tickSurveyor(s, 0, 0, 0);
  const [i0, i1] = s.seal!.images;
  // chủ đứng ảnh 0, khách đứng ảnh 1 cùng lúc
  let ev: string | null = null;
  for (let t = 50; t < 1000 && ev !== "fold"; t += 50) ev = tickSurveyor(s, t, i0.u, i0.v, [i1.u, i1.v]);
  assert.equal(ev, "fold");
  assert.deepEqual(attackTarget(0, 1, 2, [5, 6, 7, 8]), { u: 1, v: 2 });
  assert.deepEqual(attackTarget(1, 1, 2, [5, 6, 7, 8]), { u: 5, v: 6 });
  assert.deepEqual(attackTarget(2, 1, 2, [5, 6, 7, 8]), { u: 7, v: 8 });
  assert.deepEqual(attackTarget(3, 1, 2), { u: 1, v: 2 });
  const seal = { ...s.seal!, pinned: [false, false], hold: [0, 0] };
  assert.equal(sealStepAll(seal, [99, 99], 1000, 0), -1);
});

test("Kẻ Khảo sát: khách suy ra sự kiện (báo trước, khiên, ghim, gấp, chết) từ gói", () => {
  const s = newSurveyor(1, 0);
  const seen: SvSeen = { mode: "intro", atkT0: 0, pinned: 0, tries: 0 };
  s.mode = "fight";
  s.atk = { kind: "sweep", route: null, fold: null, bars: null, echo: false, t0: 500, tele: 1000, dur: 100, rec: 100, hitMain: false, hitEcho: false };
  assert.equal(surveyorEvent(seen, s), "tele");
  assert.equal(surveyorEvent(seen, s), null);
  s.mode = "seal";
  s.seal = { line: { a: 1, b: 0, c: 0, kind: "x", k: 0 }, stakes: [{ u: 2, v: 0 }], images: [{ u: -2, v: 0 }], pinned: [false], hold: [0], ghost: true, t0: 0, tries: 0, wrongAt: 0 };
  assert.equal(surveyorEvent(seen, s), "seal");
  s.seal.pinned[0] = true;
  assert.equal(surveyorEvent(seen, s), "pin");
  s.mode = "stun";
  assert.equal(surveyorEvent(seen, s), "fold");
  s.mode = "dead";
  assert.equal(surveyorEvent(seen, s), "dead");
});

// ───────────── Sổ Mưa ─────────────

test("Sổ Mưa nhiều người: Sổ cộng TRUNG BÌNH điểm các cược; người ngoài bến không tính", () => {
  assert.equal(ledgerGain([0], [3], [1, 1, 1, 1]), 1);
  assert.equal(ledgerGain([0, 3], [3], [2, 1, 1, 4]), 1);
  assert.equal(ledgerGain([0, -1], [3], [2, 1, 1, 4]), 2);
  assert.equal(ledgerGain([-1, -1], [3], [2, 1, 1, 4]), 0);
  const l = newLedger(5, 0);
  l.mode = "fight";
  l.nextAt = 0;
  tickLedger(l, 1, laneCenter(0), 0, [laneCenter(3), 0, 50, 0]);
  const d = l.draw!;
  const T = drawTimes(d.k);
  tickLedger(l, 1 + T.commit, laneCenter(0), 0, [laneCenter(3), 0, 50, 0]);
  assert.deepEqual(d.bets, [0, 3, -1]);
  tickLedger(l, 1 + T.reveal(0), 0, 0);
  assert.equal(l.points, ledgerGain([0, 3, -1], d.lanes, l.bag.pay));
});

test("Sổ Mưa: khách áp gói → cùng lượt rút / làn mưa; mưa trúng khách một lần", () => {
  const host = newLedger(6, 0);
  const guest = newLedger(77, 0);
  host.mode = "fight";
  host.nextAt = 0;
  tickLedger(host, 5, 0, 0);
  const sh = 0;
  applyLedger(guest, JSON.parse(JSON.stringify(packLedger(host, sh))), sh);
  const d = host.draw!;
  assert.deepEqual(guest.draw!.lanes, d.lanes);
  assert.deepEqual(guest.bag, host.bag);
  const T = drawTimes(d.k);
  const u = laneCenter(d.lanes[0]);
  let dmg = 0;
  for (let t = d.t0 + T.rain(0); t < d.t0 + T.rain(0) + RL.RAIN_MS; t += 30) {
    dmg += ledgerHurt(guest, t, u, 0);
    applyLedger(guest, packLedger(host, sh), sh);
  }
  assert.equal(dmg, RL.DMG.rain);
});

// ───────────── Đêm Đèn lồng ─────────────

test("Đèn lồng: khách áp gói → cùng đợt, cùng gốc pha; bố trí bướm tất định", () => {
  const e = newEvent();
  startEvent(e, 100, 0, 0);
  e.state = "wave";
  e.wave = 2;
  e.waveAt = 5000;
  const g = newEvent();
  applyLantern(g, JSON.parse(JSON.stringify(packLantern(e, 1.234, 5, 8, 0b10110101, 700))), 200);
  assert.equal(g.state, "wave");
  assert.equal(g.wave, 2);
  assert.equal(g.waveAt, 5000 + 700 - 200);
  const a = mothSlot(3, 8, LN.R_MIN, LN.R_MAX);
  assert.deepEqual(a, mothSlot(3, 8, LN.R_MIN, LN.R_MAX));
  assert.ok(a.r >= LN.R_MIN && a.r <= LN.R_MAX);
});
