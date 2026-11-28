import { test } from "node:test";
import assert from "node:assert/strict";
import { BEAM, CAT, CHASM_Y, FALL_MAX, G_PLUNGE, G_UP, LEVER, SOCKETS, STONE_Z, SW_H, SW_TOL, TOWER, VY_MAX, armOf, bBlocked, bClear, bGround, bInit, bPush, bTick, beamY, cClaim, cInit, cResolve, cSocket, cTrack, catArms, catapultV, fallV, launchH, onPad, onSeat, shotH, slideDir, stoneFor, tiltTarget, torque } from "../../lib/world/vault/balance";
import type { V3 } from "../../lib/world/vault/geom";

const on = (x: number, th = 0): V3 => [x, beamY(th, x), 0];
function run(st: ReturnType<typeof bInit>, pos: (V3 | null)[], secs: number) {
  for (let t = 0; t < secs; t += 0.1) bTick(st, pos.map((p) => (p ? [p[0], beamY(st.th, p[0]), p[2]] : null)), 0.1);
}

test("cân: bố trí đối xứng → mô-men 0, đòn về thăng bằng", () => {
  const st = bInit(0, 2);
  st.m = 0;
  run(st, [on(-4), on(4)], 3);
  assert.equal(st.tau, 0);
  assert.ok(Math.abs(st.th) < 1e-3);
});

test("màn 1: mô-men của đá cần ĐỦ N người: 7(N−1) < M·D ≤ 7N", () => {
  for (let n = 2; n <= 4; n++) {
    const s = stoneFor(0, n);
    assert.ok(s.m * s.x > 7 * (n - 1) && s.m * s.x <= 7 * n, `N = ${n}: M·D = ${s.m * s.x}`);
  }
});

test("màn 1 (N = 2): một người ở khắc 7 chưa đủ; hai người (−7, −5) cân bằng giữ 2 s → xong", () => {
  const st = bInit(0, 2);
  run(st, [on(-7), null], 3);
  assert.ok(st.th > 0.05, "đầu phải (có đá) chúi xuống");
  assert.equal(bClear(st), false);
  run(st, [on(-7), on(-5)], 1.2);
  assert.equal(st.tau, 0);
  assert.equal(bClear(st), false);
  run(st, [on(-7), on(-5)], 1.2);
  assert.equal(bClear(st), true);
});

test("cánh tay đòn = khắc gần nhất; đứng ngoài đòn không tính", () => {
  assert.equal(armOf(0, -6.4, BEAM.y, 0.2), -6);
  assert.equal(armOf(0, 7.8, BEAM.y, 0), 7);
  assert.equal(armOf(0, -11, BEAM.y, 0), null);
  assert.equal(armOf(0, 2, BEAM.y, 3), null);
  assert.equal(torque([-7, null, 3], 2, 6), 8);
});

test("nghiêng có giới hạn, chỉ trượt khi quá 6°", () => {
  assert.ok(tiltTarget(1000) <= 0.27);
  assert.equal(slideDir(0.05), 0);
  assert.equal(slideDir(0.2), 1);
  assert.equal(slideDir(-0.2), -1);
});

test("màn 2: đẩy đá phải đứng sát, đẩy xa mình, nghỉ 350 ms", () => {
  const st = bInit(1, 2);
  assert.equal(st.sx, 3);
  assert.equal(bPush(st, -3, 0, 1000), false, "đứng xa");
  assert.equal(bPush(st, 3.8, STONE_Z + 0.9, 1000), true);
  assert.equal(st.sx, 2, "đứng bên phải → đá sang trái");
  assert.equal(bPush(st, 2.8, STONE_Z + 0.9, 1100), false, "chưa hết nghỉ");
  assert.equal(bPush(st, 1.2, STONE_Z + 0.9, 1500), true);
  assert.equal(st.sx, 3, "đứng bên trái → đá sang phải");
});

test("màn 2 làm được với mọi N: đá ở −7, cả đội ở khắc 7 → thăng bằng và xong", () => {
  for (let n = 2; n <= 4; n++) {
    const st = bInit(1, n);
    st.sx = -7;
    run(st, Array.from({ length: n }, () => on(7)), 3);
    assert.equal(bClear(st), true, `N = ${n}`);
  }
  // đứng ở đầu phải nhưng đá chưa sang trái → không cân
  const st = bInit(1, 2);
  run(st, [on(7), on(7)], 3);
  assert.equal(bClear(st), false);
});

