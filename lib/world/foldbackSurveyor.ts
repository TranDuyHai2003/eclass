/**
 * Kẻ Khảo sát Gấp (Foldback Surveyor) — boss 1 của Vùng Kỳ quan (nghiên cứu Terraria; docs/ai-reviews/voxel-world/BOSSES.md).
 * Logic THUẦN (không three / React), đồng hồ mili-giây truyền vào → test được ở tests/world/foldbackSurveyor.test.ts.
 *
 * Hình dạng: một ĐOÀN 12 toa gốm đi theo một lộ trình (đường gấp khúc lấy mẫu theo độ dài cung). Toa đầu có thấu kính.
 * Toạ độ đấu trường: u = x − cx, v = z − cz (trục thế giới, ô nguyên = tâm khối) — HUD gọi là (x; z).
 *
 * Đòn đánh (mỗi đòn báo trước ≥ 1 s bằng đúng hình sẽ gây sát thương):
 *  • sweep   Quét Làn — dải rộng 3 m qua chỗ người chơi; bước ngang ra khỏi dải.
 *  • fold    Gập Ngược — lộ trình A → T rồi gập theo đường ℓ: chặng 2 là ẢNH ĐỐI XỨNG của chặng 1 qua ℓ (B = đối xứng của A);
 *            góc T bị đi qua hai lần → đợi toa cuối qua rồi mới băng qua.
 *  • measure Thả Thước — hai thanh thước song song đập xuống; đứng trong KHE giữa (hoặc ra ngoài) rồi đánh toa đầu đang hạ thấp.
 * Pha 3: các toa cuối đi lại cùng lộ trình chậm một nhịp (khoảng trống 5 m giữa thân và "tiếng vọng").
 *
 * ĐIỀU KIỆN THẮNG = PHÉP ĐỐI XỨNG TRỤC: ở 2/3 và 1/3 máu, Kẻ Khảo sát dựng Khiên Đối xứng (miễn nhiễm), vạch đường gấp ℓ
 * và cắm cọc khảo sát S₁… ở một phía. Người chơi phải đứng (0,6 s) lên ẢNH S′ của từng cọc qua ℓ — cùng khoảng cách tới ℓ,
 * nằm phía bên kia, đoạn SS′ vuông góc với ℓ. Lần 1: ℓ song song trục (x = k / z = k), có "bóng gương" của chính em
 * (ảnh của em qua ℓ — đưa bóng chạm cọc là em đang đứng ở ảnh của cọc, vì phép đối xứng là ánh xạ tự nghịch).
 * Lần 2: ℓ chéo (z = x + k / z = −x + k), KHÔNG có bóng — phải tính bằng toạ độ. Ghim đủ → khiên vỡ, đoàn toa gập lại,
 * toa đầu ngã xuống (choáng, nhận ×1,6). Hết giờ → hồi 6 % máu, cọc mới, bật lại bóng gợi ý.
 */
import { createRng, type Rng } from "./rng";

export const SV = {
  /** nửa cạnh đấu trường (24 × 24 khối) */
  HALF: 12,
  CARTS: 12,
  /** khoảng cách hai toa dọc lộ trình (m) */
  GAP: 1.5,
  /** pha 3: toa thứ ECHO_FROM trở đi chạy sau một khoảng trống ECHO_GAP m */
  ECHO_FROM: 8,
  ECHO_GAP: 5,
  /** nửa bề rộng dải báo trước của Quét / Gập (≥ bán kính va chạm toa + người) */
  LANE_HALF: 1.5,
  /** bán kính va chạm toa + người chơi (≤ LANE_HALF: báo trước luôn phủ kín vùng nguy hiểm) */
  HIT_R: 1.3,
  SPEED: 14,
  HP: 1500,
  BAR_W: 2.2,
  BAR_GAP: 3,
  BAR_LEN: 12,
  SLAM_MS: 320,
  RECOVER_MS: { sweep: 1100, fold: 1100, measure: 3000 },
  PIN_R: 0.9,
  PIN_MS: 600,
  SEAL_MS: 32000,
  STUN_MS: 6500,
  DMG: { sweep: 14, fold: 16, measure: 18 },
  /** hệ số sát thương: giáp thường · toa đầu hạ thấp (sau Thả Thước) · hồi chiêu sau Quét / Gập · choáng sau khi gấp */
  MUL: { armored: 0.35, lowered: 1.3, recover: 1, stun: 1.6 },
} as const;

