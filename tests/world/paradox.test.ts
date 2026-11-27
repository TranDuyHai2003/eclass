import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KOCH_D,
  barberConsistent,
  birthdayP,
  birthdayThreshold,
  braess,
  catchTime,
  cesaro,
  gamma,
  halvingSum,
  kochLength,
  kochPoints,
  leftMul,
  newcombBreakEven,
  newcombEV,
  pieceOf,
  reduceWord,
  simpsonRates,
  thomsonTime,
  twinAges,
  wordsUpTo,
  zenoSteps,
} from "../../lib/world/paradox";

const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) < e;

test("Zeno: infinitely many steps, finite time", () => {
  const s = zenoSteps(30);
  assert.ok(near(s[29].t, catchTime(), 1e-6));
  // tăng dần (đến khi bước nhỏ hơn độ chính xác số thực)
  assert.ok(s.slice(0, 12).every((x, i) => i === 0 || x.t > s[i - 1].t));
  assert.ok(near(catchTime(), 100 / 9));
  assert.ok(near(halvingSum(10), 1023 / 1024));
});

test("birthday: 23 people already give better than even odds", () => {
  assert.equal(birthdayThreshold(), 23);
  assert.ok(near(birthdayP(23), 0.5072972343, 1e-8));
  assert.ok(birthdayP(70) > 0.999);
  assert.equal(birthdayP(366), 1);
});

test("Simpson: A wins in every group, B wins overall (real 1986 data)", () => {
  const r = simpsonRates();
  assert.ok(r.A.small > r.B.small && r.A.large > r.B.large);
  assert.ok(r.B.all > r.A.all);
  assert.ok(near(r.A.all, 273 / 350) && near(r.B.all, 289 / 350));
});

test("Banach–Tarski: a·S(A) covers every word not starting with a", () => {
  assert.equal(reduceWord("abBA"), "");
  for (const w of wordsUpTo(4)) {
    if (pieceOf(w) === "a") continue;
    const u = reduceWord("A" + w);
    assert.equal(pieceOf(u), "A", w);
    assert.equal(leftMul("a", u), w);
  }
});

test("Russell's barber has no consistent answer", () => {
  assert.equal(barberConsistent(true), false);
  assert.equal(barberConsistent(false), false);
});

test("Newcomb: one-boxing pays once the predictor beats ~50.05 %", () => {
  const be = newcombBreakEven();
  const lo = newcombEV(be - 0.01);
  const hi = newcombEV(be + 0.01);
  assert.ok(lo.twoBox > lo.oneBox && hi.oneBox > hi.twoBox);
  assert.ok(near(newcombEV(be).oneBox, newcombEV(be).twoBox, 1e-6));
});

test("coastline: shorter rulers measure longer coasts", () => {
  assert.equal(kochPoints(3).length, 4 ** 3 + 1);
  for (let k = 1; k < 6; k++) assert.ok(kochLength(k) > kochLength(k - 1));
  assert.ok(near(KOCH_D, 1.2618595071, 1e-9));
  const pts = kochPoints(2);
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  assert.ok(near(L, kochLength(2), 1e-9));
});

test("Braess: adding a free road makes everyone slower", () => {
  assert.equal(braess(4000, false).time, 65);
  assert.equal(braess(4000, true).time, 80);
});

test("Grandi & Thomson: partial sums never settle, their average does", () => {
  assert.ok(near(cesaro(1000), 0.5));
  assert.ok(near(cesaro(1001), 501 / 1001));
  assert.ok(thomsonTime(20) < 1);
});

test("twin paradox: the traveller ages less", () => {
  const r = twinAges(4, 0.8);
  assert.ok(near(gamma(0.8), 5 / 3));
  assert.ok(near(r.earth, 10) && near(r.traveler, 6));
});
