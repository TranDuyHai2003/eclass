/**
 * Nhạc nền render sẵn (scripts/audio-render.py → public/world/audio/*) — KIỂU DỮ LIỆU + LOGIC THUẦN.
 * CHƯA nối vào musicDirector (xem docs/ai-reviews/audio/PLAN.md §6 "Còn lại"): nhạc tạo sinh cũ vẫn chạy như trước.
 */

export interface StemRef {
  /** tên file không đuôi (public/world/audio/<f>.ogg | .m4a) */
  f: string;
  /** độ dài file (giây, gồm đuôi vang) */
  dur: number;
}

export interface TrackDef {
  id: string;
  bpm: number;
  beats: number;
  bars: number;
  slotBars: number;
  /** midi chủ âm */
  root: number;
  scale: number[];
  /** mỗi ô nhịp: lớp cao độ so với root (bè trầm trước) — cho MUSIC_KEY */
  chords: number[][];
  level: number;
  /** xác suất nghỉ của mỗi khe câu */
  rest: number;
  bed: StemRef | null;
  cells: (StemRef & { slot: number })[];
  layers: (StemRef & { param: string })[];
  glitch: StemRef[];
}

export interface StingerSprite {
  f: string;
  root: number;
  cues: Record<string, { at: number; dur: number }>;
}

export type MusicState = { night: number; boss: boolean };

export const barSec = (t: TrackDef) => (60 / t.bpm) * t.beats;
export const loopSec = (t: TrackDef) => barSec(t) * t.bars;

/** Chọn bản render cho cảnh (null = giữ nhạc tạo sinh cũ). prev: bản đang phát → trễ ngưỡng ngày / đêm 0,4 / 0,6 */
export function selectTrack(scene: string, st: MusicState, prev: string | null = null): string | null {
  if (st.boss && scene !== "siren" && scene !== "study") return "boss";
  const pick = (day: string, night: string) => {
    if (prev === day) return st.night > 0.6 ? night : day;
    if (prev === night) return st.night < 0.4 ? day : night;
    return st.night >= 0.5 ? night : day;
  };
  switch (scene) {
    case "hub":
      return pick("hubDay", "hubNight");
    case "expanse":
      return pick("expDay", "expNight");
    case "impossible":
    case "siren":
    case "archive":
    case "study":
      return scene;
    default:
      return null;
  }
}

/** Dịch giọng stinger (viết ở root) về chủ âm nhạc đang phát, trong khoảng −6…+5 nửa cung → tốc độ phát */
export function stingerRate(stingerRoot: number, keyRoot: number): number {
  const semis = ((((keyRoot - stingerRoot) % 12) + 18) % 12) - 6;
  return Math.pow(2, semis / 12);
}

/**
 * Bộ ghép câu: mỗi khe chọn một biến thể viết cho khe đó (không lặp lại biến thể vừa chơi ở khe ấy khi còn lựa chọn khác),
 * hoặc nghỉ với xác suất `rest` — nhưng không nghỉ hai lần liền ở cùng khe (tránh im quá lâu). Tất định theo rng.
 */
export class CellPlanner {
  private last = new Map<number, string | null>();
  constructor(
    private t: TrackDef,
    private rng: () => number,
  ) {}
  next(slot: number): string | null {
    const opts = this.t.cells.filter((c) => c.slot === slot);
    if (!opts.length) return null;
    const prev = this.last.get(slot);
    if (prev !== null && prev !== undefined && this.rng() < this.t.rest) {
      this.last.set(slot, null);
      return null;
    }
    const pool = opts.length > 1 && prev ? opts.filter((c) => c.f !== prev) : opts;
    const f = pool[Math.floor(this.rng() * pool.length) % pool.length].f;
    this.last.set(slot, f);
    return f;
  }
}

/**
 * Neo đồng hồ hình (HARMONIC.time) → đồng hồ AudioContext: offset = ctx − harmonic, làm mượt EMA;
 * lệch quá `jump` giây (tab ẩn, khựng) thì nhảy thẳng.
 */
export class ClockAnchor {
  offset = NaN;
  update(sample: number, alpha = 0.08, jump = 0.12): number {
    if (!Number.isFinite(this.offset) || Math.abs(sample - this.offset) > jump) this.offset = sample;
    else this.offset += (sample - this.offset) * alpha;
    return this.offset;
  }
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** trộn công suất không đổi giữa nền "sạch" và lớp bất hoà */
export function layerMix(d: number): { clean: number; dis: number } {
  const x = clamp01(d) * (Math.PI / 2);
  return { clean: Math.cos(x), dis: Math.sin(x) };
}
/** xác suất glitch mỗi ô nhịp theo dissonance (0 dưới 0,25) */
export function glitchChance(d: number): number {
  return d < 0.25 ? 0 : 0.35 * clamp01(d);
}
/** tần số cắt lọc thông thấp theo decomposition: 16 kHz (đủ hoạ âm) → 900 Hz (chỉ còn âm cơ bản) */
export function lowpassFor(dec: number): number {
  return 900 * Math.pow(16000 / 900, 1 - clamp01(dec));
}
