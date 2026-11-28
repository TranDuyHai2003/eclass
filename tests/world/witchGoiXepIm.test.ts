import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATK_BEATS,
  BEAT,
  DANGER_EXPR,
  EV,
  GXI,
  MAX_HP,
  PREDICT_BEATS,
  TILT_EXPR,
  antinodePositions,
  dangerAt,
  dangerUniforms,
  envelope,
  evalShared,
  gxiText,
  gxiVisual,
  hitGxi,
  modeN,
  newGxi,
  newVisual,
  nodeAt,
  nodeHalfWidth,
  nodePositions,
  pickAtk,
  reach,
  tickGxi,
  wallTilt,
  type Atk,
  type GxiSim,
} from "@/lib/world/witchGoiXepIm";

const L = GXI.L;
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;

test("Gối Xếp Im: sóng dừng — nút ở kL/n đứng yên, bụng ở (k+½)L/n dao động cực đại, hai đầu kẹp là nút", () => {
  for (const n of GXI.MODES) {
    for (const u of [0, L, ...nodePositions(n)]) assert.ok(envelope(u, n) < 1e-9, `n=${n} u=${u}`);
    for (const u of antinodePositions(n)) assert.ok(near(envelope(u, n), 1, 1e-12), `bụng n=${n} u=${u}`);
    // số nút trong = n − 1, số bụng = n
    assert.equal(nodePositions(n).length, n - 1);
    assert.equal(antinodePositions(n).length, n);
  }
  // đúng bài tập của thiết kế: n = 2 → L/2; n = 3 → L/3, 2L/3
  assert.deepEqual(nodePositions(2), [L / 2]);
  assert.deepEqual(nodePositions(3), [L / 3, (2 * L) / 3]);
  // dải nút đủ rộng để đứng (≥ 0,8 m bề rộng cả dải) ở mode cao nhất
  assert.ok(2 * nodeHalfWidth(4) >= 0.8, `${nodeHalfWidth(4)}`);
});

test("Gối Xếp Im: nodeAt nhận đúng dải nút trong, bỏ hai đầu kẹp và bụng sóng", () => {
  for (const n of GXI.MODES) {
    const hw = nodeHalfWidth(n);
    nodePositions(n).forEach((x, k) => {
      assert.equal(nodeAt(x, n), k);
      assert.equal(nodeAt(x + hw * 0.95, n), k);
      assert.equal(nodeAt(x - hw * 0.95, n), k);
      assert.equal(nodeAt(x + hw * 1.08, n), -1);
    });
    for (const u of antinodePositions(n)) assert.equal(nodeAt(u, n), -1);
    assert.equal(nodeAt(0.1, n), -1, "đầu kẹp không phải nút để ghim");
    assert.equal(nodeAt(L - 0.1, n), -1);
    assert.equal(nodeAt(-1, n), -1);
  }
});

test("Gối Xếp Im: tập AN TOÀN vẽ trên sàn (DANGER_EXPR — chuỗi GLSL chạy bằng JS) == tập an toàn của luật ở > 40k điểm", () => {
  let checked = 0;
  let danger = 0;
  for (const n of GXI.MODES) {
    for (const atk of ["slam", "whip"] as Atk[]) {
      const uni = dangerUniforms(n, atk);
      for (let i = 0; i <= 200; i++) {
        const u = -1 + (i / 200) * (L + 2) + 0.0037;
        for (let j = 0; j <= 36; j++) {
          const v = -0.6 + (j / 36) * (GXI.D + 1.2) + 0.0021;
          const drawn = evalShared(DANGER_EXPR, { ...uni, u, v }) as boolean;
          const rule = dangerAt(u, v, n, atk);
          assert.equal(drawn, rule, `n=${n} ${atk} u=${u} v=${v}`);
          checked++;
          if (rule) danger++;
        }
      }
    }
  }
  assert.ok(checked > 40000, `${checked}`);
  // không suy biến: có cả vùng hiểm lẫn vùng an toàn
  assert.ok(danger > checked * 0.1 && danger < checked * 0.8, `${danger}/${checked}`);
});

