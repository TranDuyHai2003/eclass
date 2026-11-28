/**
 * Mê cung Hoạ âm — nhánh W (thế giới / bầu trời / kết giới), phần THUẦN (test được, không three.js).
 * docs/ai-reviews/siren-witch/PLAN.md. Mọi hàm nhận thời gian / nhịp từ HARMONIC (lib/world/harmonicState.ts) — không đồng hồ riêng.
 *
 *  - Trời cắt dán nhiều lớp (multiplane): 4 lớp hình trụ quanh máy quay, tâm lớp bám máy quay theo hệ số `follow`
 *    (lớp xa bám gần như hoàn toàn → gần như vô cực; lớp gần bám ít → thị sai), mỗi lớp trôi theo chu kỳ riêng.
 *  - Phân rã: mảnh có `rank` cao biến mất trước khi HARMONIC.decomposition tăng (bớt "hoạ âm bậc cao").
 *  - Thác ký hiệu: ký hiệu rơi xuống mặt trước, tới đáy thì vòng ra sau bay NGƯỢC lên (lật gương = "nghịch hành").
 *  - Vùng Dấu lặng: túi im lặng dưới Lồng Escher — vào là mất màu / hoạ tiết / âm thanh, mượt.
 *  - Kết giới: dòng thời gian màn chuyển khi vào màn (giấy gấp mở, khuông nhạc kéo căng), bỏ qua được, giảm chuyển động.
 */

/** trạng thái chạy dùng chung của nhánh W (SirenRest ghi, bầu trời / cắt dán / thác đọc) — mức im lặng đã làm mượt 0…1 */
export const SIREN_W = { rest: 0 };

// ───────────── Trời cắt dán nhiều lớp ─────────────

export type CollageLayer = {
  /** bán kính trụ (m) */
  radius: number;
  /** tâm lớp = máy quay × follow (1 = vô cực, nhỏ = gần, thị sai mạnh) */
  follow: number;
  /** vận tốc trôi quanh trục y (rad/beat) — mỗi lớp một chu kỳ riêng (tỉ số 2 : 3 : 5 : 7) */
  drift: number;
  /** độ cao gốc (so với tâm lớp) và biên độ rải dọc */
  y0: number;
  ySpread: number;
  /** cỡ mảnh (m) */
  size: number;
  count: number;
};

export const COLLAGE_LAYERS: CollageLayer[] = [
  { radius: 330, follow: 0.97, drift: 0.0021, y0: 6, ySpread: 22, size: 84, count: 12 },
  { radius: 250, follow: 0.85, drift: -0.0035, y0: 18, ySpread: 48, size: 40, count: 14 },
  { radius: 185, follow: 0.66, drift: 0.0058, y0: 14, ySpread: 60, size: 22, count: 16 },
  { radius: 135, follow: 0.42, drift: -0.0094, y0: 6, ySpread: 64, size: 13, count: 14 },
];

/** số ô atlas cắt dán (siren_collage.webp: 8 cột × 4 hàng; cột 0–3 = tờ A (cặp khung A/B), cột 4–7 = tờ B (bóng xa)) */
export const COLLAGE_COLS = 8;
export const COLLAGE_ROWS = 4;

export type CollagePiece = {
  layer: number;
  /** góc trên trụ (rad) */
  angle: number;
  /** độ cao so với tâm lớp */
  y: number;
  /** cỡ (m) */
  size: number;
  /** ô atlas (khung A) */
  cell: number;
  /** ô khung B (thay tay 4 Hz) — = cell nếu mảnh không đổi khung */
  cellB: number;
  /** pha / tốc độ chu kỳ riêng */
  phase: number;
  /** 0…1: thứ tự biến mất khi phân rã (cao = mất trước) */
  rank: number;
};

/** PRNG xác định (mulberry32) — bố cục giống nhau mọi máy, mọi lần tải */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bố cục trời cắt dán. Lớp xa (0, 1) dùng bóng xa (tờ B: cột 4–7), lớp gần (2, 3) dùng vật thể có cặp khung A/B (tờ A: cột 0–3,
 * cột chẵn = khung A, cột lẻ kề bên = khung B). Mảnh trong cùng lớp rải đều góc (± nhiễu) để không dồn cục.
 */
export function collageLayout(seed = 7): CollagePiece[] {
  const r = rng(seed);
  const out: CollagePiece[] = [];
  COLLAGE_LAYERS.forEach((L, li) => {
    for (let i = 0; i < L.count; i++) {
      const angle = ((i + 0.5 + (r() - 0.5) * 0.7) / L.count) * Math.PI * 2;
      const far = li < 2;
      const row = Math.floor(r() * COLLAGE_ROWS);
      let cell: number;
      let cellB: number;
      if (far) {
        cell = row * COLLAGE_COLS + 4 + Math.floor(r() * 4);
        cellB = cell;
      } else {
        const pair = Math.floor(r() * 2); // 0: cột 0/1, 1: cột 2/3
        cell = row * COLLAGE_COLS + pair * 2;
        cellB = cell + 1;
      }
      out.push({
        layer: li,
        angle,
        y: L.y0 + (r() - 0.35) * L.ySpread,
        size: L.size * (0.7 + r() * 0.6),
        cell,
        cellB,
        phase: r() * Math.PI * 2,
        rank: r(),
      });
    }
  });
  return out;
}

