"use client";
/**
 * Âm thanh tổng hợp bằng WebAudio (không file, không bản quyền) — API dùng khắp thế giới (sfx.*).
 * Từ T14 mọi tiếng đi qua lõi âm thanh dùng chung components/world/audio/engine.ts (một AudioContext, bus Hiệu ứng có
 * âm lượng riêng, vang chung, giới hạn giọng, chỉ phát sau thao tác người dùng). Tiếng chiến đấu theo NGUYÊN TỐ
 * (components/world/audio/sfxKit.ts): nguyên tố lấy từ vũ khí đang cầm (elementSource) hoặc phép vừa niệm (element()).
 * Tắt được (localStorage "world.sfx" = "off") — công tắc chung, tắt cả nhạc nền.
 */
import { audioCore, duckMusic, sfxVoice, type Voice } from "@/components/world/audio/engine";
import * as kit from "@/components/world/audio/sfxKit";
import { noiseHit, osc } from "@/components/world/audio/synth";
import { bumpCombat } from "@/components/world/audio/combatLayer";
import { playStinger } from "@/components/world/audio/stemPlayer";
import type { Surface } from "./foleyLogic";
import { BLOCKS } from "./blocks";
import { spellElement, type Element, type VoiceCat } from "./musicVoices";

type Cat = Exclude<VoiceCat, "music">;

