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
