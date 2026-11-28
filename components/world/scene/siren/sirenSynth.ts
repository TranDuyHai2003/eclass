"use client";
/**
 * Bộ tổng hợp âm thanh của Mê cung Hoạ âm — WebAudio thuần (không file, không AudioWorklet → chạy cả iOS Safari).
 *  - dây gảy (đàn một dây): cộng các hoạ âm n·f với biên độ ~1/n, mỗi hoạ âm tắt nhanh dần theo n (dây thật mất cao tần trước),
 *    hơi lệch thành phần (inharmonicity B nhỏ) cho tiếng ấm;
 *  - chuông / chuông con lắc: hoạ âm KHÔNG nguyên (tỉ lệ kiểu chuông đúc: 0,5 · 1 · 1,183 · 1,506 · 2 · 2,514 · 2,662 · 3,011…);
 *  - va chạm theo vật liệu (tổng hợp mode): giấy / gỗ / kim loại / thuỷ tinh — tập tần số mode + thời gian tắt riêng,
 *    kích bằng một xung nhiễu ngắn qua bộ lọc dải; tiếng nảy cao / to theo vận tốc chạm;
 *  - vút Doppler khi qua cổng / lỗ sâu: nhiễu lọc + dao động trượt tần (lên khi lao tới, xuống khi rời xa);
 *  - quái bất hoà: cụm hai thứ / tam cung lệch nhẹ tạo phách + điều chế vòng; khi bị giải → hợp âm trưởng thuần (4:5:6);
 *  - kênh chính: nén / giới hạn (DynamicsCompressor) + vang rẻ bằng mạng trễ hồi tiếp 3 nhánh (không convolution);
 *    giới hạn số giọng đồng thời; âm lượng / tắt riêng (localStorage), tôn trọng công tắc âm thanh chung "world.sfx".
 */

import { sfxInput, sharedContext } from "../../audio/engine";

const KEY_VOL = "world.siren.vol";
let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let wet: GainNode | null = null;
let voices = 0;
const MAX_VOICES = 24;