test("mặt đất: bệ hai bên, đòn nghiêng theo θ, ngoài đó là vực", () => {
  assert.equal(bGround(0, -12, 0), BEAM.y);
  assert.ok(Math.abs(bGround(0.1, 4, 0) - (BEAM.y - 4 * Math.tan(0.1))) < 1e-9);
  assert.equal(bGround(0, 0, 4), CHASM_Y);
});

// ───────────── Màn 3: máy bắn đá ─────────────

const L5 = CAT.seatX - CAT.padX;
const armsOf = (r: number) => ({ d1: L5 / (1 + r), d2: (L5 * r) / (1 + r) });

test("máy bắn: va chạm không đàn hồi BẢO TOÀN mô-men động lượng, động năng không tăng", () => {
  for (const m1 of [1, 2, 3])
    for (const r of [0.5, Math.SQRT1_2, 1, Math.SQRT2, 2])
      for (const v1 of [10, 20, VY_MAX]) {
        const { d1, d2 } = armsOf(r);
        const v2 = catapultV(m1, v1, d1, d2, 1);
        const w = v2 / d2;
        // trước: chỉ người rơi quay quanh trục; sau: cả hai cùng quay với ω
        assert.ok(Math.abs(m1 * v1 * d1 - (m1 * d1 * d1 + d2 * d2) * w) < 1e-9, "L trước = L sau");
        const keIn = 0.5 * m1 * v1 * v1;
        const keOut = 0.5 * m1 * (w * d1) ** 2 + 0.5 * v2 * v2;
        assert.ok(keOut <= keIn + 1e-9, `động năng không tăng (m₁ = ${m1}, r = ${r})`);
      }
  // một người, hai cánh tay bằng nhau → v₂ = v₁ / 2 (giới hạn trong thiết kế)
  assert.ok(Math.abs(catapultV(1, 20, 2.5, 2.5, 1) - 10) < 1e-12);
  assert.equal(catapultV(0, 20, 2.5, 2.5, 1), 0);
});

test("máy bắn: bay < rơi với 1–2 người rơi, mọi ổ, mọi độ cao (không có năng lượng miễn phí)", () => {
  for (const n of [1, 2])
    for (let sock = 0; sock < SOCKETS.length; sock++)
      for (let h1 = 1; h1 <= FALL_MAX; h1 += 0.5) assert.ok(shotH(n, h1, sock) < h1, `n = ${n}, ổ ${sock}, rơi ${h1} m → bay ${shotH(n, h1, sock).toFixed(2)} m`);
  // độ rơi bị kẹp: rơi 50 m cũng chỉ tính FALL_MAX
  assert.equal(fallV(50), fallV(FALL_MAX));
  assert.ok(Math.abs(launchH(fallV(10)) * G_UP - 10 * G_PLUNGE) < 1e-9);
});

test("máy bắn: hai người cùng rơi bay cao hơn một người (mọi ổ); ba người còn cao hơn", () => {
  for (let sock = 0; sock < SOCKETS.length; sock++) {
    assert.ok(shotH(2, 10, sock) > shotH(1, 10, sock));
    assert.ok(shotH(3, 10, sock) > shotH(2, 10, sock));
  }
});

test("máy bắn: tỉ lệ cánh tay là sự đánh đổi — 1 người tốt nhất ở d₂/d₁ = 1, 2 người tốt nhất ở √2", () => {
  const best = (n: number) => {
    let br = 0;
    let bv = -1;
    for (let r = 0.3; r <= 3; r += 0.01) {
      const { d1, d2 } = armsOf(r);
      const v = catapultV(n, 20, d1, d2, 1);
      if (v > bv) {
        bv = v;
        br = r;
      }
    }
    return br;
  };
  assert.ok(Math.abs(best(1) - 1) < 0.02, `1 người: ${best(1)}`);
  assert.ok(Math.abs(best(2) - Math.SQRT2) < 0.02, `2 người: ${best(2)}`);
  // ổ giữa tốt nhất cho 1 người, ổ xa tốt nhất cho 2 người
  assert.ok(shotH(1, 10, 1) > shotH(1, 10, 0) && shotH(1, 10, 1) > shotH(1, 10, 2));
  assert.ok(shotH(2, 10, 2) > shotH(2, 10, 1) && shotH(2, 10, 2) > shotH(2, 10, 0));
  // cánh tay đòn theo ổ: d₁ + d₂ = khoảng bệ – ghế, d₂/d₁ đúng tỉ số
  for (let i = 0; i < SOCKETS.length; i++) {
    const a = catArms(i);
    assert.ok(Math.abs(a.d1 + a.d2 - L5) < 1e-12 && Math.abs(a.d2 / a.d1 - SOCKETS[i]) < 1e-12);
  }
});

