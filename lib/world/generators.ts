/**
 * Sinh câu hỏi có seed cho khu "Thung lũng Hàm số".
 * - `prompt` (gửi xuống client) KHÔNG chứa đáp án.
 * - `key` + `explanation` chỉ ở server; khi chấm, server sinh lại từ (familyId, seed).
 * Mọi phương án nhiễu gắn mã ngộ nhận (lib/world/kcs.ts → MISCONCEPTIONS).
 */
import { createRng, type Rng } from "./rng";
import {
  type Cubic,
  cubicDoubleRoot,
  cubicFromRoots,
  cubicLatex,
  extrema,
  f,
  minMaxOnInterval,
} from "./cubic";
import type { KcId } from "./kcs";
import { DEFAULT_LANG, type Lang } from "./i18n";

/** Ngôn ngữ của lần sinh đề hiện tại (sinh đề là đồng bộ nên an toàn); đặt qua generate(…, lang) */
let LANG: Lang = DEFAULT_LANG;
/** Chọn chuỗi theo ngôn ngữ hiện tại: T(english, vietnamese) */
const T = (en: string, vi: string) => (LANG === "vi" ? vi : en);

export type Format = "MCQ" | "TF4" | "SHORT" | "ANCHOR" | "MULTI";
export type ExamPart = "I" | "II" | "III";

export interface GraphSpec {
  /** Vẽ đồ thị của f hay của f′ */
  kind: "f" | "fprime";
  cubic: Cubic;
  xMin: number;
  xMax: number;
}

/** Phần gửi xuống client — tuyệt đối không có đáp án */
export interface PublicPrompt {
  familyId: string;
  kc: KcId;
  format: Format;
  part?: ExamPart;
  /** Văn bản, công thức đặt trong $…$ (KaTeX) */
  stem: string;
  graph?: GraphSpec;
  /** Phương án; có thể kèm đồ thị (câu ghép đồ thị — trực giác) */
  options?: { id: string; label: string; graph?: GraphSpec }[];
  statements?: { id: "a" | "b" | "c" | "d"; text: string }[];
  input?: { maxChars: number; hint: string };
}

export type AnswerKey =
  | { kind: "MCQ"; correct: string; traps: Record<string, string> }
  | { kind: "TF4"; truth: [boolean, boolean, boolean, boolean]; traps: (string | null)[] }
  | { kind: "SHORT"; value: number; traps: { value: number; id: string }[] }
  | { kind: "ANCHOR"; xs: number[]; tol: number }
  | { kind: "MULTI"; correct: string[]; traps: Record<string, string> };

export interface Generated {
  prompt: PublicPrompt;
  key: AnswerKey;
  /** Lời giải — chỉ trả về sau khi nộp */
  explanation: string;
  /** Dữ liệu dựng đề (chỉ ở server, dùng cho test / phân tích) */
  meta?: Record<string, unknown>;
}

export interface Family {
  id: string;
  kc: KcId;
  format: Format;
  part?: ExamPart;
  /** Độ khó Elo khởi đầu */
  elo0: number;
  /** Dùng để xác nhận phát hiện (không phát trong luyện/ôn) */
  discovery?: boolean;
  generate(seed: number): Generated;
}

// ───────────── Định dạng LaTeX ─────────────

/** Số trong KaTeX: en dấu chấm thập phân, vi dấu phẩy */
export function tex(n: number): string {
  if (n === Infinity) return "+\\infty";
  if (n === -Infinity) return "-\\infty";
  const r = Math.round(n * 100) / 100;
  const s = (Object.is(r, -0) ? 0 : r).toString();
  return LANG === "vi" ? s.replace(".", "{,}") : s;
}
/** Khoảng: en (a, b) · vi (a; b) theo SGK */
const sep = () => (LANG === "vi" ? ";\\ " : ",\\ ");
const texInterval = (a: number, b: number) => `$\\left(${tex(a)}${sep()}${tex(b)}\\right)$`;
const texSegment = (a: number, b: number) => `$\\left[${tex(a)}${sep()}${tex(b)}\\right]$`;
const cubicTex = (k: Cubic) => cubicLatex(k, LANG === "vi" ? "{,}" : ".");
const OR = () => T(" or ", " hoặc ");

/** (x − p)^e */
function factor(p: number, e = 1): string {
  const base = p === 0 ? "x" : p > 0 ? `(x-${tex(p)})` : `(x+${tex(-p)})`;
  if (e === 1) return base;
  return p === 0 ? `x^{${e}}` : `${base}^{${e}}`;
}

function coefPrefix(k: number): string {
  if (k === 1) return "";
  if (k === -1) return "-";
  return tex(k);
}

