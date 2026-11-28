/**
 * Tàu Theseus LẬP THỂ (Thế giới Bất Khả) — hình học thuần, không three:
 * khung tranh chữ nhật (nửa rộng hw, nửa cao hh) chia thành các ô Voronoi lồi theo hạt giống; mỗi ô hiện con tàu từ một
 * góc nhìn khác (mũi / mạn / trên xuống / ¾) → "nhiều điểm nhìn cùng lúc" kiểu Picasso.
 * Mỗi ô = giao các nửa mặt phẳng {p : n·p + c ≥ 0} (đường trung trực với các hạt khác + 4 mép khung) — dùng làm
 * mặt phẳng cắt (clipping plane) vuông góc với khung tranh, nên các mảnh không bao giờ chồng nhau.
 */
export type Half = { nx: number; ny: number; c: number };
export type Seed = { x: number; y: number };

export function cubistCells(seeds: Seed[], hw: number, hh: number): Half[][] {
  const frame: Half[] = [
    { nx: 1, ny: 0, c: hw }, // x ≥ −hw
    { nx: -1, ny: 0, c: hw }, // x ≤ hw
    { nx: 0, ny: 1, c: hh },
    { nx: 0, ny: -1, c: hh },
  ];
  return seeds.map((s, i) => {
    const hs: Half[] = [...frame];
    seeds.forEach((o, j) => {
      if (i === j) return;
      // giữ phía gần s: (p − m)·(s − o) ≥ 0, m = trung điểm
      const nx = s.x - o.x;
      const ny = s.y - o.y;
      const L = Math.hypot(nx, ny) || 1;
      const mx = (s.x + o.x) / 2;
      const my = (s.y + o.y) / 2;
      hs.push({ nx: nx / L, ny: ny / L, c: -(nx * mx + ny * my) / L });
    });
    return hs;
  });
}

export const inCell = (cell: Half[], x: number, y: number, eps = 0) => cell.every((h) => h.nx * x + h.ny * y + h.c >= -eps);

export type CubistView = "side" | "top" | "bow" | "three" | "under" | "back";
/** Bố cục mặc định: 7 mảnh / 6 góc nhìn (vài mảnh phóng to cận cảnh như tranh lập thể tổng hợp), khung 9 × 5 m */
export const CUBIST = {
  hw: 4.5,
  hh: 2.5,
  seeds: [
    { x: -2.9, y: -0.9, view: "side", scale: 0.5 },
    { x: 2.6, y: 1.3, view: "top", scale: 0.45 },
    { x: 2.0, y: -1.5, view: "bow", scale: 0.55 },
    { x: -0.3, y: 1.6, view: "three", scale: 0.45 },
    { x: -3.4, y: 1.7, view: "side", scale: 0.95 },
    { x: 0.1, y: -1.7, view: "under", scale: 0.6 },
    { x: 3.9, y: -0.2, view: "back", scale: 0.7 },
  ] as (Seed & { view: CubistView; scale: number })[],
};
