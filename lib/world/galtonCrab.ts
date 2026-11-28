/**
 * Cua Chuông (Bell Crab) — bàn Galton trên lưng, logic thuần; test ở tests/world/ruleMonsters.test.ts.
 *
 * Quy luật = cách đánh: mỗi loạt, cua thả VOLLEY viên sỏi qua ROWS hàng đinh. Mỗi hàng viên sỏi nảy trái / phải
 * xác suất ½ → số lần nảy phải k ~ Nhị thức(ROWS, ½) → máng k. Các máng xoè thành hình quạt trước mặt cua
 * (máng giữa = thẳng hướng nó nhìn, hai máng ngoài cùng = ngang hông, ±90°). Sỏi chồng lên nhau thành CỘT
 * → chồng cột chính là biểu đồ hình chuông (phân phối chuẩn xấp xỉ nhị thức).
 *   • Đứng ở giữa (đỉnh chuông) = ăn nhiều sỏi nhất (~27 % mỗi viên). Hai đuôi (±90°) gần như không có (0,4 %).
 *   • Lúc thả sỏi cua đứng yên; mai phía trước cứng (×0,3) nhưng HÔNG hở (×1,5) — mà hông lại chính là đuôi phân phối.
 * Hiểu "hiếm ở hai đuôi" → né ra hông, đánh vào hông đang hở.
 */
import { mulberry32 } from "./monty";

export const ROWS = 8;
/** Góc giữa hai máng kề nhau (rad): 8 hàng → 9 máng phủ −90°…+90° */
export const SPREAD = Math.PI / 8;
export const VOLLEY = 20;
/** Báo trước (quạt chuông hiện trên mặt đất), thời gian giữa hai viên, thời gian bay một viên (ms) */
export const TELE_MS = 950;
export const DROP_GAP = 65;
export const FLIGHT_MS = 420;
/** Hai loạt cách nhau (ms) */
export const VOLLEY_EVERY = 5200;
/** Góc lệch so với hướng nhìn để tính là "hông" (rad, 50°) */
export const FLANK = (50 * Math.PI) / 180;

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** P(k) = C(n, k) / 2ⁿ */
export function binomPmf(n: number, k: number): number {
  return choose(n, k) / 2 ** n;
}

/** Một viên sỏi qua `rows` hàng đinh: đếm số lần nảy sang phải */
export function galtonLane(rand: () => number, rows = ROWS): number {
  let k = 0;
  for (let r = 0; r < rows; r++) if (rand() < 0.5) k++;
  return k;
}

/** Cả loạt (tất định theo hạt giống — mọi người chơi thấy cùng một loạt nếu cùng hạt) */
export function volleyLanes(seed: number, count = VOLLEY, rows = ROWS): number[] {
  const r = mulberry32(Math.floor(seed * 9973) | 0);
  return Array.from({ length: count }, () => galtonLane(r, rows));
}

/** Góc của máng k so với hướng cua nhìn (rad) */
export function laneAngle(k: number, rows = ROWS, spread = SPREAD): number {
  return (k - rows / 2) * spread;
}

/** Máng ứng với góc lệch `rel` (rad); ngoài quạt (sau lưng) → −1 */
export function laneOfAngle(rel: number, rows = ROWS, spread = SPREAD): number {
  const a = Math.atan2(Math.sin(rel), Math.cos(rel));
  const k = Math.round(a / spread + rows / 2);
  if (k < 0 || k > rows || Math.abs(a) > (rows / 2 + 0.5) * spread) return -1;
  return k;
}

/** Số sỏi kỳ vọng rơi vào máng k trong một loạt */
export function expectedInLane(k: number, count = VOLLEY, rows = ROWS): number {
  return count * binomPmf(rows, k);
}

/** Hệ số sát thương theo góc đánh (so với hướng cua nhìn): trước mặt có mai ×0,3, hông/lưng ×1,5 */
export function crabDamageMul(rel: number): number {
  const a = Math.abs(Math.atan2(Math.sin(rel), Math.cos(rel)));
  return a < FLANK ? 0.3 : 1.5;
}

/** Mốc thời gian của viên thứ i trong loạt (ms tính từ lúc bắt đầu báo trước): thả, chạm đất */
export function pebbleTimes(i: number): { drop: number; land: number } {
  const drop = TELE_MS + i * DROP_GAP;
  return { drop, land: drop + FLIGHT_MS };
}
/** Loạt kéo dài tới khi viên cuối chạm đất */
export function volleyDuration(count = VOLLEY): number {
  return pebbleTimes(count - 1).land + 60;
}