/** Cặp p < q cùng tính chẵn lẻ (p + q chẵn ⇒ hệ số nguyên), p + q ≠ 0 */
function rootPair(rng: Rng, lo = -4, hi = 4, minGap = 2): [number, number] {
  for (;;) {
    const p = rng.int(lo, hi);
    const q = rng.int(lo, hi);
    if (q - p >= minGap && (p + q) % 2 === 0 && p + q !== 0) return [p, q];
  }
}

/** Đáp số trả lời ngắn hợp lệ (≤ 4 ký tự kể cả dấu trừ) */
const fitsShort = (n: number) => Number.isInteger(n) && String(n).length <= 4;

function uniqueOptions(labels: { id: string; label: string; graph?: GraphSpec }[]): boolean {
  return new Set(labels.map((o) => o.label)).size === labels.length;
}

// ───────────── Các họ câu ─────────────

/** I — Khoảng đồng biến từ f′(x) = k(x − p)(x − q) */
const slopeInterval: Family = {
  id: "slope.interval",
  kc: "kc.slope_sign",
  format: "MCQ",
  part: "I",
  elo0: -0.5,
  generate(seed) {
    const rng = createRng(seed);
    for (;;) {
      const m = rng.pick([1, 2, -1, -2]);
      const [p, q] = rootPair(rng);
      const k = 3 * m;
      const up = m > 0; // a > 0 ⇒ đồng biến hai bên ngoài
      const correctIv: [number, number] = up ? rng.pick<[number, number]>([[-Infinity, p], [q, Infinity]]) : [p, q];
      const flipIv: [number, number] = up ? [p, q] : rng.pick<[number, number]>([[-Infinity, p], [q, Infinity]]);
      // Lấy nhầm dấu nghiệm (x − p = 0 ⇒ x = −p): ảnh đối xứng của khoảng đúng qua 0
      const rootIv: [number, number] = [-correctIv[1], -correctIv[0]];
      const overIv: [number, number] = up ? (correctIv[0] === -Infinity ? [-Infinity, q] : [p, Infinity]) : [p, Infinity];
      const raw = [
        { id: "c", iv: correctIv, trap: "" },
        { id: "f", iv: flipIv, trap: "M_SIGN_FLIP" },
        { id: "r", iv: rootIv, trap: "M_ROOT_SIGN" },
        { id: "o", iv: overIv, trap: "M_INTERVAL_OVERREACH" },
      ];
      const shuffled = rng.shuffle(raw);
      const ids = ["A", "B", "C", "D"];
      const options = shuffled.map((o, i) => ({ id: ids[i], label: texInterval(o.iv[0], o.iv[1]) }));
      if (!uniqueOptions(options)) continue;
      const traps: Record<string, string> = {};
      let correct = "";
      shuffled.forEach((o, i) => {
        if (o.id === "c") correct = ids[i];
        else traps[ids[i]] = o.trap;
      });
      const fpLatex = `${coefPrefix(k)}${factor(p)}${factor(q)}`;
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "MCQ",
          part: "I",
          stem: T(
            `The function $y = f(x)$ has derivative $f'(x) = ${fpLatex}$. On which interval is the function increasing?`,
            `Cho hàm số $y = f(x)$ có đạo hàm $f'(x) = ${fpLatex}$. Hàm số đồng biến trên khoảng nào dưới đây?`,
          ),
          options,
        },
        key: { kind: "MCQ", correct, traps },
        meta: { k, roots: [p, q], correctIv },
        explanation:
          `$f'(x) = 0 \\iff x = ${tex(p)}$${OR()}$x = ${tex(q)}$. ` +
          T(`The leading coefficient is ${k > 0 ? "positive" : "negative"}, so $f'(x) > 0$ `, `Hệ số ${k > 0 ? "dương" : "âm"} nên $f'(x) > 0$ `) +
          (up ? `${T("when", "khi")} $x < ${tex(p)}$${OR()}$x > ${tex(q)}$` : `${T("when", "khi")} $${tex(p)} < x < ${tex(q)}$`) +
          T(`. So the function is increasing on ${texInterval(correctIv[0], correctIv[1])}.`, `. Vậy hàm số đồng biến trên ${texInterval(correctIv[0], correctIv[1])}.`),
      };
    }
  },
};

