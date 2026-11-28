import { test } from "node:test";
import assert from "node:assert/strict";
import { evalShared } from "@/lib/world/witchGoiXepIm";
import {
  KEV,
  KTR,
  KTR_BEAT,
  KTR_DANGER_EXPR,
  KTR_K,
  KTR_SUM_EXPR,
  KTR_TEXT,
  ktrA2,
  ktrBeat,
  ktrDanger,
  ktrHideSum,
  ktrLocked,
  ktrPh,
  ktrR,
  ktrText,
  ktrUniforms,
  newKtr,
  sumAmp,
  sumWave,
  tickKtr,
  turnKtr,
  type KtrSim,
} from "@/lib/world/witchKhoangTru";

/** lặp mô phỏng từ t tới t1 với bước dt, người chơi đứng (pu, pv) gần sân; trả về mọi sự kiện gộp + thời điểm cuối */
function run(s: KtrSim, t: number, t1: number, pu = KTR.L / 2, pv = KTR.W + 1.5, dt = 1 / 30) {
  let ev = 0;
  const log: [number, number][] = [];
  for (; t < t1; t += dt) {
    const e = tickKtr(s, t, pu, pv, 3);
    if (e) log.push([t, e]);
    ev |= e;
  }
  return { ev, t, log };
}
function fightAt(): { s: KtrSim; t: number } {
  const s = newKtr();
  tickKtr(s, 0, 0, 0, 2);
  const r = run(s, 0, KTR.REVEAL + 0.1);
  assert.equal(s.stage, "fight");
  return { s, t: r.t };
}

test("Khoảng Trừ: biên độ tổng R = √(A₁² + A₂² + 2A₁A₂cos φ) khớp đỉnh thật của dải tổng; triệt tiêu chỉ khi A₂ = A₁ và φ = 180°", () => {
  assert.ok(Math.abs(sumAmp(1, 1, 180)) < 1e-12);
  assert.ok(Math.abs(sumAmp(1, 0.5, 180) - 0.5) < 1e-12, "đảo pha với nửa biên độ vẫn còn sóng R = ½");
  assert.ok(Math.abs(sumAmp(1, 1, 0) - 2) < 1e-12);
  assert.ok(Math.abs(sumAmp(1, 1, 90) - Math.SQRT2) < 1e-12);
  for (const a2 of KTR.AMPS)
    for (const ph of KTR.PHASES) {
      let mx = 0;
      for (let i = 0; i <= 2000; i++) mx = Math.max(mx, Math.abs(sumWave((i / 2000) * KTR.LAMBDA, 1, a2, ph, 0.3)));
      assert.ok(Math.abs(mx - sumAmp(1, a2, ph)) < 2e-3, `đỉnh dải tổng = R (A₂ = ${a2}, φ = ${ph})`);
      const zero = a2 === 1 && ph === 180;
      assert.equal(sumAmp(1, a2, ph) <= KTR.EPS, zero, `R = 0 chỉ ở A₂ = 1, φ = 180 (${a2}, ${ph})`);
    }
  assert.ok(Math.abs(KTR_K - (2 * Math.PI) / KTR.LAMBDA) < 1e-12);
});

test("Khoảng Trừ: vùng hiểm VẼ (KTR_DANGER_EXPR — chuỗi GLSL chạy bằng JS) == vùng hiểm của LUẬT ở > 40k điểm; dải tổng khớp sumWave", () => {
  let n = 0;
  let agree = 0;
  for (const a2 of KTR.AMPS)
    for (const ph of KTR.PHASES)
      for (const th of [0, 0.7, 2.1, 4.4]) {
        const U = ktrUniforms(KTR.A1, a2, ph, th);
        for (let i = 0; i < 120; i++)
          for (let j = 0; j < 10; j++) {
            const u = -0.5 + ((KTR.L + 1) * (i + 0.37)) / 120;
            const v = -0.4 + ((KTR.W + 0.8) * (j + 0.5)) / 10;
            const drawn = evalShared(KTR_DANGER_EXPR, { ...U, u, v }) as boolean;
            const rule = ktrDanger(u, v, KTR.A1, a2, ph, th);
            n++;
            if (drawn === rule) agree++;
            const y = evalShared(KTR_SUM_EXPR, { ...U, u, v }) as number;
            assert.ok(Math.abs(y - sumWave(u, KTR.A1, a2, ph, th)) < 1e-9);
          }
      }
  assert.ok(n > 40000, `${n} điểm`);
  assert.equal(agree, n, "mọi điểm khớp");
});

