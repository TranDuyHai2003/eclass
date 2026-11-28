/**
 * Bơi (thuần — dùng trong Player, test được): quyết định bơi / lội và vận tốc dọc khi bơi.
 *  - bơi khi thân ngập quá 0,55 m VÀ nước dưới chân đủ sâu (đáy thấp hơn mặt nước > 0,9 m); đang bật lên bằng nhịp đạp
 *    (vy > 3) sát mặt nước thì tạm thôi bơi để trèo lên bờ;
 *  - nổi: đầu nhô khỏi mặt nước (thân ở mặt nước − 1,2 m, dập dềnh 6 cm); nhìn xuống + bơi tới → lặn (tối đa 2,5 m mỗi nhịp,
 *    không xuyên đáy); vận tốc dọc bị kẹp ±3 m/s và tiến dần tới vận tốc mong muốn (nước cản).
 */
export const SWIM = { submerge: 0.55, minDepth: 0.9, float: 1.2, bob: 0.06, maxV: 3, slow: 0.62, wadeSlow: 0.75 } as const;

export function isSwimming(surface: number | null, y: number, floor: number, vy: number): boolean {
  if (surface === null) return false;
  if (y >= surface - SWIM.submerge || floor >= surface - SWIM.minDepth) return false;
  return !(vy > 3 && y > surface - SWIM.float);
}

/** hệ số tốc độ đi: bơi 0,62; lội (ngập > 0,2 m) 0,75; khô 1 */
export function wadeFactor(surface: number | null, y: number, swimming: boolean): number {
  if (swimming) return SWIM.slow;
  return surface !== null && y < surface - 0.2 ? SWIM.wadeSlow : 1;
}

/** vận tốc dọc mới khi bơi */
export function swimVy(o: { surface: number; y: number; floor: number; vy: number; dive: boolean; t: number; dt: number }): number {
  const target = o.dive ? Math.max(o.floor + 0.3, o.y - 2.5) : o.surface - SWIM.float + SWIM.bob * Math.sin(o.t / 420);
  const want = Math.max(-SWIM.maxV, Math.min(SWIM.maxV, (target - o.y) * 2.2));
  return o.vy + (want - o.vy) * (1 - Math.exp(-o.dt * (o.vy > want ? 2.2 : 3.5)));
}