/** thời gian báo trước theo pha (ms) — nghiên cứu: bắt đầu ~1,2 s, đo lại bằng người đi bộ ở chỗ xuất phát tệ nhất */
export const TELE_MS: Record<1 | 2 | 3, number> = { 1: 1300, 2: 1200, 3: 1050 };
export const MEASURE_TELE_MS: Record<1 | 2 | 3, number> = { 1: 1450, 2: 1350, 3: 1200 };
const GAP_MS: Record<1 | 2 | 3, number> = { 1: 1700, 2: 1300, 3: 1000 };
const SEQ: Record<1 | 2 | 3, SvAtkKind[]> = {
  1: ["sweep", "measure", "sweep", "sweep", "measure"],
  2: ["fold", "sweep", "measure", "fold", "measure"],
  3: ["fold", "sweep", "measure", "fold", "sweep", "measure"],
};

// ───────────── Lộ trình (đường gấp khúc theo độ dài cung) ─────────────

export interface Route {
  /** toạ độ đỉnh u0, v0, u1, v1, … */
  pts: number[];
  /** độ dài cung tích luỹ tại từng đỉnh */
  cum: number[];
  len: number;
}

export function makeRoute(pts: number[]): Route {
  const cum = [0];
  for (let i = 2; i < pts.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export type P2 = { u: number; v: number };

/** Điểm tại độ dài cung s (s > len: đi tiếp thẳng theo hướng chặng cuối; s < 0: lùi theo chặng đầu) → ghi vào out */
export function routeAt(r: Route, s: number, out: P2 & { du?: number; dv?: number }): P2 {
  const n = r.cum.length;
  let i = 0;
  while (i < n - 2 && s > r.cum[i + 1]) i++;
  const u0 = r.pts[i * 2];
  const v0 = r.pts[i * 2 + 1];
  const u1 = r.pts[i * 2 + 2];
  const v1 = r.pts[i * 2 + 3];
  const L = r.cum[i + 1] - r.cum[i] || 1;
  const k = (s - r.cum[i]) / L;
  out.u = u0 + (u1 - u0) * k;
  out.v = v0 + (v1 - v0) * k;
  out.du = (u1 - u0) / L;
  out.dv = (v1 - v0) / L;
  return out;
}

/** Khoảng cách từ P tới đường gấp khúc (để vẽ / kiểm báo trước phủ kín) */
export function routeDist(r: Route, pu: number, pv: number): number {
  let best = Infinity;
  for (let i = 0; i + 3 < r.pts.length; i += 2) best = Math.min(best, segDist(pu, pv, r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3]));
  return best;
}

export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const L2 = abx * abx + abz * abz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (pz - az) * abz) / L2));
  return Math.hypot(px - ax - abx * t, pz - az - abz * t);
}

/** Toa k nằm sau toa đầu bao nhiêu mét dọc lộ trình (pha 3: các toa cuối là "tiếng vọng" cách một khoảng trống) */
export function cartOffset(k: number, echo: boolean): number {
  return k * SV.GAP + (echo && k >= SV.ECHO_FROM ? SV.ECHO_GAP : 0);
}

/** Tổng chiều dài đoàn toa (đầu → đuôi) */
export function bodyLen(echo: boolean): number {
  return cartOffset(SV.CARTS - 1, echo);
}

/** Khoảng cách từ P (bên trong hình vuông nửa cạnh h) tới biên theo hướng (du, dv) */
export function toSquareEdge(pu: number, pv: number, du: number, dv: number, h: number): number {
  let t = Infinity;
  if (du > 1e-9) t = Math.min(t, (h - pu) / du);
  if (du < -1e-9) t = Math.min(t, (-h - pu) / du);
  if (dv > 1e-9) t = Math.min(t, (h - pv) / dv);
  if (dv < -1e-9) t = Math.min(t, (-h - pv) / dv);
  return Math.max(0, t);
}