test("Khoảng Trừ: R = 0 → cả dải an toàn (đường trắng phẳng); R = ½ → còn vùng hiểm; luôn có dải an toàn quanh điểm 0 của dải tổng", () => {
  for (let i = 0; i <= 400; i++) for (const v of [0.1, 1, 2.5]) assert.equal(ktrDanger((i / 400) * KTR.L, v, 1, 1, 180, 1.3), false);
  let hot = 0;
  for (let i = 0; i <= 400; i++) if (ktrDanger((i / 400) * KTR.L, 1, 1, 0.5, 180, 1.3)) hot++;
  assert.ok(hot > 100, `R = ½ vẫn còn vùng hiểm (${hot}/401)`);
  // điểm 0 của dải tổng (R = 2 ở φ = 0): u với sin(ku − θ) = 0 → an toàn
  const th = 0.9;
  const u0 = (th + Math.PI) / KTR_K;
  assert.equal(ktrDanger(u0, 1, 1, 1, 0, th), false);
  assert.equal(ktrDanger(u0 + KTR.LAMBDA / 4, 1, 1, 1, 0, th), true);
  // ngoài dải luôn an toàn
  assert.equal(ktrDanger(-0.1, 1, 1, 1, 0, th), false);
  assert.equal(ktrDanger(2, KTR.W + 0.1, 1, 1, 0, th), false);
});

test("Khoảng Trừ: máy trạng thái — ngủ → (lại gần) lộ diện → chiến đấu; dập đúng 1 lần mỗi chu kỳ ở phách 6, báo trước 5 phách, núm khoá lúc chốt", () => {
  const s = newKtr();
  assert.equal(tickKtr(s, 0, 0, 0, KTR.WAKE_R + 5), 0, "xa: vẫn ngủ");
  assert.equal(s.stage, "dormant");
  assert.ok(tickKtr(s, 1, 0, 0, KTR.WAKE_R - 1) & KEV.REVEAL);
  const r = run(s, 1, 1 + KTR.REVEAL + 0.05);
  assert.ok(r.ev & KEV.FIGHT);
  assert.ok(Math.abs(s.t0 / KTR_BEAT - Math.round(s.t0 / KTR_BEAT)) < 1e-9, "chu kỳ bắt đầu ở phách nguyên");
  const r2 = run(s, r.t, s.t0 + KTR.CYCLE * KTR_BEAT * 3 + 0.01);
  const stamps = r2.log.filter(([, e]) => e & KEV.STAMP).map(([t]) => t);
  const teles = r2.log.filter(([, e]) => e & KEV.TELE).map(([t]) => t);
  assert.equal(stamps.length, 3, "3 chu kỳ → 3 lần dập");
  assert.equal(teles.length, 3);
  stamps.forEach((t, i) => {
    const b = (t - s.t0) / KTR_BEAT - i * KTR.CYCLE;
    assert.ok(b >= KTR.STAMP && b < KTR.STAMP + 0.1, `dập ở phách 6 (${b.toFixed(2)})`);
    assert.ok(t - teles[i] >= 2 * KTR_BEAT, "báo trước ≥ 2 phách");
    assert.ok(Math.abs((t - teles[i]) / KTR_BEAT - (KTR.STAMP - KTR.TELE)) < 0.1, "báo trước 5 phách");
  });
  // khoá núm trong cửa sổ chốt
  const tl = s.t0 + (3 * KTR.CYCLE + 5.7) * KTR_BEAT;
  assert.equal(ktrLocked(s, tl), true);
  assert.equal(turnKtr(s, tl, "phase"), false, "đã chốt → xoay không ăn");
  const tf = s.t0 + (3 * KTR.CYCLE + 2) * KTR_BEAT;
  assert.equal(ktrLocked(s, tf), false);
  assert.equal(ktrBeat(s, tf).b.toFixed(3), "2.000");
});