/** I — Số điểm cực trị khi f′ có nghiệm bội */
const extremumCount: Family = {
  id: "extremum.count",
  kc: "kc.extremum_from_fprime",
  format: "MCQ",
  part: "I",
  elo0: 0.3,
  generate(seed) {
    const rng = createRng(seed);
    for (;;) {
      const n = rng.int(2, 3);
      const roots = rng.shuffle([-3, -2, -1, 0, 1, 2, 3, 4]).slice(0, n).sort((a, b) => a - b);
      const exps = roots.map(() => rng.pick([1, 1, 2, 2, 3]));
      if (!exps.some((e) => e % 2 === 0)) continue; // luôn có nghiệm bội chẵn để bẫy
      const k = rng.pick([1, -1, 2]);
      const correctN = exps.filter((e) => e % 2 === 1).length;
      const distinctN = roots.length;
      const totalN = exps.reduce((s, e) => s + e, 0);
      if (correctN === distinctN || totalN === distinctN || totalN === correctN) continue;
      const values = new Set([correctN, distinctN, totalN]);
      let filler = 0;
      while (values.has(filler)) filler++;
      const raw = [
        { v: correctN, trap: "" },
        { v: distinctN, trap: "M_FPRIME_ZERO_IS_EXTREMUM" },
        { v: totalN, trap: "M_COUNT_MULTIPLICITY" },
        { v: filler, trap: "" },
      ].sort((a, b) => a.v - b.v);
      const ids = ["A", "B", "C", "D"];
      const traps: Record<string, string> = {};
      let correct = "";
      raw.forEach((o, i) => {
        if (o.v === correctN) correct = ids[i];
        else if (o.trap) traps[ids[i]] = o.trap;
      });
      const fpLatex = `${coefPrefix(k)}${roots.map((r, i) => factor(r, exps[i])).join("")}`;
      const odd = roots.filter((_, i) => exps[i] % 2 === 1);
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "MCQ",
          part: "I",
          stem: T(
            `The function $y = f(x)$ has derivative $f'(x) = ${fpLatex}$ for all $x \\in \\mathbb{R}$. How many extrema does the function have?`,
            `Cho hàm số $y = f(x)$ có đạo hàm $f'(x) = ${fpLatex}$ với mọi $x \\in \\mathbb{R}$. Số điểm cực trị của hàm số là`,
          ),
          options: raw.map((o, i) => ({ id: ids[i], label: String(o.v) })),
        },
        key: { kind: "MCQ", correct, traps },
        meta: { k, roots, exps },
        explanation:
          T(`$f'$ only changes sign at odd-multiplicity roots: `, `$f'$ chỉ đổi dấu tại nghiệm bội lẻ: `) +
          `${odd.length ? odd.map((r) => `$x = ${tex(r)}$`).join(", ") : T("none", "không có")}. ` +
          T(
            `Even-multiplicity roots don't make $f'$ change sign, so they aren't extrema. So there are ${correctN} extrema.`,
            `Nghiệm bội chẵn không làm $f'$ đổi dấu nên không phải điểm cực trị. Vậy có ${correctN} điểm cực trị.`,
          ),
      };
    }
  },
};