/**
 * Mảnh còn "sống" ở mức phân rã d (0…1): 1 = hiện đủ, 0 = mất. Mảnh rank cao rụng trước; lớp xa nhất (0) rụng sau cùng.
 * Có dải chuyển 0,12 để mảnh co lại mượt (không bật / tắt).
 */
export function pieceAlive(rank: number, layer: number, d: number): number {
  const keep = 1 - d * (layer === 0 ? 0.75 : 1.2);
  const x = (keep + 0.16 - rank) / 0.16;
  return Math.max(0, Math.min(1, x));
}

// ───────────── Thác ký hiệu ─────────────

export const NOTES_COLS = 4;
export const NOTES_ROWS = 4;
/** ô "dấu lặng đen" trong notes_atlas (hàng 3, cột 2: quarter rest) */
export const NOTE_REST_CELL = 10;

export type Waterfall = { x: number; z: number; top: number; bottom: number; width: number; count: number };
/** ba thác ở mép mê cung (giữa các khu, ngoài tầm cầu), từ trên trời rơi xuống dưới Đáy */
export const WATERFALLS: Waterfall[] = [
  { x: 58, z: 40, top: 70, bottom: -34, width: 7, count: 64 },
  { x: -56, z: -40, top: 74, bottom: -38, width: 7, count: 64 },
  { x: -14, z: -66, top: 62, bottom: -30, width: 6, count: 56 },
];
/** chu kỳ một vòng rơi → bay ngược (beat) */
export const FALL_BEATS = 16;

/**
 * Vị trí một ký hiệu trên vòng thác ở pha u (0…1): nửa đầu rơi (gia tốc như trọng lực, chậm dần ở đáy),
 * nửa sau vòng ra sau bay ngược lên (ease đối xứng). Trả về [lệch ngang theo pháp tuyến thác (−1 sau … +1 trước), độ cao 0…1 (1 = đỉnh), lật gương 1 / −1].
 */
export function fallLoop(u: number): [number, number, number] {
  const f = u - Math.floor(u);
  if (f < 0.5) {
    const s = f / 0.5;
    // rơi: y = 1 − s² (nhanh dần), sát đáy cong ra trước
    return [1, 1 - s * s, 1];
  }
  const s = (f - 0.5) / 0.5;
  // bay ngược: smoothstep đi lên, ở phía sau, lật gương (nghịch hành)
  const e = s * s * (3 - 2 * s);
  return [-1, e, -1];
}

// ───────────── Vùng Dấu lặng ─────────────

/** túi im lặng: đảo góc Đông Bắc (31, −31) dưới Lồng Escher (sàn lồng ở y = 8) — không đè khu khác */
export const REST_ZONE = { x: 31, z: -31, y0: -3, y1: 7.4, inner: 2.6, outer: 7.5 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** mức "im lặng" 0…1 tại điểm (x, y, z): 1 trong lõi, giảm mượt ra tới vành ngoài và theo chiều cao */
export function restAmount(x: number, y: number, z: number): number {
  const Z = REST_ZONE;
  const d = Math.hypot(x - Z.x, z - Z.z);
  const radial = 1 - smooth(Z.inner, Z.outer, d);
  const vert = smooth(Z.y0 - 2, Z.y0, y) * (1 - smooth(Z.y1 - 1.5, Z.y1, y));
  return radial * vert;
}

// ───────────── Đĩa than mặt trời ─────────────

/** vòng quay đĩa theo nhịp: 1 vòng / ô nhịp (4 beat) — khoá nhịp, không đồng hồ riêng */
export const RECORD_BEATS_PER_TURN = 4;
export function recordAngle(beat: number): number {
  return -(beat / RECORD_BEATS_PER_TURN) * Math.PI * 2;
}
/**
 * Góc đích của cần kim (rad, quanh bản lề): trôi từ rãnh ngoài vào trong theo ô nhịp (8 ô / lượt), mỗi phách gõ nhẹ;
 * bất hoà → cào: nhảy rãnh theo stop-motion 8 Hz (giá trị giả ngẫu nhiên xác định theo stopTime).
 */
export function needleTarget(beat: number, stopTime: number, dissonance: number): number {
  const sweep = ((beat / 32) % 1) * 0.34;
  const tick = Math.max(0, Math.sin((beat % 1) * Math.PI * 2)) * 0.012;
  const k = Math.floor(stopTime * 8);
  const n = (Math.sin(k * 12.9898) * 43758.5453) % 1;
  const scratch = dissonance * 0.09 * (n - Math.floor(n) - 0.5);
  return -0.17 + sweep + tick + scratch;
}

// ───────────── Kết giới (màn chuyển vào màn) ─────────────

export const BARRIER_DUR = 1.5;
export const BARRIER_DUR_REDUCED = 0.45;
/**
 * Tiến độ 0…1 của kết giới sau `elapsed` giây (đã nhân tốc độ bỏ qua). reduced: chỉ mờ dần (ngắn).
 * Trả về null khi xong (gỡ lớp phủ).
 */
export function barrierProgress(elapsed: number, reduced: boolean): number | null {
  const dur = reduced ? BARRIER_DUR_REDUCED : BARRIER_DUR;
  const p = elapsed / dur;
  return p >= 1 ? null : Math.max(0, p);
}
