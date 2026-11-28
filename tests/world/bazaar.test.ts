import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHEST_GOLD,
  DAYS,
  LANTERN,
  MIMIC_BASE,
  MIMIC_VARIANTS,
  NO_PROGRESS,
  P_RED,
  SLIME_MAX,
  SLIME_STAGES,
  WHEEL_VARIANTS,
  WISP_VARIANTS,
  afterStreak,
  bayesFactor,
  bestNets,
  birthdayP,
  birthdayThreshold,
  caught,
  chestField,
  dayToDate,
  diceCounts,
  diceTotal,
  expectedFirstCollision,
  fieldCounts,
  findStreak,
  firstCollisionHistogram,
  judge,
  llnTrace,
  mimicOffers,
  mulberry32,
  netRate,
  netWays,
  offerEV,
  pairs,
  parseProgress,
  playOffer,
  posterior,
  releaseJar,
  shouldAccept,
  slimeWave,
  slotColor,
  spinSeq,
  stagePass,
  wheelOffers,
  wispOffers,
} from "@/lib/world/bazaar";
import {
  BAZAAR_SPOTS,
  COLLIDERS,
  LANTERNS,
  PORTAL,
  SLIME_TRACK,
  SPAWN,
  WALK_R,
  bazaarBlocked,
  chestPos,
  lanternPos,
  tileAt,
  tileX,
} from "@/lib/world/bazaarWorld";

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

// ───────────── Đèn Năm ─────────────

test("bài toán ngày sinh: 23 con đã > 50 %, 22 con chưa; các mốc quen thuộc", () => {
  assert.ok(birthdayP(22) < 0.5 && birthdayP(23) > 0.5);
  assert.ok(near(birthdayP(23), 0.5072972343239857, 1e-12));
  assert.ok(near(birthdayP(40), 0.891231809817949, 1e-9));
  assert.equal(birthdayThreshold(0.5), 23);
  assert.equal(birthdayThreshold(0.99), 57);
  assert.equal(birthdayP(1), 0);
  assert.equal(birthdayP(366), 1);
  assert.equal(pairs(23), 253);
  // kì vọng lần trùng đầu tiên ≈ 24,6166 (hàm Q của Ramanujan + 1)
  assert.ok(near(expectedFirstCollision(), 24.616585894598256, 1e-6));
  // trực giác "một nửa số đèn" = 183 — sai gần 8 lần
  assert.ok(183 / birthdayThreshold() > 7.9);
});

test("thả vò thật (seed cố định): trung vị lần trùng đầu tiên là 23, trung bình ≈ 24,6", () => {
  const h = firstCollisionHistogram(2026, 4000);
  assert.ok(h.median >= 22 && h.median <= 24, `median ${h.median}`);
  assert.ok(
    Math.abs(h.mean - expectedFirstCollision()) < 0.5,
    `mean ${h.mean}`,
  );
  assert.equal(
    h.hist.reduce((a, b) => a + b, 0),
    4000,
  );
  // tần suất "vò 23 con có trùng" khớp 50,7 %
  const rand = mulberry32(99);
  let hit = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) if (releaseJar(rand, 23).first > 0) hit++;
  assert.ok(Math.abs(hit / N - birthdayP(23)) < 0.02, `${hit / N}`);
});

test("vò thả hết (không dừng) đếm đúng; lần trùng đầu tiên là đèn đã sáng", () => {
  const j = releaseJar(mulberry32(5), 60, DAYS, false);
  assert.equal(j.slots.length, 60);
  if (j.first) {
    assert.equal(j.slots[j.first - 1], j.slot);
    assert.ok(j.slots.slice(0, j.first - 1).includes(j.slot));
    assert.equal(new Set(j.slots.slice(0, j.first - 1)).size, j.first - 1);
  }
  assert.deepEqual(dayToDate(0), { m: 0, d: 0 });
  assert.deepEqual(dayToDate(31), { m: 1, d: 0 });
  assert.deepEqual(dayToDate(364), { m: 11, d: 30 });
});

test("365 đèn lồng: mỗi đèn một vị trí riêng, treo trong tầm nhìn (y 1,2–7 m)", () => {
  const seen = new Set<string>();
  for (let d = 0; d < LANTERNS; d++) {
    const [x, y, z] = lanternPos(d);
    assert.ok(y > 1.2 && y < 7, `y ${y}`);
    seen.add(`${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`);
  }
  assert.equal(seen.size, LANTERNS);
});

// ───────────── Rương Mimic ─────────────