/** Âm lượng riêng mê cung (0…1); 0 = tắt */
export function sirenVolume(): number {
  try {
    const v = Number(localStorage.getItem(KEY_VOL));
    return Number.isFinite(v) && localStorage.getItem(KEY_VOL) !== null ? Math.max(0, Math.min(1, v)) : 0.8;
  } catch {
    return 0.8;
  }
}
export function setSirenVolume(v: number) {
  try {
    localStorage.setItem(KEY_VOL, String(Math.max(0, Math.min(1, v))));
  } catch {}
  if (out && ctx) out.gain.setTargetAtTime(Math.max(0, Math.min(1, v)) * 0.6, ctx.currentTime, 0.05);
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem("world.sfx") === "off") return null;
  } catch {}
  const vol = sirenVolume();
  if (vol <= 0) return null;
  if (!ctx) {
    // một AudioContext dùng chung với hiệu ứng / nhạc nền (components/world/audio/engine.ts) — chỉ có sau thao tác người dùng
    const shared = sharedContext();
    const bus = sfxInput();
    if (!shared || !bus) return null;
    ctx = shared;
    // giới hạn đỉnh + nén nhẹ để nhiều giọng cùng lúc không vỡ tiếng
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(bus);
    out = ctx.createGain();
    out.gain.value = vol * 0.6;
    out.connect(comp);
    // vang rẻ: 3 đường trễ hồi tiếp lệch nhau (gần như mạng trễ hồi tiếp), lọc thông thấp trong vòng cho đuôi ấm
    wet = ctx.createGain();
    wet.gain.value = 0.22;
    for (const [d, fb] of [
      [0.0297, 0.62],
      [0.0371, 0.58],
      [0.0411, 0.55],
    ] as const) {
      const dl = ctx.createDelay(0.2);
      dl.delayTime.value = d * 3.1;
      const g = ctx.createGain();
      g.gain.value = fb;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3800;
      wet.connect(dl);
      dl.connect(lp);
      lp.connect(g);
      g.connect(dl);
      lp.connect(out);
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Một giọng: trả về nút đích (đã nối ra kênh khô + vang) hoặc null nếu quá số giọng */
function voice(c: AudioContext, dur: number, send = 0.5): GainNode | null {
  if (voices >= MAX_VOICES || !out || !wet) return null;
  voices++;
  setTimeout(() => voices--, (dur + 0.2) * 1000);
  const g = c.createGain();
  g.connect(out);
  if (send > 0) {
    const s = c.createGain();
    s.gain.value = send;
    g.connect(s);
    s.connect(wet);
  }
  return g;
}

function partial(c: AudioContext, dest: AudioNode, f: number, amp: number, t0: number, decay: number, type: OscillatorType = "sine", attack = 0.004) {
  if (f > 16000 || amp < 1e-4) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(amp, t0 + attack);
  g.gain.exponentialRampToValueAtTime(1e-4, t0 + decay);
  o.connect(g);
  g.connect(dest);
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
  o.start(t0);
  o.stop(t0 + decay + 0.05);
}

function noiseBurst(c: AudioContext, dest: AudioNode, t0: number, dur: number, f: number, q: number, amp: number) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.value = amp;
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.onended = () => {
    src.disconnect();
    bp.disconnect();
    g.disconnect();
  };
  src.start(t0);
}

export const synth = {
  /** Dây gảy tần số f (Hz), lực gảy 0…1, độ dài ngân (s) */
  pluck(f: number, vel = 0.7, dur = 2.2, delay = 0) {
    const c = ac();
    if (!c) return;
    const g = voice(c, dur + delay, 0.45);
    if (!g) return;
    const t0 = c.currentTime + delay;
    const B = 0.00025;
    for (let n = 1; n <= 8; n++) {
      const fn = n * f * Math.sqrt(1 + B * n * n);
      partial(c, g, fn, (0.22 * vel) / n, t0, dur / (0.6 + n * 0.45), n === 1 ? "triangle" : "sine", 0.002);
    }
    noiseBurst(c, g, t0, 0.02, f * 3, 2, 0.08 * vel);
  },
  /** Hai nốt cùng lúc (quãng) — nghe thấy phách nếu lệch */
  interval(f1: number, f2: number, vel = 0.6) {
    synth.pluck(f1, vel, 2.6);
    synth.pluck(f2, vel * 0.9, 2.6, 0.04);
  },
  /** Chuông (hoạ âm không nguyên kiểu chuông đúc) */
  bell(f: number, vel = 0.6, dur = 4) {
    const c = ac();
    if (!c) return;
    const g = voice(c, dur, 0.7);
    if (!g) return;
    const t0 = c.currentTime;
    const R: [number, number, number][] = [
      [0.5, 0.35, 1],
      [1, 0.5, 0.8],
      [1.183, 0.3, 0.6],
      [1.506, 0.25, 0.5],
      [2, 0.22, 0.45],
      [2.514, 0.14, 0.35],
      [2.662, 0.12, 0.3],
      [3.011, 0.1, 0.25],
      [4.166, 0.06, 0.18],
    ];
    for (const [r, a, dk] of R) partial(c, g, f * r, a * vel * 0.3, t0, dur * dk, "sine", 0.002);
    noiseBurst(c, g, t0, 0.03, f * 4, 3, 0.1 * vel);
  },
  /** Hợp âm thuần (tỉ lệ 4:5:6 = hợp âm trưởng) rải nhẹ */
  chord(root: number, ratios: number[] = [1, 5 / 4, 3 / 2, 2], vel = 0.6) {
    ratios.forEach((r, i) => synth.pluck(root * r, vel * (1 - i * 0.1), 3, i * 0.06));
  },
  /**
   * Va chạm theo vật liệu (tổng hợp mode): một xung nhiễu ~4 ms kích các bộ lọc dải song song, mỗi dải là một mode
   * (tỉ lệ tần số, thời gian tắt −60 dB, trọng số). Q suy từ thời gian tắt. speed (m/s) quyết định độ to / độ sáng.
   */
  impact(material: "paper" | "wood" | "metal" | "glass", speed = 5) {
    const c = ac();
    if (!c || speed < 0.15) return;
    const M: Record<string, [number, [number, number, number][]]> = {
      wood: [320, [[1, 0.09, 1], [1.74, 0.06, 0.65], [2.83, 0.035, 0.4]]],
      metal: [520, [[1, 0.52, 1], [1.49, 0.38, 0.7], [2.14, 0.27, 0.5], [3.79, 0.15, 0.3]]],
      paper: [750, [[1, 0.012, 0.5], [2.2, 0.007, 1], [4.6, 0.004, 0.7]]],
      glass: [880, [[1, 0.32, 1], [1.63, 0.22, 0.7], [2.47, 0.13, 0.45], [3.88, 0.07, 0.25]]],
    };
    const [base, bands] = M[material];
    const u = Math.min(1, speed / 6);
    const g = voice(c, 0.6, 0.25);
    if (!g) return;
    const t0 = c.currentTime + 0.005;
    const len = Math.floor(c.sampleRate * 0.005);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const owned: AudioNode[] = [];
    for (const [r, t60, w] of bands) {
      const f = base * r * (0.9 + 0.25 * u);
      const alpha = Math.tanh(Math.log(1000) / (c.sampleRate * t60));
      const Q = Math.max(0.55, Math.sin((2 * Math.PI * f) / c.sampleRate) / (2 * alpha));
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = Q;
      const gg = c.createGain();
      gg.gain.value = 0.15 * w * u ** 0.65 * Math.min(16, 0.004 / alpha);
      src.connect(bp);
      bp.connect(gg);
      gg.connect(g);
      owned.push(bp, gg);
    }
    src.onended = () => {
      src.disconnect();
      owned.forEach((n) => setTimeout(() => n.disconnect(), 800));
    };
    src.start(t0);
  },
  /** Tiếng nảy đệm: cao độ theo vận tốc bật (nảy cao dần → nốt lên dần) */
  bounce(v: number) {
    const semis = Math.round(Math.min(24, Math.max(0, (v - 4) * 0.9)));
    synth.pluck(196 * Math.pow(2, semis / 12), Math.min(1, v / 18), 1.2);
    synth.impact("paper", v);
  },
  /** Vút Doppler qua cổng / lỗ sâu: tần số trượt từ f0 → f1 */
  whoosh(f0 = 580, f1 = 900, dur = 0.5, vol = 0.5) {
    const c = ac();
    if (!c) return;
    const g = voice(c, dur, 0.6);
    if (!g) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.55);
    o.frequency.exponentialRampToValueAtTime(f1 * 0.45, t0 + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600, t0);
    lp.frequency.exponentialRampToValueAtTime(5000, t0 + dur * 0.5);
    lp.frequency.exponentialRampToValueAtTime(400, t0 + dur);
    const og = c.createGain();
    og.gain.setValueAtTime(0, t0);
    og.gain.linearRampToValueAtTime(0.08 * vol, t0 + dur * 0.4);
    og.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
    o.connect(lp);
    lp.connect(og);
    og.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    noiseBurst(c, g, t0, dur, 1800, 0.8, 0.35 * vol);
  },
  /** Tiếng kêu nghịch tai của quái: cụm lệch nửa cung + phách + điều chế vòng */
  dissonant(f = 233, dur = 0.7, vol = 0.5) {
    const c = ac();
    if (!c) return;
    const g = voice(c, dur, 0.4);
    if (!g) return;
    const t0 = c.currentTime;
    const ring = c.createGain();
    ring.gain.value = 0;
    // điều chế vòng 37 Hz: dải bên f ± 37 Hz → tiếng "rè" nghịch tai
    const mod = c.createOscillator();
    mod.frequency.value = 37;
    mod.connect(ring.gain);
    ring.connect(g);
    mod.start(t0);
    mod.stop(t0 + dur + 0.05);
    for (const r of [1, 16 / 15, 45 / 32]) partial(c, ring, f * r * (1 + (Math.random() - 0.5) * 0.004), 0.12 * vol, t0, dur, "sawtooth", 0.01);
    partial(c, g, f * 1.06, 0.05 * vol, t0, dur, "square", 0.01);
  },
  /** Quái bị giải: từ bất hoà tan thành hợp âm trưởng thuần */
  resolve(f = 261.6) {
    synth.dissonant(f * 0.89, 0.25, 0.4);
    setTimeout(() => synth.chord(f, [1, 5 / 4, 3 / 2, 2, 5 / 2], 0.7), 180);
    setTimeout(() => synth.bell(f * 2, 0.4, 3), 420);
  },
};
