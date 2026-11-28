/**
 * T24 — Hiệu ứng phép vẽ (cảm hứng nguyên tắc VFX của Valorant, thiết kế riêng): logic THUẦN, test ở tests/world/spellFx.test.ts.
 *  • bảng màu mỗi phép (lõi sáng / thân / mực sẫm) — đọc được cả khi tắt bloom (ngôn ngữ hình + màu riêng);
 *  • đường cong thời gian (lên ngay → giữ 35–50 ms → tắt dần) và cửa sổ hiện / xoá của dải (đầu chạy, đuôi đuổi theo);
 *  • bộ sinh hình ghi THẲNG vào Float32Array có sẵn (không cấp phát mỗi khung): bậc thang (sét Hàm Bậc thang),
 *    xoắn ốc (Chân trời Sự kiện), sin (Sóng Chồng chập), parabol (Thiên thạch Đạn đạo), đường tròn;
 *  • ngân sách: số hạt tối đa mỗi phép theo mức hiệu ứng, LOD theo cỡ chiếu trên màn hình (có trễ để không nhấp nháy);
 *  • nét vẽ: glyph chuẩn của từng phép (để "khớp" lên nét tay khi nhận ra) + bộ lọc nhận dạng tạm thời ổn định.
 */
import type { SpellId } from "./sigil";

// ───────────── Bảng màu ─────────────

export interface SpellPalette {
  /** lõi / viền sáng (ngà, kem, phấn) */
  core: string;
  /** thân — màu nhận diện của phép */
  body: string;
  /** mực sẫm (vai tối, mép) — đọc được trên nền sáng và khi tắt bloom */
  ink: string;
  /** điểm nhấn phụ */
  accent: string;
}

export const SPELL_PALETTE: Record<SpellId, SpellPalette> = {
  // Khiên: vòng ngọc bích khép kín + viền ngà, đường nối xanh rêu sẫm
  shield: { core: "#FFF1C5", body: "#69DBAB", ink: "#194E47", accent: "#B8F5D8" },
  // Sét: sống nghệ tái + vai hổ phách, mực nâu sẫm — đầu nhọn, góc gãy
  bolt: { core: "#FFF8D6", body: "#FFE67B", ink: "#59301F", accent: "#E58C2B" },
  // Xoắn: biên dừa cạn (periwinkle) cố định, lòng cà tím, đầu dấu phẩy nhạt
  vortex: { core: "#E9E1FF", body: "#AAA9FA", ink: "#39304F", accent: "#7F6CF0" },
  // Thiên thạch: dấu chân mận – san hô mảnh, mặt vỡ kem
  meteor: { core: "#FFF0BF", body: "#FF7861", ink: "#50273A", accent: "#FFB45A" },
  // Sóng: ngọn xanh biển rộng, mép phấn, hõm sóng sẫm
  wave: { core: "#ECFFF7", body: "#33C8D0", ink: "#20536E", accent: "#8EF0F0" },
};

// ───────────── Đường cong thời gian ─────────────

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOutCubic = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - Math.pow(2, -10 * t));
export const easeInQuad = (t: number) => clamp01(t) ** 2;
export const easeOutBack = (t: number) => {
  const x = clamp01(t) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};

/**
 * Đường bao điểm nhấn kiểu Valorant: lên trong `rise` ms (outCubic), GIỮ `hold` ms ở 1, rồi tắt trong `fall` ms (bình phương ngược).
 * Trả 0 trước 0 và sau rise + hold + fall.
 */
export function envelope(ageMs: number, rise: number, hold: number, fall: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < rise) return rise <= 0 ? 1 : easeOutCubic(ageMs / rise);
  const a = ageMs - rise;
  if (a < hold) return 1;
  const f = a - hold;
  if (f >= fall) return 0;
  return (1 - f / fall) ** 2;
}

/**
 * Cửa sổ hiện của một dải theo tuổi: đầu chạy 0 → 1 trong `headMs` (outExpo), đuôi bắt đầu đuổi sau `tailDelay` ms và chạy hết
 * trong `tailMs` (inQuad). Dải nhìn thấy trên đoạn u ∈ [tail, head]; tail ≥ head nghĩa là đã xoá xong.
 */
export function revealWindow(ageMs: number, headMs: number, tailDelay: number, tailMs: number): { head: number; tail: number } {
  const head = headMs <= 0 ? 1 : easeOutExpo(ageMs / headMs);
  const tail = ageMs <= tailDelay ? 0 : tailMs <= 0 ? 1 : easeInQuad((ageMs - tailDelay) / tailMs);
  return { head, tail };
}

// ───────────── Bộ sinh hình (ghi vào mảng có sẵn) ─────────────

/** băm tất định 0..1 (không dùng Math.random → test được, mỗi lần nảy sét một hình ổn định) */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Sét Hàm Bậc thang: đường từ A tới B đi theo BẬC THANG (đoạn ngang tiến về B rồi "nhảy" dọc ±jump — điểm gián đoạn),
 * `steps` bậc, mép bậc lệch ngẫu nhiên tất định theo seed. Ghi n = 2·steps + 1 điểm (x, y, z) vào out, trả n.
 * Điểm đầu = A, điểm cuối = B chính xác.
 */
