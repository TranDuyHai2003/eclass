"use client";
/**
 * Nhạc cụ tổng hợp cho nhạc nền vùng (mỗi nốt = một giọng nhạc trong VoicePool; nút tự ngắt khi xong):
 * kalimba, hộp nhạc, marimba, harpsichord (PeriodicWave dây gảy 1/7), sáo (rung + hơi thở), thuỷ tinh, chuông đúc,
 * pad ấm / không khí / organ, hợp âm Shepard trượt lên mãi, bass, chim hót, dế, giọt nước.
 */
import type { Instrument, MusicEvent, ZoneProfile } from "@/lib/world/music";
import { shepardPartials } from "@/lib/world/music";
import { musicVoice } from "./engine";
import { modal, noiseHit, osc, periodic } from "./synth";

/** nốt giữ (có pha giữ) — cho pad / bass / sáo */
function sustained(c: AudioContext, dest: AudioNode, o: { type?: OscillatorType; wave?: PeriodicWave; f: number; t: number; a: number; hold: number; r: number; gain: number; lp?: number; detune?: number; vib?: number; glideTo?: number }) {
  const n = c.createOscillator();
  if (o.wave) n.setPeriodicWave(o.wave);
  else n.type = o.type ?? "sine";
  n.frequency.setValueAtTime(o.f, o.t);
  if (o.glideTo) n.frequency.exponentialRampToValueAtTime(o.glideTo, o.t + o.a + o.hold + o.r);
  if (o.detune) n.detune.value = o.detune;
  let lfo: OscillatorNode | null = null;
  let lg: GainNode | null = null;
  if (o.vib) {
    lfo = c.createOscillator();
    lfo.frequency.value = 4.8 + Math.random() * 0.8;
    lg = c.createGain();
    lg.gain.setValueAtTime(0, o.t);
    lg.gain.linearRampToValueAtTime(o.f * o.vib, o.t + o.a + 0.3);
    lfo.connect(lg);
    lg.connect(n.frequency);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0, o.t);
  g.gain.linearRampToValueAtTime(o.gain, o.t + o.a);
  g.gain.setValueAtTime(o.gain, o.t + o.a + o.hold);
  g.gain.exponentialRampToValueAtTime(1e-4, o.t + o.a + o.hold + o.r);
  let f: BiquadFilterNode | null = null;
  if (o.lp) {
    f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lp;
    f.Q.value = 0.5;
    n.connect(f);
    f.connect(g);
  } else n.connect(g);
  g.connect(dest);
  const end = o.t + o.a + o.hold + o.r + 0.05;
  n.onended = () => {
    n.disconnect();
    f?.disconnect();
    g.disconnect();
    lfo?.disconnect();
    lg?.disconnect();
  };
  n.start(o.t);
  n.stop(end);
  if (lfo) {
    lfo.start(o.t);
    lfo.stop(end);
  }
}

