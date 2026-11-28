"use client";
/**
 * Khối tổng hợp nhỏ dùng chung cho hiệu ứng và nhạc (mọi nút tự ngắt kết nối khi xong):
 *  osc — một dao động có đường bao (tấn công tuyến tính, tắt hàm mũ), trượt tần;
 *  noiseHit — nhiễu (bộ đệm dùng chung, vị trí ngẫu nhiên) qua bộ lọc trượt tần;
 *  modal — tổng các mode (sin) tỉ lệ không nguyên: kim loại, thuỷ tinh, chuông, gỗ;
 *  periodic — PeriodicWave lưu sẵn (đàn harpsichord, organ, hộp nhạc): nhiều hoạ âm trong MỘT dao động.
 */
import type { Core } from "./engine";

export type OscOpts = {
  type?: OscillatorType;
  wave?: PeriodicWave;
  f0: number;
  f1?: number;
  /** thời điểm bắt đầu (giây, đồng hồ AudioContext) */
  t: number;
  a?: number;
  d: number;
  gain: number;
  detune?: number;
  /** lọc thông thấp (Hz) — tuỳ chọn */
  lp?: number;
  lpEnd?: number;
};

export function osc(c: AudioContext, dest: AudioNode, o: OscOpts) {
  if (o.gain < 1e-4 || o.f0 > 18000) return;
  const n = c.createOscillator();
  if (o.wave) n.setPeriodicWave(o.wave);
  else n.type = o.type ?? "sine";
  n.frequency.setValueAtTime(o.f0, o.t);
  if (o.f1 && o.f1 !== o.f0) n.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.t + o.d);
  if (o.detune) n.detune.value = o.detune;
  const g = c.createGain();
  const a = o.a ?? 0.004;
  g.gain.setValueAtTime(0, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + a);
  g.gain.exponentialRampToValueAtTime(1e-4, o.t + a + o.d);
  let f: BiquadFilterNode | null = null;
  if (o.lp) {
    f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(o.lp, o.t);
    if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, o.t + a + o.d);
    n.connect(f);
    f.connect(g);
  } else n.connect(g);
  g.connect(dest);
  n.onended = () => {
    n.disconnect();
    f?.disconnect();
    g.disconnect();
  };
  n.start(o.t);
  n.stop(o.t + a + o.d + 0.05);
}

export type NoiseOpts = { t: number; dur: number; filter?: BiquadFilterType; f0: number; f1?: number; q?: number; gain: number; a?: number };

export function noiseHit(k: Core, dest: AudioNode, o: NoiseOpts) {
  if (o.gain < 1e-4) return;
  const c = k.ctx;
  const src = c.createBufferSource();
  src.buffer = k.noise;
  const f = c.createBiquadFilter();
  f.type = o.filter ?? "bandpass";
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, o.t);
  if (o.f1 && o.f1 !== o.f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), o.t + o.dur);
  const g = c.createGain();
  const a = o.a ?? 0.002;
  g.gain.setValueAtTime(0, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + a);
  g.gain.exponentialRampToValueAtTime(1e-4, o.t + a + o.dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.onended = () => {
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
  const off = Math.random() * Math.max(0, k.noise.duration - o.dur - a - 0.1);
  src.start(o.t, off, o.dur + a + 0.05);
}

/** Tổng các mode: tỉ lệ tần số (so với base), mỗi mode tắt nhanh hơn theo bậc */
export function modal(c: AudioContext, dest: AudioNode, base: number, ratios: number[], t: number, decay: number, gain: number) {
  ratios.forEach((r, i) => osc(c, dest, { f0: base * r, t, a: 0.001, d: decay / (1 + i * 0.6), gain: gain / (1 + i * 0.7) }));
}

const waves = new WeakMap<AudioContext, Record<string, PeriodicWave>>();
/** PeriodicWave lưu sẵn theo ngữ cảnh */
export function periodic(c: AudioContext, name: "harpsichord" | "organ" | "musicbox" | "reed"): PeriodicWave {
  let m = waves.get(c);
  if (!m) waves.set(c, (m = {}));
  if (m[name]) return m[name];
  const N = 28;
  const re = new Float32Array(N + 1);
  const im = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) {
    let a = 0;
    if (name === "harpsichord") {
      // dây gảy ở 1/7 chiều dài: biên độ ~ |sin(πn/7)|/n (hoạ âm bội 7 bị khuyết) — tiếng "kim" sáng
      a = (Math.abs(Math.sin((Math.PI * n) / 7)) / n) * (n === 1 ? 0.8 : 1.15);
    } else if (name === "organ") {
      // ống 8' + 4' + 2⅔' + 2' (hoạ âm 1, 2, 3, 4) nhẹ dần
      a = ({ 1: 1, 2: 0.55, 3: 0.3, 4: 0.22, 6: 0.08, 8: 0.05 } as Record<number, number>)[n] ?? 0;
    } else if (name === "musicbox") {
      a = ({ 1: 1, 2: 0.18, 4: 0.3, 7: 0.06 } as Record<number, number>)[n] ?? 0;
    } else {
      // reed: hoạ âm lẻ mạnh (như clarinet) cho tiếng sáo trầm
      a = n % 2 ? 1 / n : 0.12 / n;
    }
    im[n] = a;
  }
  m[name] = c.createPeriodicWave(re, im, { disableNormalization: false });
  return m[name];
}
