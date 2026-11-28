import { test } from "node:test";
import assert from "node:assert/strict";
import { actRun, chamberOf, isComp, newRun, packRun, seatJoin, seatLeave, spawnFor, startRun, tickRun, validCode, makeCode, type Run } from "../../lib/world/vault/run";
import { bridgeGeos, graphById, type KState } from "../../lib/world/vault/konigsberg";
import { CAT, LEVER, SW_H, beamY, fallV, STONE_Z, type BState } from "../../lib/world/vault/balance";
import { pedestal, PODIUM, type FState } from "../../lib/world/vault/fourier";
import { ROPES, sigil, plate, type TState } from "../../lib/world/vault/threshold";
import { rng, type V3 } from "../../lib/world/vault/geom";
import { eulerTrails, walkTrail } from "./vaultHelpers";

/** Người chơi giả lập: vị trí "me" của ghế 0, đồng hồ now */
function harness(r: Run, t0: number) {
  const h = {
    now: t0,
    me: [0, 0, 0] as V3,
    tick(secs: number, each?: () => void) {
      for (let t = 0; t < secs - 1e-9; t += 0.1) {
        h.now += 100;
        each?.();
        tickRun(r, [h.me], h.now, 0.1);
      }
    },
    /** chờ tới khi cond đúng (tối đa secs) */
    until(cond: () => boolean, secs: number, each?: () => void) {
      for (let t = 0; t < secs && !cond(); t += 0.1) h.tick(0.1, each);
      return cond();
    },
    act(a: Record<string, unknown>) {
      return actRun(r, 0, a as { k: string }, h.now, h.me);
    },
    ping(kind: string, x: number, y: number, z: number, extra: Record<string, unknown> = {}) {
      h.tick(0.6);
      return h.act({ k: "ping", kind, x, y, z, ...extra });
    },
    echoIdle: () => !r.seats[1].path.length,
  };
  return h;
}

test("mã tổ đội: 4 ký tự từ bảng chữ không gây nhầm", () => {
  const c = makeCode(rng(3));
  assert.ok(validCode(c));
  assert.equal(validCode("AB0O"), false);
  assert.equal(validCode("ACD"), false);
});

test("ghế theo uid: kết nối lại giữ ghế; người thứ 5 bị từ chối; sau khi bắt đầu, người mới thay Tiếng Vọng", () => {
  const r = newRun("ACDE", 1, 0);
  assert.equal(seatJoin(r, "u1", "A", 0), 0);
  assert.equal(seatJoin(r, "u2", "B", 0), 1);
  assert.equal(seatJoin(r, "u3", "C", 0), 2);
  assert.equal(seatJoin(r, "u4", "D", 0), 3);
  assert.equal(seatJoin(r, "u5", "E", 0), -1);
  assert.equal(seatJoin(r, "u2", "B", 10), 1);
  const s = newRun("ACDF", 2, 0);
  seatJoin(s, "u1", "A", 0);
  startRun(s, 0);
  assert.equal(s.n, 2);
  assert.equal(s.seats[1].uid, null);
  // rời giữa chừng → Tiếng Vọng giữ ghế; quay lại trong 120 s → lấy lại đúng ghế
  seatLeave(s, "u1", 1000);
  assert.equal(isComp(s.seats[0]), true);
  assert.equal(seatJoin(s, "u9", "Z", 2000), 1, "người mới thay ghế Tiếng Vọng");
  assert.equal(s.n, 2, "N đã khoá");
  assert.equal(seatJoin(s, "u8", "Y", 3000), -1, "ghế người vừa rời còn trong 120 s");
  assert.equal(seatJoin(s, "u1", "A", 4000), 0);
  assert.equal(isComp(s.seats[0]), false);
});

test("gói gửi mạng không chứa uid", () => {
  const r = newRun("ACDE", 1, 0);
  seatJoin(r, "secret-uid-123", "A", 0);
  assert.ok(!JSON.stringify(packRun(r)).includes("secret-uid-123"));
});

