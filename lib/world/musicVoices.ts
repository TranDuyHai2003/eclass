/**
 * Âm thanh — LOGIC THUẦN dùng chung cho hiệu ứng (SFX) và nhạc nền (test được, không WebAudio):
 *  - VoicePool: giới hạn số giọng theo nhóm + tổng, ưu tiên, cướp giọng cũ nhất / yếu nhất, gộp đòn trùng khung;
 *  - biến thiên cao độ / âm sắc (cent, ±dB), xoay vòng không lặp liền;
 *  - nguyên tố của vũ khí / phép (lớp âm đặc trưng) và công thức lớp transient / body / tail;
 *  - ducking nhạc nền (giảm dB có giới hạn).
 * Số liệu theo nghiên cứu Codex 2026-11 (docs/ai-reviews/game-3d/AUDIO.md §5).
 */
import type { Rng } from "./music";

// ───────────── Giới hạn giọng ─────────────

export type VoiceCat = "hit" | "swing" | "spell" | "impact" | "move" | "ui" | "ambient" | "music";
/** Trần số giọng mỗi nhóm (một "giọng" = một sự kiện âm thanh, có thể gồm vài oscillator) */
export const VOICE_CAPS: Record<VoiceCat, number> = { hit: 6, swing: 3, spell: 4, impact: 3, move: 3, ui: 3, ambient: 4, music: 12 };
/** Trần tổng của hiệu ứng (không tính nhạc) */
export const SFX_CAP = 20;
/** Đòn trùng nhóm trong khoảng này (s) bị gộp: nhỏ dần 1/√k, quá COALESCE_MAX thì bỏ */
export const COALESCE_S = 0.035;
export const COALESCE_MAX = 3;

export type Grant = { id: number; gain: number; steal: number[] } | null;
type Live = { id: number; cat: VoiceCat; prio: number; start: number; end: number };

export class VoicePool {
  private live: Live[] = [];
  private seq = 0;
  constructor(
    private caps: Record<VoiceCat, number> = VOICE_CAPS,
    private total = SFX_CAP,
  ) {}

  /** dọn giọng đã hết */
  prune(now: number) {
    if (this.live.some((v) => v.end <= now)) this.live = this.live.filter((v) => v.end > now);
  }
  count(cat?: VoiceCat): number {
    return cat ? this.live.filter((v) => v.cat === cat).length : this.live.filter((v) => v.cat !== "music").length;
  }

  /**
   * Xin một giọng. prio cao hơn = quan trọng hơn (đòn trúng của mình 3, nguy hiểm 4, trang trí 1).
   * Trả về id + hệ số âm lượng (gộp trùng) + danh sách giọng phải tắt nhanh (cướp); null = bỏ.
   */
  request(cat: VoiceCat, prio: number, now: number, dur: number): Grant {
    this.prune(now);
    const steal: number[] = [];
    // gộp: nhiều đòn cùng nhóm trong cùng ~1 khung hình (vd. đòn vùng trúng 8 quái) → không cộng dồn thành tiếng nổ to
    const near = this.live.filter((v) => v.cat === cat && now - v.start < COALESCE_S).length;
    if (cat !== "music" && near >= COALESCE_MAX) return null;
    const gain = near ? 1 / Math.sqrt(near + 1) : 1;
    // trần nhóm: cướp giọng cũ nhất của nhóm (nếu không quan trọng hơn giọng mới)
    const mine = this.live.filter((v) => v.cat === cat);
    if (mine.length >= this.caps[cat]) {
      const victim = mine.filter((v) => v.prio <= prio).sort((a, b) => a.start - b.start)[0];
      if (!victim) return null;
      steal.push(victim.id);
      this.live = this.live.filter((v) => v !== victim);
    }
    // trần tổng (chỉ hiệu ứng): cướp giọng ưu tiên thấp nhất, cũ nhất
    if (cat !== "music" && this.count() >= this.total) {
      const victim = this.live.filter((v) => v.cat !== "music" && v.prio <= prio).sort((a, b) => a.prio - b.prio || a.start - b.start)[0];
      if (!victim) return null;
      steal.push(victim.id);
      this.live = this.live.filter((v) => v !== victim);
    }
    const id = ++this.seq;
    this.live.push({ id, cat, prio, start: now, end: now + Math.max(0.02, dur) });
    return { id, gain, steal };
  }

  release(id: number) {
    this.live = this.live.filter((v) => v.id !== id);
  }
}

