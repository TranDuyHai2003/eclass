/**
 * Chợ Xác Suất (Chance Bazaar) — logic thuần, không phụ thuộc React / three. Test: tests/world/bazaar.test.ts. Kế hoạch: PLAN.md T19.
 *
 * Mỗi quầy là MỘT ý tưởng xác suất, và hiểu nó là cách thắng:
 *  • Đèn Năm (Birthday Wisps) — 365 đèn lồng, đom đóm bay vào đèn ngẫu nhiên; hai con chung một đèn → pháo hoa.
 *    Trùng nhau đến sớm hơn trực giác rất nhiều: 23 con đã > 50 % (vì có 253 CẶP, không phải 23 con).
 *  • Rương Mimic (Bayes) — 1/10 rương là mimic; Đèn Soi bắt 90 % mimic nhưng báo nhầm 20 % rương thường.
 *    Một rương đèn đỏ chỉ là mimic 1/3 (tần số tự nhiên: 9 mimic đỏ / 27 rương đỏ) → mua vẫn lời.
 *  • Ruộng Slime (định lí giới hạn trung tâm) — slime k xúc xắc nhảy k bước, mỗi bước = một mặt xúc xắc → rơi ở ô = tổng.
 *    1 xúc xắc: phẳng; 2: tam giác (7 nhiều nhất); 3: hình chuông (10, 11). Cắm lưới đúng chỗ nhiều cách tạo tổng.
 *  • Bánh Xe Chuỗi (ảo tưởng con bạc + luật số lớn) — bánh xe không có trí nhớ: sau 5 Đỏ, Đen vẫn 18/37.
 *    Tỉ lệ Đỏ tiến về 18/37, nhưng chênh lệch Đỏ − Đen KHÔNG thu hẹp (cỡ √n): số lớn "nhấn chìm" chuỗi, không "bù" lại.
 * Thắng / thua từng ván là ngẫu nhiên; quầy chấm QUYẾT ĐỊNH theo kì vọng (EV) đúng — không phạt người chơi vì xui.
 */
import { mulberry32, randInt, type Rand } from "./monty";

export { mulberry32, type Rand };

// ───────────── Đèn Năm — bài toán ngày sinh ─────────────

export const DAYS = 365;
export const MONTH_DAYS = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] as const;

/** P(có ít nhất hai con chung một đèn) khi thả n con vào d đèn: 1 − ∏ (d − i)/d */
export function birthdayP(n: number, d = DAYS): number {
  if (n > d) return 1;
  let q = 1;
  for (let i = 0; i < n; i++) q *= (d - i) / d;
  return 1 - q;
}

/** số cặp trong n con — lí do trùng đến sớm */
export const pairs = (n: number) => (n * (n - 1)) / 2;

/** n nhỏ nhất để P(trùng) ≥ p (p = ½ → 23) */
export function birthdayThreshold(p = 0.5, d = DAYS): number {
  for (let n = 1; n <= d + 1; n++) if (birthdayP(n, d) >= p) return n;
  return d + 1;
}

/** Kì vọng số con thả tới khi có lần trùng đầu tiên: Σ_{n≥0} P(n con đầu chưa trùng) (≈ 24,62 với 365) */
export function expectedFirstCollision(d = DAYS): number {
  let e = 0;
  let q = 1;
  for (let n = 0; n <= d; n++) {
    e += q;
    q *= (d - n) / d;
  }
  return e;
}

/** đèn (0…d−1) → (tháng, ngày) — để hiện "ngày 14/3" */
export function dayToDate(day: number): { m: number; d: number } {
  let r = day;
  for (let m = 0; m < 12; m++) {
    if (r < MONTH_DAYS[m]) return { m, d: r };
    r -= MONTH_DAYS[m];
  }
  return { m: 11, d: 30 };
}

export interface WispJar {
  /** đèn của từng con theo thứ tự thả */
  slots: number[];
  /** con thứ mấy (1-based) chạm đèn đã có người; 0 = không trùng trong vò */
  first: number;
  /** đèn trùng đầu tiên (−1 nếu không) */
  slot: number;
}