// ───────────── Đường gấp + phép đối xứng trục ─────────────

export type FoldKind = "x" | "z" | "diag" | "anti";
/** a·u + b·v = c với (a, b) là vectơ pháp tuyến ĐƠN VỊ; kind + k để in công thức (x = k, z = k, z = x + k, z = −x + k) */
export interface Line {
  a: number;
  b: number;
  c: number;
  kind: FoldKind;
  k: number;
}

export function foldLine(kind: FoldKind, k: number): Line {
  const s = Math.SQRT1_2;
  if (kind === "x") return { a: 1, b: 0, c: k, kind, k };
  if (kind === "z") return { a: 0, b: 1, c: k, kind, k };
  if (kind === "diag") return { a: -s, b: s, c: k * s, kind, k }; // −u + v = k ⇔ z = x + k
  return { a: s, b: s, c: k * s, kind, k }; // u + v = k ⇔ z = −x + k
}

/** Đường bất kỳ qua điểm (u0, v0) với vectơ chỉ phương (fu, fv) */
export function lineThrough(u0: number, v0: number, fu: number, fv: number): Line {
  const L = Math.hypot(fu, fv) || 1;
  const a = -fv / L;
  const b = fu / L;
  return { a, b, c: a * u0 + b * v0, kind: "diag", k: NaN };
}

/** Khoảng cách CÓ DẤU tới đường (dương = phía pháp tuyến) */
export function lineSide(L: Line, u: number, v: number): number {
  return L.a * u + L.b * v - L.c;
}

/** Ảnh của P qua phép đối xứng trục ℓ: P′ = P − 2·d·n (d = khoảng cách có dấu) — làm tròn để ô nguyên ra ô nguyên */
export function reflect(L: Line, u: number, v: number, out: P2 = { u: 0, v: 0 }): P2 {
  const d = lineSide(L, u, v);
  out.u = clean(u - 2 * L.a * d);
  out.v = clean(v - 2 * L.b * d);
  return out;
}
const clean = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) + 0 : x); // + 0: bỏ −0

const sgn = (n: number) => (n < 0 ? "−" : "+");
/** Công thức đường gấp cho HUD: "x = 2", "z = −1", "z = x + 3", "z = −x − 2" (dấu trừ thật) */
export function lineText(L: Line): string {
  const k = L.k;
  const num = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
  if (L.kind === "x") return `x = ${num(k)}`;
  if (L.kind === "z") return `z = ${num(k)}`;
  const head = L.kind === "diag" ? "z = x" : "z = −x";
  return k === 0 ? head : `${head} ${sgn(k)} ${Math.abs(k)}`;
}

/** Quy tắc toạ độ của phép đối xứng (gợi ý sau một lần thất bại): "(x; z) → (4 − x; z)" */
export function ruleText(L: Line): string {
  const k = L.k;
  const plus = (base: string, n: number) => (n === 0 ? base : `${base} ${sgn(n)} ${Math.abs(n)}`);
  const minus = (n: number, v: string) => (n === 0 ? `−${v}` : `${n < 0 ? "−" + -n : n} − ${v}`);
  if (L.kind === "x") return `(x; z) → (${minus(2 * k, "x")}; z)`;
  if (L.kind === "z") return `(x; z) → (x; ${minus(2 * k, "z")})`;
  if (L.kind === "diag") return `(x; z) → (${plus("z", -k)}; ${plus("x", k)})`;
  return `(x; z) → (${minus(k, "z")}; ${minus(k, "x")})`;
}

// ───────────── Khiên Đối xứng (điều kiện thắng) ─────────────

export interface Seal {
  line: Line;
  stakes: P2[];
  /** ảnh của từng cọc (tính sẵn — để vẽ khi đã ghim & để test) */
  images: P2[];
  pinned: boolean[];
  hold: number[];
  /** hiện "bóng gương" của người chơi (lần 1, hoặc sau một lần thất bại) */
  ghost: boolean;
  t0: number;
  tries: number;
  /** lúc gần nhất người chơi đứng nhầm lên chính cọc (gợi ý "đó là cọc, không phải ảnh") */
  wrongAt: number;
}