test("Khoảng Trừ: THẮNG = hiểu triệt tiêu — vòng 1 đảo pha; vòng 2 (đã đảo, nửa biên độ) vẫn còn sóng tới khi tăng A₂; vòng 3 dự đoán (che tổng)", () => {
  const { s, t: t0 } = fightAt();
  let t = t0;
  const stampOnce = () => {
    const tEnd = s.t0 + (s.stamped * KTR.CYCLE + KTR.STAMP + 0.2) * KTR_BEAT;
    const r = run(s, t, tEnd);
    // sang đầu chu kỳ kế (phách 0,5 — núm mở lại) để xoay tiếp
    const tFree = s.t0 + (s.stamped * KTR.CYCLE + 0.5) * KTR_BEAT;
    t = run(s, r.t, tFree).t;
    assert.equal(ktrLocked(s, t), s.stage !== "fight");
    return r.ev;
  };
  // vòng 1: A₂ = A₁, φ = 0 → không xoay gì: R = 2, không qua
  assert.equal(ktrA2(s), 1);
  assert.equal(ktrPh(s), 0);
  assert.equal(stampOnce() & KEV.CLEAR, 0);
  // chỉ đổi biên độ: vẫn không qua
  turnKtr(s, t, "amp");
  assert.equal(stampOnce() & KEV.CLEAR, 0);
  turnKtr(s, t, "amp");
  turnKtr(s, t, "amp");
  assert.equal(ktrA2(s), 1, "vòng về A₂ = 1");
  // đảo pha 180° (hai nấc 90°) → khoảng lặng
  turnKtr(s, t, "phase");
  turnKtr(s, t, "phase");
  assert.equal(ktrPh(s), 180);
  assert.ok(ktrR(s) <= KTR.EPS);
  assert.ok(stampOnce() & KEV.CLEAR);
  assert.equal(s.round, 1);
  // vòng 2: đã đảo pha sẵn nhưng A₂ = ½ → R = ½ → dập vẫn còn sóng
  assert.equal(ktrPh(s), 180);
  assert.equal(ktrA2(s), 0.5);
  assert.ok(Math.abs(ktrR(s) - 0.5) < 1e-12);
  assert.equal(stampOnce() & KEV.CLEAR, 0, "đảo pha với nửa biên độ chưa đủ");
  turnKtr(s, t, "amp");
  assert.ok(stampOnce() & KEV.CLEAR, "tăng A₂ bằng A₁ → triệt tiêu");
  // vòng 3: A₂ = 1,5, φ = 90°, đường tổng bị che tới lúc dập
  assert.equal(s.round, 2);
  assert.equal(ktrA2(s), 1.5);
  assert.equal(ktrPh(s), 90);
  const tb = s.t0 + (s.stamped * KTR.CYCLE + 2) * KTR_BEAT;
  assert.equal(ktrHideSum(s, tb), true, "vòng dự đoán: che đường tổng");
  t = Math.max(t, tb);
  turnKtr(s, t, "amp");
  turnKtr(s, t, "amp"); // 1,5 → 0,5 → 1
  turnKtr(s, t, "phase"); // 90 → 180
  assert.equal(ktrA2(s), 1);
  assert.equal(ktrPh(s), 180);
  const ev = stampOnce();
  assert.ok(ev & KEV.CLEAR && ev & KEV.WIN);
  assert.equal(s.stage, "done");
});

test("Khoảng Trừ: dập trúng người đứng ở vùng hiểm, tha người đứng ở điểm 0 của dải tổng hoặc ngoài dải; tất định", () => {
  const go = (pu: number, pv: number) => {
    const { s, t } = fightAt();
    const tEnd = s.t0 + (KTR.STAMP + 0.2) * KTR_BEAT;
    return { r: run(s, t, tEnd, pu, pv), s };
  };
  // θ lúc dập của chu kỳ đầu
  const probe = go(-5, -5).s;
  const th = probe.lastTheta;
  // vòng 1 ban đầu: R = 2 (φ = 0) → đỉnh ở sin(ku − θ) = ±1
  const uPeak = (th + Math.PI / 2) / KTR_K;
  const uZero = (th + Math.PI) / KTR_K;
  const wrap = (u: number) => ((u % KTR.LAMBDA) + KTR.LAMBDA) % KTR.LAMBDA;
  assert.ok(go(wrap(uPeak), 1).r.ev & KEV.HURT, "đứng ở đỉnh dải tổng lúc dập → trúng");
  assert.equal(go(wrap(uZero), 1).r.ev & KEV.HURT, 0, "đứng ở điểm 0 của dải tổng → an toàn");
  assert.equal(go(wrap(uPeak), KTR.W + 1).r.ev & KEV.HURT, 0, "ngoài dải → an toàn");
  // tất định: cùng đầu vào → cùng nhật ký sự kiện
  const a = go(1.3, 0.8).r.log;
  const b = go(1.3, 0.8).r.log;
  assert.deepEqual(a, b);
});

test("Khoảng Trừ: rời sân lâu → ngủ lại, giữ số vòng, đặt lại núm vòng hiện tại; văn bản song ngữ đủ khoá", () => {
  const { s, t } = fightAt();
  turnKtr(s, t, "phase");
  let tt = t;
  let ev = 0;
  for (; tt < t + 7; tt += 0.1) ev |= tickKtr(s, tt, 0, 0, KTR.WAKE_R + 20);
  assert.ok(ev & KEV.RESET);
  assert.equal(s.stage, "dormant");
  assert.equal(ktrPh(s), 0, "núm về trạng thái đầu vòng");
  for (const k of Object.keys(KTR_TEXT) as (keyof typeof KTR_TEXT)[]) {
    assert.ok(KTR_TEXT[k].vi.length > 0 && KTR_TEXT[k].en.length > 0, k);
  }
  assert.equal(ktrText("vi", "left", { r: "0,5" }), "Vẫn còn sóng: R = 0,5");
});