/** II — Khoá 4 chìa: một hàm, bốn mệnh đề tăng dần độ khó */
const extremumTf4: Family = {
  id: "extremum.tf4",
  kc: "kc.extremum_from_fprime",
  format: "TF4",
  part: "II",
  elo0: 0.5,
  generate(seed) {
    const rng = createRng(seed);
    for (;;) {
      const m = rng.pick([1, -1]);
      const [p, q] = rootPair(rng, -3, 3, 2);
      const d = rng.int(-3, 3);
      const k = cubicFromRoots(m, p, q, d);
      const ex = extrema(k);
      if (!ex.max || !ex.min) continue;
      const xMax = ex.max.x;
      const xMin = ex.min.x;
      const yMax = f(k, xMax);
      const yMin = f(k, xMin);
      // a) khoảng đồng biến
      const upIv: [number, number] = m > 0 ? [q, Infinity] : [p, q];
      const downIv: [number, number] = m > 0 ? [p, q] : [q, Infinity];
      const aTrue = rng.chance(0.5);
      // b) cực đại tại
      const bTrue = rng.chance(0.5);
      // c) giá trị cực tiểu
      const cTrue = rng.chance(0.5);
      if (!cTrue && xMin === yMin) continue;
      // d) GTLN trên đoạn — chọn đoạn chứa điểm cực đại và một đầu mút có thể cao hơn
      const lo = Math.min(p, q) - rng.int(0, 1);
      const hi = Math.max(p, q) + rng.int(1, 2);
      const mm = minMaxOnInterval(k, lo, hi);
      const localMaxInside = xMax > lo && xMax < hi;
      const dTrue = rng.chance(0.5);
      const dFalseValue = localMaxInside && Math.abs(yMax - mm.max.y) > 1e-9 ? yMax : mm.max.y + rng.pick([1, -1, 2]);
      const dTrap = localMaxInside && Math.abs(yMax - mm.max.y) > 1e-9 ? "M_FORGOT_ENDPOINT" : null;
      const values = [yMax, yMin, mm.max.y, dFalseValue];
      if (!values.every((v) => Number.isInteger(v) && Math.abs(v) < 1000)) continue;
      const iv = aTrue ? upIv : downIv;
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "TF4",
          part: "II",
          stem: T(
            `Let $f(x) = ${cubicTex(k)}$. The graph of its derivative $f'(x)$ is shown. Is each statement true or false?`,
            `Cho hàm số $f(x) = ${cubicTex(k)}$. Đồ thị của đạo hàm $f'(x)$ như hình. Mỗi mệnh đề sau đúng hay sai?`,
          ),
          graph: { kind: "fprime", cubic: k, xMin: p - 2, xMax: q + 2 },
          statements: [
            { id: "a", text: T(`$f(x)$ is increasing on ${texInterval(iv[0], iv[1])}.`, `Hàm số $f(x)$ đồng biến trên khoảng ${texInterval(iv[0], iv[1])}.`) },
            { id: "b", text: T(`$f(x)$ has a local maximum at $x = ${tex(bTrue ? xMax : xMin)}$.`, `Hàm số $f(x)$ đạt cực đại tại $x = ${tex(bTrue ? xMax : xMin)}$.`) },
            { id: "c", text: T(`The local minimum value of $f(x)$ is $${tex(cTrue ? yMin : xMin)}$.`, `Giá trị cực tiểu của hàm số $f(x)$ bằng $${tex(cTrue ? yMin : xMin)}$.`) },
            {
              id: "d",
              text: T(
                `The maximum of $f(x)$ on ${texSegment(lo, hi)} is $${tex(dTrue ? mm.max.y : dFalseValue)}$.`,
                `Giá trị lớn nhất của $f(x)$ trên đoạn ${texSegment(lo, hi)} bằng $${tex(dTrue ? mm.max.y : dFalseValue)}$.`,
              ),
            },
          ],
        },
        key: {
          kind: "TF4",
          truth: [aTrue, bTrue, cTrue, dTrue],
          traps: [aTrue ? null : "M_SIGN_FLIP", bTrue ? null : "M_MAX_MIN_SWAP", cTrue ? null : "M_X_NOT_POINT", dTrue ? null : dTrap],
        },
        explanation:
          `$f'(x) = ${tex(3 * m)}${factor(p)}${factor(q)}$ ${T("changes sign at", "đổi dấu tại")} $x = ${tex(p)}$ ${T("and", "và")} $x = ${tex(q)}$. ` +
          T(
            `Local max at $x = ${tex(xMax)}$ ($f = ${tex(yMax)}$), local min at $x = ${tex(xMin)}$ ($f = ${tex(yMin)}$). Increasing on ${texInterval(upIv[0], upIv[1])}. `,
            `Cực đại tại $x = ${tex(xMax)}$ ($f = ${tex(yMax)}$), cực tiểu tại $x = ${tex(xMin)}$ ($f = ${tex(yMin)}$). Đồng biến trên ${texInterval(upIv[0], upIv[1])}. `,
          ) +
          `${T("On", "Trên")} ${texSegment(lo, hi)}: ${T("compare", "so sánh")} $f(${tex(lo)}) = ${tex(f(k, lo))}$, $f(${tex(hi)}) = ${tex(f(k, hi))}$` +
          (localMaxInside ? ` ${T("and", "và")} $f(${tex(xMax)}) = ${tex(yMax)}$` : "") +
          ` ⇒ ${T("max", "GTLN")} $= ${tex(mm.max.y)}$.`,
      };
    }
  },
};

