"use client";
/**
 * Hiệu ứng âm thanh chiến đấu theo NGUYÊN TỐ (lớp transient / body / tail), gọi đúng khung hình VFX
 * (cùng chỗ với emitHit / emitBurst / addFx). Mỗi lần phát có biến thiên cao độ ±cent, ±dB, vị trí nhiễu ngẫu nhiên
 * → không lặp máy móc; số giọng bị giới hạn theo nhóm (engine VoicePool).
 *
 * Âm có cao độ (nhặt đồ, mở rương, thăng cấp, khoá phép) lấy nốt từ HỢP ÂM ĐANG CHƠI của nhạc nền (MUSIC_KEY) —
 * như Sky: Children of the Light — nên hiệu ứng "hợp" với nhạc vùng.
 */
import { ELEMENTS, centsJitter, dbJitter, dbToGain, hitLayers, spellElement, type Element } from "@/lib/world/musicVoices";
import { midiToHz } from "@/lib/world/music";
import { duckMusic, sfxVoice, type Voice } from "./engine";
import { modal, noiseHit, osc } from "./synth";

/** Khoá nhạc hiện tại (ZoneMusic cập nhật mỗi câu): chủ âm midi, thang, lớp cao độ hợp âm (so với chủ âm) */
export const MUSIC_KEY = { root: 62, scale: [0, 2, 4, 7, 9] as readonly number[], chord: [0, 4, 7] as readonly number[] };

const R = Math.random;
const cj = (c: number) => centsJitter(R, c);
const dj = (d: number) => dbJitter(R, d);

/** nốt thứ i của hợp âm hiện tại, quãng tám oct (so với chủ âm) */
function chordHz(i: number, oct = 1): number {
  const ch = MUSIC_KEY.chord.length ? MUSIC_KEY.chord : [0, 4, 7];
  const n = ch.length;
  const k = ((i % n) + n) % n;
  return midiToHz(MUSIC_KEY.root + 12 * (oct + Math.floor(i / n)) + ch[k]);
}

// ───────────── Lớp phụ theo nguyên tố ─────────────

function extra(v: Voice, kind: (typeof ELEMENTS)[Element]["extra"], t: number, g: number) {
  const { c, out, core } = v;
  switch (kind) {
    case "crackle":
      for (let i = 0; i < 4; i++) noiseHit(core, out, { t: t + 0.02 + i * (0.03 + R() * 0.03), dur: 0.012, filter: "highpass", f0: 1800 + R() * 2500, q: 0.7, gain: g * (0.5 + R() * 0.4) });
      noiseHit(core, out, { t, dur: 0.18, filter: "lowpass", f0: 1600, f1: 500, q: 0.6, gain: g * 0.5 });
      break;
    case "zap":
      for (let i = 0; i < 3; i++) noiseHit(core, out, { t: t + i * 0.022, dur: 0.006, filter: "highpass", f0: 3000 + R() * 3000, q: 0.8, gain: g * 0.9 });
      osc(c, out, { type: "square", f0: 900 * cj(80), f1: 140, t: t + 0.03, d: 0.09, gain: g * 0.12, lp: 3000 });
      break;
    case "bubble":
      for (let i = 0; i < 3; i++) osc(c, out, { f0: (700 + R() * 600) * 0.7, f1: 1400 + R() * 900, t: t + 0.03 + i * 0.045, d: 0.05, gain: g * 0.18 });
      break;
    case "tick":
      osc(c, out, { type: "square", f0: 2400, t, d: 0.012, gain: g * 0.12, lp: 5000 });
      osc(c, out, { type: "square", f0: 1800, t: t + 0.12, d: 0.012, gain: g * 0.1, lp: 4000 });
      break;
    case "rustle":
      noiseHit(core, out, { t: t + 0.01, dur: 0.14, filter: "bandpass", f0: 5200, f1: 2600, q: 2, gain: g * 0.4 });
      break;
    case "sparkle":
      for (let i = 0; i < 3; i++) osc(c, out, { f0: chordHz(i + Math.floor(R() * 3), 3) * cj(10), t: t + 0.03 + i * 0.035, d: 0.16, gain: g * 0.07 });
      break;
    case "whoosh":
      noiseHit(core, out, { t, dur: 0.12, filter: "bandpass", f0: 500, f1: 2000, q: 1.2, gain: g * 0.45 });
      break;
    case "suck":
      osc(c, out, { f0: 420, f1: 50, t, d: 0.32, gain: g * 0.35 });
      noiseHit(core, out, { t, dur: 0.3, filter: "lowpass", f0: 3000, f1: 200, q: 0.8, gain: g * 0.3 });
      break;
    case "thud":
      osc(c, out, { f0: 70 * cj(60), f1: 38, t, d: 0.22, gain: g * 0.6 });
      break;
  }
}

