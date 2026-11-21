"use client";

/**
 * Âm thanh giao diện — tổng hợp bằng Web Audio, không tải file.
 * - Chỉ tạo AudioContext sau cử chỉ đầu tiên (chính sách trình duyệt), âm lượng nhỏ.
 * - Bật/tắt lưu localStorage("sound"); mặc định bật. Đọc localStorage chỉ khi gọi (trong sự kiện/useEffect) → không lệch HTML.
 */
export type SoundName = "click" | "coin" | "success" | "levelup" | "tick" | "reveal-common" | "reveal-rare" | "reveal-epic" | "reveal-legendary" | "error";

const KEY = "sound";
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
    master.gain.value = 0.15;
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
    g.gain.setValueAtTime(0.0001, now + n.t);
    g.gain.exponentialRampToValueAtTime(n.g ?? 1, now + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    o.connect(g).connect(master);
    o.start(now + n.t);
    o.stop(now + n.t + n.d + 0.02);
  }
}

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ f: 880, t: 0, d: 0.06, type: "triangle", g: 0.6 }],
  coin: [
    { f: 1568, t: 0, d: 0.09, type: "square", g: 0.35 },
    { f: 2093, t: 0.07, d: 0.18, type: "square", g: 0.35 },
  ],
  success: [
    { f: 523, t: 0, d: 0.12, type: "triangle" },
    { f: 659, t: 0.1, d: 0.12, type: "triangle" },
    { f: 784, t: 0.2, d: 0.2, type: "triangle" },
    { f: 1047, t: 0.3, d: 0.35, type: "triangle" },
  ],
  levelup: [
    { f: 392, t: 0, d: 0.15, type: "triangle" },
    { f: 523, t: 0.12, d: 0.15, type: "triangle" },
    { f: 659, t: 0.24, d: 0.15, type: "triangle" },
    { f: 784, t: 0.36, d: 0.3, type: "triangle" },
    { f: 1047, t: 0.5, d: 0.5, type: "sine" },
    { f: 1319, t: 0.5, d: 0.5, type: "sine", g: 0.5 },
  ],
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
  error: [
    { f: 220, t: 0, d: 0.12, type: "square", g: 0.4 },
    { f: 165, t: 0.12, d: 0.2, type: "square", g: 0.4 },
  ],
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