test("Gối Xếp Im: dải nút luôn an toàn với Gập Bụng; bụng sóng đập hết chiều sâu; sau hai kẹp an toàn", () => {
  for (const n of GXI.MODES) {
    const hw = nodeHalfWidth(n);
    for (const x of nodePositions(n)) for (const du of [-0.98, -0.5, 0, 0.5, 0.98]) for (const v of [0, 1, 2.5, 4.9]) assert.equal(dangerAt(x + du * hw, v, n, "slam"), false);
    for (const x of antinodePositions(n)) for (const v of [0, 1, 2.5, GXI.D - 0.01]) assert.equal(dangerAt(x, v, n, "slam"), true, `bụng n=${n} v=${v}`);
    for (const v of [0, 2, 4]) {
      assert.equal(dangerAt(-0.2, v, n, "slam"), false);
      assert.equal(dangerAt(L + 0.2, v, n, "slam"), false);
    }
    // ngoài dải sàn (sau lưng người, v ≥ D) không bị đập
    assert.equal(dangerAt(antinodePositions(n)[0], GXI.D + 0.01, n, "slam"), false);
    // Dây Chỉ Quất: ở nút chỉ còn nửa bề dày sợi chỉ → đứng lệch khỏi sợi chỉ ≥ HW là qua được
    for (const x of nodePositions(n)) {
      assert.equal(dangerAt(x, GXI.VC + GXI.HW + 0.02, n, "whip"), false);
      assert.equal(dangerAt(x, GXI.VC, n, "whip"), true);
    }
    for (const x of antinodePositions(n)) assert.equal(dangerAt(x, GXI.VC + GXI.HW + GXI.AW - 0.02, n, "whip"), true);
  }
});

test("Gối Xếp Im: độ nghiêng vách (TILT_EXPR) == wallTilt; lúc đập, đỉnh vách rơi ĐÚNG mép vùng hiểm", () => {
  for (const n of GXI.MODES) {
    for (let i = 0; i <= 240; i++) {
      const u = (i / 240) * L;
      for (const [amp, osc, pull, slam] of [
        [0.16, 0.7, 0, 0],
        [0.32, -1, 0.3, 0],
        [0, 1, 0.45, 0.4],
        [0.1, 0.2, 0, 1],
      ]) {
        const gl = evalShared(TILT_EXPR, { u, uL: L, uN: n, uS: GXI.S, uK: GXI.K, uAmp: amp, uOsc: osc, uPull: pull, uSlam: slam }) as number;
        assert.ok(near(gl, wallTilt(u, n, amp, osc, pull, slam), 1e-12), `n=${n} u=${u}`);
      }
      // slam = 1: đỉnh ở v = D·reach(u) — điểm ngay trong là hiểm, ngay ngoài là an toàn
      const tip = GXI.D * wallTilt(u, n, 0.2, 1, 0.3, 1);
      assert.ok(near(tip, GXI.D * reach(u, n), 1e-12));
      if (tip > 0.02) {
        assert.equal(dangerAt(u, tip - 0.01, n, "slam"), true);
        assert.equal(dangerAt(u, tip + 0.01, n, "slam"), false);
      } else assert.equal(dangerAt(u, 0.01, n, "slam"), false);
    }
  }
});

/** chạy mô phỏng tới t với người chơi đứng yên ở (pu, pv) — bước 1/60 s */
function run(s: GxiSim, from: number, to: number, pu: number, pv: number, py = 0): number {
  let ev = 0;
  for (let t = from; t <= to + 1e-9; t += 1 / 60) ev |= tickGxi(s, t, pu, pv, py);
  return ev;
}

test("Gối Xếp Im: máy trạng thái — ngủ → (lại gần) lộ dạng → khúc mẫu vô hại → chiến đấu, đòn đầu là Gập Bụng", () => {
  const s = newGxi(7);
  assert.equal(s.stage, "dormant");
  assert.equal(run(s, 0, 3, L / 2, 20), 0, "đứng xa: vẫn ngủ");
  run(s, 3, 3.1, L / 2, 4);
  assert.equal(s.stage, "reveal");
  const t0 = s.at;
  // lộ dạng + khúc mẫu: đứng ngay bụng sóng cũng không đau
  const ev = run(s, t0, t0 + GXI.REVEAL + GXI.DEMO * BEAT - 0.05, antinodePositions(2)[0], 1);
  assert.equal(ev & EV.HURT, 0);
  assert.equal(s.stage, "demo");
  run(s, t0 + GXI.REVEAL + GXI.DEMO * BEAT - 0.04, t0 + GXI.REVEAL + GXI.DEMO * BEAT + 0.05, L / 2, 1);
  assert.equal(s.stage, "fight");
  assert.equal(s.atk, "slam");
});

function toFight(seed = 3): { s: GxiSim; t: number } {
  const s = newGxi(seed);
  hitGxi(s, 0, L / 2, 1); // đánh thức bằng một đòn
  assert.equal(s.stage, "reveal");
  const t = GXI.REVEAL + GXI.DEMO * BEAT + 0.02;
  run(s, 0, t, L / 2, 10);
  assert.equal(s.stage, "fight");
  return { s, t };
}