// ───────────── API ─────────────

/**
 * Trúng đòn theo nguyên tố. power: 0 thường · 1 nặng · 2 chí mạng (thêm glint hợp âm sau 20 ms, sub trầm, ducking nhạc).
 * Transient 5–15 ms + body 40–200 ms + tail 100–500 ms (nghiên cứu §5).
 */
export function elementHit(el: Element, power: 0 | 1 | 2 = 0, prio = 3) {
  const R0 = ELEMENTS[el];
  const L = hitLayers(power);
  const tail = L.tail ? R0.tail.ms / 1000 : 0.08;
  const v = sfxVoice("hit", prio + (power === 2 ? 1 : 0), 0.25 + tail, R0.tail.send * (L.tail ? 1 : 0.4));
  if (!v) return;
  const { c, out, t, core } = v;
  const G = dj(1.5) * (power === 2 ? 1.15 : power === 1 ? 1.05 : 0.9);
  // transient
  noiseHit(core, out, { t, dur: R0.tr.ms / 1000, filter: "bandpass", f0: R0.tr.hz * (0.88 + R() * 0.24), q: R0.tr.q, gain: dbToGain(R0.tr.db) * 0.9 * G });
  // body
  const fb = cj(45);
  if (R0.body.modes) modal(c, out, R0.body.f0 * fb * 1.6, R0.body.modes, t, R0.body.ms / 1000 + (L.tail ? 0.12 : 0), dbToGain(R0.body.db) * 0.5 * G);
  osc(c, out, { type: R0.body.wave, f0: R0.body.f0 * fb, f1: R0.body.f1 * fb, t, d: R0.body.ms / 1000, gain: dbToGain(R0.body.db) * 0.55 * G, lp: 4000 });
  // tail + lớp nguyên tố
  if (L.tail || R() < 0.5) extra(v, R0.extra, t, 0.5 * G);
  if (L.glint) {
    for (let i = 0; i < 2; i++) osc(c, out, { f0: chordHz(i * 2 + 1, 2), t: t + 0.02 + i * 0.012, d: 0.14, gain: 0.08 });
    osc(c, out, { type: "triangle", f0: chordHz(0, 3), t: t + 0.025, d: 0.22, gain: 0.045 });
  }
  if (L.sub) osc(c, out, { f0: 62 * cj(30), f1: 34, t, a: 0.003, d: 0.3, gain: 0.5 });
  if (L.duck) duckMusic(L.duck);
}

/** Vung vũ khí: vút theo nguyên tố (heavy: trầm, dài hơn) — phát ~90 ms trước khung trúng */
export function elementSwing(el: Element, heavy = false) {
  const d = heavy ? 0.3 : 0.18;
  const v = sfxVoice("swing", 2, d + 0.2, 0.12);
  if (!v) return;
  const { c, out, t, core } = v;
  const k = cj(120);
  const lo = el === "earth" || el === "fire" ? 0.6 : el === "light" || el === "ice" ? 1.4 : 1;
  noiseHit(core, out, { t, dur: d, filter: "bandpass", f0: (heavy ? 900 : 1400) * lo * k, f1: (heavy ? 3200 : 4200) * lo * k, q: 1.4, gain: (heavy ? 0.22 : 0.16) * dj(1.5), a: d * 0.45 });
  if (el === "steel" || el === "light") osc(c, out, { f0: 2600 * k, f1: 3100 * k, t: t + d * 0.4, d: 0.18, gain: 0.025 });
  if (el === "fire") noiseHit(core, out, { t, dur: d + 0.05, filter: "lowpass", f0: 700, f1: 300, gain: 0.12, a: d * 0.4 });
  if (el === "lightning") extra(v, "zap", t + d * 0.6, 0.25);
}

/** Đòn hụt (vung trúng không khí) */
export function whiff() {
  const v = sfxVoice("swing", 1, 0.3, 0.05);
  if (!v) return;
  noiseHit(v.core, v.out, { t: v.t, dur: 0.14, filter: "bandpass", f0: 1200 * cj(150), f1: 500, q: 1, gain: 0.07 });
}