const DIRS8: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2],
];

/**
 * Tạo khiên: đường gấp loại `kinds`, n cọc ô nguyên cùng một phía, cách ℓ 1,5–6 m; cọc và ảnh đều trong |x|, |z| ≤ 8;
 * các điểm (cọc + ảnh) cách nhau ≥ 2,5 m để không đứng nhầm. Tất định theo rng.
 */
export function makeSeal(rng: Rng, kinds: FoldKind[], n: number, ghost: boolean, now: number): Seal {
  for (let attempt = 0; attempt < 60; attempt++) {
    const kind = rng.pick(kinds);
    const k = kind === "x" || kind === "z" ? rng.int(-2, 2) : rng.pick([-2, 0, 2]);
    const line = foldLine(kind, k);
    const side = rng.chance(0.5) ? 1 : -1;
    const stakes: P2[] = [];
    const images: P2[] = [];
    for (let t = 0; t < 400 && stakes.length < n; t++) {
      const u = rng.int(-8, 8);
      const v = rng.int(-8, 8);
      const d = lineSide(line, u, v) * side;
      if (d < 1.5 || d > 6) continue;
      const im = reflect(line, u, v);
      if (Math.abs(im.u) > 8 || Math.abs(im.v) > 8) continue;
      const far = (q: P2) => Math.hypot(q.u - u, q.v - v) >= 2.5 && Math.hypot(q.u - im.u, q.v - im.v) >= 2.5;
      if (!stakes.every(far) || !images.every(far)) continue;
      // tránh cọc ngay tâm (chỗ đoàn toa gập lại)
      if (Math.hypot(u, v) < 1.5 || Math.hypot(im.u, im.v) < 1.5) continue;
      stakes.push({ u, v });
      images.push(im);
    }
    if (stakes.length === n) return { line, stakes, images, pinned: stakes.map(() => false), hold: stakes.map(() => 0), ghost, t0: now, tries: 0, wrongAt: -1e9 };
  }
  // dự phòng tất định (không bao giờ tới với n ≤ 3, giữ cho an toàn)
  const line = foldLine("x", 0);
  const stakes = [{ u: 3, v: -3 }, { u: 5, v: 3 }, { u: 2, v: 6 }].slice(0, n);
  return { line, stakes, images: stakes.map((s) => reflect(line, s.u, s.v)), pinned: stakes.map(() => false), hold: stakes.map(() => 0), ghost, t0: now, tries: 0, wrongAt: -1e9 };
}

/** Một bước ghim: đứng trong PIN_R quanh ảnh chưa ghim đủ PIN_MS → ghim. Trả chỉ số vừa ghim (−1 nếu không). */
export function sealStep(seal: Seal, pu: number, pv: number, dtMs: number, now: number): number {
  return sealStepAll(seal, [pu, pv], dtMs, now);
}

/** Nhiều người: pts = [u0, v0, u1, v1, …] — ảnh được ghim khi BẤT KỲ ai đứng đủ lâu trên nó (có thể chia nhau mỗi người một ảnh) */
export function sealStepAll(seal: Seal, pts: ArrayLike<number>, dtMs: number, now: number): number {
  const near = (u: number, v: number) => {
    for (let k = 0; k + 1 < pts.length; k += 2) if (Math.hypot(pts[k] - u, pts[k + 1] - v) <= SV.PIN_R) return true;
    return false;
  };
  let got = -1;
  for (let i = 0; i < seal.stakes.length; i++) {
    if (seal.pinned[i]) continue;
    const im = seal.images[i];
    if (near(im.u, im.v)) {
      seal.hold[i] += dtMs;
      if (seal.hold[i] >= SV.PIN_MS) {
        seal.pinned[i] = true;
        got = i;
      }
    } else seal.hold[i] = 0;
    const s = seal.stakes[i];
    if (near(s.u, s.v)) seal.wrongAt = now;
  }
  return got;
}

export const sealDone = (seal: Seal) => seal.pinned.every(Boolean);
export const sealPinned = (seal: Seal) => seal.pinned.filter(Boolean).length;

// ───────────── Đòn đánh ─────────────