/** Thả tối đa `max` con; dừng ở lần trùng đầu tiên nếu `stopAtHit` */
export function releaseJar(
  rand: Rand,
  max: number,
  d = DAYS,
  stopAtHit = true,
): WispJar {
  const seen = new Uint8Array(d);
  const slots: number[] = [];
  let first = 0;
  let slot = -1;
  for (let i = 0; i < max; i++) {
    const s = randInt(d, rand);
    slots.push(s);
    if (seen[s] && !first) {
      first = i + 1;
      slot = s;
      if (stopAtHit) break;
    }
    seen[s] = 1;
  }
  return { slots, first, slot };
}

/** Thả `jars` vò (mỗi vò thả tới khi trùng): đếm vị trí trùng đầu tiên → biểu đồ cột; trung vị ≈ 23 */
export function firstCollisionHistogram(
  seed: number,
  jars: number,
  d = DAYS,
  cap = 100,
) {
  const rand = mulberry32(seed);
  const hist = new Array<number>(cap + 1).fill(0);
  let sum = 0;
  const all: number[] = [];
  for (let j = 0; j < jars; j++) {
    const f = releaseJar(rand, d + 1, d).first;
    hist[Math.min(cap, f)]++;
    sum += f;
    all.push(f);
  }
  all.sort((a, b) => a - b);
  return { hist, mean: sum / jars, median: all[Math.floor((jars - 1) / 2)] };
}

// ───────────── Rương Mimic — Bayes ─────────────

export interface Detector {
  /** P(đèn đỏ | mimic) — độ nhạy */
  sens: number;
  /** P(đèn đỏ | rương thường) — báo nhầm */
  fpr: number;
}
export const LANTERN: Detector = { sens: 0.9, fpr: 0.2 };
export const MIMIC_BASE = 0.1;
/** giá một rương và số vé trong rương thường (mimic nuốt vé) */
export const CHEST_PRICE = 1;
export const CHEST_GOLD = 3;

/** P(mimic | các lần soi), mỗi lần soi độc lập với cùng một loại đèn; readings[i] = true nếu đèn đỏ */
export function posterior(
  base: number,
  readings: boolean[],
  det: Detector = LANTERN,
): number {
  let lm = base;
  let ln = 1 - base;
  for (const r of readings) {
    lm *= r ? det.sens : 1 - det.sens;
    ln *= r ? det.fpr : 1 - det.fpr;
  }
  return lm / (lm + ln);
}

/** Dạng "tỉ số cược": odds sau = odds trước × (sens / fpr) mỗi lần đỏ — đẹp để giải thích */
export const bayesFactor = (det: Detector = LANTERN) => det.sens / det.fpr;

export interface Chest {
  mimic: boolean;
  /** Đèn Soi báo đỏ */
  red: boolean;
}

/**
 * Bãi 100 rương với TẦN SỐ TỰ NHIÊN đúng tuyệt đối (để dạy, không ngẫu nhiên số lượng): 10 mimic (9 đỏ, 1 lọt),
 * 90 rương thường (18 đỏ nhầm). Chỉ vị trí được xáo theo seed. → rương đỏ: 9 mimic / 27 = 1/3.
 */