export function stepPath(out: Float32Array, ax: number, ay: number, az: number, bx: number, by: number, bz: number, steps: number, jump: number, seed: number): number {
  steps = Math.max(1, Math.min(steps, Math.floor((out.length / 3 - 1) / 2)));
  let k = 0;
  const put = (x: number, y: number, z: number) => {
    out[k * 3] = x;
    out[k * 3 + 1] = y;
    out[k * 3 + 2] = z;
    k++;
  };
  put(ax, ay, az);
  let y = ay;
  for (let s = 0; s < steps; s++) {
    // vị trí ngang cuối bậc s (lệch nhẹ để không đều như thước kẻ)
    const u = s === steps - 1 ? 1 : (s + 0.55 + (hash01(seed + s * 7.3) - 0.5) * 0.5) / steps;
    const x = ax + (bx - ax) * u;
    const z = az + (bz - az) * u;
    // đi ngang tới mép bậc (giữ độ cao hiện tại)
    put(x, y, z);
    // nhảy dọc: bậc cuối nhảy đúng tới B, các bậc khác dao động quanh đường thẳng A→B
    const base = ay + (by - ay) * u;
    y = s === steps - 1 ? by : base + (s % 2 === 0 ? 1 : -1) * jump * (0.6 + 0.4 * hash01(seed * 3.1 + s));
    put(x, y, z);
  }
  return k;
}

/**
 * Xoắn ốc phẳng (mặt đất, quanh gốc): bán kính đi r0 → r1 qua `turns` vòng, góc bắt đầu `phase`, n điểm (x, 0, z).
 * Xoắn vào trong khi r1 < r0. Trả n.
 */
export function spiralPath(out: Float32Array, n: number, turns: number, r0: number, r1: number, phase: number): number {
  n = Math.min(n, Math.floor(out.length / 3));
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const a = phase + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = 0;
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return n;
}

/**
 * Đường sin trong hệ cục bộ: x = s·len (dọc hướng đi), y = amp·sin(2π·waves·s + phase)·env(s), z = 0, s ∈ [0, 1].
 * env = sin(πs) khi `pinned` (hai đầu ghim về 0 — đúng dáng một bó sóng), ngược lại 1.
 */
export function sinePath(out: Float32Array, n: number, len: number, amp: number, waves: number, phase: number, pinned = false): number {
  n = Math.min(n, Math.floor(out.length / 3));
  for (let i = 0; i < n; i++) {
    const s = n > 1 ? i / (n - 1) : 0;
    out[i * 3] = s * len;
    out[i * 3 + 1] = amp * Math.sin(2 * Math.PI * waves * s + phase) * (pinned ? Math.sin(Math.PI * s) : 1);
    out[i * 3 + 2] = 0;
  }
  return n;
}

/** Độ cao ngọn sóng chồng chập tại u ∈ [0, 1] ngang mặt sóng: tổng 3 sin lệch pha, ghim hai mép (sin πu) */
export function crestHeight(u: number, amp: number, phase: number): number {
  const s = Math.sin(2 * Math.PI * u + phase) + 0.5 * Math.sin(6 * Math.PI * u - phase * 1.7) + 0.25 * Math.sin(10 * Math.PI * u + phase * 2.3);
  return amp * (0.55 + 0.45 * s / 1.75) * Math.sin(Math.PI * clamp01(u));
}

/**
 * Quỹ đạo đạn đạo p(t) = p0 + v·t − ½g t² ŷ, t ∈ [t0, T] chia đều n điểm (đúng phương trình mà thiên thạch bay) — để vẽ
 * đường dự báo (nét đứt mảnh) phần CÒN LẠI của parabol. Trả n.
 */
export function parabolaPath(out: Float32Array, n: number, p0: { x: number; y: number; z: number }, v: { x: number; y: number; z: number }, g: number, t0: number, T: number): number {
  n = Math.min(n, Math.floor(out.length / 3));
  for (let i = 0; i < n; i++) {
    const t = t0 + (n > 1 ? i / (n - 1) : 0) * (T - t0);
    out[i * 3] = p0.x + v.x * t;
    out[i * 3 + 1] = p0.y + v.y * t - 0.5 * g * t * t;
    out[i * 3 + 2] = p0.z + v.z * t;
  }
  return n;
}

// ───────────── Glyph chuẩn (màn hình vẽ) ─────────────

/**
 * Hình lý tưởng của từng phép, chuẩn hoá trong hộp [-0.5, 0.5]² (y hướng XUỐNG như toạ độ màn hình), n điểm (x, y).
 * Dùng để "khớp" glyph chuẩn lên nét tay khi nhận ra phép. `dir` = ±1: chiều quay (tròn / xoắn) hoặc chiều đi (trái → phải).
 */