export type SvAtkKind = "sweep" | "fold" | "measure";
export interface Bars {
  /** tâm O (chỗ người chơi lúc chốt), hướng dọc thước d, pháp tuyến n */
  ou: number;
  ov: number;
  du: number;
  dv: number;
  nu: number;
  nv: number;
  /** độ lệch tâm 2 thanh theo n (thanh 1 phủ người chơi, khe ở giữa) */
  off: [number, number];
}
export interface SvAtk {
  kind: SvAtkKind;
  route: Route | null;
  /** Gập Ngược: đường gấp qua điểm gấp T */
  fold: Line | null;
  bars: Bars | null;
  echo: boolean;
  t0: number;
  tele: number;
  /** thời gian pha đánh (đầu đoàn tới cuối đoàn qua hết lộ trình / thước đập) */
  dur: number;
  rec: number;
  /** đã trúng người chơi (thân chính / tiếng vọng) */
  hitMain: boolean;
  hitEcho: boolean;
}

export type SvMode = "intro" | "fight" | "seal" | "stun" | "dead";
export interface Surveyor {
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  mode: SvMode;
  modeAt: number;
  atk: SvAtk | null;
  n: number;
  nextAt: number;
  seal: Seal | null;
  /** số khiên đã phá (0, 1, 2) */
  sealsDone: number;
  rng: Rng;
  deadAt: number;
  lastT: number;
}

export const INTRO_MS = 2600;
/** ngưỡng máu dựng khiên: 2/3 và 1/3 */
export const SEAL_AT = [2 / 3, 1 / 3] as const;

export function newSurveyor(seed: number, now: number, players = 1): Surveyor {
  const maxHp = Math.round(SV.HP * (0.6 + 0.4 * Math.max(1, players)));
  return { hp: maxHp, maxHp, phase: 1, mode: "intro", modeAt: now, atk: null, n: 0, nextAt: now + INTRO_MS, seal: null, sealsDone: 0, rng: createRng(seed), deadAt: 0, lastT: now };
}

/** Pha của đòn đang ra: "tele" báo trước · "strike" gây sát thương · "recover" hồi chiêu · null hết */
export function atkStage(a: SvAtk, now: number): "tele" | "strike" | "recover" | null {
  const t = now - a.t0;
  if (t < a.tele) return "tele";
  if (t < a.tele + a.dur) return "strike";
  if (t < a.tele + a.dur + a.rec) return "recover";
  return null;
}

/** Đầu đoàn đi được bao nhiêu mét trên lộ trình (Quét / Gập) */
export function headS(a: SvAtk, now: number): number {
  return Math.max(0, now - a.t0 - a.tele) * (SV.SPEED / 1000);
}

const clampIn = (x: number, m: number) => Math.max(-m, Math.min(m, x));

export function makeSweep(rng: Rng, pu: number, pv: number, now: number, phase: 1 | 2 | 3): SvAtk {
  const [du, dv] = rng.pick(DIRS8);
  const cu = clampIn(pu, SV.HALF - 1);
  const cv = clampIn(pv, SV.HALF - 1);
  const back = toSquareEdge(cu, cv, -du, -dv, SV.HALF);
  const fwd = toSquareEdge(cu, cv, du, dv, SV.HALF);
  const route = makeRoute([cu - du * back, cv - dv * back, cu + du * fwd, cv + dv * fwd]);
  const echo = phase === 3;
  return { kind: "sweep", route, fold: null, bars: null, echo, t0: now, tele: TELE_MS[phase], dur: ((route.len + bodyLen(echo)) / SV.SPEED) * 1000, rec: SV.RECOVER_MS.sweep, hitMain: false, hitEcho: false };
}

/**
 * Gập Ngược: chặng 1 A → T (T = chỗ người chơi), đường gấp ℓ qua T lệch β so với chặng 1; chặng 2 T → B với B = ảnh của A
 * qua ℓ (rồi cắt ở biên). Góc gấp β ∈ {±25°, ±35°} → đoàn toa quay ngoắt 110–130°.
 */
