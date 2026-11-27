/**
 * Toán hàm bậc ba y = ax³ + bx² + cx + d — thuần, dùng chung cho sinh đề, chấm điểm và vẽ đường ray 3D.
 */
export interface Cubic {
  a: number;
  b: number;
  c: number;
  d: number;
}

export const f = (k: Cubic, x: number) => ((k.a * x + k.b) * x + k.c) * x + k.d;
export const fp = (k: Cubic, x: number) => (3 * k.a * x + 2 * k.b) * x + k.c;
export const fpp = (k: Cubic, x: number) => 6 * k.a * x + 2 * k.b;

/** Δ′ của f′ = 3ax² + 2bx + c (chia 4): b² − 3ac */
export const deltaPrime = (k: Cubic) => k.b * k.b - 3 * k.a * k.c;

export type CriticalPoints =
  | { kind: "two"; x1: number; x2: number } // x1 < x2, f′ đổi dấu tại cả hai
  | { kind: "double"; x0: number } // f′ = 0 nhưng không đổi dấu (điểm uốn nằm ngang)
  | { kind: "none" };

const EPS = 1e-9;

export function criticalPoints(k: Cubic): CriticalPoints {
  if (Math.abs(k.a) < EPS) {
    // Suy biến thành bậc hai: f′ = 2bx + c
    if (Math.abs(k.b) < EPS) return { kind: "none" };
    const x = -k.c / (2 * k.b);
    return { kind: "double", x0: x }; // không dùng trong sinh đề; trả về để không vỡ
  }
  const D = deltaPrime(k);
  if (D > EPS) {
    const r = Math.sqrt(D);
    const xa = (-k.b - r) / (3 * k.a);
    const xb = (-k.b + r) / (3 * k.a);
    return { kind: "two", x1: Math.min(xa, xb), x2: Math.max(xa, xb) };
  }
  if (Math.abs(D) <= EPS) return { kind: "double", x0: -k.b / (3 * k.a) };
  return { kind: "none" };
}

export interface Extrema {
  max?: { x: number; y: number };
  min?: { x: number; y: number };
}

/** Điểm cực đại / cực tiểu (chỉ khi f′ đổi dấu) */
export function extrema(k: Cubic): Extrema {
  const cp = criticalPoints(k);
  if (cp.kind !== "two") return {};
  const p1 = { x: cp.x1, y: f(k, cp.x1) };
  const p2 = { x: cp.x2, y: f(k, cp.x2) };
  // a > 0: f′ dương – âm – dương ⇒ x1 cực đại, x2 cực tiểu
  return k.a > 0 ? { max: p1, min: p2 } : { max: p2, min: p1 };
}

export interface MonoInterval {
  from: number; // -Infinity được phép
  to: number; // Infinity được phép
  sign: 1 | -1; // 1 = đồng biến
}

/** Các khoảng đơn điệu (bỏ qua điểm f′ = 0 không đổi dấu) */
export function monotonicIntervals(k: Cubic): MonoInterval[] {
  const s = (k.a > 0 ? 1 : -1) as 1 | -1;
  const cp = criticalPoints(k);
  if (cp.kind !== "two") return [{ from: -Infinity, to: Infinity, sign: s }];
  return [
    { from: -Infinity, to: cp.x1, sign: s },
    { from: cp.x1, to: cp.x2, sign: (-s) as 1 | -1 },
    { from: cp.x2, to: Infinity, sign: s },
  ];
}

/** Giá trị lớn nhất / nhỏ nhất trên đoạn [lo, hi] và nơi đạt */
export function minMaxOnInterval(k: Cubic, lo: number, hi: number) {
  const xs = [lo, hi];
  const cp = criticalPoints(k);
  if (cp.kind === "two") for (const x of [cp.x1, cp.x2]) if (x > lo && x < hi) xs.push(x);
  if (cp.kind === "double" && cp.x0 > lo && cp.x0 < hi) xs.push(cp.x0);
  let max = { x: lo, y: f(k, lo) };
  let min = { x: lo, y: f(k, lo) };
  for (const x of xs) {
    const y = f(k, x);
    if (y > max.y + EPS) max = { x, y };
    if (y < min.y - EPS) min = { x, y };
  }
  return { max, min };
}

/**
 * Dựng hàm bậc ba từ nghiệm của đạo hàm: f′(x) = 3m(x − p)(x − q), f(0) = d.
 * ⇒ f = m x³ − (3m(p+q)/2) x² + 3mpq x + d. Hệ số nguyên khi p + q chẵn.
 */
export function cubicFromRoots(m: number, p: number, q: number, d: number): Cubic {
  return { a: m, b: (-3 * m * (p + q)) / 2, c: 3 * m * p * q, d };
}

/** f′(x) = 3m(x − p)² (nghiệm kép) ⇒ f = m x³ − 3mp x² + 3mp² x + d */
export function cubicDoubleRoot(m: number, p: number, d: number): Cubic {
  return { a: m, b: -3 * m * p, c: 3 * m * p * p, d };
}

/** f′(x) = 3m((x − p)² + s), s > 0 (không có nghiệm) */
export function cubicNoRoot(m: number, p: number, s: number, d: number): Cubic {
  return { a: m, b: -3 * m * p, c: 3 * m * (p * p + s), d };
}

// ───────────── Hiển thị ─────────────

/** Số kiểu Việt Nam: dấu phẩy thập phân, dấu trừ thật; tối đa 2 chữ số thập phân */
export function vn(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "+∞" : "−∞";
  const r = Math.round(n * 100) / 100;
  const s = (Object.is(r, -0) ? 0 : r).toString().replace(".", ",");
  return s.startsWith("-") ? "−" + s.slice(1) : s;
}

/** Khoảng dạng (a; b) theo cách viết SGK */
export function vnInterval(from: number, to: number): string {
  return `(${vn(from)}; ${vn(to)})`;
}

function term(coef: number, pow: number, first: boolean, dec: string): string {
  if (Math.abs(coef) < EPS) return "";
  const sign = coef < 0 ? "-" : first ? "" : "+";
  const abs = Math.abs(coef);
  const num = Number.isInteger(abs) ? String(abs) : String(Math.round(abs * 100) / 100).replace(".", dec);
  const showNum = pow === 0 || abs !== 1;
  const x = pow === 0 ? "" : pow === 1 ? "x" : `x^{${pow}}`;
  return `${sign}${showNum ? num : ""}${x}`;
}

/** LaTeX của đa thức (hệ số giảm dần theo bậc) */
export function polyLatex(coeffs: number[], dec = "."): string {
  const deg = coeffs.length - 1;
  let out = "";
  coeffs.forEach((c, i) => {
    const t = term(c, deg - i, out === "", dec);
    out += t;
  });
  return out || "0";
}

/** dec: dấu thập phân trong KaTeX — "." (en) hoặc "{,}" (vi) */
export const cubicLatex = (k: Cubic, dec = ".") => polyLatex([k.a, k.b, k.c, k.d], dec);
/** f′ = 3a x² + 2b x + c */
export const derivLatex = (k: Cubic, dec = ".") => polyLatex([3 * k.a, 2 * k.b, k.c], dec);