/** Phép vẽ (đúng khung castSpell): vòng → khiên pha lê, zigzag → sét, xoắn → hút, parabol → huýt lên, sin → 3 sóng */
export function spellCast(id: string) {
  const el = spellElement(id);
  const v = sfxVoice("spell", 3, 1.6, 0.45);
  if (!v) return;
  const { c, out, t, core } = v;
  switch (id) {
    case "shield":
      // hợp âm rải đi lên + vang thuỷ tinh
      for (let i = 0; i < 4; i++) modal(c, out, chordHz(i, 2), [1, 2.32, 4.25], t + i * 0.05, 0.9, 0.09);
      noiseHit(core, out, { t, dur: 0.5, filter: "highpass", f0: 5000, f1: 9000, q: 0.7, gain: 0.05, a: 0.15 });
      break;
    case "bolt":
      for (let i = 0; i < 5; i++) noiseHit(core, out, { t: t + i * 0.035 + R() * 0.02, dur: 0.008, filter: "highpass", f0: 2500 + R() * 4000, q: 0.7, gain: 0.35 });
      osc(c, out, { type: "sawtooth", f0: 220, f1: 55, t: t + 0.02, d: 0.35, gain: 0.08, lp: 2400, lpEnd: 300 });
      noiseHit(core, out, { t: t + 0.1, dur: 0.6, filter: "lowpass", f0: 400, f1: 90, gain: 0.25 });
      break;
    case "vortex":
      extra(v, "suck", t, 0.9);
      osc(c, out, { f0: 55, f1: 41, t, a: 0.25, d: 1.3, gain: 0.25 });
      break;
    case "meteor":
      // huýt lên theo đường parabol đạn đạo (ngược với tiếng rơi)
      osc(c, out, { f0: 320, f1: 1500, t, a: 0.05, d: 0.55, gain: 0.06 });
      noiseHit(core, out, { t, dur: 0.6, filter: "bandpass", f0: 600, f1: 2400, q: 1.5, gain: 0.12, a: 0.2 });
      break;
    default:
      // chồng chập: 3 sin lệch nhẹ → phách (beat) rồi hội tụ
      for (let i = 0; i < 3; i++) osc(c, out, { f0: chordHz(i, 1) * (1 + (i - 1) * 0.012), f1: chordHz(i, 2), t: t + i * 0.03, a: 0.06, d: 0.6, gain: 0.07 });
      extra(v, "bubble", t + 0.1, 0.6);
  }
  extra(v, ELEMENTS[el].extra === "sparkle" ? "sparkle" : undefined, t + 0.05, 0.5);
}

/** Nổ diện rộng (thiên thạch chạm đất, lỗ đen sập, tuyệt kỹ Q bung, bổ nhào): sub + nhiễu + mảnh vụn + duck nhạc */
export function explode(el: Element = "fire", power = 1) {
  const v = sfxVoice("impact", 4, 1.3, 0.35);
  if (!v) return;
  const { c, out, t, core } = v;
  const p = Math.min(1.6, power);
  noiseHit(core, out, { t, dur: 0.02, filter: "bandpass", f0: 3500, q: 0.8, gain: 0.5 * p });
  osc(c, out, { f0: 85 * cj(50), f1: 30, t, a: 0.004, d: 0.55 * p, gain: 0.55 * p });
  noiseHit(core, out, { t, dur: 0.7 * p, filter: "lowpass", f0: 2400, f1: 160, q: 0.7, gain: 0.35 * p });
  extra(v, ELEMENTS[el].extra, t + 0.03, 0.6);
  duckMusic(1 + 0.4 * p);
}

/** Khiên chặn đòn: tiếng pha lê "ping" + gợn */
export function wardBlock() {
  const v = sfxVoice("hit", 4, 0.8, 0.4);
  if (!v) return;
  modal(v.c, v.out, 1180 * cj(40), [1, 1.62, 2.31, 3.4], v.t, 0.5, 0.12);
  noiseHit(v.core, v.out, { t: v.t, dur: 0.15, filter: "highpass", f0: 6000, f1: 3000, q: 1, gain: 0.08 });
}

/** Lướt / né: vút ngắn đi lên + sột soạt vải */
export function dash() {
  const v = sfxVoice("move", 2, 0.45, 0.15);
  if (!v) return;
  noiseHit(v.core, v.out, { t: v.t, dur: 0.24, filter: "bandpass", f0: 700 * cj(100), f1: 2600, q: 1.1, gain: 0.16, a: 0.06 });
  noiseHit(v.core, v.out, { t: v.t + 0.02, dur: 0.08, filter: "highpass", f0: 3500, q: 0.7, gain: 0.04 });
}

