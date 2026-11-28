"use client";
/**
 * Giọng của Dàn hợp xướng: MỘT OscillatorNode với PeriodicWave = đúng tổng các hoạ âm đang kêu (sin, biên độ a_k),
 * nốt gốc 196 Hz (Sol), nhỏ, tắt được. Nghe được sai dấu / thiếu ống (âm sắc khác hẳn) — phản hồi trung thực bằng tai.
 * AudioContext riêng (không đụng lib/world/sfx.ts); tôn trọng tắt âm thanh chung (localStorage "world.sfx").
 */
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let last = "";

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem("world.sfx") === "off") return null;
  } catch {}
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Đặt dàn đang kêu: ks = số hiệu hoạ âm, amps = biên độ (0 = câm). muted / rỗng → tắt dần */
export function setChoir(ks: number[], amps: number[], muted: boolean) {
  const loud = !muted && amps.some((a) => Math.abs(a) > 1e-3);
  const key = loud ? ks.map((k, i) => `${k}:${amps[i].toFixed(3)}`).join("|") : "off";
  if (key === last) return;
  last = key;
  const c = loud ? ac() : ctx;
  if (!c) return;
  if (!loud) {
    gain?.gain.setTargetAtTime(0, c.currentTime, 0.08);
    return;
  }
  const K = Math.max(...ks) + 1;
  const real = new Float32Array(K);
  const imag = new Float32Array(K);
  ks.forEach((k, i) => (imag[k] = amps[i]));
  const wave = c.createPeriodicWave(real, imag, { disableNormalization: true });
  if (!osc) {
    osc = c.createOscillator();
    gain = c.createGain();
    gain.gain.value = 0;
    osc.frequency.value = 196;
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
  }
  osc.setPeriodicWave(wave);
  // âm lượng theo biên độ tổng (giới hạn, tránh chói)
  const peak = Math.min(1.6, amps.reduce((s, a) => s + Math.abs(a), 0));
  gain!.gain.setTargetAtTime(0.05 * (peak / 1.6 + 0.4), c.currentTime, 0.05);
}

export function stopChoir() {
  last = "";
  if (!ctx || !gain || !osc) return;
  const g = gain;
  const o = osc;
  g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  setTimeout(() => {
    try {
      o.stop();
      o.disconnect();
      g.disconnect();
    } catch {}
  }, 400);
  osc = null;
  gain = null;
}
