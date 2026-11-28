/**
 * Chợ Xác Suất — bố cục thuần (dùng chung cho cảnh, va chạm, điểm tương tác và test). Toạ độ game x, z; y lên; bắc = −z.
 *
 *   sân tròn bán kính 26 m (đi được tới 25 m), mặt sàn phẳng y = 0
 *   tâm: Tháp Số Lớn (luật số lớn của mọi vòng quay trong Chợ)
 *   tây: Đèn Năm (cây dù 12 dây tháng × 365 đèn lồng)  ·  bắc: Bãi Rương Mimic 10 × 10
 *   đông: Ruộng Slime (đường ray ô 0…18)                ·  tây nam: Bánh Xe Chuỗi + Thầy Chuỗi
 *   nam: điểm vào + cổng về Quảng trường
 */
import { DAYS, MONTH_DAYS, SLIME_MAX } from "./bazaar";

export const BAZAAR_R = 26;
export const WALK_R = 25;
export const SPAWN = { x: 0, z: 17.5 };
export const PORTAL = { x: 0, z: 21.5 };
/** cột chỉ đường tới Sân khấu Ba Cửa (Monty Hall — ở Sảnh Bất Khả) */
export const MONTY_SIGN = { x: 5.2, z: 18.6 };

export const TOWER = { x: 0, z: 0, r: 1.3, h: 6.5 };

// ── Đèn Năm (Birthday Wisps): cột giữa cao, 12 dây (tháng) thả xuống 12 cọc ở bán kính 5,5 m; đèn treo dọc dây
export const WISP_TREE = {
  x: -14,
  z: 0,
  top: 6.8,
  poleR: 0.35,
  R: 5.5,
  endY: 2.0,
};
export const WISP_KEEPER = { x: -7.6, z: 1.8 };
export const WISP_SPOT = { x: -6.4, z: 1.8 };

/** vị trí đèn thứ `day` (0…364): dây tháng m, đèn thứ d trên dây (đường võng nhẹ) */
export function lanternPos(day: number): [number, number, number] {
  let r = day;
  let m = 0;
  while (m < 11 && r >= MONTH_DAYS[m]) {
    r -= MONTH_DAYS[m];
    m++;
  }
  const a = (m / 12) * Math.PI * 2 + Math.PI / 12;
  const t = (r + 1) / 32;
  const T = WISP_TREE;
  const rad = 0.45 + t * (T.R - 0.45);
  // dây võng: thẳng từ đỉnh xuống cọc, trừ một parabol 4·t·(1−t)·0,55
  const y = T.top + (T.endY - T.top) * t - 4 * t * (1 - t) * 0.55 - 0.18;
  return [T.x + Math.cos(a) * rad, y, T.z + Math.sin(a) * rad];
}
export const LANTERNS = DAYS;
/** 12 cọc cuối dây */
export const WISP_POSTS: [number, number][] = Array.from(
  { length: 12 },
  (_, m) => {
    const a = (m / 12) * Math.PI * 2 + Math.PI / 12;
    return [
      WISP_TREE.x + Math.cos(a) * WISP_TREE.R,
      WISP_TREE.z + Math.sin(a) * WISP_TREE.R,
    ];
  },
);

// ── Bãi Rương Mimic (Bayes): lưới 10 × 10, cách 1 m, có hàng rào; quầy + 3 rương thương vụ ở mép nam
export const CHEST_FIELD = { x: 0, z: -15, n: 10, gap: 1.0 };
export const chestPos = (i: number): [number, number] => {
  const F = CHEST_FIELD;
  const c = i % F.n;
  const r = Math.floor(i / F.n);
  return [F.x + (c - (F.n - 1) / 2) * F.gap, F.z + (r - (F.n - 1) / 2) * F.gap];
};
export const FIELD_HALF = (CHEST_FIELD.n * CHEST_FIELD.gap) / 2 + 0.4;
export const MIMIC_KEEPER = { x: 0, z: -8.4 };
export const MIMIC_SPOT = { x: 0, z: -6.9 };
/** 3 rương thương vụ trên quầy */
export const OFFER_CHESTS: [number, number][] = [
  [-1.3, -8.4],
  [0, -8.4],
  [1.3, -8.4],
];

