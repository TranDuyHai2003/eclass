/**
 * Phòng "Học cùng nhau" (Study with me): bố cục thuần — dùng chung cho cảnh 3D, va chạm, chỗ ngồi và test.
 * Toạ độ game: x đông–tây, z bắc(−)–nam(+), y lên. Một gác thư viện hình chữ nhật 14 × 13 m.
 *
 *  bắc (tường chính, đối diện cửa): tấm Lời thề lớn ở giữa + hai cửa sổ cao nhìn ra mưa / hoàng hôn
 *  giữa phòng: 6 bàn dài × 2 ghế (12 chỗ), quay mặt về bắc, lối đi giữa trải thảm
 *  tây: lò sưởi + giá sách · đông: giá sách · trên giá: bảng danh ngôn
 *  nam: cửa ra Quảng trường + năm tấm "Ta sẽ vì chân lý mà đấu tranh!"
 */

/** nửa bề ngang (x), nửa chiều sâu (z), chiều cao trần */
export const SR = { W: 7, D: 6.5, H: 5.2 } as const;
/** giới hạn đi lại (trừ bề dày tường + bán kính người) */
export const WALK = { x: SR.W - 0.4, z: SR.D - 0.35 } as const;

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const rect = (cx: number, cz: number, hx: number, hz: number): Rect => ({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });

/** bàn học: tâm (x, z), mặt bàn dài 2,6 × sâu 0,9, cao 0,76 */
export const TABLE = { hx: 1.3, hz: 0.45, h: 0.76 } as const;
export const TABLE_COLS = [-3, 3] as const;
export const TABLE_ROWS = [-3.2, -0.6, 2] as const;
export const TABLES: { x: number; z: number }[] = TABLE_ROWS.flatMap((z) => TABLE_COLS.map((x) => ({ x, z })));

/** ghế: phía nam bàn (người ngồi nhìn về bắc), hai ghế mỗi bàn */
export const CHAIR = { hx: 0.24, hz: 0.24, seat: 0.46, back: 0.95, dz: 0.82, dx: 0.65 } as const;

export interface Seat {
  id: number;
  /** tâm ghế */
  x: number;
  z: number;
  /** hướng nhìn khi ngồi (π = nhìn về bắc, −z) */
  yaw: number;
  /** chỗ đứng sau lưng ghế (đứng dậy thì về đây) */
  sx: number;
  sz: number;
  table: number;
}
export const SEATS: Seat[] = TABLES.flatMap((t, ti) =>
  [-1, 1].map((s, k) => {
    const x = t.x + s * CHAIR.dx;
    const z = t.z + CHAIR.dz;
    return { id: ti * 2 + k, x, z, yaw: Math.PI, sx: x, sz: z + 0.72, table: ti };
  }),
);

/** lò sưởi (tường tây) */
export const FIREPLACE = { x: -SR.W + 0.35, z: -0.6, hw: 1.05, depth: 0.7 } as const;
/** giá sách sát tường đông / tây: [z đầu, z cuối]; sâu 0,5 */
export const SHELF_DEPTH = 0.5;
export const SHELF_RUNS: { side: -1 | 1; z0: number; z1: number }[] = [
  { side: -1, z0: -6.3, z1: -2 },
  { side: -1, z0: 0.8, z1: 4.9 },
  { side: 1, z0: -6.3, z1: 4.9 },
];
/** chậu cây hai góc nam (cạnh cửa) */
export const PLANTS: { x: number; z: number; r: number }[] = [
  { x: -5.9, z: 5.75, r: 0.38 },
  { x: 5.9, z: 5.75, r: 0.38 },
];
/** cửa ra (tường nam) + điểm xuất hiện (nhìn về bắc: Lời thề + cửa sổ) */
export const DOOR = { x: 0, z: SR.D, hw: 0.95 } as const;
export const STUDY_SPAWN = { x: 0, z: 4.9 } as const;
export const EXIT_POINT = { x: 0, z: 5.75, r: 1.25 } as const;

