"use client";
/**
 * Âm thanh nền phòng học — tạo hoàn toàn bằng WebAudio (không tải file, không bản quyền):
 *  - mưa: nhiễu hồng (bộ lọc Paul Kellet) lọc thông thấp + giọt mưa lách tách ngẫu nhiên;
 *  - lửa: nhiễu nâu trầm (lửa cháy âm ỉ) + tiếng nổ lép bép thưa.
 * Mỗi loại sinh MỘT bộ đệm vài giây (có nối vòng mượt) rồi phát lặp — không tổng hợp liên tục (nhẹ pin).
 * Độ dài hai vòng lặp khác nhau (8,3 s và 6,7 s) để khi trộn không lộ chu kỳ. Tắt hẳn → suspend AudioContext.
 */
import type { Ambient } from "./studyState";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const chans: Partial<Record<"rain" | "fire", { src: AudioBufferSourceNode; gain: GainNode }>> = {};

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

/** Nối vòng: trộn chéo 0,4 s cuối vào đầu để vòng lặp không "tách" */
function loopify(d: Float32Array, sr: number) {
  const n = Math.floor(sr * 0.4);
  const L = d.length;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    d[i] = d[i] * k + d[L - n + i] * (1 - k);
  }
  return d.subarray(0, L - n);
}

function rainBuffer(c: AudioContext): AudioBuffer {
  const sr = c.sampleRate;
  const len = Math.floor(sr * 8.3);
  const out = c.createBuffer(2, len - Math.floor(sr * 0.4), sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(1234 + ch * 77);
    const d = new Float32Array(len);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09;
      b6 = w * 0.115926;
    }
    // giọt mưa rơi trên mái / kính: xung ngắn tắt dần, cao độ ngẫu nhiên
    for (let k = 0; k < 900; k++) {
      const at = Math.floor(r() * (len - sr * 0.03));
      const f = 1800 + r() * 4200;
      const a = 0.02 + r() * r() * 0.12;
      const n = Math.floor(sr * (0.004 + r() * 0.012));
      for (let i = 0; i < n; i++) d[at + i] += Math.sin((i / sr) * f * Math.PI * 2) * a * Math.exp((-i / n) * 5);
    }
    out.copyToChannel(loopify(d, sr) as Float32Array<ArrayBuffer>, ch);
  }
  return out;
}

function fireBuffer(c: AudioContext): AudioBuffer {
  const sr = c.sampleRate;
  const len = Math.floor(sr * 6.7);
  const out = c.createBuffer(2, len - Math.floor(sr * 0.4), sr);
  for (let ch = 0; ch < 2; ch++) {
    const r = rng(987 + ch * 31);
    const d = new Float32Array(len);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // nhiễu nâu (tích phân nhiễu trắng) — tiếng lửa cháy trầm
      last = (last + 0.02 * (r() * 2 - 1)) / 1.02;
      d[i] = last * 2.2;
    }
    // tiếng lép bép: chùm xung nhiễu rất ngắn, thưa, đôi khi nổ đôi
    for (let k = 0; k < 140; k++) {
      const at = Math.floor(r() * (len - sr * 0.06));
      const n = Math.floor(sr * (0.002 + r() * 0.01));
      const a = 0.08 + r() * r() * 0.45;
      const reps = r() < 0.3 ? 2 + Math.floor(r() * 3) : 1;
      for (let q = 0; q < reps; q++) {
        const o = at + Math.floor(q * sr * (0.008 + r() * 0.02));
        for (let i = 0; i < n && o + i < len; i++) d[o + i] += (r() * 2 - 1) * a * Math.exp((-i / n) * 4);
      }
    }
    out.copyToChannel(loopify(d, sr) as Float32Array<ArrayBuffer>, ch);
  }
  return out;
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  return ctx;
}

function channel(kind: "rain" | "fire") {
  const c = ensure();
  if (!c || !master) return null;
  if (chans[kind]) return chans[kind]!;
  const src = c.createBufferSource();
  src.buffer = kind === "rain" ? rainBuffer(c) : fireBuffer(c);
  src.loop = true;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = kind === "rain" ? 3200 : 2400;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(filt);
  filt.connect(gain);
  gain.connect(master);
  src.start();
  chans[kind] = { src, gain };
  return chans[kind]!;
}

/**
 * Đặt âm nền: loại + âm lượng (0..1, thang cảm nhận: bình phương). Phải gọi từ một cú bấm của người chơi lần đầu
 * (trình duyệt chặn tự phát). "off" → giảm dần rồi suspend.
 */
export function setAmbient(kind: Ambient, vol: number) {
  if (kind === "off" && !ctx) return;
  const c = ensure();
  if (!c || !master) return;
  const now = c.currentTime;
  const g = kind === "off" ? 0 : Math.min(1, Math.max(0, vol)) ** 2 * 0.9;
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(g, now, 0.35);
  for (const k of ["rain", "fire"] as const) {
    const want = kind === "both" || kind === k;
    const ch = want ? channel(k) : chans[k];
    if (!ch) continue;
    ch.gain.gain.cancelScheduledValues(now);
    ch.gain.gain.setTargetAtTime(want ? (k === "fire" && kind === "both" ? 0.55 : 1) : 0, now, 0.3);
  }
  if (kind === "off") {
    window.setTimeout(() => {
      if (ctx && master && master.gain.value < 0.01) ctx.suspend().catch(() => {});
    }, 1500);
  } else if (c.state === "suspended") c.resume().catch(() => {});
}

/** Rời phòng: tắt hẳn, giải phóng bộ đệm */
export function stopAmbient() {
  if (!ctx) return;
  for (const k of ["rain", "fire"] as const) {
    try {
      chans[k]?.src.stop();
    } catch {}
    delete chans[k];
  }
  ctx.close().catch(() => {});
  ctx = null;
  master = null;
}