function lead(inst: Instrument, c: AudioContext, out: AudioNode, hz: number, t: number, dur: number, g: number, bright: number) {
  switch (inst) {
    case "kalimba":
      osc(c, out, { f0: hz, t, a: 0.003, d: 1.1 + dur * 0.3, gain: g });
      osc(c, out, { f0: hz * 5.93, t, a: 0.002, d: 0.09, gain: g * 0.22 });
      osc(c, out, { type: "triangle", f0: hz * 2, t, a: 0.003, d: 0.35, gain: g * 0.12, lp: bright });
      break;
    case "musicbox":
      osc(c, out, { wave: periodic(c, "musicbox"), f0: hz * 2, t, a: 0.002, d: 1.5, gain: g * 0.7, lp: bright });
      osc(c, out, { f0: hz * 4, t, a: 0.002, d: 0.4, gain: g * 0.12 });
      break;
    case "marimba":
      osc(c, out, { f0: hz, t, a: 0.003, d: 0.55, gain: g });
      osc(c, out, { f0: hz * 4, t, a: 0.002, d: 0.08, gain: g * 0.3 });
      osc(c, out, { f0: hz * 9.9, t, a: 0.001, d: 0.025, gain: g * 0.1 });
      break;
    case "harpsichord": {
      const d = Math.max(0.25, Math.min(0.9, 140 / hz));
      osc(c, out, { wave: periodic(c, "harpsichord"), f0: hz, t, a: 0.0015, d, gain: g * 0.55, lp: bright, lpEnd: bright * 0.35 });
      osc(c, out, { wave: periodic(c, "harpsichord"), f0: hz * 2, t, a: 0.0015, d: d * 0.6, gain: g * 0.12, lp: bright, detune: 4 });
      break;
    }
    case "flute":
      sustained(c, out, { type: "sine", f: hz, t, a: 0.12, hold: Math.max(0.05, dur - 0.2), r: 0.45, gain: g * 0.75, vib: 0.006 });
      sustained(c, out, { wave: periodic(c, "reed"), f: hz, t, a: 0.16, hold: Math.max(0.05, dur - 0.25), r: 0.35, gain: g * 0.12, lp: bright * 0.6 });
      break;
    case "glass":
      sustained(c, out, { type: "sine", f: hz, t, a: 0.05, hold: 0.1, r: 2.2, gain: g * 0.8 });
      osc(c, out, { f0: hz * 2.01, t, a: 0.02, d: 1.1, gain: g * 0.22 });
      osc(c, out, { f0: hz * 3.03, t, a: 0.01, d: 0.5, gain: g * 0.08 });
      break;
    case "bell":
      modal(c, out, hz, [0.5, 1, 1.183, 1.506, 2, 2.514], t, 3.2, g * 0.55);
      break;
    default:
      osc(c, out, { type: "triangle", f0: hz, t, a: 0.003, d: 0.6, gain: g, lp: bright });
  }
}

/** Phát một sự kiện nhạc tại thời điểm tuyệt đối t (đồng hồ AudioContext), vào nút vùng `zone` */
export function playEvent(ev: MusicEvent, t: number, zone: AudioNode, p: ZoneProfile): boolean {
  const tail = ev.kind === "pad" || ev.kind === "shepard" ? 2 : ev.kind === "lead" ? (p.lead === "bell" ? 3.3 : p.lead === "glass" ? 2.4 : 1.6) : 1;
  // nền / bass quan trọng hơn giai điệu, giai điệu hơn điểm nhấn: hết giọng thì cướp cái kém quan trọng
  const prio = ev.kind === "pad" || ev.kind === "shepard" || ev.kind === "bass" ? 2 : ev.kind === "lead" ? 1 : 0;
  const v = musicVoice(zone, ev.dur + tail, p.space * 0.7, prio);
  if (!v) return false;
  const { c, out } = v;
  const g = ev.vel;
  switch (ev.kind) {
    case "lead":
      lead(p.lead, c, out, ev.hz[0], t, ev.dur, 0.15 * g, p.bright);
      break;
    case "pad":
      for (const hz of ev.hz) {
        if (p.pad === "organ") sustained(c, out, { wave: periodic(c, "organ"), f: hz, t, a: 2.5, hold: Math.max(0.1, ev.dur - 3), r: 2.5, gain: 0.03 * g, lp: p.bright * 0.5 });
        else if (p.pad === "air") sustained(c, out, { type: "sine", f: hz, t, a: 2, hold: Math.max(0.1, ev.dur - 2.5), r: 2.5, gain: 0.05 * g, vib: 0.002 });
        else
          for (const dt of [-7, 7]) sustained(c, out, { type: "sawtooth", f: hz, t, a: 1.6, hold: Math.max(0.1, ev.dur - 2.4), r: 2.2, gain: 0.018 * g, lp: p.bright * 0.32, detune: dt });
      }
      break;
    case "shepard":
      // mỗi lớp cao độ: các thành phần cách quãng tám (chuông log-tần), trượt lên 2 nửa cung suốt hợp âm → nối tiếp mãi
      for (const pc of ev.pc ?? []) {
        for (const part of shepardPartials(pc, 55, 6, 1.1)) sustained(c, out, { type: "sine", f: part.hz, t, a: 1.8, hold: Math.max(0.1, ev.dur - 3.3), r: 1.5, gain: 0.028 * g * part.amp, glideTo: part.hz * Math.pow(2, 2 / 12) });
      }
      break;
    case "bass":
      sustained(c, out, { type: "sine", f: ev.hz[0], t, a: 0.03, hold: Math.max(0.05, ev.dur * 0.5), r: ev.dur * 0.6, gain: 0.12 * g });
      sustained(c, out, { type: "triangle", f: ev.hz[0] * 2, t, a: 0.03, hold: 0.05, r: 0.5, gain: 0.02 * g, lp: 800 });
      break;
    case "chirp": {
      const up = Math.random() < 0.6;
      osc(c, out, { f0: ev.hz[0], f1: ev.hz[0] * (up ? 1.35 : 0.75), t, a: 0.006, d: ev.dur, gain: 0.05 * g });
      break;
    }
    case "cricket": {
      // dế: chuỗi xung ngắn 4–5 kHz, 25 xung/s
      const n = Math.floor(ev.dur / 0.04);
      for (let i = 0; i < n; i++) if (i % 8 < 5) osc(c, out, { f0: ev.hz[0], t: t + i * 0.04, a: 0.002, d: 0.012, gain: 0.018 * g });
      break;
    }
    case "drip":
      osc(c, out, { f0: ev.hz[0], f1: ev.hz[0] * 1.9, t, a: 0.002, d: 0.06, gain: 0.07 * g });
      break;
  }
  return true;
}