test("Gối Xếp Im: nhịp đòn — báo trước ≥ 2 phách (≥ 1,25 s) trước lúc đập; chỉ trúng trong cửa sổ đánh, mỗi đòn ≤ 1 lần", () => {
  for (const atk of ["slam", "whip"] as Atk[]) {
    const k = ATK_BEATS[atk];
    assert.ok((k.active - k.tele) * BEAT >= 1.25 - 1e-9, atk);
    assert.ok(k.tele <= k.commit && k.commit < k.active && k.active < k.recover && k.recover < k.end);
  }
  assert.ok((PREDICT_BEATS.active - PREDICT_BEATS.guess) * BEAT >= 2.5);
  const { s, t } = toFight();
  const atkAt = s.atkAt;
  const bu = antinodePositions(2)[0];
  // đứng ở bụng suốt dồn lực + báo trước + chốt: chưa đau
  let ev = run(s, t, atkAt + (ATK_BEATS.slam.active - 0.05) * BEAT, bu, 1);
  assert.equal(ev & EV.HURT, 0);
  assert.ok(ev & EV.TELE && ev & EV.COMMIT);
  ev = run(s, atkAt + (ATK_BEATS.slam.active - 0.04) * BEAT, atkAt + (ATK_BEATS.slam.end - 0.05) * BEAT, bu, 1);
  assert.ok(ev & EV.HURT, "đập trúng bụng");
  assert.equal(s.lastDmg, GXI.DMG.slam);
  // đứng ở nút: không đau ở đòn kế
  const s2 = toFight().s;
  const ev2 = run(s2, s2.atkAt, s2.atkAt + ATK_BEATS.slam.end * BEAT, L / 2, 1);
  assert.equal(ev2 & EV.HURT, 0);
  // bay cao hơn tầm vải: không đau
  const s3 = toFight().s;
  assert.equal(run(s3, s3.atkAt, s3.atkAt + ATK_BEATS.slam.end * BEAT, bu, 1, 3) & EV.HURT, 0);
});

test("Gối Xếp Im: THẮNG = ghim đúng nút — bụng nuốt đòn; đủ nút mode 2 → lượt dự đoán → mode 3", () => {
  const { s, t } = toFight();
  assert.equal(s.hp, MAX_HP);
  assert.equal(hitGxi(s, t, antinodePositions(2)[0], 1), "antinode");
  assert.equal(hitGxi(s, t, L / 2, GXI.PIN_REACH + 1), "far");
  assert.equal(s.hp, MAX_HP, "đòn sai chỗ không trừ máu");
  assert.equal(hitGxi(s, t, L / 2 + 0.3, 1), "pin");
  assert.equal(s.hp, MAX_HP - 1);
  assert.equal(hitGxi(s, t, L / 2 - 0.2, 2), "mode");
  assert.equal(s.stage, "predict");
  assert.equal(modeN(s), 3);
  assert.equal(s.prevN, 2);
  assert.equal(hitGxi(s, t, L / 3, 1), "locked", "đang đổi mode: không ghim được");
});

test("Gối Xếp Im: lượt DỰ ĐOÁN — đứng ở L/3 khi vách đổi sang 3 bụng → nút được may ngay; đoán sai ở bụng → đau", () => {
  const mk = () => {
    const { s, t } = toFight(11);
    hitGxi(s, t, L / 2, 1);
    hitGxi(s, t, L / 2, 1);
    assert.equal(s.stage, "predict");
    return { s, t };
  };
  {
    const { s, t } = mk();
    const ev = run(s, t, t + PREDICT_BEATS.active * BEAT + 0.05, L / 3 + 0.2, 2);
    assert.ok(ev & EV.GUESS_OK);
    assert.equal(ev & EV.HURT, 0);
    assert.equal(s.pins[0], GXI.PIN_HITS);
    assert.equal(s.guessOk, 1);
    // hết lượt → chiến đấu lại ở mode 3, chỉ còn nút 2L/3
    run(s, t + PREDICT_BEATS.active * BEAT + 0.06, t + PREDICT_BEATS.end * BEAT + 0.05, L / 3, 2);
    assert.equal(s.stage, "fight");
    assert.equal(hitGxi(s, s.at, L / 3, 1), "sewn");
    assert.equal(hitGxi(s, s.at, (2 * L) / 3, 1), "pin");
  }
  {
    const { s, t } = mk();
    // đứng ở L/2 (nút CŨ của n = 2) — với n = 3 đó là bụng sóng
    const ev = run(s, t, t + PREDICT_BEATS.active * BEAT + 0.05, L / 2, 2);
    assert.ok(ev & EV.GUESS_MISS && ev & EV.HURT);
    assert.equal(s.pins[0] + s.pins[1], 0);
  }
  {
    // đứng ngoài dải sàn (chỗ trú ở mép): không đoán, không đau
    const { s, t } = mk();
    const ev = run(s, t, t + PREDICT_BEATS.end * BEAT - 0.1, L / 2, GXI.D + 1);
    assert.equal(ev & (EV.GUESS_MISS | EV.GUESS_OK | EV.HURT), 0);
  }
});