test("máy bắn: chuông A cần 1 người (ổ giữa), chuông B cần 2 người cùng lúc + ổ xa; với N = 2…4 đều làm được", () => {
  // ngưỡng thật (có dung sai chạm chuông)
  const [A, B] = SW_H.map((h) => h - SW_TOL);
  // rơi từ đỉnh cột gió (10 m) — Tiếng Vọng luôn rơi từ đây; người thật lượn quanh đỉnh: rơi ≈ 9,7–10,8 m
  assert.ok(shotH(1, CAT.up, 1) >= SW_H[0], "1 người, ổ giữa, từ đỉnh → A (đúng 4,5 m)");
  assert.ok(shotH(1, 9.7, 1) >= A, "1 người hơi thấp hơn đỉnh vẫn tới A");
  for (const s of [0, 2]) assert.ok(shotH(1, CAT.up, s) < A, `1 người ở ổ ${s} hụt A`);
  for (let s = 0; s < 3; s++) assert.ok(shotH(1, FALL_MAX, s) < B, "1 người không bao giờ tới B");
  assert.ok(shotH(2, FALL_MAX, 1) < B, "2 người ở ổ giữa vẫn hụt B dù rơi tối đa (gần thôi!)");
  assert.ok(shotH(2, FALL_MAX, 0) < B);
  assert.ok(shotH(2, CAT.up, 2) >= SW_H[1], "2 người cùng lúc + ổ xa, từ đỉnh → B (9,1 m)");
  assert.ok(shotH(2, 9.7, 2) >= B, "2 người rơi hơi thấp vẫn tới B");
  // N người: tối đa N người rơi (khi Quả cân Bổ đề được bắn) — luôn đủ 2 người cho B, 1 người cho A
  for (let n = 2; n <= 4; n++) {
    assert.ok(n >= 2 && shotH(2, CAT.up, 2) >= B, `N = ${n}: 2 người rơi + Quả cân / người thứ 3 bay`);
    assert.ok(n - 1 >= 1 && shotH(1, CAT.up, 1) >= A, `N = ${n}: 1 người rơi, 1 người bay`);
  }
});

const PAD: V3 = [CAT.padX, CAT.y, CAT.z];
const SEAT: V3 = [CAT.seatX, CAT.y, CAT.z];
const TOP: V3 = [CAT.padX, CAT.top, CAT.z];

test("máy bắn: server kiểm cú chạm (đứng trên bệ, vừa ở cột gió ≤ 3 s, vy ≤ trần, không rác)", () => {
  const c = cInit(3);
  const v = fallV(10);
  assert.equal(cClaim(c, 0, v, PAD, 1000), "", "chưa từng lên cột gió");
  cTrack(c, [TOP, null, null], 1000);
  assert.equal(cClaim(c, 0, v, [CAT.padX + 2, CAT.y, CAT.z], 1500), "", "không đứng trên bệ đáp");
  assert.equal(cClaim(c, 0, VY_MAX + 5, PAD, 1500), "", "vy vượt trần (gian lận)");
  assert.equal(cClaim(c, 0, NaN, PAD, 1500), "");
  assert.equal(cClaim(c, 0, v, PAD, 4500), "", "bổ nhào quá 3 s sau khi rời cột gió");
  cTrack(c, [TOP, null, null], 5000);
  assert.equal(cClaim(c, 0, v, PAD, 5300), "ok");
  assert.equal(cClaim(c, 0, v, PAD, 5350), "", "một người chỉ tính một lần mỗi nhóm");
  assert.equal(cClaim(c, 9, v, PAD, 5350), "", "ghế không tồn tại");
  // vy hơi quá trần (sai số) → nhận nhưng kẹp
  const d = cInit(1);
  cTrack(d, [TOP], 0);
  assert.equal(cClaim(d, 0, VY_MAX + 0.5, PAD, 100), "ok");
  assert.equal(d.grp?.imp[0].v, VY_MAX);
});

