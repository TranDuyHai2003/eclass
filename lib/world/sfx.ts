"use client";
/**
 * Âm thanh tổng hợp bằng WebAudio (không file, không bản quyền): chuông phép, vút, trúng đòn, khiên, vỡ khiên, thất bại, bước chân.
 * Tắt được (localStorage "world.sfx" = "off").
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem("world.sfx") === "off") return null;
  } catch {}
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    // Vang nhẹ cho cảm giác "phép thuật"
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, t0: number, dur: number, type: OscillatorType = "sine", vol = 0.2, glideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + t0 + dur);
  g.gain.setValueAtTime(0, c.currentTime + t0);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(c.currentTime + t0);
  o.stop(c.currentTime + t0 + dur + 0.05);
}

function noise(t0: number, dur: number, vol = 0.2, from = 4000, to = 300, q = 1) {
  const c = ac();
  if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(from, c.currentTime + t0);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(c.currentTime + t0);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

/** Tiếng hát cá voi: sóng sin trầm lượn lên xuống + rung (vibrato) + bồi âm mờ */
function whaleSong(vol: number) {
  const c = ac();
  if (!c || !master) return;
  const now = c.currentTime;
  const mk = (f0: number, f1: number, f2: number, t0: number, dur: number, v: number) => {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, now + t0);
    o.frequency.exponentialRampToValueAtTime(f1, now + t0 + dur * 0.45);
    o.frequency.exponentialRampToValueAtTime(f2, now + t0 + dur);
    lfo.frequency.value = 5.5;
    lg.gain.value = f0 * 0.012;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, now + t0);
    g.gain.exponentialRampToValueAtTime(v, now + t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(g);
    g.connect(master!);
    o.start(now + t0);
    lfo.start(now + t0);
    o.stop(now + t0 + dur + 0.1);
    lfo.stop(now + t0 + dur + 0.1);
  };
  mk(180, 340, 220, 0, 2.6, vol);
  mk(360, 680, 440, 0.05, 2.5, vol * 0.25);
  mk(260, 150, 190, 2.4, 2.2, vol * 0.8);
}