export function chestField(
  seed: number,
  n = 100,
  base = MIMIC_BASE,
  det: Detector = LANTERN,
): Chest[] {
  const m = Math.round(n * base);
  const mRed = Math.round(m * det.sens);
  const nRed = Math.round((n - m) * det.fpr);
  const out: Chest[] = [];
  for (let i = 0; i < n; i++)
    out.push(
      i < m
        ? { mimic: true, red: i < mRed }
        : { mimic: false, red: i - m < nRed },
    );
  const rand = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = randInt(i + 1, rand);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function fieldCounts(f: Chest[]) {
  let red = 0;
  let redMimic = 0;
  let mimic = 0;
  for (const c of f) {
    if (c.mimic) mimic++;
    if (c.red) red++;
    if (c.red && c.mimic) redMimic++;
  }
  return { n: f.length, mimic, red, redMimic, share: red ? redMimic / red : 0 };
}

// ───────────── Ruộng Slime — tổng xúc xắc ─────────────

/** số cách để k xúc xắc có tổng s: counts[s], s = 0…6k (tổng = 6^k) */
export function diceCounts(k: number): number[] {
  let c = [1];
  for (let i = 0; i < k; i++) {
    const n = new Array<number>(c.length + 6).fill(0);
    for (let s = 0; s < c.length; s++)
      if (c[s]) for (let f = 1; f <= 6; f++) n[s + f] += c[s];
    c = n;
  }
  return c;
}
export const diceTotal = (k: number) => 6 ** k;
export const diceMean = (k: number) => 3.5 * k;
export const diceSd = (k: number) => Math.sqrt((k * 35) / 12);

export interface SlimeStage {
  dice: number;
  nets: number;
  /** cần tổng số cách (trên 6^dice) của các ô có lưới ≥ need — so sánh SỐ NGUYÊN, không sai số */
  need: number;
  wave: number;
}
/** 1 xúc xắc: ô nào cũng như nhau → 2 xúc xắc: chỉ ô 7 đủ → 3 xúc xắc, 2 lưới: chỉ {10, 11} đủ 25 % */
export const SLIME_STAGES: SlimeStage[] = [
  { dice: 1, nets: 1, need: 1, wave: 12 },
  { dice: 2, nets: 1, need: 6, wave: 18 },
  { dice: 3, nets: 2, need: 54, wave: 24 },
];
/** ô xa nhất của đường ray (3 xúc xắc) */
export const SLIME_MAX = 18;

/** tổng số cách của các ô có lưới (ô trùng chỉ tính một lần) */
export function netWays(dice: number, tiles: number[]): number {
  const c = diceCounts(dice);
  let w = 0;
  for (const t of new Set(tiles)) w += c[t] ?? 0;
  return w;
}
export const netRate = (dice: number, tiles: number[]) =>
  netWays(dice, tiles) / diceTotal(dice);
export function stagePass(st: SlimeStage, tiles: number[]): boolean {
  const u = [...new Set(tiles)];
  return u.length <= st.nets && netWays(st.dice, u) >= st.need;
}
/** cách cắm lưới tốt nhất (tham lam theo số cách — đúng vì các ô rời nhau) */
export function bestNets(dice: number, nets: number): number[] {
  const c = diceCounts(dice);
  return c
    .map((w, s) => [w, s] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1])
    .slice(0, nets)
    .map((p) => p[1])
    .sort((a, b) => a - b);
}

export interface Slime {
  /** độ dài từng bước nhảy (mặt xúc xắc) */
  hops: number[];
  sum: number;
}
export function slimeWave(seed: number, dice: number, count: number): Slime[] {
  const rand = mulberry32(seed);
  const out: Slime[] = [];
  for (let i = 0; i < count; i++) {
    const hops: number[] = [];
    for (let k = 0; k < dice; k++) hops.push(1 + randInt(6, rand));
    out.push({ hops, sum: hops.reduce((a, b) => a + b, 0) });
  }
  return out;
}
export const caught = (wave: Slime[], tiles: number[]) => {
  const t = new Set(tiles);
  return wave.filter((s) => t.has(s.sum)).length;
};

// ───────────── Bánh Xe Chuỗi — độc lập + luật số lớn ─────────────

/** 37 ô: 0 = xanh (nhà cái), lẻ = Đỏ, chẵn = Đen → P(Đỏ) = P(Đen) = 18/37 */
export const WHEEL_SLOTS = 37;
export type WheelColor = "r" | "b" | "g";
export const slotColor = (s: number): WheelColor =>
  s === 0 ? "g" : s % 2 ? "r" : "b";
export const P_RED = 18 / 37;

export function spinSeq(seed: number, n: number): Uint8Array {
  const rand = mulberry32(seed);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = randInt(WHEEL_SLOTS, rand);
  return out;
}

/** Sau mỗi chuỗi ≥ `streak` lần Đỏ liền nhau, lần quay kế tiếp ra gì? */
export function afterStreak(seq: Uint8Array, streak: number) {
  let run = 0;
  const next = { r: 0, b: 0, g: 0, n: 0 };
  for (let i = 0; i < seq.length; i++) {
    const c = slotColor(seq[i]);
    if (run >= streak) {
      next[c]++;
      next.n++;
    }
    run = c === "r" ? run + 1 : 0;
  }
  return next;
}