// ── Ruộng Slime (tổng xúc xắc): ô s ở x = X0 + s·W, dọc z = Z; ô 0 = ổ trứng (slime xuất phát)
export const SLIME_TRACK = { x0: 6.2, z: 2.6, w: 0.95, half: 0.62 };
export const tileX = (s: number) => SLIME_TRACK.x0 + s * SLIME_TRACK.w;
/** ô dưới chân (1…18) hoặc −1 nếu không đứng trên đường ray */
export function tileAt(x: number, z: number): number {
  const T = SLIME_TRACK;
  if (Math.abs(z - T.z) > T.half + 0.25) return -1;
  const s = Math.round((x - T.x0) / T.w);
  return s >= 1 && s <= SLIME_MAX ? s : -1;
}
/** quầy ở đầu tây đường ray, mặt quay về đông (nhìn dọc đường ray) */
export const SLIME_KEEPER = { x: 3.9, z: 2.6 };
export const SLIME_SPOT = { x: 5.3, z: 4.5 };

// ── Bánh Xe Chuỗi: bánh xe đứng, mặt quay về tâm sân; Thầy Chuỗi đứng cạnh
export const WHEEL = { x: -11.5, z: 12.5, r: 2.3, hub: 3.0 };
const WD = Math.hypot(WHEEL.x, WHEEL.z);
/** hướng nhìn ra (về tâm sân) */
export const WHEEL_YAW = Math.atan2(-WHEEL.x / WD, -WHEEL.z / WD);
export const WHEEL_SPOT = {
  x: WHEEL.x - (WHEEL.x / WD) * 3.2,
  z: WHEEL.z - (WHEEL.z / WD) * 3.2,
};
export const SEER = {
  x: WHEEL.x - (WHEEL.x / WD) * 1.2 + 2.4 * (WHEEL.z / WD),
  z: WHEEL.z - (WHEEL.z / WD) * 1.2 - 2.4 * (WHEEL.x / WD),
};

// ── Va chạm
export interface Circle {
  x: number;
  z: number;
  r: number;
}
export const COLLIDERS: Circle[] = [
  { x: TOWER.x, z: TOWER.z, r: TOWER.r },
  { x: WISP_TREE.x, z: WISP_TREE.z, r: WISP_TREE.poleR + 0.25 },
  ...WISP_POSTS.map(([x, z]) => ({ x, z, r: 0.25 })),
  { x: WISP_KEEPER.x, z: WISP_KEEPER.z, r: 0.75 },
  { x: MIMIC_KEEPER.x - 1.3, z: MIMIC_KEEPER.z, r: 0.6 },
  { x: MIMIC_KEEPER.x, z: MIMIC_KEEPER.z, r: 0.6 },
  { x: MIMIC_KEEPER.x + 1.3, z: MIMIC_KEEPER.z, r: 0.6 },
  { x: SLIME_KEEPER.x, z: SLIME_KEEPER.z, r: 0.7 },
  // bánh xe đứng: 3 vòng dọc theo bề ngang đĩa (tiếp tuyến với hướng nhìn)
  ...[-1.6, 0, 1.6].map((k) => ({
    x: WHEEL.x + (WHEEL.z / WD) * k,
    z: WHEEL.z - (WHEEL.x / WD) * k,
    r: 0.85,
  })),
  { x: SEER.x, z: SEER.z, r: 0.45 },
  { x: MONTY_SIGN.x, z: MONTY_SIGN.z, r: 0.3 },
];

export function bazaarGround(): number {
  return 0;
}

export function bazaarBlocked(x: number, z: number, pad = 0.3): boolean {
  if (Math.hypot(x, z) > WALK_R) return true;
  // hàng rào bãi rương
  const F = CHEST_FIELD;
  if (
    Math.abs(x - F.x) < FIELD_HALF + pad &&
    Math.abs(z - F.z) < FIELD_HALF + pad
  )
    return true;
  for (const c of COLLIDERS)
    if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return true;
  return false;
}

/** điểm tương tác (bấm F) */
export const BAZAAR_SPOTS = {
  portal: PORTAL,
  wisp: WISP_SPOT,
  mimic: MIMIC_SPOT,
  slime: SLIME_SPOT,
  wheel: WHEEL_SPOT,
  monty: { x: MONTY_SIGN.x - 1.0, z: MONTY_SIGN.z - 0.6 },
} as const;