/** I — Số điểm cực trị của hàm bậc ba theo Δ′ = b² − 3ac */
const shapeCount: Family = {
  id: "shape.count",
  kc: "kc.cubic_shape",
  format: "MCQ",
  part: "I",
  elo0: 0,
  generate(seed) {
    const rng = createRng(seed);
    const wantTrap = rng.chance(0.6);
    for (let tries = 0; ; tries++) {
      const a = rng.pick([1, -1, 2, -2, 3]);
      const b = rng.int(-4, 4);
      const c = rng.int(-6, 6);
      const d = rng.int(-3, 3);
      const D = b * b - 3 * a * c;
      const correctN = D > 0 ? 2 : 0;
      const wrongN = b * b - 4 * a * c > 0 ? 2 : 0;
      if (wantTrap && wrongN === correctN && tries < 200) continue;
      const k: Cubic = { a, b, c, d };
      const ids = ["A", "B", "C", "D"];
      const traps: Record<string, string> = {
        B: D === 0 ? "M_FPRIME_ZERO_IS_EXTREMUM" : "M_ODD_DEGREE",
        D: "M_ODD_DEGREE",
      };
      const other = correctN === 2 ? "A" : "C";
      traps[other] = "M_DELTA_WRONG";
      delete traps[correctN === 2 ? "C" : "A"];
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "MCQ",
          part: "I",
          stem: T(`How many extrema does $y = ${cubicTex(k)}$ have?`, `Hàm số $y = ${cubicTex(k)}$ có bao nhiêu điểm cực trị?`),
          options: [0, 1, 2, 3].map((v, i) => ({ id: ids[i], label: String(v) })),
        },
        key: { kind: "MCQ", correct: correctN === 2 ? "C" : "A", traps },
        explanation:
          `$y' = ${tex(3 * a)}x^2 ${2 * b >= 0 ? "+" : "-"} ${tex(Math.abs(2 * b))}x ${c >= 0 ? "+" : "-"} ${tex(Math.abs(c))}$, ` +
          `$\\Delta' = b^2 - 3ac = ${tex(b * b)} - 3\\cdot(${tex(a)})\\cdot(${tex(c)}) = ${tex(D)}$. ` +
          (D > 0
            ? T("$\\Delta' > 0$ ⇒ $y'$ has two distinct roots and changes sign ⇒ 2 extrema.", "$\\Delta' > 0$ ⇒ $y'$ có hai nghiệm phân biệt và đổi dấu ⇒ 2 điểm cực trị.")
            : D === 0
              ? T("$\\Delta' = 0$ ⇒ $y'$ has a double root and doesn't change sign ⇒ no extrema.", "$\\Delta' = 0$ ⇒ $y'$ có nghiệm kép, không đổi dấu ⇒ không có cực trị.")
              : T("$\\Delta' < 0$ ⇒ $y'$ never changes sign ⇒ no extrema.", "$\\Delta' < 0$ ⇒ $y'$ không đổi dấu ⇒ không có cực trị.")),
      };
    }
  },
};

/** III — Giá trị cực đại / cực tiểu (trả lời ngắn) */
const extremumValue: Family = {
  id: "value.extremum",
  kc: "kc.extremum_value",
  format: "SHORT",
  part: "III",
  elo0: 0.2,
  generate(seed) {
    const rng = createRng(seed);
    for (;;) {
      const m = rng.pick([1, -1, 2]);
      const [p, q] = rootPair(rng, -3, 3, 2);
      const d = rng.int(-5, 5);
      const k = cubicFromRoots(m, p, q, d);
      const ex = extrema(k);
      if (!ex.max || !ex.min) continue;
      const askMax = rng.chance(0.5);
      const target = askMax ? ex.max : ex.min;
      const other = askMax ? ex.min : ex.max;
      if (!fitsShort(target.y) || target.y === target.x || target.y === other.y) continue;
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "SHORT",
          part: "III",
          stem: T(
            `Find the local ${askMax ? "maximum" : "minimum"} value of $y = ${cubicTex(k)}$.`,
            `Tìm giá trị ${askMax ? "cực đại" : "cực tiểu"} của hàm số $y = ${cubicTex(k)}$.`,
          ),
          input: { maxChars: 4, hint: T("Enter a number (max 4 characters)", "Nhập một số (tối đa 4 ký tự, dùng dấu phẩy cho số thập phân)") },
        },
        key: {
          kind: "SHORT",
          value: target.y,
          traps: [
            { value: target.x, id: "M_X_NOT_POINT" },
            { value: other.y, id: "M_MAX_MIN_SWAP" },
          ],
        },
        explanation:
          `$y' = ${tex(3 * m)}${factor(p)}${factor(q)} = 0 \\iff x = ${tex(p)}$${OR()}$x = ${tex(q)}$. ` +
          T(
            `Since $a ${m > 0 ? "> 0" : "< 0"}$, the max is at $x = ${tex(ex.max.x)}$ and the min at $x = ${tex(ex.min.x)}$. `,
            `Hệ số $a ${m > 0 ? "> 0" : "< 0"}$ nên cực đại tại $x = ${tex(ex.max.x)}$, cực tiểu tại $x = ${tex(ex.min.x)}$. `,
          ) +
          T(`Local ${askMax ? "maximum" : "minimum"} value`, `Giá trị ${askMax ? "cực đại" : "cực tiểu"}`) +
          ` $= y(${tex(target.x)}) = ${tex(target.y)}$.`,
      };
    }
  },
};

