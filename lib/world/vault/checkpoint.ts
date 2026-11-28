/**
 * Hầm Bổ đề — điểm lưu khi chơi MỘT MÌNH (tải lại trang không mất lượt): lưu hạt giống + số ghế + phòng / màn đang chơi,
 * dựng lại bằng cùng hạt giống rồi nhảy thẳng tới màn đó. Hết hạn sau 2 giờ; dữ liệu hỏng / ngoài khoảng → bỏ qua.
 */
import { MAX_SEATS, PLAN, STAGES } from "./run";

export const CHECKPOINT_KEY = "world.vault.solo";
export const CHECKPOINT_TTL = 2 * 3600 * 1000;
export interface SoloCheckpoint {
  seed: number;
  n: number;
  ch: number;
  sg: number;
  at: number;
}

export function parseCheckpoint(raw: string | null, now: number): SoloCheckpoint | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SoloCheckpoint>;
    const ints = [o.seed, o.n, o.ch, o.sg, o.at].every((x) => Number.isInteger(x));
    if (!ints) return null;
    const c = o as SoloCheckpoint;
    if (now - c.at > CHECKPOINT_TTL || c.at > now + 60_000) return null;
    if (c.n < 2 || c.n > MAX_SEATS || c.ch < 0 || c.ch >= PLAN.length) return null;
    if (c.sg < 0 || c.sg >= STAGES[PLAN[c.ch]]) return null;
    // phòng đầu / màn đầu: không cần khôi phục (bắt đầu lại như mới)
    if (c.ch === 0 && c.sg === 0) return null;
    return c;
  } catch {
    return null;
  }
}
