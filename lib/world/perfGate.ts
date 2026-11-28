/**
 * Cổng hiệu năng của thế giới 3D (thuần, không three — chạy được trong test): các quyết định "khung này có vẽ / cập nhật không",
 * dùng chung cho cảnh. Nguồn: rà soát hiệu năng docs/ai-reviews/perf/CODEX_PERF_REVIEW.md (+ _RESPONSE.md: số đo A/B).
 */
export type Tier = "low" | "mid" | "high";

// ───────────── Cổng nhìn xuyên của Mê cung Hoạ âm ─────────────
/** số ô cổng live: máy yếu chỉ mặt xoáy; cao + phản chiếu bật → 2 ô (vẫn chỉ MỘT lượt vẽ mỗi khung, xem portalPassOrder) */
export function portalSlots(q: Tier, reflections: boolean): number {
  return q === "low" ? 0 : q === "high" && reflections ? 2 : 1;
}
/** chu kỳ tối thiểu giữa hai lần vẽ lại MỘT ô (ms): cao 30 Hz, laptop / điện thoại 12 Hz */
export function portalPeriodMs(q: Tier): number {
  return q === "high" ? 1000 / 30 : 1000 / 12;
}
/**
 * Thứ tự thử vẽ các ô ở khung này: chỉ ô đang gắn cổng và đã đến hạn, ô lâu chưa vẽ nhất trước.
 * Người gọi vẽ ô ĐẦU TIÊN vẽ được rồi dừng → tối đa một lượt vẽ cảnh phụ mỗi khung (hai ô đến hạn cùng lúc thì luân phiên).
 */
export function portalPassOrder(slots: readonly { active: boolean; at: number }[], now: number, periodMs: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < slots.length; i++) if (slots[i].active && now - slots[i].at >= periodMs) out.push(i);
  return out.sort((a, b) => slots[a].at - slots[b].at);
}

// ───────────── Hồ Quảng trường ─────────────
/** Phản chiếu phẳng động: tắt ở máy yếu (dùng nhánh Fresnel + trời); laptop 10 Hz, máy mạnh 20 Hz */
export function reflectionPlan(q: Tier, enabled: boolean): { on: boolean; periodMs: number } {
  return { on: enabled && q !== "low", periodMs: q === "high" ? 50 : 100 };
}
/** Số bước mô phỏng sóng / bọt tối đa mỗi khung (bước cố định 60 Hz): máy yếu không "đuổi" bước khi tụt FPS */
export function waterMaxSteps(q: Tier): number {
  return q === "low" ? 1 : 2;
}

// ───────────── Cài đặt đồ hoạ hiệu dụng khi tự hạ chất lượng ─────────────
export interface GfxFlags {
  reflections: boolean;
  shadows: boolean;
  ao: boolean;
  godrays: boolean;
  dof: boolean;
  bloom: boolean;
  vfx: 0 | 1 | 2;
}
/**
 * PerformanceMonitor hạ chất lượng (cao → vừa → thấp) thì các cờ đắt cũng phải hạ theo — trước đây chỉ `quality` đổi,
 * máy xuống "thấp" vẫn giữ hồ phản chiếu / mật độ hiệu ứng cao. Không bao giờ BẬT thêm thứ gì.
 *  vừa: tắt AO, tia thể tích, DOF, bóng đổ (chỉ mức Siêu mới có); hiệu ứng ≤ vừa
 *  thấp: thêm tắt phản chiếu, bloom; hiệu ứng thấp
 */
export function capGfx<T extends GfxFlags>(g: T, q: Tier): T {
  if (q === "high") return g;
  const out = { ...g, ao: false, godrays: false, dof: false, shadows: false, vfx: Math.min(g.vfx, 1) as 0 | 1 | 2 };
  if (q === "low") Object.assign(out, { reflections: false, bloom: false, vfx: 0 });
  return out;
}

/**
 * DPR render dễ đoán: DPR thiết bị kẹp trong khoảng của mức chất lượng, KHÔNG vượt DPR thật của màn hình (không siêu lấy mẫu
 * trên laptop DPR 1 — trừ khi superSample, dành cho mức Cao), rồi mới nhân hệ số người dùng (scale) × độ phân giải động (drs).
 * Trước đây khoảng [lo, hi] bị nhân scale·drs TRƯỚC khi kẹp → với DPR 1,25 và drs 0,75–1 kết quả vẫn 1,25 (độ phân giải động
 * không có tác dụng), còn màn DPR 1 ở mức vừa lại vẽ 1,25× (thừa 56% điểm ảnh).
 */
export function renderDpr(device: number, range: readonly [number, number], scale: number, drs: number, superSample = false): number {
  const d = device > 0 && Number.isFinite(device) ? device : 1;
  const base = Math.min(Math.max(d, range[0]), range[1], superSample ? Infinity : Math.max(d, 1));
  return Math.max(0.5, base * scale * drs);
}

