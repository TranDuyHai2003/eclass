/**
 * Cổng Mandelbrot (bốt Siêu khối): toán thuần cho bục "lái" chế độ Julia.
 * Bục khắc đúng đường biên cardioid chính c = e^{it}/2 − e^{2it}/4 ở tỉ lệ PAD_SCALE m / đơn vị, dời +0,375 đơn vị theo trục x
 * của bục → đứng ở điểm nào trên hình khắc thì c chính là điểm đó của mặt phẳng phức (Re c = x/s − 0,375, Im c = −z/s cục bộ).
 */
export const PAD_R = 0.72;
export const PAD_SHIFT = 0.375;
export const PAD_SCALE = 0.8;

/**
 * (dx, dz) = chân người chơi trừ tâm bục (thế giới), dy = độ cao so với mặt bục, b = phương vị bục (độ, bục xoay −b quanh y).
 * Trả c = [Re, Im] khi đứng trên bục, null khi ở ngoài.
 */
export function mandelPadC(dx: number, dz: number, dy: number, b: number): [number, number] | null {
  if (Math.abs(dy) > 0.6 || Math.hypot(dx, dz) > PAD_R) return null;
  const r = (b * Math.PI) / 180;
  const lx = dx * Math.cos(r) + dz * Math.sin(r);
  const lz = -dx * Math.sin(r) + dz * Math.cos(r);
  return [lx / PAD_SCALE - PAD_SHIFT, -lz / PAD_SCALE];
}

/** Số bước thoát của z → z² + c (z₀ = 0); trả `max` nếu chưa thoát (coi như thuộc tập M) */
export function escapeTime(cr: number, ci: number, max = 200): number {
  let x = 0;
  let y = 0;
  for (let i = 0; i < max; i++) {
    const nx = x * x - y * y + cr;
    y = 2 * x * y + ci;
    x = nx;
    if (x * x + y * y > 4) return i;
  }
  return max;
}