test("Gối Xếp Im: đủ ba mode (2, 3, 4) → ru ngủ → xong; máu = số mũi ghim còn lại", () => {
  const { s, t } = toFight(5);
  let tt = t;
  for (const n of GXI.MODES) {
    if (s.stage === "predict") {
      run(s, tt, tt + PREDICT_BEATS.end * BEAT + 0.05, -3, 1);
      tt += PREDICT_BEATS.end * BEAT + 0.1;
    }
    assert.equal(s.stage, "fight");
    assert.equal(modeN(s), n);
    for (const x of nodePositions(n)) for (let h = 0; h < GXI.PIN_HITS; h++) hitGxi(s, tt, x, 1);
  }
  assert.equal(s.stage, "hush");
  assert.equal(s.hp, 0);
  run(s, tt, tt + GXI.HUSH + 0.1, L / 2, 1);
  assert.equal(s.stage, "done");
  assert.equal(MAX_HP, (1 + 2 + 3) * GXI.PIN_HITS);
});

test("Gối Xếp Im: tất định — cùng seed + cùng đầu vào → cùng chuỗi đòn / sự kiện; pha 1 chỉ có Gập Bụng", () => {
  const trace = (seed: number) => {
    const { s, t } = toFight(seed);
    hitGxi(s, t, L / 2, 1);
    hitGxi(s, t, L / 2, 1);
    const out: string[] = [];
    let tt = t;
    for (let i = 0; i < 60 * 40; i++) {
      tt += 1 / 60;
      const ev = tickGxi(s, tt, 1.3 + (i % 7) * 0.9, 1 + (i % 3), 0);
      if (ev) out.push(`${i}:${ev}:${s.stage}:${s.atk}`);
    }
    return out.join("|");
  };
  assert.equal(trace(42), trace(42));
  assert.notEqual(trace(42), trace(43));
  for (let a = 0; a < 20; a++) assert.equal(pickAtk(9, a, 0), "slam");
  let whips = 0;
  for (let a = 0; a < 200; a++) if (pickAtk(9, a, 2) === "whip") whips++;
  assert.ok(whips > 30 && whips < 100, `${whips}`);
});

test("Gối Xếp Im: hình — lộ dạng mở NGANG (unfold tăng đều), khúc mẫu vô hại có xem trước, đếm lùi khi báo trước", () => {
  const s = newGxi(1);
  const V = newVisual();
  gxiVisual(s, 0, 0, V);
  assert.equal(V.unfold, 0);
  assert.equal(V.pillow, 1);
  hitGxi(s, 0, L / 2, 1);
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    gxiVisual(s, (i / 20) * GXI.REVEAL, 0, V);
    assert.ok(V.unfold >= prev - 1e-12);
    prev = V.unfold;
  }
  assert.ok(near(V.unfold, 1, 1e-6));
  run(s, 0, GXI.REVEAL + 2 * BEAT, L / 2, 10);
  gxiVisual(s, GXI.REVEAL + 2 * BEAT, 0, V);
  assert.equal(s.stage, "demo");
  assert.ok(V.preview > 0.99 && V.tele === 0);
  const { s: f } = toFight();
  gxiVisual(f, f.atkAt + 1.5 * BEAT, 0, V);
  assert.equal(V.count, 2);
  assert.equal(V.tele, 1);
  gxiVisual(f, f.atkAt + (ATK_BEATS.slam.active + 0.3) * BEAT, 0, V);
  assert.ok(near(V.slam, 1, 1e-9), "đang đập: đỉnh chạm đúng mép vùng hiểm");
  // giảm chuyển động: biên độ dao động nhỏ hơn, hình dạng báo trước giữ nguyên
  const Vc = newVisual();
  gxiVisual(f, f.atkAt + 1.5 * BEAT, 0, Vc, true);
  assert.equal(Vc.tele, V.tele === 1 ? 1 : Vc.tele);
  assert.ok(gxiVisual(f, f.atkAt + 7 * BEAT, 0.3, newVisual(), true).amp < gxiVisual(f, f.atkAt + 7 * BEAT, 0.3, newVisual()).amp);
});

test("Gối Xếp Im: văn bản song ngữ đủ khoá, thay tham số", () => {
  assert.equal(gxiText("vi", "name"), "Gối Xếp Im");
  assert.equal(gxiText("en", "predict", { n: 3 }), "The wall is re-tuning to 3 loops. Stand where you predict a node!");
  assert.equal(gxiText("vi", "pinHint", { k: 1, m: 2 }), "Đánh vào vách từ chỗ NÚT để ghim (1/2)");
});
