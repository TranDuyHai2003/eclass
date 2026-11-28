/**
 * Hộ Vệ Nguyên Tố (Prime Warden) — logic thuần, test ở tests/world/ruleMonsters.test.ts.
 *
 * Quy luật = cách đánh: khiên mang một số n (vẽ thành lưới a × b viên gạch; số nguyên tố chỉ xếp được 1 hàng).
 * Mỗi đòn trúng khiên ĐẾM thêm 1 (không gây sát thương). Ngừng tay ≥ QUIET_MS thì khiên "chốt" số đòn c của loạt:
 *   • c chia hết n (c > 1) → khiên bị CHIA: n ← n / c; về 1 thì vỡ → hở 5 s, chịu sát thương ×1,6;
 *   • c = 1 → chia cho 1 chẳng đổi gì;
 *   • c không phải ước của n → khiên phản đòn (sóng xung kích quanh nó) và giữ nguyên n.
 * Hợp số: phân tích ra thừa số (12 = 3·2·2 → loạt 3, rồi 2, rồi 2 — hoặc 3 rồi 4). Số nguyên tố p: chỉ có đúng
 * MỘT loạt p đòn liền phá được — dạy định nghĩa "chỉ chia hết cho 1 và chính nó".
 */

/** Dãy số khiên (vòng lại); xen hợp số và nguyên tố */
export const SHIELDS = [12, 7, 30, 9, 11, 20, 5, 18, 13, 8];
/** Ngừng đánh chừng này (ms) thì chốt loạt */
export const QUIET_MS = 900;
/** Khiên vỡ: hở chừng này (ms) */
export const OPEN_MS = 5000;
/** Loạt dài quá chừng này thì tự chốt (không ai cần quá 30) */
export const MAX_COUNT = 30;

export interface WardenState {
  /** số trên khiên hiện tại */
  n: number;
  /** số khiên ban đầu của vòng này (để vẽ / ghi chép) */
  n0: number;
  /** số đòn trong loạt đang đếm */
  count: number;
  lastHit: number;
  /** khiên vỡ tới lúc này (0 = còn khiên) */
  openUntil: number;
  round: number;
  /** các thừa số đã "chia" được trong vòng này (để hiện 12 = 3·2·2) */
  used: number[];
}

export function newWarden(seed = 0): WardenState {
  const round = Math.abs(Math.floor(seed)) % SHIELDS.length;
  return { n: SHIELDS[round], n0: SHIELDS[round], count: 0, lastHit: -1e9, openUntil: 0, round, used: [] };
}

export function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

/** Phân tích thừa số nguyên tố (tăng dần) */
export function factorize(n: number): number[] {
  const out: number[] = [];
  let m = Math.floor(n);
  for (let d = 2; d * d <= m; d++)
    while (m % d === 0) {
      out.push(d);
      m /= d;
    }
  if (m > 1) out.push(m);
  return out;
}

/** Lưới gạch hiển thị n: số hàng = ước lớn nhất ≤ √n (nguyên tố → 1 hàng), số cột = n / hàng */
export function tileGrid(n: number): [number, number] {
  let rows = 1;
  for (let d = 1; d * d <= n; d++) if (n % d === 0) rows = d;
  return [rows, n / rows];
}

export function wardenOpen(s: WardenState, now: number): boolean {
  return now < s.openUntil;
}

/** Một đòn trúng: khiên còn → đếm (trả "count"); khiên vỡ → "open" (đòn gây sát thương thật) */
export function wardenHit(s: WardenState, now: number): "count" | "open" {
  if (wardenOpen(s, now)) return "open";
  s.count = Math.min(MAX_COUNT + 1, s.count + 1);
  s.lastHit = now;
  return "count";
}

export type Settle = { kind: "divide"; by: number; n: number } | { kind: "break"; by: number } | { kind: "one" } | { kind: "reject"; count: number } | { kind: "reshield"; n: number };

/**
 * Gọi mỗi khung hình. Trả kết quả khi: loạt đòn vừa chốt (ngừng tay ≥ QUIET_MS hoặc quá MAX_COUNT),
 * hoặc khiên vừa hồi lại sau thời gian hở (số mới của vòng sau). Không có gì → null.
 */
export function wardenTick(s: WardenState, now: number): Settle | null {
  if (s.openUntil && now >= s.openUntil) {
    s.openUntil = 0;
    s.round = (s.round + 1) % SHIELDS.length;
    s.n = s.n0 = SHIELDS[s.round];
    s.count = 0;
    s.used = [];
    return { kind: "reshield", n: s.n };
  }
  if (!s.count || (now - s.lastHit < QUIET_MS && s.count <= MAX_COUNT)) return null;
  const c = s.count;
  s.count = 0;
  if (c === 1) return { kind: "one" };
  if (c <= s.n && s.n % c === 0) {
    s.n /= c;
    s.used.push(c);
    if (s.n === 1) {
      s.openUntil = now + OPEN_MS;
      return { kind: "break", by: c };
    }
    return { kind: "divide", by: c, n: s.n };
  }
  return { kind: "reject", count: c };
}

/** Các loạt đòn ngắn nhất để phá khiên n (= các thừa số nguyên tố) — gợi ý trong Ghi chép */
export function bestPlan(n: number): number[] {
  return factorize(n);
}
