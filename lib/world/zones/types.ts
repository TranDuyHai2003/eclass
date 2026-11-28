/**
 * Kiểu va chạm dùng chung của các khu mở rộng Mê cung Hoạ âm (giai đoạn 2 — docs/ai-reviews/siren-witch/PHASE2_PLAN.md).
 * Mọi toạ độ là CỤC BỘ của khu (gốc khu ở lib/world/zoneGraph.ts → ZONE_DEFS[id].origin). Thuần, không three.js.
 */

/** Mặt đi được: hộp xoay quanh y (yaw: trục z cục bộ = (sin yaw, cos yaw)) hoặc đĩa. y = cao độ mặt trên. */
export interface ZSurf {
  id: string;
  kind: "box" | "disc";
  x: number;
  z: number;
  y: number;
  hx?: number;
  hz?: number;
  r?: number;
  yaw?: number;
  /** khối đặc từ y − thick tới y */
  thick: number;
  /** chỉ số mặt động (mảng ZONE_DYN — lún xuống bao nhiêu mét) */
  dyn?: number;
  /** nhãn (vd. "plate", "key:12") cho luật khu */
  tag?: string;
}

/** Tường hộp đứng (y0…y1). flag: chỉ chặn khi ZONE_FLAGS[flag] chưa bật (vd. đê mở) */
export interface ZWall {
  id: string;
  x: number;
  z: number;
  hx: number;
  hz: number;
  yaw?: number;
  y0: number;
  y1: number;
  flag?: string;
}

/** Trụ đứng */
export interface ZCyl {
  id: string;
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
}

export interface ZoneColliders {
  surfs: ZSurf[];
  walls: ZWall[];
  cyls: ZCyl[];
}

export const zbox = (id: string, x: number, y: number, z: number, hx: number, hz: number, thick = 1, yaw = 0, tag?: string): ZSurf => ({ id, kind: "box", x, y, z, hx, hz, yaw, thick, tag });
export const zdisc = (id: string, x: number, y: number, z: number, r: number, thick = 1, tag?: string): ZSurf => ({ id, kind: "disc", x, y, z, r, thick, tag });
export const zwall = (id: string, x: number, z: number, hx: number, hz: number, y0: number, y1: number, yaw = 0, flag?: string): ZWall => ({ id, x, z, hx, hz, yaw, y0, y1, flag });

/** bậc cao tối đa (cùng sirenMaze.RISE) */
export const ZRISE = 0.45;

/** Cầu thang thẳng từ a (chân) tới b (mép mặt trên): bậc đều ≤ ZRISE, bậc cuối bằng cao độ b */
export function zstairs(id: string, a: [number, number, number], b: [number, number, number], w: number): ZSurf[] {
  const n = Math.ceil(Math.abs(b[1] - a[1]) / ZRISE - 1e-9);
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]);
  const out: ZSurf[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    out.push({ id: `${id}.${i}`, kind: "box", x: a[0] + (b[0] - a[0]) * t, z: a[2] + (b[2] - a[2]) * t, y: a[1] + ((b[1] - a[1]) * (i + 1)) / n, hx: w / 2, hz: L / n / 2 + 0.06, yaw, thick: 0.35 });
  }
  return out;
}