// ───────────── Địa hình xa (FarTerrain): hàng đợi ô ─────────────
/** vị trí ô (bỏ bậc chi tiết): "x0,z0,step" → "x0,z0" */
export const farPos = (key: string) => key.slice(0, key.lastIndexOf(","));
export interface FarTileState {
  /** lưới đã cài (truthy) hay chưa */
  mesh: unknown;
  pending: boolean;
}
/**
 * Khi tâm đổi: ô nào bỏ ngay, ô nào cần (xếp lại) hàng đợi.
 *  • bỏ: ô không còn cần ở bất kỳ bậc nào tại vị trí đó;
 *  • ô cũ khác bậc chi tiết mà vị trí vẫn cần: GIỮ tới khi ô thay thế đúng về (khỏi lỗ);
 *  • xếp hàng: MỌI ô cần mà chưa có lưới và không đang dựng — kể cả ô đã có trong bảng từ lần trước nhưng chưa kịp giao việc
 *    (lỗi cũ: xoá hàng đợi rồi chỉ thêm ô MỚI → các ô đang chờ mắc kẹt, không bao giờ được dựng → địa hình xa trống).
 */
export function farReplan(tiles: ReadonlyMap<string, FarTileState>, keep: ReadonlySet<string>): { drop: string[]; queue: string[] } {
  const keepPos = new Set<string>();
  for (const k of keep) keepPos.add(farPos(k));
  const drop: string[] = [];
  for (const k of tiles.keys()) if (!keep.has(k) && !keepPos.has(farPos(k))) drop.push(k);
  const queue: string[] = [];
  for (const k of keep) {
    const t = tiles.get(k);
    if (!t || (!t.mesh && !t.pending)) queue.push(k);
  }
  return { drop, queue };
}
/** Kết quả worker về: chỉ cài nếu ô vẫn đang được cần — kết quả cũ (bậc chi tiết đã đổi) không được xoá ô mới hơn cùng chỗ */
export function farAccept(key: string, keep: ReadonlySet<string>): boolean {
  return keep.has(key);
}

// ───────────── Tự hạ / nâng chất lượng (PerformanceMonitor) ─────────────
/** ân hạn sau khi màn chờ tắt (biên dịch shader + tải lúc vào cảnh làm khung dài bất thường) */
export const QUALITY_GRACE_MS = 9000;
/** phải chậm LIÊN TỤC chừng này (các lần báo "decline" nối nhau, ~2,5 s một lần) mới hạ một bậc */
export const QUALITY_SUSTAIN_MS = 5000;
/** phải nhanh liên tục chừng này mới nâng lại một bậc (trễ lớn hơn hạ → không lật qua lại) */
export const QUALITY_RAISE_MS = 15000;
/** khoảng lặng giữa hai lần báo lớn hơn mức này (FPS lửng lơ giữa hai ngưỡng) = chuỗi bị đứt */
const QUALITY_GAP_MS = 4000;
export interface QualityGate {
  lowSince: number;
  highSince: number;
  last: number;
}
export const newQualityGate = (): QualityGate => ({ lowSince: 0, highSince: 0, last: 0 });
/**
 * Quyết định hạ / nâng chất lượng từ các lần PerformanceMonitor báo FPS thấp ("decline") / cao ("incline").
 *  • readyAt = lúc màn chờ tắt (0 = đang tải / đang chuyển cảnh): trong QUALITY_GRACE_MS sau đó không quyết gì;
 *  • hạ khi thấp liên tục ≥ QUALITY_SUSTAIN_MS VÀ độ phân giải động đã xuống đáy (drsFloor);
 *  • nâng (chỉ khi trước đó đã tự hạ: canRaise) khi cao liên tục ≥ QUALITY_RAISE_MS.
 * Trước đây onFallback của drei (đếm MỌI lần decline/incline, flipflops = 2) hạ thẳng xuống "thấp" ~7 s sau khi gắn Canvas,
 * không có ân hạn, rồi tắt luôn bộ theo dõi → vào cảnh khựng vì biên dịch là mất bloom cả phiên.
 */
export function qualityStep(g: QualityGate, ev: "decline" | "incline", now: number, readyAt: number, drsFloor: boolean, canRaise: boolean): "down" | "up" | null {
  const gap = g.last > 0 && now - g.last > QUALITY_GAP_MS;
  g.last = now;
  if (readyAt <= 0 || now - readyAt < QUALITY_GRACE_MS) {
    g.lowSince = g.highSince = 0;
    return null;
  }
  if (gap) g.lowSince = g.highSince = 0;
  if (ev === "decline") {
    g.highSince = 0;
    if (!g.lowSince) g.lowSince = now;
    if (drsFloor && now - g.lowSince >= QUALITY_SUSTAIN_MS) {
      g.lowSince = 0;
      return "down";
    }
    return null;
  }
  g.lowSince = 0;
  if (!canRaise) return null;
  if (!g.highSince) g.highSince = now;
  if (now - g.highSince >= QUALITY_RAISE_MS) {
    g.highSince = 0;
    return "up";
  }
  return null;
}

// ───────────── Nhân vật VRM ─────────────
/**
 * Viền MToon (một lượt vẽ lại toàn bộ lưới da, mặt sau) của NPC / người chơi khác: tắt khi xa hoặc máy yếu — viền mực hậu kỳ
 * (Ink) vẫn vẽ bóng dáng. Trễ 26 ↔ 30 m để khỏi nháy ở ranh giới. Nhân vật của chính người chơi luôn có viền.
 */
export function outlineOn(dist: number, wasOn: boolean, npc: boolean, q: Tier): boolean {
  if (!npc) return true;
  if (q === "low") return false;
  return wasOn ? dist < 30 : dist < 26;
}

// ───────────── Vết chân ướt (Hub) ─────────────
/** còn dấu chân nào chưa tan hẳn không (dấu mới nhất in lúc `newest`, tan trong `lifeMs`) */
export function printsAlive(newest: number, now: number, lifeMs: number): boolean {
  return now - newest < lifeMs;
}
