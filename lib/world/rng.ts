/**
 * PRNG có seed (mulberry32) — cùng seed ⇒ cùng dãy số, để server sinh lại đúng câu hỏi khi chấm.
 * Thuần, không phụ thuộc môi trường; dùng được cả ở server lẫn client.
 */
export interface Rng {
  /** Số thực trong [0, 1) */
  next(): number;
  /** Số nguyên trong [lo, hi] (gồm cả hai đầu) */
  int(lo: number, hi: number): number;
  /** Một phần tử ngẫu nhiên */
  pick<T>(arr: readonly T[]): T;
  /** Bản sao đã xáo trộn (Fisher–Yates) */
  shuffle<T>(arr: readonly T[]): T[];
  /** true với xác suất p */
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}

/** Seed ngẫu nhiên 31 bit (vừa cột Int của Postgres) */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