/** Nền liên tục của vùng (drone Hư Không, gió đồng cỏ) — trả về hàm dừng */
export function startBed(kind: "drone" | "wind", c: AudioContext, dest: AudioNode, p: ZoneProfile, noise: AudioBuffer): () => void {
  const nodes: AudioScheduledSourceNode[] = [];
  const all: AudioNode[] = [];
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.setTargetAtTime(1, c.currentTime, 2);
  g.connect(dest);
  all.push(g);
  if (kind === "drone") {
    const f0 = 440 * Math.pow(2, (p.root - 69) / 12);
    // chủ âm + quãng năm, lệch rất nhẹ → phách chậm 0,1–0,3 Hz (không gian "thở")
    for (const [r, amp, det] of [
      [1, 0.09, 0],
      [1, 0.06, 0.18],
      [1.5, 0.05, -0.12],
      [2, 0.025, 0.07],
      [5, 0.006, 0],
    ] as const) {
      const o = c.createOscillator();
      o.frequency.value = f0 * r + det;
      const og = c.createGain();
      og.gain.value = amp;
      o.connect(og);
      og.connect(g);
      o.start();
      nodes.push(o);
      all.push(o, og);
    }
  }
  // gió / "gió vũ trụ": nhiễu lọc thông thấp, tần số cắt trôi chậm bằng LFO 0,05 Hz
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = kind === "drone" ? "bandpass" : "lowpass";
  lp.frequency.value = kind === "drone" ? 300 : 600;
  lp.Q.value = kind === "drone" ? 4 : 0.7;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.05 + Math.random() * 0.03;
  const lg = c.createGain();
  lg.gain.value = kind === "drone" ? 160 : 350;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  const ng = c.createGain();
  ng.gain.value = kind === "drone" ? 0.035 : 0.05;
  src.connect(lp);
  lp.connect(ng);
  ng.connect(g);
  src.start();
  lfo.start();
  nodes.push(src, lfo);
  all.push(src, lp, lfo, lg, ng);
  return () => {
    g.gain.setTargetAtTime(0, c.currentTime, 0.8);
    setTimeout(() => {
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {}
      });
      all.forEach((n) => n.disconnect());
    }, 4000);
  };
}