/** tấm Lời thề (tường bắc, chính giữa) và hai cửa sổ hai bên */
export const OATH_PANEL = { x: 0, y0: 0.75, y1: 4.15, hw: 2.05 } as const;
export const WINDOWS = [-4.5, 4.5].map((x) => ({ x, y0: 0.85, y1: 4.2, hw: 1.15 }));

export const COLLIDER_RECTS: Rect[] = (() => {
  const r: Rect[] = [];
  for (const t of TABLES) r.push(rect(t.x, t.z, TABLE.hx, TABLE.hz));
  for (const s of SEATS) r.push(rect(s.x, s.z, CHAIR.hx, CHAIR.hz));
  for (const s of SHELF_RUNS) {
    const x = s.side * (SR.W - SHELF_DEPTH / 2);
    r.push({ x0: x - SHELF_DEPTH / 2, x1: x + SHELF_DEPTH / 2, z0: s.z0, z1: s.z1 });
  }
  r.push({ x0: -SR.W, x1: -SR.W + FIREPLACE.depth + 0.35, z0: FIREPLACE.z - FIREPLACE.hw, z1: FIREPLACE.z + FIREPLACE.hw });
  return r;
})();

/** khoảng cách từ điểm tới hình chữ nhật (0 nếu ở trong) */
function rectDist(x: number, z: number, b: Rect) {
  const dx = Math.max(b.x0 - x, 0, x - b.x1);
  const dz = Math.max(b.z0 - z, 0, z - b.z1);
  return Math.hypot(dx, dz);
}

/**
 * Va chạm: true nếu (x, z) bị chặn. `seat` = chỗ đang ngồi (không tự chặn chính ghế của mình).
 */
export function studyBlocked(x: number, z: number, pad = 0.28, seat: number | null = null): boolean {
  if (Math.abs(x) > WALK.x || Math.abs(z) > WALK.z) return true;
  for (let i = 0; i < COLLIDER_RECTS.length; i++) {
    if (seat !== null && i === TABLES.length + seat) continue;
    if (rectDist(x, z, COLLIDER_RECTS[i]) < pad) return true;
  }
  for (const p of PLANTS) if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return true;
  return false;
}

/** ghế gần nhất trong tầm với (đứng sau / cạnh ghế), hoặc null */
export function seatNear(x: number, z: number, reach = 1.05): Seat | null {
  let best: Seat | null = null;
  let bd = reach;
  for (const s of SEATS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** ghế mà một người ở (x, z) đang ngồi (trong 0,35 m) — để đếm chỗ đã có người */
export function seatAt(x: number, z: number): number | null {
  for (const s of SEATS) if (Math.hypot(x - s.x, z - s.z) < 0.35) return s.id;
  return null;
}

/**
 * Gợi ý chỗ ngồi cho người mới vào: ghế trống, ưu tiên KHÔNG sát người khác (cùng bàn) nhưng vẫn
 * thấy nhau (hiệu ứng "học cạnh nhau" mà không bị làm phiền), rồi gần cửa sổ, rồi gần lối giữa.
 */
export function suggestSeat(occupied: Iterable<number>): Seat | null {
  const occ = new Set(occupied);
  let best: Seat | null = null;
  let bs = -Infinity;
  for (const s of SEATS) {
    if (occ.has(s.id)) continue;
    const mate = SEATS.find((o) => o.table === s.table && o.id !== s.id);
    const crowded = mate && occ.has(mate.id) ? 1 : 0;
    // có người trong phòng → ưu tiên bàn kế bên bàn có người (cùng hàng hoặc hàng trên/dưới)
    let near = 0;
    if (occ.size) {
      let dmin = Infinity;
      for (const o of occ) {
        const so = SEATS[o];
        if (so) dmin = Math.min(dmin, Math.hypot(so.x - s.x, so.z - s.z));
      }
      near = dmin < 7 ? 1 : 0;
    }
    const score = -crowded * 10 + near * 3 - (s.z + SR.D) * 0.3 - Math.abs(s.x) * 0.05;
    if (score > bs) {
      bs = score;
      best = s;
    }
  }
  return best;
}