/** Vị trí đầu tiên (chỉ số lần quay CUỐI của chuỗi) có đúng ≥ `streak` Đỏ liền nhau */
export function findStreak(seq: Uint8Array, streak: number): number {
  let run = 0;
  for (let i = 0; i < seq.length; i++) {
    run = slotColor(seq[i]) === "r" ? run + 1 : 0;
    if (run >= streak) return i;
  }
  return -1;
}

/** Luật số lớn tại các mốc n: tỉ lệ Đỏ (→ 18/37) và chênh lệch Đỏ − Đen (không thu hẹp, cỡ √n) */
export function llnTrace(seq: Uint8Array, marks: number[]) {
  let r = 0;
  let b = 0;
  let k = 0;
  const out: { n: number; ratio: number; gap: number }[] = [];
  const sorted = [...marks].sort((x, y) => x - y);
  for (let i = 0; i < seq.length && k < sorted.length; i++) {
    const c = slotColor(seq[i]);
    if (c === "r") r++;
    else if (c === "b") b++;
    while (k < sorted.length && sorted[k] === i + 1) {
      out.push({ n: i + 1, ratio: r / (i + 1), gap: r - b });
      k++;
    }
  }
  return out;
}

// ───────────── Thương vụ: nhận hay bỏ (chấm theo kì vọng) ─────────────

export type OfferKind = "jar" | "chest" | "bet";
export interface Offer {
  id: string;
  kind: OfferKind;
  /** xác suất thắng (đã tính đúng từ mô hình) */
  pWin: number;
  /** đặt 1 vé, thắng nhận lại `payout` vé (gồm cả vé đặt) */
  payout: number;
  /** tham số để hiển thị / mô phỏng */
  jar?: number;
  base?: number;
  readings?: boolean[];
  color?: WheelColor;
  /** lời mời của người bán: "seer" = Thầy Chuỗi (bẫy), "honest" = Cô Hàng Bên, "keeper" = chủ quầy */
  who: "keeper" | "seer" | "honest";
  /** sau chuỗi bao nhiêu Đỏ (chỉ để kể chuyện — KHÔNG ảnh hưởng xác suất) */
  streak?: number;
}
/** kì vọng lời / lỗ của một lần nhận (vé) */
export const offerEV = (o: Offer) => o.pWin * o.payout - 1;
export const shouldAccept = (o: Offer) => offerEV(o) > 0;

/** Đèn Năm: bà chủ cá ngang tay (thắng ×2) rằng vò KHÔNG có hai con chung đèn — bạn cược "có trùng" */
export const WISP_VARIANTS: number[][] = [
  [12, 23, 40],
  [30, 15, 25],
  [20, 50, 10],
];
export function wispOffers(v: number): Offer[] {
  return WISP_VARIANTS[v % WISP_VARIANTS.length].map((n) => ({
    id: `jar${n}`,
    kind: "jar",
    who: "keeper",
    jar: n,
    pWin: birthdayP(n),
    payout: 2,
  }));
}

/** Rương: giá 1 vé, rương thường có 3 vé. base = tỉ lệ mimic của xe hàng (biển ghi rõ), readings = các Đèn Soi */
export const MIMIC_VARIANTS: { base: number; readings: boolean[] }[][] = [
  [
    { base: 0.1, readings: [true] },
    { base: 0.1, readings: [true, true] },
    { base: 0.1, readings: [false] },
  ],
  [
    { base: 0.4, readings: [true] },
    { base: 0.1, readings: [true] },
    { base: 0.1, readings: [true, true] },
  ],
  [
    { base: 0.05, readings: [true, true] },
    { base: 0.1, readings: [true, false] },
    { base: 0.4, readings: [true] },
  ],
];
export function mimicOffers(v: number): Offer[] {
  return MIMIC_VARIANTS[v % MIMIC_VARIANTS.length].map((c, i) => ({
    id: `chest${i}`,
    kind: "chest",
    who: "keeper",
    base: c.base,
    readings: c.readings,
    pWin: 1 - posterior(c.base, c.readings),
    payout: CHEST_GOLD / CHEST_PRICE,
  }));
}

