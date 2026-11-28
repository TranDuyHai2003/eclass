/**
 * Đồng bộ nhiều người cho boss / sự kiện Vùng Kỳ quan — QUY TẮC SERVER (thuần, không import gì): kiểm thông điệp
 * triệu hồi, chọn "chủ trận", giới hạn tốc độ. realtime/bossrelay.mjs được SINH từ file này (scripts/gen-realtime.mjs) —
 * server và test dùng cùng một mã. Thiết kế: docs/ai-reviews/voxel-world/BOSSES.md § Nhiều người.
 *
 * Mô hình "chủ trận": người triệu hồi giữ mô phỏng có thẩm quyền; server chỉ giữ CHỖ TRẬN (slot), chuyển tiếp trạng thái
 * (chủ → cả phòng), đòn đánh (khách → chủ), và chọn chủ mới khi chủ rời.
 */

export const BR = {
  KINDS: ["surveyor", "ledger", "lantern"],
  /** tối đa số trận cùng lúc trong một phòng (kênh ≤ 40 người) */
  MAX_SLOTS: 4,
  /** người triệu hồi phải đứng cách tâm ≤ SUMMON_R m (theo vị trí server đã nhận) */
  SUMMON_R: 24,
  /** hai trận cách nhau ≥ GAP_R m — triệu hồi gần trận đang có thì vào trận đó */
  GAP_R: 80,
  /** chủ mới phải đứng cách tâm ≤ HOST_R m */
  HOST_R: 60,
  /** khách đánh boss phải đứng cách tâm ≤ HIT_R m */
  HIT_R: 45,
  /** kích thước JSON tối đa của một gói trạng thái */
  STATE_MAX: 4000,
  /** sát thương tối đa một đòn (chống gian lận thô, như boss Siren) */
  HIT_MAX: 150,
  /** chủ im lặng quá lâu → huỷ trận */
  STALE_MS: 30000,
} as const;

export interface FightReq {
  kind: string;
  cx: number;
  cz: number;
  y: number;
  seed: number;
  rot: number;
}

const fin = (v: unknown, lim: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= lim;

/** Kiểm + chuẩn hoá yêu cầu triệu hồi ({kind, cx, cz, y, seed, rot}); null = rác */
export function validFight(m: unknown): FightReq | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  if (typeof o.kind !== "string" || !(BR.KINDS as readonly string[]).includes(o.kind)) return null;
  if (!fin(o.cx, 1e5) || !fin(o.cz, 1e5) || !fin(o.y, 500)) return null;
  if (!Number.isInteger(o.seed) || (o.seed as number) < 0 || (o.seed as number) > 2 ** 31) return null;
  const rot = Number.isInteger(o.rot) ? (o.rot as number) : 0;
  if (rot < 0 || rot > 3) return null;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { kind: o.kind, cx: r2(o.cx), cz: r2(o.cz), y: r2(o.y), seed: o.seed as number, rot };
}

/** Chỉ số trận gần (x, z) nhất trong bán kính r (−1 nếu không có) */
export function slotNear(slots: readonly { cx: number; cz: number }[], x: number, z: number, r: number): number {
  let best = -1;
  let bd = r;
  for (let i = 0; i < slots.length; i++) {
    const d = Math.hypot(slots[i].cx - x, slots[i].cz - z);
    if (d <= bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** Chọn chủ trận mới: người gần tâm nhất trong maxR (hoà → id nhỏ hơn cho tất định); null = không ai → kết thúc trận */
export function pickHost(cx: number, cz: number, cands: readonly { id: string; x: number; z: number }[], maxR: number): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - cx, c.z - cz);
    if (d > maxR) continue;
    if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && best !== null && c.id < best)) {
      bd = d;
      best = c.id;
    }
  }
  return best;
}

/** Thùng token: hồi `rate` / giây, tối đa `cap`; trả true và trừ 1 nếu còn */
export function takeToken(b: { tokens: number; at: number }, now: number, rate: number, cap: number): boolean {
  b.tokens = Math.min(cap, b.tokens + ((now - b.at) / 1000) * rate);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/** Sát thương một đòn của khách: số hữu hạn, kẹp [0, HIT_MAX], làm tròn; mục tiêu "b" (boss) hoặc "m0".."m7" (bướm) */
export function validHit(m: unknown): { k: string; d: number } | null {
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const k = o.k;
  if (k !== "b" && !(typeof k === "string" && /^m[0-7]$/.test(k))) return null;
  const d = Number(o.d);
  if (!Number.isFinite(d)) return null;
  return { k, d: Math.max(0, Math.min(BR.HIT_MAX, Math.round(d))) };
}