test("gợi ý: hỏi → chờ 5 s (ai cũng bấm được 'Chưa cần') → lên bậc; một mình thì hiện ngay", () => {
  const r = newRun("ACDE", 1, 0);
  seatJoin(r, "u1", "A", 0);
  seatJoin(r, "u2", "B", 0);
  startRun(r, 0);
  const pos: (V3 | null)[] = [spawnFor(r, 0), spawnFor(r, 1)];
  assert.equal(actRun(r, 0, { k: "hint" }, 100, pos[0]), true);
  tickRun(r, pos, 3000, 0.1);
  assert.equal(r.hint.lv, 0);
  assert.equal(actRun(r, 1, { k: "notyet" }, 3100, pos[1]), true);
  tickRun(r, pos, 6000, 0.1);
  assert.equal(r.hint.lv, 0, "đã huỷ");
  actRun(r, 1, { k: "hint" }, 7000, pos[1]);
  tickRun(r, pos, 12100, 0.1);
  assert.equal(r.hint.lv, 1);
  const solo = newRun("SOLO", 1, 0, true);
  seatJoin(solo, "me", "Me", 0);
  startRun(solo, 0);
  actRun(solo, 0, { k: "hint" }, 10, spawnFor(solo, 0));
  assert.equal(solo.hint.lv, 1);
});

test("đếm ngược: chỉ một lần chạy cùng lúc", () => {
  const r = newRun("ACDE", 1, 0);
  seatJoin(r, "u1", "A", 0);
  startRun(r, 0);
  assert.equal(actRun(r, 0, { k: "count" }, 1000, null), true);
  assert.equal(r.count.at, 4000);
  assert.equal(actRun(r, 0, { k: "count" }, 2000, null), false);
  assert.equal(actRun(r, 0, { k: "count" }, 5300, null), true);
});

test("động từ phòng bị bỏ khi sai chỗ / sai pha / số rác", () => {
  const r = newRun("ACDE", 1, 0);
  seatJoin(r, "u1", "A", 0);
  assert.equal(actRun(r, 0, { k: "ring" }, 0, [ROPES[0][0], 0, 0]), false, "chưa bắt đầu");
  startRun(r, 0);
  assert.equal(actRun(r, 0, { k: "ping", kind: "here", x: Number.NaN, y: 0, z: 0 }, 10, [0, 0, 0]), false);
  assert.equal(actRun(r, 0, { k: "ping", kind: "hack", x: 0, y: 0, z: 0 }, 20, [0, 0, 0]), false);
  assert.equal(actRun(r, 0, { k: "ping", kind: "here", x: 500, y: 0, z: 0 }, 30, [0, 0, 0]), false, "ping quá xa");
  assert.equal(actRun(r, 0, { k: "say", id: "<b>hi</b>" }, 40, [0, 0, 0]), false, "chỉ câu có sẵn");
  assert.equal(actRun(r, 0, { k: "say", id: "nice" }, 50, [0, 0, 0]), true);
  assert.equal(actRun(r, 0, { k: "dial", i: 0, v: 1 }, 60, [0, 0, 0]), false, "không phải phòng Hợp xướng");
});