/** III — GTLN / GTNN trên đoạn (bẫy đầu mút) */
const minmaxInterval: Family = {
  id: "minmax.interval",
  kc: "kc.minmax_interval",
  format: "SHORT",
  part: "III",
  elo0: 0.8,
  generate(seed) {
    const rng = createRng(seed);
    const endpointWins = rng.chance(0.5);
    for (let tries = 0; ; tries++) {
      const m = rng.pick([1, -1]);
      const [p, q] = rootPair(rng, -3, 3, 2);
      const d = rng.int(-4, 4);
      const k = cubicFromRoots(m, p, q, d);
      const ex = extrema(k);
      if (!ex.max || !ex.min) continue;
      const askMax = rng.chance(0.5);
      const lo = rng.int(p - 2, p + 1);
      const hi = rng.int(Math.max(lo + 2, q - 1), q + 3);
      const mm = minMaxOnInterval(k, lo, hi);
      const ans = askMax ? mm.max : mm.min;
      const local = askMax ? ex.max : ex.min;
      const localInside = local.x > lo && local.x < hi;
      const isEndpoint = ans.x === lo || ans.x === hi;
      if (tries < 300 && endpointWins !== (isEndpoint && localInside)) continue;
      if (!fitsShort(ans.y)) continue;
      const traps: { value: number; id: string }[] = [];
      if (localInside && local.y !== ans.y) traps.push({ value: local.y, id: "M_FORGOT_ENDPOINT" });
      if (!localInside && local.y !== ans.y) traps.push({ value: local.y, id: "M_CRIT_OUTSIDE" });
      const cands = [lo, hi, ...[p, q].filter((x) => x > lo && x < hi)].sort((a, b) => a - b);
      return {
        prompt: {
          familyId: this.id,
          kc: this.kc,
          format: "SHORT",
          part: "III",
          stem: T(
            `Find the ${askMax ? "maximum" : "minimum"} value of $y = ${cubicTex(k)}$ on ${texSegment(lo, hi)}.`,
            `Tìm giá trị ${askMax ? "lớn nhất" : "nhỏ nhất"} của hàm số $y = ${cubicTex(k)}$ trên đoạn ${texSegment(lo, hi)}.`,
          ),
          input: { maxChars: 4, hint: T("Enter a number (max 4 characters)", "Nhập một số (tối đa 4 ký tự)") },
        },
        key: { kind: "SHORT", value: ans.y, traps },
        explanation:
          `$y' = 0 \\iff x = ${tex(p)}$${OR()}$x = ${tex(q)}$. ` +
          T("Check the points inside the interval and both endpoints: ", "Xét các điểm trong đoạn và hai đầu mút: ") +
          cands.map((x) => `$y(${tex(x)}) = ${tex(f(k, x))}$`).join(", ") +
          `. ⇒ ${askMax ? T("max", "GTLN") : T("min", "GTNN")} $= ${tex(ans.y)}$${isEndpoint ? T(" (at an endpoint!)", " (đạt tại đầu mút!)") : ""}.`,
      };
    }
  },
};

// ───────────── Bài xác nhận phát hiện ─────────────

/** Đặt Neo Móc tại mọi điểm cực trị của đường ray */
const discStillpoint: Family = {
  id: "disc.stillpoint",
  kc: "kc.extremum_value",
  format: "ANCHOR",
  elo0: 0,
  discovery: true,
  generate(seed) {
    const rng = createRng(seed);
    const halves = [0, 0.5];
    let p = 0;
    let q = 0;
    while (q - p < 2) {
      p = rng.int(-3, 0) + rng.pick(halves);
      q = rng.int(0, 3) + rng.pick(halves);
    }
    const m = rng.pick([0.5, -0.5, 1, -1]);
    const k = cubicFromRoots(m, p, q, rng.int(-2, 2));
    return {
      prompt: {
        familyId: this.id,
        kc: this.kc,
        format: "ANCHOR",
        stem: T(
          "A new track has appeared. Drop a Grapple Anchor on EVERY spot where the rider could stand still (peaks and dips).",
          "Một đường ray mới vừa hiện ra. Đặt Neo Móc vào TẤT CẢ những chỗ người lướt đứng yên được (đỉnh và đáy).",
        ),
        graph: { kind: "f", cubic: k, xMin: p - 2.5, xMax: q + 2.5 },
      },
      key: { kind: "ANCHOR", xs: [p, q], tol: 0.15 },
      explanation: T(
        `The slope is zero at $x = ${tex(p)}$ and $x = ${tex(q)}$ — exactly at the peak and the dip.`,
        `Độ dốc bằng 0 tại $x = ${tex(p)}$ và $x = ${tex(q)}$ — đúng chỗ đỉnh và đáy.`,
      ),
    };
  },
};