// ───────────── Biến thiên ─────────────

/** Hệ số tần số lệch ngẫu nhiên ±cents */
export const centsJitter = (rng: Rng, cents: number) => Math.pow(2, ((rng() * 2 - 1) * cents) / 1200);
/** Hệ số âm lượng lệch ngẫu nhiên ±dB */
export const dbJitter = (rng: Rng, db: number) => Math.pow(10, ((rng() * 2 - 1) * db) / 20);
/** Chọn chỉ số 0…n−1 khác lần trước (xoay vòng ngẫu nhiên không lặp liền) */
export function pickNoRepeat(rng: Rng, n: number, last: number): number {
  if (n <= 1) return 0;
  const k = Math.floor(rng() * (n - 1));
  return k >= last && last >= 0 ? k + 1 : k;
}
export const dbToGain = (db: number) => Math.pow(10, db / 20);

// ───────────── Ducking nhạc nền ─────────────

/** Giảm nhạc khi có đòn lớn: 3–5 dB theo sức mạnh, cộng dồn nhưng kẹp tối đa 6 dB */
export const DUCK = { attack: 0.008, hold: 0.04, release: 0.2, maxDb: 6 };
export function duckDb(power: number, currentDb = 0): number {
  const add = Math.max(0, Math.min(5, 3 + 2 * (power - 1)));
  return Math.min(DUCK.maxDb, Math.max(currentDb, add) + (currentDb > 0 ? 1 : 0));
}

// ───────────── Nguyên tố ─────────────

export type Element = "steel" | "wind" | "wave" | "earth" | "time" | "lightning" | "nature" | "light" | "fire" | "ice" | "void" | "arcane";

/** Vũ khí → nguyên tố (theo tính chất toán / lý của vũ khí) */
export const WEAPON_ELEMENT: Record<string, Element> = {
  blade: "steel", // lưỡi kiếm: kim loại sáng
  bow: "wind", // cung parabol: gió rít
  staff: "wave", // trượng Fourier: sóng
  lever: "earth", // đòn bẩy: mô-men, trầm nặng
  pendulum: "time", // con lắc: tích tắc chu kỳ
  coil: "lightning", // cuộn cảm: điện
  spiral: "nature", // xoắn Fibonacci: lá, gỗ
  prism: "light", // lăng kính: thuỷ tinh, ánh sáng
  lance: "wave", // giáo sin: sóng chạy
  shield: "time", // khiên con lắc: tích tắc chu kỳ
};

/** Phép (ký hiệu vẽ) → nguyên tố */
export const SPELL_ELEMENT: Record<string, Element> = {
  shield: "ice", // vòng tròn: khiên pha lê
  bolt: "lightning", // zigzag
  vortex: "void", // xoắn ốc: chân trời sự kiện
  meteor: "fire", // parabol: thiên thạch
  wave: "wave", // sin
};

/**
 * Công thức lớp âm cho mỗi nguyên tố (số liệu khởi đầu, chỉnh bằng tai):
 *  transient 5–15 ms nhiễu lọc dải (tần số tâm, Q);
 *  body: dao động (kiểu sóng, tần số đầu → cuối, ms) hoặc mode kim loại / thuỷ tinh (tỉ lệ không nguyên);
 *  tail: dài (ms) + lượng gửi vang; extra: lớp riêng (lách tách lửa, nổ điện, bọt nước…).
 */