test("Bayes: một đèn đỏ chỉ là mimic 1/3 (không phải 90 %); hai đèn đỏ → 69 %; không đỏ → 1,4 %", () => {
  assert.ok(near(posterior(MIMIC_BASE, [true]), 1 / 3));
  assert.ok(near(posterior(MIMIC_BASE, [true, true]), 0.081 / 0.117));
  assert.ok(posterior(MIMIC_BASE, [false]) < 0.014);
  // dạng tỉ số cược: odds sau = odds trước × 4,5
  const odds = (p: number) => p / (1 - p);
  assert.ok(near(odds(posterior(0.1, [true])), odds(0.1) * bayesFactor()));
  assert.ok(near(bayesFactor(LANTERN), 4.5));
  // tỉ lệ nền đổi → kết luận đổi
  assert.ok(posterior(0.4, [true]) > 0.7);
});

test("bãi 100 rương: tần số tự nhiên chính xác 9 mimic đỏ / 27 rương đỏ; seed chỉ đổi vị trí", () => {
  const a = fieldCounts(chestField(1));
  assert.deepEqual(
    { n: a.n, mimic: a.mimic, red: a.red, redMimic: a.redMimic },
    { n: 100, mimic: 10, red: 27, redMimic: 9 },
  );
  assert.ok(near(a.share, posterior(MIMIC_BASE, [true])));
  const f1 = chestField(1)
    .map((c) => +c.mimic)
    .join("");
  const f2 = chestField(2)
    .map((c) => +c.mimic)
    .join("");
  assert.notEqual(f1, f2);
  assert.equal(
    chestField(1)
      .map((c) => +c.mimic)
      .join(""),
    f1,
  );
  // lưới 10 × 10 cách đều 1 m
  assert.deepEqual(
    chestPos(0).map((v) => Math.round(v * 10) / 10),
    [-4.5, -19.5],
  );
  assert.deepEqual(
    chestPos(99).map((v) => Math.round(v * 10) / 10),
    [4.5, -10.5],
  );
});

test("thương vụ rương: mỗi bộ có đúng một bẫy 'bỏ tỉ lệ nền' và EV không sát 0", () => {
  for (let v = 0; v < MIMIC_VARIANTS.length; v++) {
    const offers = mimicOffers(v);
    for (const o of offers)
      assert.ok(Math.abs(offerEV(o)) > 0.05, `${v} ${o.id} ${offerEV(o)}`);
    // trực giác "đèn đỏ = mimic" (bỏ qua tỉ lệ nền) → mua chỉ khi KHÔNG có đèn đỏ nào
    const naive = offers.map((o) => !o.readings!.some(Boolean));
    assert.equal(judge(offers, naive).allRight, false, `variant ${v}`);
    const smart = offers.map(shouldAccept);
    assert.equal(judge(offers, smart).allRight, true);
  }
  // biến thể 0: đèn đỏ một lần → MUA (EV +1 vé), hai lần → BỎ, không đỏ → MUA
  assert.deepEqual(mimicOffers(0).map(shouldAccept), [true, false, true]);
  assert.ok(near(offerEV(mimicOffers(0)[0]), (2 / 3) * CHEST_GOLD - 1));
});

// ───────────── Ruộng Slime ─────────────

