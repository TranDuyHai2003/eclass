/**
 * Đệm phím + huỷ đòn bằng lướt (H1) — logic thuần, test ở tests/world/inputBuffer.test.ts.
 *
 *  • Đệm phím 150 ms: bấm đánh khi nhát đang vung CHƯA cho nối → ghi nhớ lần bấm; tới đúng lúc được phép
 *    (openAt) thì nhát kế ra NGAY (không đợi hết hoạt ảnh). Bấm sớm hơn openAt quá BUFFER_MS → bỏ (tránh
 *    "đòn ma" do bấm bừa từ lâu); bấm lại thì ghi đè.
 *  • Huỷ bằng lướt: đang vung (kể cả pha khởi động / ra đòn) bấm lướt → huỷ nhát ngay, lướt luôn. Chỉ bị chặn
 *    khi đang trong một cú lướt KHÁC (không phải bước lao của chính nhát đó).
 */

export const BUFFER_MS = 150;
const NONE = -Infinity;

export interface InputBuf {
  /** lúc bấm được đệm (−∞ = trống) */
  at: number;
}

export function newBuf(): InputBuf {
  return { at: NONE };
}

export function hasBuffered(b: InputBuf): boolean {
  return b.at !== NONE;
}

export function bufferPress(b: InputBuf, now: number): void {
  b.at = now;
}

export function clearBuf(b: InputBuf): void {
  b.at = NONE;
}

/**
 * Hỏi bộ đệm ở thời điểm `now`, khi nhát kế được phép từ `openAt`:
 *  "none"  — không có lần bấm nào;
 *  "wait"  — có lần bấm hợp lệ, chưa tới lúc;
 *  "fire"  — tới lúc: ra đòn ngay (bộ đệm được xoá);
 *  "drop"  — bấm quá sớm (> win trước openAt): bỏ (bộ đệm được xoá).
 */
export function takeBuffered(b: InputBuf, now: number, openAt: number, win = BUFFER_MS): "none" | "wait" | "fire" | "drop" {
  if (b.at === NONE) return "none";
  if (openAt - b.at > win) {
    b.at = NONE;
    return "drop";
  }
  if (now < openAt) return "wait";
  b.at = NONE;
  return "fire";
}

/**
 * Bấm lướt khi đang có nhát `cur` (null = rảnh):
 *  "free"   — không có nhát nào, lướt bình thường;
 *  "cancel" — huỷ nhát ngay rồi lướt;
 *  "busy"   — đang trong một cú lướt khác chưa xong → bỏ qua.
 * `dashUntil` = mốc kết thúc cú lướt hiện tại; `lungeUntil` = mốc kết thúc bước lao CỦA nhát đang vung (nếu có).
 */
export function dashDecision(hasMove: boolean, now: number, dashUntil: number, lungeUntil: number): "free" | "cancel" | "busy" {
  const dashing = now < dashUntil;
  const ownLunge = hasMove && now < lungeUntil && Math.abs(dashUntil - lungeUntil) < 1;
  if (dashing && !ownLunge) return "busy";
  return hasMove ? "cancel" : "free";
}
