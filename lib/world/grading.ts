/**
 * Chấm câu trả lời theo AnswerKey (chỉ chạy ở server). Thuần.
 * Thang Phần II của đề tốt nghiệp: đúng 1/2/3/4 ý → 0,1 / 0,25 / 0,5 / 1 điểm.
 */
import type { AnswerKey } from "./generators";
import { DEFAULT_LANG, type Lang } from "./i18n";

export const TF4_SCALE = [0, 0.1, 0.25, 0.5, 1] as const;

export type Answer =
  | { kind: "MCQ"; choice: string }
  | { kind: "TF4"; marks: (boolean | null)[] }
  | { kind: "SHORT"; text: string }
  | { kind: "ANCHOR"; xs: number[] }
  | { kind: "MULTI"; choices: string[] };

export interface GradeResult {
  correct: boolean;
  /** 0..1 (TF4 theo thang đề thi) */
  score: number;
  /** Ngộ nhận được phát hiện (nếu có) */
  misconception: string | null;
  /** Chi tiết TF4: ý nào đúng */
  perStatement?: boolean[];
  /** Lỗi định dạng (không tính là sai kiến thức) */
  formatError?: string;
}

/** "-1,5" | "−1.5" | " 3 " → số; null nếu không hợp lệ hoặc quá 4 ký tự */
export function parseShort(text: string, maxChars = 4, lang: Lang = DEFAULT_LANG): { value: number | null; error?: string } {
  const E = (en: string, vi: string) => (lang === "vi" ? vi : en);
  const t = String(text ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[−–—]/g, "-");
  if (!t) return { value: null, error: E("Enter an answer first.", "Chưa nhập đáp số.") };
  if (t.length > maxChars) return { value: null, error: E(`Answers are at most ${maxChars} characters (including the minus sign and decimal point).`, `Đáp số tối đa ${maxChars} ký tự (kể cả dấu trừ và dấu phẩy).`) };
  if (!/^-?\d+([.,]\d+)?$/.test(t)) return { value: null, error: E("Numbers only, e.g. -2 or 1.5", "Chỉ nhập số, ví dụ: -2 hoặc 1,5") };
  return { value: Number(t.replace(",", ".")) };
}

const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

export function grade(key: AnswerKey, answer: Answer, lang: Lang = DEFAULT_LANG): GradeResult {
  if (key.kind !== answer.kind) {
    return { correct: false, score: 0, misconception: null, formatError: lang === "vi" ? "Sai dạng câu trả lời." : "Wrong answer format." };
  }
  switch (key.kind) {
    case "MCQ": {
      const a = answer as Extract<Answer, { kind: "MCQ" }>;
      const correct = a.choice === key.correct;
      return { correct, score: correct ? 1 : 0, misconception: correct ? null : (key.traps[a.choice] ?? null) };
    }
    case "TF4": {
      const a = answer as Extract<Answer, { kind: "TF4" }>;
      const per = key.truth.map((t, i) => a.marks[i] === t);
      const n = per.filter(Boolean).length;
      // Ngộ nhận: ý sai đầu tiên (đúng là "Sai" nhưng học sinh chọn "Đúng") có gắn bẫy
      let mis: string | null = null;
      for (let i = 0; i < 4; i++) {
        if (!per[i] && key.traps[i] && a.marks[i] === true) {
          mis = key.traps[i];
          break;
        }
      }
      return { correct: n === 4, score: TF4_SCALE[n], misconception: mis, perStatement: per };
    }
    case "SHORT": {
      const a = answer as Extract<Answer, { kind: "SHORT" }>;
      const parsed = parseShort(a.text, 4, lang);
      if (parsed.value === null) return { correct: false, score: 0, misconception: null, formatError: parsed.error };
      const correct = near(parsed.value, key.value, 1e-6);
      const trap = correct ? undefined : key.traps.find((t) => near(t.value, parsed.value!, 1e-6));
      return { correct, score: correct ? 1 : 0, misconception: trap?.id ?? null };
    }
    case "ANCHOR": {
      const a = answer as Extract<Answer, { kind: "ANCHOR" }>;
      const xs = (a.xs ?? []).filter((x) => Number.isFinite(x));
      // Mỗi điểm đúng phải có đúng một neo gần nó; không có neo thừa
      const hit = key.xs.every((x) => xs.some((y) => near(x, y, key.tol)));
      const extra = xs.some((y) => !key.xs.some((x) => near(x, y, key.tol)));
      const correct = hit && !extra && xs.length === key.xs.length;
      return { correct, score: correct ? 1 : 0, misconception: correct ? null : extra ? "M_FPRIME_ZERO_IS_EXTREMUM" : null };
    }
    case "MULTI": {
      const a = answer as Extract<Answer, { kind: "MULTI" }>;
      const chosen = new Set(a.choices ?? []);
      const want = new Set(key.correct);
      const correct = chosen.size === want.size && [...want].every((c) => chosen.has(c));
      const wrongPick = [...chosen].find((c) => !want.has(c));
      return { correct, score: correct ? 1 : 0, misconception: correct ? null : wrongPick ? (key.traps[wrongPick] ?? null) : null };
    }
  }
}

/** Đáp án ở dạng hiển thị được — CHỈ trả về sau khi đã nộp */
export function revealAnswer(key: AnswerKey): unknown {
  switch (key.kind) {
    case "MCQ":
      return { correct: key.correct };
    case "TF4":
      return { truth: key.truth };
    case "SHORT":
      return { value: key.value };
    case "ANCHOR":
      return { xs: key.xs };
    case "MULTI":
      return { correct: key.correct };
  }
}
