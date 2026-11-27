/**
 * Khách sạn Hilbert (David Hilbert, 1924) — logic thuần.
 * Hành lang lặp vô hạn: mỗi đoạn 10 m có 4 cửa mỗi bên; phòng lẻ bên trái, chẵn bên phải, đánh số từ lối vào.
 * Ba "phép màu" khi khách sạn đã kín phòng:
 *  - 1 khách mới:            khách phòng n chuyển sang n + 1   → phòng 1 trống
 *  - 1 xe buýt vô hạn khách: khách phòng n chuyển sang 2n      → mọi phòng lẻ trống (khách thứ k vào phòng 2k − 1)
 *  - vô hạn xe buýt:         khách cũ phòng n → 2^n; khách ghế n của xe buýt k (k ≥ 1) → p_k^n (p_k = số nguyên tố lẻ thứ k)
 *                            (Định lý cơ bản của số học: mỗi số chỉ có một cách phân tích → không ai trùng phòng)
 */
export const SEG = 10;
export const DOORS = [1.25, 3.75, 6.25, 8.75];
export const ROOMS_PER_SEG = 8;

/** Số phòng của cửa j (0..3) bên trái/phải ở đoạn thứ g (g = 0 là đoạn ở lối vào) */
export function roomNumber(g: number, j: number, side: "left" | "right") {
  return ROOMS_PER_SEG * g + 2 * j + (side === "left" ? 1 : 2);
}
/** Vị trí (đoạn, cửa, bên) của phòng n */
export function roomPlace(n: number) {
  const g = Math.floor((n - 1) / ROOMS_PER_SEG);
  const r = (n - 1) % ROOMS_PER_SEG;
  return { g, j: Math.floor(r / 2), side: (r % 2 === 0 ? "left" : "right") as "left" | "right" };
}

export type Move = "one" | "bus" | "buses";
/** Phòng mới của khách cũ đang ở phòng n */
export function moveOld(move: Move, n: number) {
  if (move === "one") return n + 1;
  if (move === "bus") return 2 * n;
  return 2 ** n;
}
/** Phòng (n) đang chứa ai sau phép chuyển: "old" (khách cũ từ phòng m) | "new" (khách mới thứ k / xe k ghế s) | null (trống) */
export function occupantAfter(move: Move, n: number): { kind: "old"; from: number } | { kind: "new"; k: number; seat?: number } | null {
  if (move === "one") return n === 1 ? { kind: "new", k: 1 } : { kind: "old", from: n - 1 };
  if (move === "bus") return n % 2 === 0 ? { kind: "old", from: n / 2 } : { kind: "new", k: (n + 1) / 2 };
  // vô hạn xe buýt: n = 2^m → khách cũ m; n = p_k^s (p lẻ nguyên tố) → xe k ghế s; còn lại: trống (vẫn còn vô hạn phòng trống!)
  const pp = primePower(n);
  if (!pp) return null;
  if (pp.p === 2) return { kind: "old", from: pp.e };
  return { kind: "new", k: oddPrimeIndex(pp.p), seat: pp.e };
}
function primePower(n: number): { p: number; e: number } | null {
  if (n < 2) return null;
  for (let p = 2; p * p <= n; p++) {
    if (n % p === 0) {
      let e = 0;
      let m = n;
      while (m % p === 0) {
        m /= p;
        e++;
      }
      return m === 1 ? { p, e } : null;
    }
  }
  return { p: n, e: 1 };
}
function oddPrimeIndex(p: number) {
  let k = 0;
  for (let q = 3; q <= p; q += 2) if (primePower(q)?.e === 1 && primePower(q)?.p === q) k++;
  return k;
}