export function makeFold(rng: Rng, pu: number, pv: number, now: number, phase: 1 | 2 | 3): SvAtk {
  const [du, dv] = rng.pick(DIRS8);
  const tu = clampIn(pu, SV.HALF - 3);
  const tv = clampIn(pv, SV.HALF - 3);
  const leg = Math.min(10, toSquareEdge(tu, tv, -du, -dv, SV.HALF));
  const au = tu - du * leg;
  const av = tv - dv * leg;
  const beta = (rng.chance(0.5) ? 1 : -1) * (rng.chance(0.5) ? 25 : 35) * (Math.PI / 180);
  const fu = du * Math.cos(beta) - dv * Math.sin(beta);
  const fv = du * Math.sin(beta) + dv * Math.cos(beta);
  const fold = lineThrough(tu, tv, fu, fv);
  const b = reflect(fold, au, av);
  // cắt chặng 2 ở biên đấu trường
  const l2 = Math.hypot(b.u - tu, b.v - tv) || 1;
  const eu = (b.u - tu) / l2;
  const ev = (b.v - tv) / l2;
  const l2c = Math.min(l2, toSquareEdge(tu, tv, eu, ev, SV.HALF));
  const route = makeRoute([au, av, tu, tv, tu + eu * l2c, tv + ev * l2c]);
  const echo = phase === 3;
  return { kind: "fold", route, fold, bars: null, echo, t0: now, tele: TELE_MS[phase] + 150, dur: ((route.len + bodyLen(echo)) / SV.SPEED) * 1000, rec: SV.RECOVER_MS.fold, hitMain: false, hitEcho: false };
}

/** Thả Thước: hai thanh dài BAR_LEN, rộng BAR_W, khe BAR_GAP; thanh 1 phủ chỗ người chơi, khe ở phía gần tâm đấu trường */
export function makeMeasure(rng: Rng, pu: number, pv: number, now: number, phase: 1 | 2 | 3): SvAtk {
  const a = rng.pick([0, 1, 2, 3]) * (Math.PI / 4);
  const du = Math.cos(a);
  const dv = Math.sin(a);
  const nu = -dv;
  const nv = du;
  const ou = clampIn(pu, SV.HALF - 2);
  const ov = clampIn(pv, SV.HALF - 2);
  // khe về phía tâm (để thanh 2 không ra ngoài đấu trường)
  const s = ou * nu + ov * nv > 0 ? -1 : 1;
  const step = SV.BAR_W + SV.BAR_GAP;
  const bars: Bars = { ou, ov, du, dv, nu, nv, off: [0, s * step] };
  return { kind: "measure", route: null, fold: null, bars, echo: false, t0: now, tele: MEASURE_TELE_MS[phase], dur: SV.SLAM_MS, rec: SV.RECOVER_MS.measure, hitMain: false, hitEcho: false };
}

/** Điểm (u, v) có nằm trên một thanh thước không */
export function inBars(b: Bars, pu: number, pv: number, pad = 0): boolean {
  const x = pu - b.ou;
  const z = pv - b.ov;
  const along = x * b.du + z * b.dv;
  if (Math.abs(along) > SV.BAR_LEN / 2 + pad) return false;
  const off = x * b.nu + z * b.nv;
  return Math.abs(off - b.off[0]) <= SV.BAR_W / 2 + pad || Math.abs(off - b.off[1]) <= SV.BAR_W / 2 + pad;
}

/** Tâm khe an toàn giữa hai thanh (để test / gợi ý) */
export function gapCenter(b: Bars): P2 {
  const m = (b.off[0] + b.off[1]) / 2;
  return { u: b.ou + b.nu * m, v: b.ov + b.nv * m };
}

/** Vị trí toa đầu khi Thả Thước: cuối khe (toa đầu "kéo thước" rồi hạ thấp ở đó) */
export function measureHead(b: Bars, out: P2): P2 {
  const g = gapCenter(b);
  out.u = g.u + b.du * (SV.BAR_LEN / 2 + 1.2);
  out.v = g.v + b.dv * (SV.BAR_LEN / 2 + 1.2);
  return out;
}

const TMP: P2 & { du?: number; dv?: number } = { u: 0, v: 0 };