test("máy bắn: gom cú chạm trong 250 ms; chạm trễ bị phí; người trên ghế được bắn, không ai thì bắn Quả cân", () => {
  const c = cInit(3);
  c.sock = 2;
  const v = fallV(10);
  cTrack(c, [TOP, TOP, null], 0);
  assert.equal(cClaim(c, 0, v, PAD, 1000), "ok");
  assert.equal(cClaim(c, 1, v, PAD, 1200), "ok", "200 ms sau → cùng nhóm");
  assert.equal(cResolve(c, [PAD, PAD, SEAT], 1200), null, "chưa đủ 250 ms");
  const L = cResolve(c, [PAD, PAD, SEAT], 1300);
  assert.ok(L && L.n === 2 && L.by === 2, "2 người rơi, ghế 2 ngồi ghế bắn");
  assert.ok(Math.abs(L!.h - shotH(2, 10, 2)) < 0.01);
  assert.equal(c.sw[0], true, "A kêu");
  assert.equal(c.sw[1], false, "B bị niêm cho tới khi A đã kêu từ cú TRƯỚC");
  // trễ: chạm 300 ms sau cú bắn → phí
  cTrack(c, [TOP, null, null], 1300);
  assert.equal(cClaim(c, 0, v, PAD, 1600), "late");
  // nhóm mới, người thứ hai tới sau 300 ms → trễ, cú bắn chỉ tính 1 người
  cTrack(c, [TOP, TOP, null], 3000);
  assert.equal(cClaim(c, 0, v, PAD, 3100), "ok");
  assert.equal(cClaim(c, 1, v, PAD, 3400), "late");
  const L2 = cResolve(c, [PAD, PAD, null], 3400);
  assert.ok(L2 && L2.n === 1 && L2.by === -1, "không ai trên ghế → Quả cân Bổ đề bay");
  assert.equal(c.sw[1], false, "1 người ở ổ xa không tới B");
  // lần này hai người cùng lúc → B
  cTrack(c, [TOP, TOP, null], 5000);
  cClaim(c, 0, v, PAD, 5100);
  cClaim(c, 1, v, PAD, 5150);
  const L3 = cResolve(c, [PAD, PAD, null], 5400);
  assert.ok(L3 && L3.h >= SW_H[1]);
  assert.equal(c.sw[1], true);
});

test("máy bắn: dời điểm tựa phải đứng ở cần gạt, không đổi giữa nhóm chạm; màn 3 xong khi cả hai chuông kêu và giữ 2 s", () => {
  const st = bInit(2, 2);
  const c = st.cat!;
  assert.equal(c.sock, 1);
  assert.equal(cSocket(c, 2, 5, -14), false, "xa cần gạt");
  assert.equal(cSocket(c, 2, LEVER.x, LEVER.z), true);
  assert.equal(cSocket(c, 7, LEVER.x, LEVER.z), false);
  c.grp = { t0: 0, imp: [] };
  assert.equal(cSocket(c, 0, LEVER.x, LEVER.z), false, "đang có nhóm chạm");
  c.grp = null;
  bTick(st, [null, null], 0.1);
  assert.equal(bClear(st), false);
  c.sw = [true, true];
  for (let t = 0; t < 2.1; t += 0.1) bTick(st, [null, null], 0.1);
  assert.equal(bClear(st), true);
  assert.equal(st.th, 0, "đòn cân phía trước đứng yên (đá ở giữa)");
});

test("máy bắn: mặt đất sân / bập bênh / vực; thân tháp chắn đường", () => {
  assert.equal(bGround(0, CAT.padX, CAT.z, 2), CAT.y);
  assert.equal(bGround(0, -7, -8, 2), BEAM.y);
  assert.equal(bGround(0, 0, 0, 2), CHASM_Y, "màn 3 không đi trên đòn cân");
  assert.equal(bGround(0, 0, -20, 2), CHASM_Y);
  assert.equal(bBlocked(0, TOWER.x, TOWER.z, BEAM.y, 2), true);
  assert.equal(bBlocked(0, -7, -8, BEAM.y, 2), false);
  assert.ok(onPad(CAT.padX + 1, CAT.z) && !onPad(CAT.padX + 1.3, CAT.z));
  assert.ok(onSeat(CAT.seatX, CAT.y, CAT.z) && !onSeat(CAT.seatX, CAT.y + 3, CAT.z));
});
