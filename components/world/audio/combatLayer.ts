"use client";
/**
 * Lớp nhạc chiến đấu (AUDIO.md "Còn": lớp nhạc chiến đấu): trống + bass ostinato theo HỢP ÂM ĐANG CHƠI của nhạc nền
 * (MUSIC_KEY) → luôn hoà với nhạc vùng. Cường độ tăng theo hoạt động giao tranh (trúng đòn / bị đánh / nổ) và tắt dần
 * ~8 s sau trận; dưới ngưỡng thì dừng hẳn bộ lập lịch. Đi qua bus nhạc (âm lượng Nhạc nền + ducking).
 * Mẫu nhịp 16 phách, 112 BPM, lập lịch trước 0,2 s theo đồng hồ AudioContext.
 */
import { audioCore, audioRunning, getVol } from "./engine";
import { noiseHit, osc } from "./synth";
import { MUSIC_KEY } from "./sfxKit";
import { musicGrid } from "./musicDirector";
import { midiToHz } from "@/lib/world/music";
import { COMBAT_PATTERN, combatDecay } from "@/lib/world/musicVoices";

const BPM = 112;
const STEP = 60 / BPM / 4;
const AHEAD = 0.2;

const S = { k: 0, at: 0, step: 0, next: 0, timer: null as ReturnType<typeof setInterval> | null, out: null as GainNode | null };

/** gọi khi có giao tranh: amount 0..1 (trúng đòn ~0,25, bị đánh ~0,5, nổ lớn ~0,6) */
export function bumpCombat(amount: number) {
  const now = performance.now();
  S.k = Math.min(1, combatDecay(S.k, (now - S.at) / 1000) + amount);
  S.at = now;
  if (!S.timer && S.k > 0.05) start();
}

function start() {
  const core = audioCore(false);
  if (!core || !audioRunning() || getVol("music") <= 0.001) return;
  if (!S.out) {
    S.out = core.ctx.createGain();
    S.out.gain.value = 0;
    S.out.connect(core.duck);
  }
  S.next = core.ctx.currentTime + 0.05;
  S.step = 0;
  S.timer = setInterval(tick, 50);
}

function tick() {
  const core = audioCore(false);
  // bản boss render sẵn đã có bộ gõ riêng → lớp này im
  const k = musicGrid()?.boss ? 0 : combatDecay(S.k, (performance.now() - S.at) / 1000);
  if (!core || !S.out || !audioRunning() || k < 0.03) {
    if (S.out && core) S.out.gain.setTargetAtTime(0, core.ctx.currentTime, 0.5);
    if (S.timer) clearInterval(S.timer);
    S.timer = null;
    return;
  }
  const c = core.ctx;
  S.out.gain.setTargetAtTime(0.55 * k, c.currentTime, 0.4);
  while (S.next < c.currentTime + AHEAD) {
    const t = S.next;
    const st = S.step % 16;
    const p = COMBAT_PATTERN;
    const root = MUSIC_KEY.root + (MUSIC_KEY.chord[0] ?? 0);
    if (p.kick[st]) osc(c, S.out, { f0: 120, f1: 42, t, a: 0.002, d: 0.22, gain: 0.55 * p.kick[st] });
    if (p.snare[st] && k > 0.25) {
      noiseHit(core, S.out, { t, dur: 0.14, filter: "bandpass", f0: 1900, f1: 900, q: 0.8, gain: 0.32 * p.snare[st] });
      osc(c, S.out, { f0: 220, f1: 160, t, d: 0.08, gain: 0.12 });
    }
    if (p.hat[st] && k > 0.45) noiseHit(core, S.out, { t, dur: 0.04, filter: "highpass", f0: 7000, q: 0.7, gain: 0.08 * p.hat[st] });
    const b = p.bass[st];
    if (b !== null && b !== undefined) {
      const pc = MUSIC_KEY.chord[b % MUSIC_KEY.chord.length] ?? 0;
      const hz = midiToHz(root - 24 + (pc - (MUSIC_KEY.chord[0] ?? 0)));
      osc(c, S.out, { type: "sawtooth", f0: hz, t, a: 0.005, d: STEP * 1.6, gain: 0.16, lp: 520, lpEnd: 220 });
      osc(c, S.out, { type: "sine", f0: hz, t, a: 0.005, d: STEP * 1.8, gain: 0.22 });
    }
    S.next += STEP;
    S.step++;
  }
}

/** kiểm thử trong trình duyệt */
export function combatLayerDebug() {
  return { k: combatDecay(S.k, (performance.now() - S.at) / 1000), running: !!S.timer, step: S.step };
}