/**
 * Toa trúng người chơi? (Quét / Gập) — kiểm từng toa ĐANG Ở TRÊN lộ trình (0 ≤ s ≤ len + 1), đúng vị trí vẽ ra.
 * Trả "main" / "echo" / null. Không cấp phát.
 */
export function cartsHit(a: SvAtk, now: number, pu: number, pv: number): "main" | "echo" | null {
  if (!a.route) return null;
  const sh = headS(a, now);
  for (let k = 0; k < SV.CARTS; k++) {
    const s = sh - cartOffset(k, a.echo);
    if (s < 0 || s > a.route.len + 1) continue;
    routeAt(a.route, s, TMP);
    if (Math.hypot(pu - TMP.u, pv - TMP.v) <= SV.HIT_R) return a.echo && k >= SV.ECHO_FROM ? "echo" : "main";
  }
  return null;
}

// ───────────── Máy trạng thái ─────────────

function startSeal(s: Surveyor, now: number) {
  const second = s.sealsDone >= 1;
  s.mode = "seal";
  s.modeAt = now;
  s.atk = null;
  s.seal = makeSeal(s.rng, second ? ["diag", "anti"] : ["x", "z"], second ? 3 : 2, !second, now);
  s.nextAt = now + 2500;
}

/**
 * Một bước (gọi mỗi khung hoặc theo nhịp): chuyển pha, ghim cọc, lên lịch đòn. (pu, pv) = người chơi theo toạ độ đấu trường.
 * Trả sự kiện để lớp vẽ phát âm / hiệu ứng: "seal" (vừa dựng khiên), "pin", "fold" (gấp xong, choáng), "fail", "tele", "strike", "dead".
 */
export function tickSurveyor(s: Surveyor, now: number, pu: number, pv: number, others?: ArrayLike<number>): string | null {
  const dt = Math.min(100, Math.max(0, now - s.lastT));
  s.lastT = now;
  if (s.mode === "dead") return null;
  if (s.hp <= 0) {
    s.mode = "dead";
    s.deadAt = now;
    s.atk = null;
    return "dead";
  }
  if (s.mode === "intro") {
    if (now >= s.nextAt) {
      s.mode = "fight";
      s.modeAt = now;
    }
    return null;
  }
  if (s.mode === "stun") {
    if (now - s.modeAt >= SV.STUN_MS) {
      s.mode = "fight";
      s.modeAt = now;
      s.nextAt = now + 800;
    }
    return null;
  }
  // tới ngưỡng máu → dựng Khiên Đối xứng (chờ đòn đang ra kết thúc pha đánh cho khỏi cắt ngang hình báo trước)
  if (s.mode === "fight" && s.sealsDone < 2 && s.hp <= s.maxHp * SEAL_AT[s.sealsDone] && (!s.atk || atkStage(s.atk, now) !== "strike")) {
    startSeal(s, now);
    return "seal";
  }
  if (s.mode === "seal" && s.seal) {
    const seal = s.seal;
    const got = others && others.length ? sealStepAll(seal, [pu, pv, ...Array.from(others)], dt, now) : sealStep(seal, pu, pv, dt, now);
    if (sealDone(seal)) {
      s.sealsDone++;
      s.phase = s.sealsDone === 1 ? 2 : 3;
      s.mode = "stun";
      s.modeAt = now;
      s.atk = null;
      s.n = 0;
      return "fold";
    }
    if (now - seal.t0 > SV.SEAL_MS) {
      // thất bại: hồi 6 % máu (không vượt ngưỡng trên), cọc mới, bật bóng gợi ý
      const cap = s.sealsDone === 0 ? s.maxHp : s.maxHp * SEAL_AT[0];
      s.hp = Math.min(cap, s.hp + s.maxHp * 0.06);
      const tries = seal.tries + 1;
      s.seal = makeSeal(s.rng, seal.line.kind === "x" || seal.line.kind === "z" ? ["x", "z"] : ["diag", "anti"], seal.stakes.length, true, now);
      s.seal.tries = tries;
      s.atk = null;
      return "fail";
    }
    if (got >= 0) return "pin";
    // khiên lần 2: vẫn Quét Làn chậm (6 s / lần) để giữ áp lực
    if (s.sealsDone === 0) return null;
  }
  if (s.atk) {
    const st = atkStage(s.atk, now);
    if (st === null) {
      s.atk = null;
      s.nextAt = now + (s.mode === "seal" ? 6000 : GAP_MS[s.phase]);
    }
    return null;
  }
  if (now < s.nextAt) return null;
  const kind = s.mode === "seal" ? "sweep" : SEQ[s.phase][s.n % SEQ[s.phase].length];
  // nhiều người: mỗi đòn nhắm lần lượt một người trong trận (chủ, rồi từng khách)
  const pick = attackTarget(s.n, pu, pv, others);
  pu = pick.u;
  pv = pick.v;
  s.n++;
  s.atk = kind === "sweep" ? makeSweep(s.rng, pu, pv, now, s.phase) : kind === "fold" ? makeFold(s.rng, pu, pv, now, s.phase) : makeMeasure(s.rng, pu, pv, now, s.phase);
  return "tele";
}