/** Sương che đường ray: chỉ biết f′, chọn các khoảng đi lên */
const discSlopeSign: Family = {
  id: "disc.slope_sign",
  kc: "kc.slope_sign",
  format: "MULTI",
  elo0: 0,
  discovery: true,
  generate(seed) {
    const rng = createRng(seed);
    const m = rng.pick([1, -1]);
    const [p, q] = rootPair(rng, -3, 3, 2);
    const up = m > 0;
    const ivs: [number, number][] = [
      [-Infinity, p],
      [p, q],
      [q, Infinity],
    ];
    const rising = up ? ["i1", "i3"] : ["i2"];
    const traps: Record<string, string> = {};
    for (const id of ["i1", "i2", "i3"]) if (!rising.includes(id)) traps[id] = "M_SIGN_FLIP";
    return {
      prompt: {
        familyId: this.id,
        kc: this.kc,
        format: "MULTI",
        stem: T(
          `Fog covers the valley. Your compass only shows the slope: $f'(x) = ${tex(3 * m)}${factor(p)}${factor(q)}$. Pick EVERY stretch where the path rises (moving right).`,
          `Sương mù che kín thung lũng. La bàn chỉ cho biết độ dốc: $f'(x) = ${tex(3 * m)}${factor(p)}${factor(q)}$. Chọn MỌI đoạn đường đi lên (khi đi sang phải).`,
        ),
        options: ivs.map((iv, i) => ({ id: `i${i + 1}`, label: texInterval(iv[0], iv[1]) })),
      },
      key: { kind: "MULTI", correct: rising, traps },
      explanation:
        T(
          `Plug an x from each interval into f′: it is ${up ? "positive on both outer intervals, negative in the middle" : "negative on both outer intervals, positive in the middle"}. Rising ⇔ f′ > 0.`,
          `Thay một giá trị x vào từng khoảng: f′ ${up ? "dương ở hai bên ngoài, âm ở giữa" : "âm ở hai bên ngoài, dương ở giữa"}. Đi lên ⇔ f′ > 0.`,
        ),
    };
  },
};

/** Chỗ phẳng nhưng không phải đỉnh/đáy (nghiệm kép của f′) */
const discFlatNotPeak: Family = {
  id: "disc.flat_not_peak",
  kc: "kc.extremum_from_fprime",
  format: "MCQ",
  elo0: 0,
  discovery: true,
  generate(seed) {
    const rng = createRng(seed);
    const m = rng.pick([0.5, -0.5, 1]);
    const p = rng.int(-2, 2);
    const k = cubicDoubleRoot(m, p, rng.int(-1, 1));
    return {
      prompt: {
        familyId: this.id,
        kc: this.kc,
        format: "MCQ",
        stem: T(
          `This track has $f'(x) = ${tex(3 * m)}${factor(p, 2)}$: it's flat at $x = ${tex(p)}$. How many extrema does the track have?`,
          `Đường ray này có $f'(x) = ${tex(3 * m)}${factor(p, 2)}$: phẳng tại $x = ${tex(p)}$. Đường ray có bao nhiêu điểm cực trị?`,
        ),
        graph: { kind: "f", cubic: k, xMin: p - 2.5, xMax: p + 2.5 },
        options: [
          { id: "A", label: "0" },
          { id: "B", label: "1" },
          { id: "C", label: "2" },
        ],
      },
      key: { kind: "MCQ", correct: "A", traps: { B: "M_FPRIME_ZERO_IS_EXTREMUM", C: "M_ODD_DEGREE" } },
      explanation: T(
        `$${factor(p, 2)} \\ge 0$, so $f'$ doesn't change sign through $x = ${tex(p)}$ ⇒ no extremum even though $f'(${tex(p)}) = 0$.`,
        `$${factor(p, 2)} \\ge 0$ nên $f'$ không đổi dấu khi đi qua $x = ${tex(p)}$ ⇒ không có cực trị dù $f'(${tex(p)}) = 0$.`,
      ),
    };
  },
};


// ───────────── Ghép đồ thị (trực giác — không phải luyện đề) ─────────────

/** Nhìn đồ thị f′, chọn đồ thị f — "đọc bóng" */
const matchF: Family = {
  id: "match.f_from_fprime",
  kc: "kc.slope_sign",
  format: "MCQ",
  elo0: 0.1,
  generate(seed) {
    const rng = createRng(seed);
    const m = rng.pick([0.5, -0.5]);
    const [p, q] = rootPair(rng, -3, 3, 2);
    const k = cubicFromRoots(m, p, q, 0);
    const win = { xMin: p - 2.5, xMax: q + 2.5 };
    const flipped: Cubic = { a: -k.a, b: -k.b, c: -k.c, d: 0 };
    const mirrored = cubicFromRoots(m, -q, -p, 0);
    // "Nhầm f với f′": vẽ chính parabol f′ như thể là f
    const asDeriv: Cubic = { a: 0, b: 3 * k.a, c: 2 * k.b, d: k.c };
    const raw = rng.shuffle([
      { c: k, trap: "" },
      { c: flipped, trap: "M_SIGN_FLIP" },
      { c: mirrored, trap: "M_ROOT_SIGN" },
      { c: asDeriv, trap: "M_F_VS_FPRIME" },
    ]);
    const ids = ["A", "B", "C", "D"];
    const traps: Record<string, string> = {};
    let correct = "";
    raw.forEach((o, i) => {
      if (!o.trap) correct = ids[i];
      else traps[ids[i]] = o.trap;
    });
    return {
      prompt: {
        familyId: this.id,
        kc: this.kc,
        format: "MCQ",
        stem: T(
          "This glowing curve is the SLOPE f′ of a hidden track. Which picture is the track y = f(x) itself?",
          "Đường cong phát sáng này là ĐỘ DỐC f′ của một đường ray bị giấu. Hình nào là chính đường ray y = f(x)?",
        ),
        graph: { kind: "fprime", cubic: k, ...win },
        options: raw.map((o, i) => ({ id: ids[i], label: ids[i], graph: { kind: "f" as const, cubic: o.c, ...win } })),
      },
      key: { kind: "MCQ", correct, traps },
      explanation: T(
        `Where f′ is above the axis the track climbs; where it's below, the track falls. f′ crosses zero at $x = ${tex(p)}$ and $x = ${tex(q)}$ — those are exactly the peak and the dip of f.`,
        `Chỗ f′ nằm trên trục thì đường ray đi lên, nằm dưới trục thì đi xuống. f′ cắt trục tại $x = ${tex(p)}$ và $x = ${tex(q)}$ — đúng là đỉnh và đáy của f.`,
      ),
    };
  },
};

