/**
 * Bài toán Monty Hall (Steve Selvin 1975; Marilyn vos Savant 1990) — logic thuần, không phụ thuộc React.
 * n cửa, 1 xe, n−1 dê. Người chơi chọn 1 cửa; MC (biết xe ở đâu) mở n−2 cửa dê KHÔNG phải cửa người chơi chọn,
 * chừa lại đúng 1 cửa khác. Giữ thắng với xác suất 1/n, đổi thắng với xác suất (n−1)/n.
 */
export type Rand = () => number;

/** PRNG có hạt giống (mulberry32) — để mô phỏng/kiểm thử lặp lại được */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (n: number, rand: Rand = Math.random) => Math.min(n - 1, Math.floor(rand() * n));

/**
 * Cửa còn đóng ngoài cửa đã chọn sau khi MC mở hết các cửa dê còn lại.
 * Chọn trúng xe → MC chừa ngẫu nhiên một cửa dê; chọn trượt → cửa chừa lại chắc chắn là xe.
 */
export function otherDoor(n: number, car: number, pick: number, rand: Rand = Math.random): number {
  if (pick !== car) return car;
  const k = randInt(n - 1, rand);
  return k >= pick ? k + 1 : k;
}

/** Các cửa MC mở (mọi cửa trừ cửa đã chọn và cửa chừa lại), tăng dần */
export function hostOpens(n: number, pick: number, keep: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (i !== pick && i !== keep) out.push(i);
  return out;
}

/** Một ván trọn vẹn */
export function playRound(n: number, swap: boolean, rand: Rand = Math.random) {
  const car = randInt(n, rand);
  const pick = randInt(n, rand);
  const keep = otherDoor(n, car, pick, rand);
  const final = swap ? keep : pick;
  return { car, pick, keep, opened: hostOpens(n, pick, keep), final, win: final === car };
}

export type Tally = { stayWin: number; stayN: number; swapWin: number; swapN: number };
export const EMPTY_TALLY: Tally = { stayWin: 0, stayN: 0, swapWin: 0, swapN: 0 };

export function addRound(t: Tally, swap: boolean, win: boolean): Tally {
  return swap ? { ...t, swapN: t.swapN + 1, swapWin: t.swapWin + (win ? 1 : 0) } : { ...t, stayN: t.stayN + 1, stayWin: t.stayWin + (win ? 1 : 0) };
}

/** Mô phỏng `trials` ván mỗi chiến lược (cùng chuỗi ngẫu nhiên) */
export function simulate(trials: number, n = 3, rand: Rand = Math.random): Tally {
  let t = EMPTY_TALLY;
  for (let i = 0; i < trials; i++) {
    t = addRound(t, false, playRound(n, false, rand).win);
    t = addRound(t, true, playRound(n, true, rand).win);
  }
  return t;
}

export const rate = (win: number, n: number) => (n ? win / n : 0);