export type ElementRecipe = {
  tr: { hz: number; q: number; ms: number; db: number };
  body: { wave: OscillatorType; f0: number; f1: number; ms: number; db: number; modes?: number[] };
  tail: { ms: number; send: number };
  extra?: "crackle" | "zap" | "bubble" | "tick" | "rustle" | "sparkle" | "whoosh" | "suck" | "thud";
};
export const ELEMENTS: Record<Element, ElementRecipe> = {
  steel: { tr: { hz: 5200, q: 1.2, ms: 10, db: -4 }, body: { wave: "triangle", f0: 240, f1: 120, ms: 70, db: -6, modes: [1, 2.76, 5.4] }, tail: { ms: 260, send: 0.25 }, extra: "sparkle" },
  wind: { tr: { hz: 3800, q: 0.9, ms: 8, db: -6 }, body: { wave: "sine", f0: 200, f1: 110, ms: 60, db: -8 }, tail: { ms: 160, send: 0.2 }, extra: "whoosh" },
  wave: { tr: { hz: 2600, q: 1.5, ms: 10, db: -7 }, body: { wave: "sine", f0: 520, f1: 180, ms: 120, db: -6 }, tail: { ms: 320, send: 0.4 }, extra: "bubble" },
  earth: { tr: { hz: 1800, q: 0.8, ms: 14, db: -4 }, body: { wave: "triangle", f0: 130, f1: 55, ms: 110, db: -3, modes: [1, 1.74, 2.83] }, tail: { ms: 220, send: 0.15 }, extra: "thud" },
  time: { tr: { hz: 4200, q: 4, ms: 6, db: -6 }, body: { wave: "sine", f0: 880, f1: 860, ms: 90, db: -9, modes: [1, 2.01, 3.03] }, tail: { ms: 420, send: 0.4 }, extra: "tick" },
  lightning: { tr: { hz: 6000, q: 0.7, ms: 6, db: -3 }, body: { wave: "square", f0: 180, f1: 70, ms: 90, db: -12 }, tail: { ms: 260, send: 0.3 }, extra: "zap" },
  nature: { tr: { hz: 2200, q: 1.1, ms: 12, db: -6 }, body: { wave: "triangle", f0: 300, f1: 200, ms: 80, db: -7, modes: [1, 2.3, 3.9] }, tail: { ms: 200, send: 0.25 }, extra: "rustle" },
  light: { tr: { hz: 7000, q: 2, ms: 6, db: -6 }, body: { wave: "sine", f0: 1320, f1: 1320, ms: 100, db: -10, modes: [1, 1.63, 2.47, 3.88] }, tail: { ms: 480, send: 0.5 }, extra: "sparkle" },
  fire: { tr: { hz: 1400, q: 0.7, ms: 14, db: -3 }, body: { wave: "sawtooth", f0: 110, f1: 50, ms: 140, db: -12 }, tail: { ms: 340, send: 0.25 }, extra: "crackle" },
  ice: { tr: { hz: 6500, q: 3, ms: 6, db: -6 }, body: { wave: "sine", f0: 2100, f1: 2100, ms: 100, db: -11, modes: [1, 1.62, 2.31] }, tail: { ms: 380, send: 0.45 }, extra: "sparkle" },
  void: { tr: { hz: 900, q: 0.8, ms: 12, db: -6 }, body: { wave: "sine", f0: 160, f1: 40, ms: 200, db: -4 }, tail: { ms: 520, send: 0.5 }, extra: "suck" },
  arcane: { tr: { hz: 4800, q: 2, ms: 8, db: -7 }, body: { wave: "triangle", f0: 660, f1: 660, ms: 120, db: -9 }, tail: { ms: 300, send: 0.45 }, extra: "sparkle" },
};

export function weaponElement(id: string | undefined): Element {
  return (id && WEAPON_ELEMENT[id]) || "steel";
}
export function spellElement(id: string | undefined): Element {
  return (id && SPELL_ELEMENT[id]) || "arcane";
}

/** Trúng đòn: lớp nào được bật theo sức nặng (0 thường · 1 nặng · 2 chí mạng) — chí mạng thêm glint cao + sub trầm */
export function hitLayers(power: 0 | 1 | 2): { transient: boolean; body: boolean; tail: boolean; glint: boolean; sub: boolean; duck: number } {
  return { transient: true, body: true, tail: power >= 1, glint: power === 2, sub: power === 2, duck: power === 2 ? 1.2 : 0 };
}

/**
 * Lớp nhạc chiến đấu: mẫu 16 phách (trống trầm, trống lẫy, hi-hat — 0..1 = độ mạnh; bass = bậc trong hợp âm hoặc null).
 * Cường độ chiến đấu tắt dần theo hàm mũ, bán rã ~2,8 s (≈ 8 s về mức lặng).
 */
export const COMBAT_PATTERN = {
  kick: [1, 0, 0, 0, 0, 0, 0.6, 0, 1, 0, 0.5, 0, 0, 0, 0, 0],
  snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.4],
  hat: [0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 1],
  bass: [0, null, null, 0, null, null, 1, null, 0, null, null, 0, null, 2, null, null] as (number | null)[],
};
export const COMBAT_HALF_LIFE = 2.8;
export function combatDecay(k: number, dtSec: number): number {
  return k * Math.pow(0.5, Math.max(0, dtSec) / COMBAT_HALF_LIFE);
}