test("một lượt trọn vẹn chơi MỘT MÌNH: Tiếng Vọng chỉ làm theo ping (không tự giải) — Ngưỡng cửa → Königsberg → Cân → Hợp xướng → Cỗ máy Định lý", () => {
  const r = newRun("SOLO", 42, 1_000_000, true);
  assert.equal(seatJoin(r, "me", "Me", 1_000_000), 0);
  assert.equal(startRun(r, 1_000_000), true);
  assert.equal(r.n, 2);
  const h = harness(r, 1_000_000);
  h.me = spawnFor(r, 0);

  // ── Ngưỡng cửa ──
  const t = () => r.st as TState;
  const [s0x, s0z] = sigil(2, 0);
  const [s1x, s1z] = sigil(2, 1);
  h.me = [s0x, 0, s0z];
  h.ping("here", s1x, 0, s1z);
  assert.ok(h.until(() => t().beat >= 1, 8), "nhịp 1: mọi ấn ký có người");
  h.me = [ROPES[0][0] + 0.7, 0, 0.5];
  h.ping("use", ROPES[1][0], 0, ROPES[1][1]);
  assert.ok(h.until(h.echoIdle, 8));
  assert.equal(r.seats[1].task, "ring");
  // không đếm ngược: kéo một mình thì không đủ
  h.act({ k: "ring" });
  h.tick(1);
  assert.equal(t().beat, 1);
  h.act({ k: "count" });
  h.until(() => r.count.go, 4);
  h.act({ k: "ring" });
  assert.equal(t().beat, 2, "hai dây kéo trong 0,5 s nhờ đếm ngược");
  h.ping("here", t().plate[0], 0, t().plate[1]);
  assert.ok(h.until(() => chamberOf(r) === "konigsberg", 12), "phiến ẩn có người đứng → sang Königsberg");

  // ── Königsberg: 3 màn, mỗi màn 2 sợi chỉ (người + Tiếng Vọng) ──
  for (let sg = 0; sg < 3; sg++) {
    assert.equal(r.sg, sg);
    assert.equal(r.phase, "play");
    const st = () => r.st as KState;
    const g = graphById(st().g);
    const [mine, echo] = eulerTrails(g);
    // Tiếng Vọng: chỉ đảo bắt đầu rồi từng cây cầu
    const S = g.islands[echo.start];
    h.ping("here", S.x, 0, S.z);
    assert.ok(h.until(h.echoIdle, 15), "lượn xuống đảo");
    assert.equal(st().tr[1].s, echo.start);
    let at = echo.start;
    for (const e of echo.edges) {
      const b = g.bridges[e];
      const other = b.a === at ? b.b : b.a;
      // ping thẳng vào giữa cầu ("đi đường này")
      const geo = bridgeGeos(g)[e];
      const m = geo.pts.length / 2;
      h.ping("go", geo.pts[m - 1], 0.5, geo.pts[m]);
      assert.ok(h.until(h.echoIdle, 15));
      assert.equal(st().lit[e], 1, `Tiếng Vọng thắp cầu ${e}`);
      at = other;
    }
    // người chơi tự đi sợi chỉ của mình
    const walk = walkTrail(g, mine, 0.2, rng(sg));
    let k = 0;
    h.until(() => r.phase !== "play", 60, () => {
      if (k < walk.length) h.me = walk[k++];
    });
    assert.equal(r.phase, "clear", `xong màn ${sg + 1}`);
    h.until(() => r.phase !== "clear", 4);
  }
  assert.equal(r.phase, "reveal");
  h.act({ k: "ready" });
  assert.equal(chamberOf(r), "balance");

  // ── Cân Archimedes ──
  const bs = () => r.st as BState;
  const onBeam = (x: number) => () => (h.me = [x, beamY(bs().th, x), 0]);
  h.ping("here", -5, beamY(0, -5), 0);
  assert.ok(h.until(() => r.phase === "clear", 15, onBeam(-7)), "màn 1: (−7) + (−5) cân đá 2×6");
  h.until(() => r.phase === "play", 4);
  assert.equal(r.sg, 1);
  for (let i = 0; i < 12 && bs().sx > -7; i++) {
    const x = bs().sx + 0.8;
    h.me = [x, beamY(bs().th, x), STONE_Z + 0.9];
    h.tick(0.4);
    h.act({ k: "push" });
  }
  assert.equal(bs().sx, -7, "đẩy đá sang hẳn bên trái");
  h.ping("here", 7, beamY(0, 7), 0);
  assert.ok(h.until(() => r.phase === "clear", 15, onBeam(7)), "màn 2: cả đội ở khắc 7, đá ở −7");
  h.until(() => r.phase === "play", 4);
  assert.equal(r.sg, 2);

  // ── màn 3: máy bắn đá (N = 2: mình + Tiếng Vọng) ──
  const cat = () => bs().cat!;
  const launches = () => r.ev.filter((e) => e.k === "launch");
  // A: Tiếng Vọng lên đỉnh cột gió, mình ngồi ghế bắn; 3-2-1 → Tiếng Vọng bổ nhào lúc GO → mình bay ≥ 4,5 m
  h.ping("use", CAT.padX, CAT.y, CAT.z);
  assert.ok(h.until(h.echoIdle, 15), "Tiếng Vọng lên tới đỉnh cột gió");
  assert.ok(r.seats[1].p[1] > CAT.top - 0.5 && String(r.seats[1].task) === "plunge");
  h.me = [CAT.seatX, CAT.y, CAT.z];
  assert.ok(h.act({ k: "count" }));
  assert.ok(h.until(() => launches().length > 0, 5), "có cú bắn sau GO");
  const l1 = launches().pop()!;
  assert.equal(l1.by, 0, "mình (trên ghế) được bắn");
  assert.ok(Number(l1.s!.split("|")[1]) >= SW_H[0], `bay ${l1.s}`);
  assert.deepEqual(cat().sw, [true, false]);
  // động từ rác / sai chỗ bị bỏ
  assert.equal(h.act({ k: "plunge", vy: 999 }), false);
  assert.equal(h.act({ k: "plunge", vy: fallV(10) }), false, "không đứng trên bệ đáp");
  assert.equal(h.act({ k: "socket", i: 2 }), false, "không đứng ở cần gạt");
  // B: dời điểm tựa sang ổ xa, rồi mình + Tiếng Vọng cùng bổ nhào lúc GO (ghế trống → Quả cân bay)
  h.me = [LEVER.x, CAT.y - 0.6, LEVER.z];
  assert.ok(h.act({ k: "socket", i: 2 }));
  assert.ok(h.until(h.echoIdle, 15), "Tiếng Vọng bay lại lên đỉnh");
  const top: V3 = [CAT.padX, CAT.top, CAT.z + 0.4];
  h.me = top;
  h.tick(0.3);
  assert.ok(h.act({ k: "count" }));
  const go = r.count.at;
  h.until(() => h.now >= go + 400, 5, () => (h.me = top));
  h.me = [CAT.padX, CAT.y, CAT.z + 0.4];
  assert.ok(h.act({ k: "plunge", vy: fallV(10) }), "cú chạm của mình được nhận");
  assert.ok(h.until(() => launches().length > 1, 2));
  const l2 = launches().pop()!;
  assert.equal(l2.by, -1, "Quả cân Bổ đề bay");
  assert.equal(l2.s!.split("|")[2], "2", "hai người cùng chạm");
  assert.ok(h.until(() => r.phase === "clear", 4), "màn 3: cả hai chuông kêu");
  h.until(() => r.phase === "reveal", 4);
  h.act({ k: "ready" });
  assert.equal(chamberOf(r), "fourier");

  // ── Dàn hợp xướng Fourier ──
  const fs = () => r.st as FState;
  for (let sg = 0; sg < 3; sg++) {
    const p0 = pedestal(fs(), 0);
    const p1 = pedestal(fs(), 1);
    if (fs().cond) {
      // màn 3: ghé bục Nhạc trưởng xem phổ trước (thông tin chỉ có ở đó)
      h.me = [PODIUM.x, 0, PODIUM.z];
      h.tick(0.5);
    }
    h.me = [p0.x, 0, p0.z];
    h.act({ k: "dial", i: 0, v: fs().tg[0] });
    h.ping("use", p1.x, 0, p1.z);
    assert.ok(h.until(h.echoIdle, 15));
    const want = fs().tg[1];
    for (let i = 0; i < 20 && Math.abs(fs().amp[1] - want) > 1e-6; i++) h.ping("val", p1.x, 1, p1.z, { t: 1, v: want > fs().amp[1] ? "+" : "-" });
    assert.ok(Math.abs(fs().amp[1] - want) < 1e-6, `Tiếng Vọng vặn ống 2 tới ${want}`);
    assert.ok(h.until(() => r.phase === "clear", 6), `xong màn hợp xướng ${sg + 1}`);
    h.until(() => r.phase !== "clear", 4);
  }
  assert.equal(r.phase, "reveal");
  h.act({ k: "ready" });
  assert.equal(chamberOf(r), "finale");

  // ── Cỗ máy Định lý ──
  const [q0x, q0z] = plate(2, 0);
  const [q1x, q1z] = plate(2, 1);
  h.me = [q0x, 0, q0z];
  h.ping("here", q1x, 0, q1z);
  assert.ok(h.until(() => r.phase === "done", 20), "Định lý phục hồi");
  assert.ok(r.seats[1].sc.br > 0 && r.seats[0].sc.push > 0 && r.seats[1].sc.dial > 0);
});