/** mọi tiếng "cổ điển" dưới đây: một giọng (giới hạn theo nhóm), tone / noise nối vào giọng đó */
function voice(cat: Cat, dur: number, prio = 2, send = 0.25): Voice | null {
  return sfxVoice(cat, prio, dur, send);
}
const LEG = 0.8;
function tone(v: Voice, freq: number, t0: number, dur: number, type: OscillatorType = "sine", vol = 0.2, glideTo?: number) {
  osc(v.c, v.out, { type, f0: freq, f1: glideTo, t: v.t + t0, a: 0.01, d: dur, gain: vol * LEG });
}
function noise(v: Voice, t0: number, dur: number, vol = 0.2, from = 4000, to = 300, q = 1) {
  noiseHit(v.core, v.out, { t: v.t + t0, dur, f0: from, f1: to, q, gain: vol * LEG });
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

// ───────────── Nguyên tố hiện tại ─────────────

let baseElement: () => Element = () => "steel";
const override = { el: "steel" as Element, until: 0 };
/** combat đăng ký: nguyên tố của vũ khí đang cầm */
export function elementSource(fn: () => Element) {
  baseElement = fn;
}
function elementNow(): Element {
  return performance.now() < override.until ? override.el : baseElement();
}

/** Tiếng hát cá voi: sóng sin trầm lượn lên xuống + rung (vibrato) + bồi âm mờ */
function whaleSong(vol: number) {
  const v = voice("ambient", 5, 1, 0.6);
  if (!v) return;
  const { c, out } = v;
  const now = v.t;
  const mk = (f0: number, f1: number, f2: number, t0: number, dur: number, vv: number) => {
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
    g.gain.exponentialRampToValueAtTime(vv * LEG, now + t0 + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t0 + dur);
    o.connect(g);
    g.connect(out);
    o.onended = () => {
      o.disconnect();
      lfo.disconnect();
      lg.disconnect();
      g.disconnect();
    };
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
  /** Đặt nguyên tố tạm (phép vừa niệm) trong ms — các đòn trúng sau đó mang lớp âm của nguyên tố này */
  element(el: Element, ms = 1800) {
    override.el = el;
    override.until = performance.now() + ms;
  },
  /** Vút gió khi vung vũ khí (heavy: trầm, dài hơn) — theo nguyên tố vũ khí */
  swing(heavy = false) {
    kit.elementSwing(elementNow(), heavy);
  },
  /** Vung hụt (không trúng ai) */
  whiff() {
    kit.whiff();
  },
  /** Tiếng đập khi trúng đòn nặng: thump trầm + vỡ giòn + giảm nhạc */
  impact(power = 1) {
    bumpCombat(0.3 * power);
    const v = voice("impact", 0.6, 3, 0.2);
    if (!v) return;
    tone(v, 95, 0, 0.28, "sine", 0.4 * power, 42);
    noise(v, 0, 0.14, 0.28 * power, 1400, 180, 1.1);
    if (power >= 1.2) kit.explode(elementNow(), power - 0.4);
    else duckMusic(power);
  },
  /** Nổ diện rộng (thiên thạch, lỗ đen sập, tuyệt kỹ) */
  explode(el?: Element, power = 1) {
    kit.explode(el ?? elementNow(), power);
  },
  /** Chuỗi hoà âm: hoạ âm bậc n của nốt gốc 110 Hz (f, 2f, 3f… — Pythagoras: tỉ số nguyên nghe "thuận tai") */
  harmonic(n: number) {
    const v = voice("ui", 1.7, 2, 0.4);
    if (!v) return;
    tone(v, 110 * n, 0, 1.6, "sine", 0.2);
    tone(v, 110 * n * 2, 0, 0.9, "triangle", 0.05);
  },
  /** Cá voi sao cất tiếng (vol theo khoảng cách) */
  whale(vol = 0.12) {
    whaleSong(vol);
  },
  /** Chòm sao hoàn thành: chuỗi chuông ngũ cung dài đi lên + nền trầm */
  constellation() {
    const v = voice("ui", 3.6, 3, 0.4);
    if (!v) return;
    for (let i = 0; i < 10; i++) tone(v, PENTA[i % PENTA.length] * (i >= 8 ? 2 : 1), i * 0.11, 1.2, "triangle", 0.13);
    tone(v, 130.81, 0, 3.5, "sine", 0.18);
    tone(v, 196, 0.4, 3.2, "sine", 0.1);
  },
  /** Mở khoá / đúng: chuỗi chuông ngũ cung đi lên */
  chime(level = 0) {
    const v = voice("ui", 1.6, 2, 0.35);
    if (!v) return;
    for (let i = 0; i < 4; i++) tone(v, PENTA[(i + level) % PENTA.length] * (i > 3 ? 2 : 1), i * 0.07, 0.6, "triangle", 0.16);
    tone(v, PENTA[(level + 4) % PENTA.length] * 2, 0.3, 1.2, "sine", 0.08);
  },
  /** Vòng phép hiện lên */
  circle() {
    const v = voice("spell", 1, 2, 0.35);
    if (!v) return;
    tone(v, 220, 0, 0.9, "sawtooth", 0.04, 440);
    tone(v, 330, 0.05, 0.9, "triangle", 0.06, 660);
    noise(v, 0, 0.6, 0.06, 800, 6000, 3);
  },
  /** Tung phép / bắn (vút) — theo nguyên tố: cung = dây bật, điện = xẹt, còn lại = vút sáng */
  cast() {
    const el = elementNow();
    const v = voice("spell", 0.5, 2, 0.25);
    if (!v) return;
    if (el === "wind") {
      // dây cung bật: gảy trầm + nhiễu ngắn
      osc(v.c, v.out, { type: "triangle", f0: 118 * (0.95 + Math.random() * 0.1), f1: 105, t: v.t, a: 0.002, d: 0.18, gain: 0.22 });
      noise(v, 0, 0.12, 0.18, 4500, 1200, 0.9);
    } else if (el === "lightning") {
      noise(v, 0, 0.012, 0.3, 6000, 4000, 0.7);
      osc(v.c, v.out, { type: "square", f0: 1100, f1: 180, t: v.t + 0.01, d: 0.16, gain: 0.05, lp: 3500 });
    } else {
      noise(v, 0, 0.25, 0.25, 6000, 600, 0.8);
      tone(v, 880 * (0.94 + Math.random() * 0.12), 0, 0.25, "square", 0.05, 1760);
    }
  },
  /** Phép vẽ (đúng khung castSpell) — đặt nguyên tố cho các đòn trúng tiếp theo */
  spell(id: string) {
    sfx.element(spellElement(id), id === "vortex" ? 2400 : 1600);
    kit.spellCast(id);
  },
  /** Trúng đòn — kèm "khựng hình" phía hình ảnh. combo/power: 0 thường · 1 nặng · 2 chí mạng */
  hit(combo = 0) {
    kit.elementHit(elementNow(), (Math.max(0, Math.min(2, combo)) as 0 | 1 | 2));
    bumpCombat(0.22 + combo * 0.08);
  },
  /** Báo trước đòn quái (lúc nó bắt đầu vung, ~0,45 s trước khi trúng): tiếng rít lên + tích nhỏ, nhỏ dần theo khoảng cách */
  telegraph(dist = 0) {
    if (dist > 22) return;
    const k = 1 / (1 + dist / 5);
    const v = voice("ui", 0.5, 1, 0.1);
    if (!v) return;
    tone(v, 520, 0, 0.32, "triangle", 0.09 * k, 1180);
    noise(v, 0, 0.3, 0.05 * k, 2600, 5200, 2.2);
    tone(v, 1560, 0.3, 0.05, "square", 0.05 * k);
  },
  /** Người chơi bị đánh */
  hurt() {
    kit.hurt();
    bumpCombat(0.5);
  },
  /** Khiên đỡ đòn */
  shield() {
    kit.wardBlock();
  },
  /** Giáo Sin — đỉnh sóng đi qua quái: "bloop" sin, cao độ theo biên độ (to → trầm, đầy); tăng cường thêm bồi âm quãng tám */
  waveCrest(amp = 1, constructive = false) {
    const v = voice("impact", 0.45, 2, 0.35);
    if (!v) return;
    const a = Math.max(0.2, Math.min(2.6, amp));
    tone(v, 760 / Math.sqrt(a), 0, 0.22, "sine", 0.1 + 0.05 * a, 300 / Math.sqrt(a));
    noise(v, 0, 0.08, 0.05 + 0.03 * a, 2600, 900, 1.6);
    if (constructive) tone(v, 1520 / Math.sqrt(a), 0.02, 0.3, "triangle", 0.08, 1180);
  },
  /** Hai sóng gặp nhau: tăng cường = hợp âm quãng 5 sáng; triệt tiêu = hai nốt lệch nhau rồi tắt lịm (phách) */
  interfere(constructive: boolean) {
    const v = voice("ui", 0.9, 2, 0.4);
    if (!v) return;
    if (constructive) {
      tone(v, 440, 0, 0.6, "sine", 0.14);
      tone(v, 660, 0.03, 0.6, "sine", 0.1);
      tone(v, 880, 0.06, 0.5, "triangle", 0.06);
    } else {
      tone(v, 440, 0, 0.5, "sine", 0.1, 300);
      tone(v, 446, 0, 0.5, "sine", 0.1, 296);
    }
  },
  /** Khiên Con lắc đỡ đòn: hoàn hảo = gong kim loại + chuông thời gian; tốt = keng; yếu = đục */
  parry(grade: "perfect" | "good" | "weak") {
    if (grade === "perfect") {
      sfx.element("time", 900);
      kit.elementHit("time", 2);
      const v = voice("impact", 1.4, 3, 0.45);
      if (v) {
        tone(v, 196, 0, 1.2, "triangle", 0.2, 188);
        tone(v, 196 * 2.76, 0, 0.8, "sine", 0.08);
        tone(v, 1175, 0.05, 0.9, "sine", 0.07);
      }
      duckMusic(0.8);
      return;
    }
    kit.wardBlock();
    const v = voice("impact", 0.4, 2, 0.2);
    if (!v) return;
    if (grade === "good") tone(v, 520, 0, 0.18, "triangle", 0.12, 480);
    else noise(v, 0, 0.12, 0.16, 900, 200, 0.8);
  },
  /** Tích tắc khi quả lắc qua đáy trong thế đỡ (nhịp để canh đòn) */
  pendTick(strong = false) {
    const v = voice("ui", 0.12, 1, 0.1);
    if (!v) return;
    tone(v, strong ? 1760 : 1320, 0, 0.05, "square", strong ? 0.05 : 0.03);
  },
  /** Khiên vỡ / quái tan / thuần hoá thành công: mảnh pha lê theo hợp âm + nhiễu vỡ */
  shatter() {
    const v = voice("impact", 1.2, 2, 0.35);
    if (!v) return;
    for (let i = 0; i < 6; i++) tone(v, 1500 + Math.random() * 2500, i * 0.025, 0.25, "triangle", 0.06);
    noise(v, 0, 0.5, 0.25, 8000, 500, 0.5);
    setTimeout(() => sfx.chime(2), 250);
  },
  /** Sai */
  miss() {
    const v = voice("ui", 0.6, 1, 0.1);
    if (!v) return;
    tone(v, 330, 0, 0.25, "triangle", 0.12, 220);
    tone(v, 247, 0.12, 0.35, "triangle", 0.1, 165);
  },
  step() {
    const v = voice("move", 0.1, 1, 0);
    if (!v) return;
    noise(v, 0, 0.06, 0.05, 1200, 400, 2);
  },
  /** Lướt / né */
  dash() {
    kit.dash();
  },
  /** Nhặt đồ (rare: vũ khí / đồ hiếm) */
  pickup(rare = false) {
    kit.pickup(rare);
  },
  /** Mở rương */
  chest() {
    kit.chest();
  },
  /** Thăng cấp / hoàn thành nhiệm vụ (theo khoá nhạc vùng) */
  levelUp() {
    // "Amen" hợp xướng (iv → I, render sẵn); chưa tải → kèn hợp âm tổng hợp cũ
    if (!playStinger("amen")) kit.levelUp();
  },
  /** Vẽ ký hiệu: bắt đầu / nhận ra (khoá) / không nhận ra */
  sigilStart() {
    kit.sigilStart();
  },
  sigilLock(id: string) {
    kit.sigilLock(id);
  },
  sigilFail() {
    kit.sigilFail();
  },
  click() {
    const v = voice("ui", 0.1, 1, 0);
    if (!v) return;
    tone(v, 1320, 0, 0.06, "sine", 0.08);
  },
  /** Rê chuột qua nút: tích celesta rất nhỏ */
  hover() {
    const v = voice("ui", 0.08, 0, 0.05);
    if (!v) return;
    osc(v.c, v.out, { f0: 2637 * (0.98 + Math.random() * 0.04), t: v.t, a: 0.002, d: 0.045, gain: 0.018 });
  },
  /** Mở bảng: hai nốt celesta đi lên (quãng ba) */
  uiOpen() {
    const v = voice("ui", 0.4, 1, 0.25);
    if (!v) return;
    osc(v.c, v.out, { f0: 1318.5, t: v.t, a: 0.003, d: 0.16, gain: 0.045 });
    osc(v.c, v.out, { f0: 1661.2, t: v.t + 0.06, a: 0.003, d: 0.22, gain: 0.04 });
  },
  /** Đóng bảng / quay lại: hai nốt đi xuống (quãng bốn) */
  uiBack() {
    const v = voice("ui", 0.35, 1, 0.2);
    if (!v) return;
    osc(v.c, v.out, { f0: 1318.5, t: v.t, a: 0.003, d: 0.12, gain: 0.035 });
    osc(v.c, v.out, { f0: 987.8, t: v.t + 0.055, a: 0.003, d: 0.18, gain: 0.032 });
  },
  /** Bước chân theo mặt đất (nhỏ, ngẫu nhiên ±) */
  footstep(s: Surface, speed = 3) {
    const v = voice("move", 0.2, 0, 0.04);
    if (!v) return;
    const k = Math.min(1.3, 0.55 + speed / 10) * (0.85 + Math.random() * 0.3);
    const j = 0.9 + Math.random() * 0.2;
    const N = (dur: number, f0: number, f1: number, q: number, g: number, t = 0) => noiseHit(v.core, v.out, { t: v.t + t, dur, f0: f0 * j, f1: f1 * j, q, gain: g * k * LEG });
    switch (s) {
      case "grass":
      case "leaf":
        N(0.11, 2600, 1300, 0.9, 0.05);
        N(0.05, 600, 300, 1, 0.03);
        break;
      case "sand":
      case "snow":
        N(0.14, s === "snow" ? 3200 : 1800, 900, 0.8, 0.05);
        break;
      case "wood":
        osc(v.c, v.out, { type: "triangle", f0: 240 * j, f1: 170, t: v.t, a: 0.002, d: 0.06, gain: 0.05 * k });
        N(0.04, 1500, 700, 1.5, 0.03);
        break;
      case "paper":
        N(0.07, 3400, 1800, 1.2, 0.045);
        N(0.03, 5200, 4000, 2, 0.02, 0.03);
        break;
      case "crystal":
        osc(v.c, v.out, { f0: 2100 * j, t: v.t, a: 0.001, d: 0.05, gain: 0.012 * k });
        N(0.04, 2200, 1200, 1.5, 0.035);
        break;
      default:
        osc(v.c, v.out, { f0: 190 * j, f1: 120, t: v.t, a: 0.002, d: 0.05, gain: 0.05 * k });
        N(0.05, 2400, 1000, 1.2, 0.035);
    }
  },
  /** Tiếp đất sau cú rơi (power ~ thời gian trên không, giây) */
  land(s: Surface, power = 0.5) {
    const v = voice("move", 0.35, 1, 0.08);
    if (!v) return;
    const p = Math.min(1.5, 0.5 + power);
    osc(v.c, v.out, { f0: 110, f1: 55, t: v.t, a: 0.003, d: 0.12, gain: 0.08 * p });
    noiseHit(v.core, v.out, { t: v.t, dur: 0.1, f0: s === "grass" || s === "leaf" ? 1800 : 1200, f1: 400, q: 0.8, gain: 0.05 * p * LEG });
  },
  /** Xuống nước: quét nhiễu 3 kHz → 700 Hz + bong bóng */
  splash(power = 1) {
    const v = voice("move", 0.7, 2, 0.15);
    if (!v) return;
    const p = Math.min(1.4, power);
    noiseHit(v.core, v.out, { t: v.t, dur: 0.38, f0: 3000, f1: 700, q: 0.7, gain: 0.12 * p * LEG });
    for (let i = 0; i < 3; i++) osc(v.c, v.out, { f0: 500 + Math.random() * 500, f1: 1300 + Math.random() * 800, t: v.t + 0.08 + i * 0.05, d: 0.04, gain: 0.03 * p });
  },
  /** Sải bơi: nước gợn trầm */
  swimStroke() {
    const v = voice("move", 0.35, 0, 0.1);
    if (!v) return;
    noiseHit(v.core, v.out, { t: v.t, dur: 0.24, f0: 1200 * (0.9 + Math.random() * 0.2), f1: 300, q: 0.9, gain: 0.05 * LEG, a: 0.06 });
  },
  /** Đặt / phá khối voxel theo vật liệu (id trong BLOCKS) */
  block(kind: "place" | "break", id: number) {
    const name = BLOCKS[id] ?? "stone";
    const soft = ["grass", "dirt", "moss", "leaf", "blossom", "pine", "sand", "snow"].includes(name);
    const wood = ["wood", "plank", "rope", "bench", "torch"].includes(name);
    const glass = ["glass", "crystal", "intcrystal"].includes(name);
    const v = voice(kind === "break" ? "impact" : "ui", 0.35, 2, 0.12);
    if (!v) return;
    const j = 0.9 + Math.random() * 0.2;
    if (kind === "place") {
      osc(v.c, v.out, { type: "triangle", f0: (wood ? 260 : soft ? 180 : 220) * j, f1: 140, t: v.t, a: 0.002, d: 0.07, gain: 0.07 });
      noiseHit(v.core, v.out, { t: v.t, dur: 0.05, f0: soft ? 1400 : 2200, f1: 800, q: 1.2, gain: 0.05 * LEG });
      return;
    }
    if (glass) for (let i = 0; i < 4; i++) osc(v.c, v.out, { f0: (1800 + Math.random() * 2200) * j, t: v.t + i * 0.022, a: 0.001, d: 0.09, gain: 0.025 });
    for (let i = 0; i < (soft ? 2 : 4); i++) noiseHit(v.core, v.out, { t: v.t + i * 0.03 * j, dur: 0.05, f0: (soft ? 1500 : wood ? 1900 : 2600) * j, f1: 600, q: 1.1, gain: (soft ? 0.06 : 0.08) * LEG });
    osc(v.c, v.out, { type: "triangle", f0: (wood ? 200 : soft ? 120 : 160) * j, f1: 70, t: v.t, a: 0.002, d: 0.1, gain: 0.08 });
  },
  /** Hình strike() (VFX) tới cao trào: lớp rất nhỏ, theo nhóm hình (delayMs = báo trước + nín thở) */
  strike(shape: string, r = 2, delayMs = 0) {
    if (shape === "muzzle") return; // mỗi phát bắn đã có tiếng riêng
    const v = voice("ambient", 0.6 + delayMs / 1000, 1, 0.25);
    if (!v) return;
    const t = delayMs / 1000;
    const k = Math.min(1.2, 0.5 + r / 6);
    if (["rupture", "crater", "crest", "drop", "piston", "wall", "land", "scorch"].includes(shape)) {
      osc(v.c, v.out, { f0: 70, f1: 38, t: v.t + t, a: 0.004, d: 0.25, gain: 0.06 * k });
    } else if (["sigil", "star", "converge", "hex", "iris", "gate", "dial", "grid", "knight"].includes(shape)) {
      osc(v.c, v.out, { f0: 1760 * (0.97 + Math.random() * 0.06), t: v.t + t, a: 0.003, d: 0.25, gain: 0.015 * k });
      osc(v.c, v.out, { f0: 2637, t: v.t + t + 0.03, a: 0.003, d: 0.2, gain: 0.01 * k });
    } else {
      noiseHit(v.core, v.out, { t: v.t + t, dur: 0.14, f0: 900, f1: 2600, q: 1.2, gain: 0.03 * k * LEG, a: 0.04 });
    }
  },
  /** Trống dồn (game show): các nhịp nhiễu dày dần + mạnh dần, kết bằng một cú chũm choẹ */
  drumroll(dur = 1.2) {
    const v = voice("ui", dur + 0.8, 2, 0.2);
    if (!v) return;
    const n = Math.round(dur * 26);
    for (let i = 0; i < n; i++) noise(v, i * (dur / n), 0.05, 0.05 + 0.18 * (i / n), 1800, 500, 1.5);
    noise(v, dur, 0.7, 0.28, 9000, 2500, 0.6);
  },
  /** Kèn chiến thắng: hợp âm rải trưởng đi lên + hợp âm ngân */
  fanfare() {
    if (playStinger("victory", 0.9)) return;
    const v = voice("ui", 1.9, 3, 0.35);
    if (!v) return;
    const n = [523.25, 659.25, 783.99, 1046.5];
    n.forEach((f, i) => tone(v, f, i * 0.11, 0.3, "square", 0.06));
    n.forEach((f) => tone(v, f, 0.48, 1.3, "sawtooth", 0.035));
    tone(v, 1318.51, 0.48, 1.3, "triangle", 0.07);
  },
  /** Tiếng dê "be-e-e": răng cưa có rung tần số, lọc formant */
  baa() {
    const v = voice("ui", 0.9, 2, 0.15);
    if (!v) return;
    const { c, out } = v;
    const t0 = v.t;
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
    g.gain.linearRampToValueAtTime(0.22 * LEG, t0 + 0.05);
    g.gain.setValueAtTime(0.22 * LEG, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
    o.connect(f);
    f.connect(g);
    g.connect(out);
    o.onended = () => {
      o.disconnect();
      lfo.disconnect();
      lg.disconnect();
      f.disconnect();
      g.disconnect();
    };
    o.start(t0);
    lfo.start(t0);
    o.stop(t0 + 0.85);
    lfo.stop(t0 + 0.85);
  },
  /** Búa gõ gỗ (đóng ván): hai nhịp gỗ khô */
  knock() {
    const v = voice("ui", 0.4, 1, 0.15);
    if (!v) return;
    for (let i = 0; i < 2; i++) {
      tone(v, 190 - i * 30, i * 0.14, 0.09, "square", 0.09, 120);
      noise(v, i * 0.14, 0.07, 0.18, 2600, 900, 2);
    }
  },
  /** Cửa sân khấu kẽo kẹt mở */
  creak() {
    const v = voice("ui", 0.6, 1, 0.15);
    if (!v) return;
    tone(v, 140, 0, 0.5, "sawtooth", 0.04, 95);
    noise(v, 0, 0.45, 0.06, 900, 300, 6);
  },
  /**
   * "The Fold" — glissando Shepard–Risset: 7 sóng sin cách nhau một quãng tám cùng trượt lên; biên độ theo hình chuông
   * trên trục log-tần số nên âm thanh như đi lên mãi mà không bao giờ cao hơn (ảo giác thính giác). + tiếng ầm gió nền.
   */
  fold(dur = 4.8) {
    const v = voice("ambient", dur + 0.6, 4, 0.3);
    if (!v) return;
    const { c, out } = v;
    const t0 = v.t;
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
        g.gain.linearRampToValueAtTime(0.05 * LEG * bell * Math.max(0, env), t0 + tt);
      }
      o.connect(g);
      g.connect(out);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      o.start(t0);
      o.stop(t0 + dur + 0.1);
    }
    noise(v, 0, dur, 0.09, 200, 2400, 0.6);
    // cửa chớp đóng sập giữa chuyến
    setTimeout(() => {
      const w = voice("impact", 0.6, 3, 0.2);
      if (!w) return;
      tone(w, 70, 0, 0.5, "square", 0.12, 40);
      noise(w, 0, 0.3, 0.3, 3000, 200, 0.8);
    }, dur * 470);
  },
};

export function setSfxEnabled(on: boolean) {
  try {
    localStorage.setItem("world.sfx", on ? "on" : "off");
  } catch {}
  // lõi âm thanh nghe sự kiện này: tắt → im + tạm dừng ngữ cảnh (cả nhạc nền); bật → tiếp tục
  try {
    window.dispatchEvent(new Event("world:sound"));
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
let wind: { src: AudioBufferSourceNode; bp: BiquadFilterNode; g: GainNode; ctx: AudioContext } | null = null;
export function setWind(level: number) {
  const k = level > 0.01 || wind ? audioCore() : null;
  if (!k || k.ctx.state !== "running") return;
  const c = k.ctx;
  if (!wind || wind.ctx !== c) {
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
    g.connect(k.sfx);
    src.start();
    wind = { src, bp, g, ctx: c };
  }
  const L = Math.max(0, Math.min(1, level));
  wind.g.gain.setTargetAtTime(L * 0.45, c.currentTime, 0.25);
  wind.bp.frequency.setTargetAtTime(260 + L * 1500, c.currentTime, 0.3);
}