test("tổng xúc xắc: 1 phẳng, 2 tam giác (7 có 6 cách), 3 hình chuông (10, 11 có 27 cách)", () => {
  assert.deepEqual(diceCounts(1).slice(1), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(diceCounts(2).slice(2), [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
  const c3 = diceCounts(3);
  assert.equal(c3[10], 27);
  assert.equal(c3[11], 27);
  assert.equal(c3[3], 1);
  assert.equal(c3.length - 1, SLIME_MAX);
  for (const k of [1, 2, 3, 6])
    assert.equal(
      diceCounts(k).reduce((a, b) => a + b, 0),
      diceTotal(k),
    );
  assert.deepEqual(bestNets(2, 1), [7]);
  assert.deepEqual(bestNets(3, 2), [10, 11]);
});

test("màn slime: chỉ cách cắm lưới đúng mới qua; trải đều / cắm ở đuôi thì trượt", () => {
  const [s1, s2, s3] = SLIME_STAGES;
  for (let t = 1; t <= 6; t++)
    assert.ok(stagePass(s1, [t]), `1 xúc xắc ô ${t}`);
  for (let t = 2; t <= 12; t++)
    assert.equal(stagePass(s2, [t]), t === 7, `2 xúc xắc ô ${t}`);
  let ok = 0;
  for (let a = 3; a <= 18; a++)
    for (let b = a + 1; b <= 18; b++) if (stagePass(s3, [a, b])) ok++;
  assert.equal(ok, 1);
  assert.ok(stagePass(s3, [11, 10]));
  assert.ok(!stagePass(s3, [9, 10]) && !stagePass(s3, [3, 18]));
  // quá số lưới thì không tính
  assert.ok(!stagePass(s3, [9, 10, 11]));
  // ô trùng chỉ tính một lần
  assert.equal(netWays(3, [10, 10]), 27);
  assert.ok(near(netRate(3, [10, 11]), 0.25));
});

test("đàn slime (seed cố định): tổng = tổng các bước nhảy, phân phối khớp số cách", () => {
  const w = slimeWave(7, 3, 30000);
  for (const s of w.slice(0, 50)) {
    assert.equal(s.hops.length, 3);
    assert.equal(
      s.sum,
      s.hops.reduce((a, b) => a + b, 0),
    );
    assert.ok(s.hops.every((h) => h >= 1 && h <= 6));
  }
  const rate = caught(w, [10, 11]) / w.length;
  assert.ok(Math.abs(rate - 0.25) < 0.012, `${rate}`);
  const tail = caught(w, [3, 18]) / w.length;
  assert.ok(tail < 0.02);
  // tất định
  assert.deepEqual(
    slimeWave(7, 3, 5).map((s) => s.sum),
    w.slice(0, 5).map((s) => s.sum),
  );
});

test("đường ray: ô s đứng được, đúng toạ độ, nằm trong sân", () => {
  for (let s = 1; s <= SLIME_MAX; s++) {
    assert.equal(tileAt(tileX(s), SLIME_TRACK.z), s);
    assert.equal(tileAt(tileX(s) + 0.4, SLIME_TRACK.z - 0.5), s);
    assert.ok(!bazaarBlocked(tileX(s), SLIME_TRACK.z), `ô ${s} bị chặn`);
  }
  assert.equal(tileAt(tileX(5), SLIME_TRACK.z + 2), -1);
  assert.equal(tileAt(tileX(0), SLIME_TRACK.z), -1);
});

// ───────────── Bánh Xe Chuỗi ─────────────

test("bánh xe không có trí nhớ: sau ≥ 5 Đỏ liền, Đen vẫn ≈ 18/37", () => {
  const seq = spinSeq(31, 400000);
  const a = afterStreak(seq, 5);
  assert.ok(a.n > 5000, `${a.n}`);
  assert.ok(
    Math.abs(a.b / a.n - P_RED) < 0.02,
    `black after streak ${a.b / a.n}`,
  );
  assert.ok(Math.abs(a.r / a.n - P_RED) < 0.02);
  let red = 0;
  for (const s of seq) if (slotColor(s) === "r") red++;
  assert.ok(Math.abs(red / seq.length - P_RED) < 0.004);
  const i = findStreak(seq, 5);
  assert.ok(i >= 4);
  for (let k = i - 4; k <= i; k++) assert.equal(slotColor(seq[k]), "r");
});

test("luật số lớn: tỉ lệ Đỏ hội tụ nhưng chênh lệch Đỏ − Đen không thu hẹp", () => {
  const marks = [10, 100, 1000, 10000, 100000];
  let gapSmall = 0;
  let gapBig = 0;
  let errSmall = 0;
  let errBig = 0;
  const S = 40;
  for (let seed = 1; seed <= S; seed++) {
    const t = llnTrace(spinSeq(seed, 100000), marks);
    assert.equal(t.length, marks.length);
    errSmall += Math.abs(t[1].ratio - P_RED);
    errBig += Math.abs(t[4].ratio - P_RED);
    gapSmall += Math.abs(t[1].gap);
    gapBig += Math.abs(t[4].gap);
  }
  // sai số tỉ lệ giảm ~√1000 ≈ 31 lần; chênh lệch tuyệt đối TĂNG ~31 lần
  assert.ok(errBig / S < errSmall / S / 10, `${errSmall / S} → ${errBig / S}`);
  assert.ok(
    gapBig / S > (gapSmall / S) * 10,
    `${gapSmall / S} → ${gapBig / S}`,
  );
});

test("thương vụ bánh xe: cược theo chuỗi của Thầy Chuỗi luôn lỗ, Cô Hàng Bên ×2,2 luôn lời", () => {
  for (let v = 0; v < WHEEL_VARIANTS.length; v++) {
    const offers = wheelOffers(v);
    for (const o of offers) {
      assert.equal(shouldAccept(o), o.who === "honest", `${v} ${o.id}`);
      assert.ok(Math.abs(offerEV(o)) > 0.02);
    }
    // ảo tưởng con bạc: "chuỗi Đỏ → Đen sắp về" — nhận mọi cược Đen của thầy → sai
    const gambler = offers.map((o) => o.color === "b");
    assert.equal(judge(offers, gambler).allRight, false);
    assert.equal(judge(offers, offers.map(shouldAccept)).allRight, true);
  }
});

test("thương vụ đèn năm: ngưỡng 23 — nhận vò ≥ 23, bỏ vò ≤ 20; chơi thật khớp xác suất", () => {
  for (let v = 0; v < WISP_VARIANTS.length; v++)
    for (const o of wispOffers(v))
      assert.equal(shouldAccept(o), (o.jar ?? 0) >= 23, `jar ${o.jar}`);
  // trực giác "phải gần nửa số đèn mới trùng" → bỏ hết → sai
  assert.equal(judge(wispOffers(0), [false, false, false]).allRight, false);
  const o = wispOffers(0)[2];
  const rand = mulberry32(11);
  let w = 0;
  for (let i = 0; i < 4000; i++) if (playOffer(o, rand).win) w++;
  assert.ok(Math.abs(w / 4000 - o.pWin) < 0.02);
  const chest = mimicOffers(0)[0];
  let cw = 0;
  for (let i = 0; i < 6000; i++) if (playOffer(chest, rand).win) cw++;
  assert.ok(Math.abs(cw / 6000 - 2 / 3) < 0.02);
});

// ───────────── Bố cục + tiến trình ─────────────

test("bố cục: điểm vào / cổng / mọi quầy đứng được, tới được từ điểm vào", () => {
  const S = 0.5;
  const N = Math.ceil((WALK_R * 2) / S);
  const X = (i: number) => -WALK_R + i * S;
  const seen = new Uint8Array(N * N);
  const q: number[] = [];
  const si = Math.round((SPAWN.x + WALK_R) / S);
  const sj = Math.round((SPAWN.z + WALK_R) / S);
  assert.ok(!bazaarBlocked(SPAWN.x, SPAWN.z));
  q.push(si * N + sj);
  seen[si * N + sj] = 1;
  while (q.length) {
    const c = q.pop()!;
    const i = Math.floor(c / N);
    const j = c % N;
    for (const [a, b] of [
      [i + 1, j],
      [i - 1, j],
      [i, j + 1],
      [i, j - 1],
    ]) {
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      const k = a * N + b;
      if (!seen[k] && !bazaarBlocked(X(a), X(b))) {
        seen[k] = 1;
        q.push(k);
      }
    }
  }
  const can = (x: number, z: number) => {
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++)
        if (seen[i * N + j] && Math.hypot(X(i) - x, X(j) - z) < 0.8)
          return true;
    return false;
  };
  for (const [k, p] of Object.entries(BAZAAR_SPOTS)) {
    assert.ok(!bazaarBlocked(p.x, p.z), `${k} bị chặn`);
    assert.ok(can(p.x, p.z), `${k} không tới được`);
  }
  for (let s = 1; s <= SLIME_MAX; s++)
    assert.ok(can(tileX(s), SLIME_TRACK.z), `ô slime ${s}`);
  // các điểm tương tác cách nhau ≥ 3 m
  const pts = Object.values(BAZAAR_SPOTS);
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) >= 3);
  assert.ok(Math.hypot(PORTAL.x, PORTAL.z) < WALK_R);
  for (const c of COLLIDERS) assert.ok(Math.hypot(c.x, c.z) < WALK_R + 1);
});

test("tiến trình: đọc an toàn từ localStorage hỏng / thiếu / ngoài khoảng", () => {
  assert.deepEqual(parseProgress(null), NO_PROGRESS);
  assert.deepEqual(parseProgress("{rác"), NO_PROGRESS);
  const p = parseProgress(
    JSON.stringify({
      stamps: { wisp: true, mimic: "yes" },
      tickets: 1e9,
      slimeStage: 9,
    }),
  );
  assert.equal(p.stamps.wisp, true);
  assert.equal(p.stamps.mimic, false);
  assert.equal(p.tickets, 999);
  assert.equal(p.slimeStage, SLIME_STAGES.length);
  assert.equal(parseProgress(JSON.stringify({ tickets: -5 })).tickets, 0);
  // NO_PROGRESS không bị sửa qua bản sao
  parseProgress(null).stamps.wisp = true;
  assert.equal(NO_PROGRESS.stamps.wisp, false);
});