export function idealGlyph(id: SpellId, out: Float32Array, n: number, dir = 1): number {
  n = Math.min(n, Math.floor(out.length / 2));
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    let x = 0;
    let y = 0;
    if (id === "shield") {
      const a = -Math.PI / 2 + dir * t * Math.PI * 2;
      x = 0.5 * Math.cos(a);
      y = 0.5 * Math.sin(a);
    } else if (id === "vortex") {
      const a = dir * t * Math.PI * 2 * 2.25;
      const r = 0.04 + 0.46 * t;
      x = r * Math.cos(a);
      y = r * Math.sin(a);
    } else if (id === "bolt") {
      // 4 đoạn gãy (5 đỉnh) như hướng dẫn: lên – xuống – lên – xuống
      const seg = t * 4;
      const k = Math.min(3, Math.floor(seg));
      const f = seg - k;
      const ys = [-0.5, 0.5, -0.5, 0.5, -0.5];
      x = -0.5 + t;
      y = ys[k] + (ys[k + 1] - ys[k]) * f;
    } else if (id === "meteor") {
      // parabol úp (đỉnh ở trên, màn hình y hướng xuống): y = 4x² − 0.5 → (±0.5, 0.5) … (0, −0.5)
      x = -0.5 + t;
      y = 4 * x * x - 0.5;
    } else {
      // sin 2 chu kỳ, biên độ 0,2 (cao quá thì góc rẽ gắt → bị nhận nhầm thành sét)
      x = -0.5 + t;
      y = -0.2 * Math.sin(t * Math.PI * 4);
    }
    if (id !== "shield" && id !== "vortex" && dir < 0) x = -x;
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }
  return n;
}

/**
 * Bộ lọc nhận dạng tạm thời: nét đang vẽ được nhận dạng định kỳ; chỉ báo "có vẻ là X" khi cùng một kết quả giữ ≥ `stableMs`
 * (60–90 ms theo nghiên cứu) → không nhấp nháy giữa hai phép khi tay đang lượn.
 */
export class StableMatch<T> {
  private cand: T | null = null;
  private since = 0;
  constructor(private stableMs = 75) {}
  /** đưa kết quả mới (null = chưa nhận ra) tại thời điểm `now` → trả kết quả ổn định hoặc null */
  push(v: T | null, now: number): T | null {
    if (v !== this.cand) {
      this.cand = v;
      this.since = now;
    }
    return this.cand !== null && now - this.since >= this.stableMs ? this.cand : null;
  }
  reset() {
    this.cand = null;
    this.since = 0;
  }
}

/** Phản hồi theo bậc chính xác: số vòng loé khi khớp glyph, có rung nhẹ (Rough), màu nhấn */
export function tierFeedback(label: string): { rings: number; shake: boolean; sparks: number; color: string } {
  if (label === "Perfect") return { rings: 3, shake: false, sparks: 14, color: "#FFE9A8" };
  if (label === "Good") return { rings: 2, shake: false, sparks: 9, color: "#FFFFFF" };
  if (label === "OK") return { rings: 1, shake: false, sparks: 5, color: "#DDE6FF" };
  return { rings: 1, shake: true, sparks: 3, color: "#B9B4C8" };
}

// ───────────── Ngân sách & LOD ─────────────

export type FxLevel = 0 | 1 | 2;

/** Hạt (tia / mảnh) tối đa mỗi lần phát cho từng phép: thấp / vừa / cao (nghiên cứu: điện thoại / laptop) */
export const SPELL_PARTICLES: Record<SpellId, [number, number, number]> = {
  shield: [8, 12, 16],
  bolt: [8, 11, 14],
  vortex: [8, 12, 16],
  meteor: [16, 22, 30],
  wave: [8, 12, 16],
};
/** Tia hào quang niệm phép sống cùng lúc tối đa (4 điện thoại / 8 laptop) */
export const AURA_SPARKS: [number, number, number] = [4, 6, 8];
/** Mảnh (shard) đặc tối đa trong pool chung — 1 lệnh vẽ */
export const SHARD_CAP: [number, number, number] = [32, 64, 96];

export function spellParticles(id: SpellId, lv: FxLevel): number {
  return SPELL_PARTICLES[id][lv] ?? SPELL_PARTICLES[id][1];
}

/** Đường kính chiếu trên màn hình (px) của vật đường kính `diam` m ở khoảng cách `dist`, máy quay fov dọc `fovDeg`, cao `viewH` px */
export function projectedPx(diam: number, dist: number, fovDeg: number, viewH: number): number {
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  return (diam * f * viewH * 0.5) / Math.max(0.05, dist);
}

/**
 * LOD theo cỡ chiếu: 2 = đủ lớp, 1 = bỏ lớp phụ (< 48 px), 0 = chỉ còn mép / đầu chính (< 24 px).
 * Trễ ±4 px quanh mỗi ngưỡng để máy quay lắc nhẹ không làm lớp bật / tắt liên tục.
 */
export function lodTier(px: number, prev: FxLevel = 2): FxLevel {
  const H = 4;
  const up1 = prev >= 1 ? 24 - H : 24 + H;
  const up2 = prev >= 2 ? 48 - H : 48 + H;
  if (px >= up2) return 2;
  if (px >= up1) return 1;
  return 0;
}
