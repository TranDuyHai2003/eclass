"use client";

/**
 * Âm thanh giao diện — tổng hợp bằng Web Audio, không tải file.
 * - Chỉ tạo AudioContext sau cử chỉ đầu tiên (chính sách trình duyệt), âm lượng nhỏ.
 * - Bật/tắt lưu localStorage("sound"); mặc định bật. Đọc localStorage chỉ khi gọi (trong sự kiện/useEffect) → không lệch HTML.
 */
export type SoundName = "click" | "coin" | "success" | "levelup" | "tick" | "reveal-common" | "reveal-rare" | "reveal-epic" | "reveal-legendary" | "error" | "build" | "reveal" | "meow";

const KEY = "sound";
/** Âm lượng chung; mỗi tiếng có g tương đối → âm lượng thật bằng đúng mẫu (vd click 0,6 × 0,15 = 0,09) */
const MASTER = 0.15;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<(on: boolean) => void>();

export function isSoundOn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* bộ nhớ bị chặn → chỉ áp dụng trong phiên */
  }
  listeners.forEach((l) => l(on));
  if (on) play("click");
}

export function onSoundChange(l: (on: boolean) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface Note {
  f: number;
  t: number; // bắt đầu (giây, so với lúc gọi)
  d: number; // độ dài
  type?: OscillatorType;
  g?: number; // âm lượng tương đối
  f2?: number; // trượt tần số tới f2 (như canvas thiết kế)
}

function tone(notes: Note[]) {
  const c = getCtx();
  if (!c || !master) return;
  const now = c.currentTime;
  for (const n of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = n.type ?? "sine";
    o.frequency.setValueAtTime(n.f, now + n.t);
    if (n.f2) o.frequency.exponentialRampToValueAtTime(n.f2, now + n.t + n.d * 0.8);
    // Đường âm lượng y như mẫu: bật ngay ở mức đỉnh rồi tắt dần tới 0,001 (tính trên âm lượng thật = master × g)
    g.gain.setValueAtTime(n.g ?? 1, now + n.t);
    g.gain.exponentialRampToValueAtTime(0.001 / MASTER, now + n.t + n.d);
    o.connect(g).connect(master);
    o.start(now + n.t);
    o.stop(now + n.t + n.d + 0.02);
  }
}

const SOUNDS: Record<SoundName, Note[]> = {
  // Theo canvas thiết kế (Tiệm quà v2): bấm trượt 520→760 Hz, xu 2 nốt tam giác
  click: [{ f: 520, t: 0, d: 0.07, type: "sine", g: 0.6, f2: 760 }],
  coin: [
    { f: 880, t: 0, d: 0.25, type: "triangle", g: 0.8 },
    { f: 1174.66, t: 0.07, d: 0.25, type: "triangle", g: 0.8 },
  ],
  // Dựng hồi hộp khi sao băng bay (8 nốt đi lên), lật thẻ (5 nốt), meo (trượt 560→840 Hz)
  build: [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5].map((f, i) => ({ f, t: i * 0.24, d: 0.45, type: "sine" as const, g: 0.55 })),
  reveal: [523.25, 659.25, 783.99, 1046.5, 1318.5].map((f, i) => ({ f, t: i * 0.065, d: 0.55, type: "triangle" as const, g: 0.85 })),
  meow: [{ f: 560, t: 0, d: 0.3, type: "triangle", g: 0.8, f2: 840 }],
  success: [
    { f: 523, t: 0, d: 0.12, type: "triangle" },
    { f: 659, t: 0.1, d: 0.12, type: "triangle" },
    { f: 784, t: 0.2, d: 0.2, type: "triangle" },
    { f: 1047, t: 0.3, d: 0.35, type: "triangle" },
  ],
  levelup: [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].map((f, i) => ({ f, t: i * 0.11, d: 0.4, type: "triangle" as const, g: 0.8 })),
  tick: [{ f: 660, t: 0, d: 0.04, type: "square", g: 0.3 }],
  "reveal-common": [
    { f: 587, t: 0, d: 0.12, type: "triangle" },
    { f: 784, t: 0.1, d: 0.25, type: "triangle" },
  ],
  "reveal-rare": [
    { f: 659, t: 0, d: 0.1, type: "triangle" },
    { f: 880, t: 0.1, d: 0.1, type: "triangle" },
    { f: 1175, t: 0.2, d: 0.3, type: "triangle" },
  ],
  "reveal-epic": [
    { f: 523, t: 0, d: 0.1, type: "sawtooth", g: 0.4 },
    { f: 784, t: 0.1, d: 0.1, type: "sawtooth", g: 0.4 },
    { f: 1047, t: 0.2, d: 0.1, type: "sawtooth", g: 0.4 },
    { f: 1568, t: 0.3, d: 0.45, type: "triangle" },
  ],
  "reveal-legendary": [
    { f: 523, t: 0, d: 0.12, type: "triangle" },
    { f: 659, t: 0.1, d: 0.12, type: "triangle" },
    { f: 784, t: 0.2, d: 0.12, type: "triangle" },
    { f: 1047, t: 0.3, d: 0.12, type: "triangle" },
    { f: 1319, t: 0.4, d: 0.5, type: "sine" },
    { f: 1568, t: 0.4, d: 0.5, type: "sine", g: 0.6 },
    { f: 2093, t: 0.55, d: 0.7, type: "sine", g: 0.5 },
  ],
  error: [{ f: 220, t: 0, d: 0.18, type: "square", g: 0.35, f2: 160 }],
};

/** Phát một tiếng (im lặng nếu người dùng tắt loa, trình duyệt không hỗ trợ, hoặc đang render ở server) */
export function play(name: SoundName) {
  if (!isSoundOn()) return;
  try {
    tone(SOUNDS[name]);
  } catch {
    /* bỏ qua lỗi audio */
  }
}

/** Rung nhẹ trên điện thoại (như canvas thiết kế); im lặng khi tắt loa hoặc máy không hỗ trợ */
export function buzz(pattern: number | number[]) {
  if (!isSoundOn()) return;
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* bỏ qua */
  }
}
