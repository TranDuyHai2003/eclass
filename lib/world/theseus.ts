/**
 * Con tàu của Theseus (Plutarch, ~75 SCN; Hobbes, De Corpore 1655 thêm con tàu thứ hai) — logic thuần.
 * Tàu A được thay lần lượt 24 tấm ván vỏ; các tấm cũ được gom về ụ bên cạnh và ráp lại thành tàu B.
 * Mỗi học thuyết về "đồng nhất" trả lời khác nhau câu hỏi: tàu nào mới là Tàu của Theseus?
 */
import { mulberry32 } from "./monty";

export const N_PLANKS = 24;

/** Thứ tự thay ván cố định (rải đều hai mạn, không theo hàng) — hoán vị của 0..23 */
export function replaceOrder(seed = 1655): number[] {
  const a = Array.from({ length: N_PLANKS }, (_, i) => i);
  const r = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tập ván đã thay sau k lần thay */
export function replacedSet(k: number, order = replaceOrder()): Set<number> {
  return new Set(order.slice(0, Math.max(0, Math.min(N_PLANKS, k))));
}

export const originalShare = (k: number) => (N_PLANKS - Math.max(0, Math.min(N_PLANKS, k))) / N_PLANKS;

export type Theory = "continuity" | "matter" | "function" | "fourd" | "nihil";
export type Verdict = "yes" | "no" | "both" | "empty";
export const THEORIES: Theory[] = ["continuity", "matter", "function", "fourd", "nihil"];

/**
 * Học thuyết `t` nói gì về tàu A (đang được sửa) và tàu B (ráp từ ván cũ) sau k lần thay.
 * - liên tục: A luôn là tàu Theseus (lịch sử + hình dạng không đứt quãng); B là tàu mới ráp.
 * - vật chất: tàu nào giữ đa số vật chất gốc thì là tàu Theseus (hoà ở k = 12).
 * - chức năng/tên gọi: con tàu đang chạy, đang mang tên, đang được thuỷ thủ dùng — A.
 * - bốn chiều: tàu là "con sâu thời gian"; A và B CÙNG CHUNG một quá khứ → cả hai (đã tách).
 * - hư vô: "cùng một con tàu" chỉ là cách gọi; sự thật chỉ là các tấm ván ở đâu → câu hỏi rỗng.
 */
export function verdict(t: Theory, k: number): { a: Verdict; b: Verdict } {
  const kk = Math.max(0, Math.min(N_PLANKS, k));
  switch (t) {
    case "continuity":
      return { a: "yes", b: "no" };
    case "matter":
      if (kk * 2 === N_PLANKS) return { a: "both", b: "both" };
      return kk * 2 < N_PLANKS ? { a: "yes", b: "no" } : { a: "no", b: "yes" };
    case "function":
      return { a: "yes", b: "no" };
    case "fourd":
      return kk === 0 ? { a: "yes", b: "no" } : { a: "both", b: "both" };
    case "nihil":
      return { a: "empty", b: "empty" };
  }
}

/** Tàu B đã thành hình (đủ ván) chưa */
export const shipBComplete = (k: number) => k >= N_PLANKS;