/** Người chơi bị đánh: tiếng đục trầm (khác hẳn tiếng mình đánh trúng quái) */
export function hurt() {
  const v = sfxVoice("hit", 4, 0.5, 0.1);
  if (!v) return;
  const { c, out, t, core } = v;
  osc(c, out, { type: "triangle", f0: 150 * cj(60), f1: 60, t, d: 0.2, gain: 0.35, lp: 900 });
  noiseHit(core, out, { t, dur: 0.12, filter: "lowpass", f0: 1100, f1: 300, q: 0.7, gain: 0.3 });
  duckMusic(1);
}

/** Nhặt đồ: hai nốt hợp âm đi lên (hiếm: hợp âm rải 4 nốt + lấp lánh) */
export function pickup(rare = false) {
  const v = sfxVoice("ui", 2, rare ? 1.4 : 0.7, 0.35);
  if (!v) return;
  const n = rare ? 4 : 2;
  const s = Math.floor(R() * 2);
  for (let i = 0; i < n; i++) osc(v.c, v.out, { type: "triangle", f0: chordHz(s + i, 2), t: v.t + i * 0.07, d: rare ? 0.7 : 0.35, gain: 0.09 });
  if (rare) extra(v, "sparkle", v.t + 0.25, 0.9);
}

/** Mở rương: kẹt bản lề gỗ + chốt tách + hợp âm rải đi lên + lấp lánh */
export function chest() {
  const v = sfxVoice("ui", 3, 2, 0.4);
  if (!v) return;
  const { c, out, t, core } = v;
  osc(c, out, { type: "sawtooth", f0: 130, f1: 95, t, a: 0.05, d: 0.35, gain: 0.03, lp: 900 });
  noiseHit(core, out, { t: t + 0.32, dur: 0.02, filter: "bandpass", f0: 2600, q: 2, gain: 0.25 });
  for (let i = 0; i < 5; i++) osc(c, out, { type: "triangle", f0: chordHz(i, 2), t: t + 0.4 + i * 0.075, d: 0.8, gain: 0.08 });
  extra(v, "sparkle", t + 0.8, 1);
  duckMusic(0.8);
}

/** Thăng cấp / hoàn thành nhiệm vụ: kèn hợp âm theo khoá nhạc vùng + chuông + nền */
export function levelUp() {
  const v = sfxVoice("ui", 4, 2.6, 0.45);
  if (!v) return;
  const { c, out, t } = v;
  for (let i = 0; i < 4; i++) osc(c, out, { type: "triangle", f0: chordHz(i, 1), t: t + i * 0.09, d: 0.45, gain: 0.1 });
  for (let i = 0; i < 3; i++) osc(c, out, { type: "sawtooth", f0: chordHz(i, 1), t: t + 0.38, a: 0.04, d: 1.6, gain: 0.03, lp: 2600, lpEnd: 900 });
  modal(c, out, chordHz(0, 3), [1, 2.0, 2.76], t + 0.38, 1.6, 0.08);
  duckMusic(1.3);
}

/** Bắt đầu vẽ ký hiệu: rít nhẹ đi lên (vòng phép hiện) */
export function sigilStart() {
  const v = sfxVoice("spell", 1, 0.9, 0.3);
  if (!v) return;
  osc(v.c, v.out, { type: "triangle", f0: chordHz(0, 0), f1: chordHz(0, 1), t: v.t, a: 0.25, d: 0.5, gain: 0.04 });
  noiseHit(v.core, v.out, { t: v.t, dur: 0.6, filter: "bandpass", f0: 900, f1: 5000, q: 3, gain: 0.04, a: 0.3 });
}

/** Ký hiệu được nhận ra: glint trắng 100–150 ms rồi cắt gọn (khoá) */
export function sigilLock(id: string) {
  const v = sfxVoice("spell", 3, 0.5, 0.3);
  if (!v) return;
  const el = spellElement(id);
  osc(v.c, v.out, { f0: chordHz(2, 3), t: v.t, a: 0.002, d: 0.12, gain: 0.1 });
  osc(v.c, v.out, { f0: chordHz(0, 3), t: v.t + 0.01, a: 0.002, d: 0.14, gain: 0.07 });
  noiseHit(v.core, v.out, { t: v.t, dur: 0.01, filter: "highpass", f0: ELEMENTS[el].tr.hz, q: 0.8, gain: 0.15 });
}

/** Không nhận ra ký hiệu */
export function sigilFail() {
  const v = sfxVoice("ui", 1, 0.5, 0.1);
  if (!v) return;
  osc(v.c, v.out, { type: "triangle", f0: 330, f1: 220, t: v.t, d: 0.22, gain: 0.08 });
}