/** Nhìn đường ray f, chọn đồ thị độ dốc f′ */
const matchFprime: Family = {
  id: "match.fprime_from_f",
  kc: "kc.extremum_from_fprime",
  format: "MCQ",
  elo0: 0.2,
  generate(seed) {
    const rng = createRng(seed);
    const m = rng.pick([0.5, -0.5]);
    const [p, q] = rootPair(rng, -3, 3, 2);
    const k = cubicFromRoots(m, p, q, 0);
    const win = { xMin: p - 2.5, xMax: q + 2.5 };
    const flipped: Cubic = { a: -k.a, b: -k.b, c: -k.c, d: 0 };
    const shifted = cubicFromRoots(m, p + 1, q + 1, 0);
    const raw = rng.shuffle([
      { g: { kind: "fprime" as const, cubic: k }, trap: "" },
      { g: { kind: "fprime" as const, cubic: flipped }, trap: "M_SIGN_FLIP" },
      { g: { kind: "fprime" as const, cubic: shifted }, trap: "M_INTERVAL_OVERREACH" },
      { g: { kind: "f" as const, cubic: k }, trap: "M_F_VS_FPRIME" },
    ]);
    const ids = ["A", "B", "C", "D"];
    const traps: Record<string, string> = {};
    let correct = "";
    raw.forEach((o, i) => {
      if (!o.trap) correct = ids[i];
      else traps[ids[i]] = o.trap;
    });
    return {
      prompt: {
        familyId: this.id,
        kc: this.kc,
        format: "MCQ",
        stem: T(
          "Here is the track y = f(x). Which picture shows its slope f′(x) at every point?",
          "Đây là đường ray y = f(x). Hình nào cho biết độ dốc f′(x) tại mọi điểm?",
        ),
        graph: { kind: "f", cubic: k, ...win },
        options: raw.map((o, i) => ({ id: ids[i], label: ids[i], graph: { ...o.g, ...win } })),
      },
      key: { kind: "MCQ", correct, traps },
      explanation: T(
        `At the peak and the dip ($x = ${tex(p)}$, $x = ${tex(q)}$) the slope is 0, so f′ must cross the axis exactly there; where the track climbs, f′ is above the axis.`,
        `Tại đỉnh và đáy ($x = ${tex(p)}$, $x = ${tex(q)}$) độ dốc bằng 0 nên f′ phải cắt trục đúng tại đó; chỗ đường ray đi lên thì f′ nằm trên trục.`,
      ),
    };
  },
};

export const FAMILIES: Family[] = [
  matchF,
  matchFprime,
  slopeInterval,
  extremumCount,
  extremumTf4,
  shapeCount,
  extremumValue,
  minmaxInterval,
  discStillpoint,
  discSlopeSign,
  discFlatNotPeak,
];

export const FAMILY_BY_ID: Record<string, Family> = Object.fromEntries(FAMILIES.map((fam) => [fam.id, fam]));

/** Họ câu dùng cho luyện / ôn của một KC (không gồm bài xác nhận phát hiện) */
export const practiceFamilies = (kc: KcId) => FAMILIES.filter((fam) => fam.kc === kc && !fam.discovery);

/** Sinh đề theo ngôn ngữ (mặc định tiếng Anh). Đáp án / bẫy không phụ thuộc ngôn ngữ. */
export function generate(familyId: string, seed: number, lang: Lang = DEFAULT_LANG): Generated {
  const fam = FAMILY_BY_ID[familyId];
  if (!fam) throw new Error(`Unknown question family ${familyId}`);
  const prev = LANG;
  LANG = lang;
  try {
    return fam.generate(seed);
  } finally {
    LANG = prev;
  }
}