export const sfx = {
  /** Vút gió khi vung vũ khí (heavy: trầm, dài hơn) */
  swing(heavy = false) {
    noise(0, heavy ? 0.34 : 0.2, heavy ? 0.2 : 0.13, heavy ? 1500 : 3600, heavy ? 260 : 800, 0.9);
  },
  /** Tiếng đập khi trúng đòn nặng: thump trầm + vỡ giòn */
  impact(power = 1) {
    tone(95, 0, 0.28, "sine", 0.4 * power, 42);
    noise(0, 0.14, 0.28 * power, 1400, 180, 1.1);
    tone(PENTA[2] * 2, 0.01, 0.35, "triangle", 0.08 * power);
  },
  /** Chuỗi hoà âm: hoạ âm bậc n của nốt gốc 110 Hz (f, 2f, 3f… — Pythagoras: tỉ số nguyên nghe "thuận tai") */
  harmonic(n: number) {
    tone(110 * n, 0, 1.6, "sine", 0.2);
    tone(110 * n * 2, 0, 0.9, "triangle", 0.05);
  },
  /** Cá voi sao cất tiếng (vol theo khoảng cách) */
  whale(vol = 0.12) {
    whaleSong(vol);
  },
  /** Chòm sao hoàn thành: chuỗi chuông ngũ cung dài đi lên + nền trầm */
  constellation() {
    for (let i = 0; i < 10; i++) tone(PENTA[i % PENTA.length] * (i >= 8 ? 2 : 1), i * 0.11, 1.2, "triangle", 0.13);
    tone(130.81, 0, 3.5, "sine", 0.18);
    tone(196, 0.4, 3.2, "sine", 0.1);
  },
  /** Mở khoá / đúng: chuỗi chuông ngũ cung đi lên */
  chime(level = 0) {
    for (let i = 0; i < 4; i++) tone(PENTA[(i + level) % PENTA.length] * (i > 3 ? 2 : 1), i * 0.07, 0.6, "triangle", 0.16);
    tone(PENTA[(level + 4) % PENTA.length] * 2, 0.3, 1.2, "sine", 0.08);
  },
  /** Vòng phép hiện lên */
  circle() {
    tone(220, 0, 0.9, "sawtooth", 0.04, 440);
    tone(330, 0.05, 0.9, "triangle", 0.06, 660);
    noise(0, 0.6, 0.06, 800, 6000, 3);
  },
  /** Tung phép (vút) */
  cast() {
    noise(0, 0.25, 0.25, 6000, 600, 0.8);
    tone(880, 0, 0.25, "square", 0.05, 1760);
  },
  /** Trúng đòn — kèm "khựng hình" phía hình ảnh */
  hit(combo = 0) {
    noise(0, 0.18, 0.4, 2500, 200, 0.7);
    tone(110 + combo * 20, 0, 0.2, "square", 0.12, 55);
    tone(PENTA[combo % PENTA.length] * 2, 0.02, 0.25, "triangle", 0.1);
  },
  /** Khiên đỡ đòn */
  shield() {
    tone(1200, 0, 0.35, "sine", 0.12, 900);
    tone(1800, 0, 0.3, "sine", 0.06, 1400);
    noise(0, 0.2, 0.08, 7000, 3000, 6);
  },
  /** Khiên vỡ / thuần hoá thành công */
  shatter() {
    for (let i = 0; i < 6; i++) tone(1500 + Math.random() * 2500, i * 0.025, 0.25, "triangle", 0.06);
    noise(0, 0.5, 0.25, 8000, 500, 0.5);
    setTimeout(() => sfx.chime(2), 250);
  },
  /** Sai */
  miss() {
    tone(330, 0, 0.25, "triangle", 0.12, 220);
    tone(247, 0.12, 0.35, "triangle", 0.1, 165);
  },
  step() {
    noise(0, 0.06, 0.05, 1200, 400, 2);
  },
  click() {
    tone(1320, 0, 0.06, "sine", 0.08);
  },
  /** Trống dồn (game show): các nhịp nhiễu dày dần + mạnh dần, kết bằng một cú chũm choẹ */
  drumroll(dur = 1.2) {
    const n = Math.round(dur * 26);
    for (let i = 0; i < n; i++) noise(i * (dur / n), 0.05, 0.05 + 0.18 * (i / n), 1800, 500, 1.5);
    noise(dur, 0.7, 0.28, 9000, 2500, 0.6);
  },
  /** Kèn chiến thắng: hợp âm rải trưởng đi lên + hợp âm ngân */
  fanfare() {
    const n = [523.25, 659.25, 783.99, 1046.5];
    n.forEach((f, i) => tone(f, i * 0.11, 0.3, "square", 0.06));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, 0.48, 1.3, "sawtooth", 0.035));
    tone(1318.51, 0.48, 1.3, "triangle", 0.07);
  },
  /** Tiếng dê "be-e-e": răng cưa có rung tần số, lọc formant */
  baa() {
    const c = ac();
    if (!c || !master) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(420, t0);
    o.frequency.linearRampToValueAtTime(380, t0 + 0.7);
    const lfo = c.createOscillator();
    lfo.frequency.value = 9;
    const lg = c.createGain();
    lg.gain.value = 22;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1100;
    f.Q.value = 2.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.22, t0 + 0.05);
    g.gain.setValueAtTime(0.22, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 0.85);
    lfo.stop(t0 + 0.85);
  },
  /** Búa gõ gỗ (đóng ván): hai nhịp gỗ khô */
  knock() {
    for (let i = 0; i < 2; i++) {
      tone(190 - i * 30, i * 0.14, 0.09, "square", 0.09, 120);
      noise(i * 0.14, 0.07, 0.18, 2600, 900, 2);
    }
  },
  /** Cửa sân khấu kẽo kẹt mở */
  creak() {
    tone(140, 0, 0.5, "sawtooth", 0.04, 95);
    noise(0, 0.45, 0.06, 900, 300, 6);
  },
  /**
   * "The Fold" — glissando Shepard–Risset: 7 sóng sin cách nhau một quãng tám cùng trượt lên; biên độ theo hình chuông
   * trên trục log-tần số nên âm thanh như đi lên mãi mà không bao giờ cao hơn (ảo giác thính giác). + tiếng ầm gió nền.
   */
  fold(dur = 4.8) {
    const c = ac();
    if (!c || !master) return;
    const t0 = c.currentTime;
    const N = 7;
    const base = 55;
    const steps = 48;
    for (let i = 0; i < N; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      g.gain.setValueAtTime(0, t0);
      for (let k = 0; k <= steps; k++) {
        const tt = (k / steps) * dur;
        // vị trí trên vòng quãng tám 0..N (trôi lên 1,5 quãng tám trong suốt chuyến)
        const pos = (i + (1.5 * tt) / dur) % N;
        o.frequency.setValueAtTime(base * Math.pow(2, pos), t0 + tt);
        const bell = Math.exp(-Math.pow((pos - N / 2) / 1.3, 2));
        const env = Math.min(1, tt / 0.4, (dur - tt) / 0.6);
        g.gain.linearRampToValueAtTime(0.05 * bell * Math.max(0, env), t0 + tt);
      }
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    }
    noise(0, dur, 0.09, 200, 2400, 0.6);
    // cửa chớp đóng sập giữa chuyến
    setTimeout(() => {
      tone(70, 0, 0.5, "square", 0.12, 40);
      noise(0, 0.3, 0.3, 3000, 200, 0.8);
    }, dur * 470);
  },
};

export function setSfxEnabled(on: boolean) {
  try {
    localStorage.setItem("world.sfx", on ? "on" : "off");
  } catch {}
}
export function isSfxEnabled(): boolean {
  try {
    return localStorage.getItem("world.sfx") !== "off";
  } catch {
    return true;
  }
}

/**
 * Gió khi bay: một vòng nhiễu → lọc dải (tần số tăng theo tốc độ) → âm lượng theo tốc độ.
 * level 0…1 (0 = tắt dần). Gọi mỗi khung hình cũng được — chỉ đặt mục tiêu (setTargetAtTime), không tạo nút mới.
 */
let wind: { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode } | null = null;
export function setWind(level: number) {
  const c = level > 0.01 || wind ? ac() : null;
  if (!c || !master) return;
  if (!wind) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    // nhiễu "hồng" thô (lọc thông thấp một cực) cho tiếng gió ấm, không rít
    let last = 0;
    for (let i = 0; i < len; i++) d[i] = last = last * 0.96 + (Math.random() * 2 - 1) * 0.2;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp);
    bp.connect(g);
    g.connect(master);
    src.start();
    wind = { src, bp, g };
  }
  const L = Math.max(0, Math.min(1, level));
  wind.g.gain.setTargetAtTime(L * 0.55, c.currentTime, 0.25);
  wind.bp.frequency.setTargetAtTime(260 + L * 1500, c.currentTime, 0.3);
}