/** Bánh xe: Thầy Chuỗi chào cược theo chuỗi (×2 — luôn lỗ vì ô xanh); Cô Hàng Bên trả ×2,2 (lời, bất kể chuỗi) */
export const WHEEL_VARIANTS: Omit<Offer, "id" | "kind" | "pWin">[][] = [
  [
    { who: "seer", color: "b", payout: 2, streak: 5 },
    { who: "seer", color: "r", payout: 2, streak: 5 },
    { who: "honest", color: "r", payout: 2.2, streak: 5 },
  ],
  [
    { who: "honest", color: "b", payout: 2.2, streak: 6 },
    { who: "seer", color: "b", payout: 2, streak: 6 },
    { who: "seer", color: "g", payout: 30, streak: 6 },
  ],
  [
    { who: "seer", color: "r", payout: 2, streak: 4 },
    { who: "honest", color: "r", payout: 2.2, streak: 4 },
    { who: "seer", color: "g", payout: 36, streak: 4 },
  ],
];
export function wheelOffers(v: number): Offer[] {
  return WHEEL_VARIANTS[v % WHEEL_VARIANTS.length].map((o, i) => ({
    ...o,
    id: `bet${i}`,
    kind: "bet",
    pWin: o.color === "g" ? 1 / 37 : P_RED,
  }));
}

export interface Verdict {
  id: string;
  accepted: boolean;
  right: boolean;
  ev: number;
}
/** chấm quyết định: đúng khi nhận ⇔ EV > 0 */
export function judge(
  offers: Offer[],
  accepts: boolean[],
): { verdicts: Verdict[]; allRight: boolean } {
  const verdicts = offers.map((o, i) => ({
    id: o.id,
    accepted: !!accepts[i],
    right: !!accepts[i] === shouldAccept(o),
    ev: offerEV(o),
  }));
  return { verdicts, allRight: verdicts.every((v) => v.right) };
}

/** kết quả THẬT của một thương vụ đã nhận (mô phỏng đúng quá trình, không tung đồng xu theo pWin) */
export function playOffer(
  o: Offer,
  rand: Rand,
): { win: boolean; detail: number } {
  if (o.kind === "jar") {
    const j = releaseJar(rand, o.jar ?? 0);
    return { win: j.first > 0, detail: j.first };
  }
  if (o.kind === "chest") {
    // rút mimic theo hậu nghiệm (tương đương rút một rương có đúng các lần soi này)
    const mimic = rand() < 1 - o.pWin;
    return { win: !mimic, detail: mimic ? 1 : 0 };
  }
  const s = randInt(WHEEL_SLOTS, rand);
  return { win: slotColor(s) === o.color, detail: s };
}

// ───────────── Tiến trình (localStorage) ─────────────

export type StallId = "wisp" | "mimic" | "slime" | "wheel";
export const STALLS: StallId[] = ["wisp", "mimic", "slime", "wheel"];
export interface BazaarProgress {
  stamps: Record<StallId, boolean>;
  /** vé hội (tiền riêng của Chợ — KHÔNG phải xu) */
  tickets: number;
  /** màn Ruộng Slime đang chơi (0…2; 3 = xong) */
  slimeStage: number;
  /** đã nhận quà đủ 4 dấu (một lần) */
  grand: boolean;
}
export const START_TICKETS = 10;
export const NO_PROGRESS: BazaarProgress = {
  stamps: { wisp: false, mimic: false, slime: false, wheel: false },
  tickets: START_TICKETS,
  slimeStage: 0,
  grand: false,
};

export function parseProgress(raw: string | null): BazaarProgress {
  try {
    const v = JSON.parse(raw ?? "null");
    if (!v || typeof v !== "object") return structuredClone(NO_PROGRESS);
    const stamps = { ...NO_PROGRESS.stamps };
    for (const k of STALLS) stamps[k] = v.stamps?.[k] === true;
    const t = Number(v.tickets);
    const st = Number(v.slimeStage);
    return {
      stamps,
      tickets: Number.isFinite(t)
        ? Math.max(0, Math.min(999, Math.round(t * 10) / 10))
        : START_TICKETS,
      slimeStage: Number.isFinite(st)
        ? Math.max(0, Math.min(SLIME_STAGES.length, Math.floor(st)))
        : 0,
      grand: v.grand === true,
    };
  } catch {
    return structuredClone(NO_PROGRESS);
  }
}