/** Người bị nhắm ở đòn thứ n: lần lượt theo vòng [chủ, khách 1, khách 2, …] */
export function attackTarget(n: number, pu: number, pv: number, others?: ArrayLike<number>): P2 {
  const cnt = 1 + Math.floor((others?.length ?? 0) / 2);
  const k = n % cnt;
  return k === 0 || !others ? { u: pu, v: pv } : { u: others[(k - 1) * 2], v: others[(k - 1) * 2 + 1] };
}

/**
 * Đòn của boss có trúng người chơi lúc này không → sát thương (0 = không). Mỗi đòn trúng tối đa một lần (+ một lần cho
 * "tiếng vọng" ở pha 3). Gọi mỗi khung sau tickSurveyor.
 */
export function surveyorHurt(s: Surveyor, now: number, pu: number, pv: number): number {
  const a = s.atk;
  if (!a || s.mode === "dead" || atkStage(a, now) !== "strike") return 0;
  if (a.kind === "measure") {
    if (a.hitMain || !a.bars) return 0;
    if (inBars(a.bars, pu, pv)) {
      a.hitMain = true;
      return SV.DMG.measure;
    }
    return 0;
  }
  const h = cartsHit(a, now, pu, pv);
  if (h === "main" && !a.hitMain) {
    a.hitMain = true;
    return SV.DMG[a.kind];
  }
  if (h === "echo" && !a.hitEcho) {
    a.hitEcho = true;
    return Math.round(SV.DMG[a.kind] * 0.75);
  }
  return 0;
}

/** Hệ số sát thương người chơi gây lên toa đầu lúc này */
export function surveyorMul(s: Surveyor, now: number): number {
  if (s.mode === "dead" || s.mode === "seal" || s.mode === "intro") return 0;
  if (s.mode === "stun") return SV.MUL.stun;
  const a = s.atk;
  if (a && atkStage(a, now) === "recover") return a.kind === "measure" ? SV.MUL.lowered : SV.MUL.recover;
  return SV.MUL.armored;
}

/**
 * Nhận sát thương (đã nhân hệ số). Máu không vượt qua ngưỡng khiên đang chờ trong một đòn (đòn to không bỏ qua câu đố).
 * Trả sát thương thực.
 */
export function hitSurveyor(s: Surveyor, raw: number, now: number): number {
  const m = surveyorMul(s, now);
  if (m <= 0 || s.hp <= 0) return 0;
  const floor = s.sealsDone < 2 ? Math.ceil(s.maxHp * SEAL_AT[s.sealsDone]) - 1 : 0;
  const before = s.hp;
  s.hp = Math.max(s.mode === "fight" && s.sealsDone < 2 ? Math.min(before, floor) : 0, s.hp - Math.round(raw * m));
  return before - s.hp;
}

/** Thời gian (ms) để đi bộ ra khỏi vùng nguy hiểm ở chỗ đứng TỆ NHẤT (tâm dải / tâm thanh) — để test báo trước đủ dài */
export function worstEscapeMs(kind: SvAtkKind, walk = 4): number {
  const dist = kind === "measure" ? SV.BAR_W / 2 + 0.35 : SV.HIT_R + 0.05;
  return (dist / walk) * 1000;
}
