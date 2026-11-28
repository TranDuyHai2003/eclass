"use client";
/**
 * Lõi âm thanh DÙNG CHUNG của thế giới (một AudioContext duy nhất cho hiệu ứng, nhạc nền và Mê cung Hoạ âm):
 *
 *   giọng SFX ─► sfxBus (âm lượng Hiệu ứng) ─┐
 *   giọng nhạc ─► vùng (crossfade) ─► duck ─► musicBus (âm lượng Nhạc) ─┤─► master (công tắc chung) ─► limiter ─► loa
 *   gửi vang (mọi giọng) ─► vang mạng trễ 3 nhánh (không convolution) ─┘
 *
 * - Chỉ tạo / mở AudioContext sau thao tác đầu tiên của người dùng (quy định autoplay); ẩn tab → tạm dừng.
 * - Công tắc âm thanh chung: localStorage "world.sfx" = "off" (lib/world/sfx.ts setSfxEnabled phát sự kiện "world:sound").
 * - Âm lượng Nhạc / Hiệu ứng: localStorage "world.vol.music" / "world.vol.sfx" (0…1, đường cong bình phương).
 * - Giới hạn giọng + gộp đòn trùng khung (VoicePool), ducking nhạc khi có đòn lớn.
 */
import { DUCK, VoicePool, duckDb, dbToGain, type VoiceCat } from "@/lib/world/musicVoices";

const KEY_VOL = { music: "world.vol.music", sfx: "world.vol.sfx" } as const;
const DEF_VOL = { music: 0.55, sfx: 0.85 } as const;
/** mức tham chiếu của từng bus (nhạc nhỏ hơn hiệu ứng ~ 10 dB: nền, không giành chỗ) */
const BUS_REF = { music: 0.32, sfx: 0.9 } as const;

export type Core = {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  duck: GainNode;
  verb: GainNode;
  noise: AudioBuffer;
};

let core: Core | null = null;
let gestured = false;
let duckLevel = 0;
const pool = new VoicePool();
const liveGain = new Map<number, GainNode>();
const listeners = new Set<() => void>();

export function soundOn(): boolean {
  try {
    return localStorage.getItem("world.sfx") !== "off";
  } catch {
    return true;
  }
}

export function getVol(kind: "music" | "sfx"): number {
  try {
    const raw = localStorage.getItem(KEY_VOL[kind]);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEF_VOL[kind];
  } catch {
    return DEF_VOL[kind];
  }
}
const busGain = (kind: "music" | "sfx") => BUS_REF[kind] * getVol(kind) * getVol(kind);

export function setVol(kind: "music" | "sfx", v: number) {
  try {
    localStorage.setItem(KEY_VOL[kind], String(Math.max(0, Math.min(1, v))));
  } catch {}
  if (core) core[kind].gain.setTargetAtTime(busGain(kind), core.ctx.currentTime, 0.05);
  emit();
}

/** Đăng ký nghe thay đổi trạng thái (mở khoá, bật/tắt, ẩn tab, âm lượng) — trả về hàm huỷ */
export function onAudioChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((f) => f());
}

/** Đã có thao tác người dùng (được phép phát) */
export function audioUnlocked(): boolean {
  if (gestured) return true;
  try {
    return !!(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
  } catch {
    return false;
  }
}

function build(): Core | null {
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  let ctx: AudioContext;
  try {
    ctx = new C({ latencyHint: "interactive" });
  } catch {
    return null;
  }
  // giới hạn đỉnh cuối chuỗi (−2 dBTP gần đúng): nhiều đòn + nhạc cùng lúc không vỡ tiếng
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -8;
  lim.knee.value = 6;
  lim.ratio.value = 12;
  lim.attack.value = 0.003;
  lim.release.value = 0.22;
  lim.connect(ctx.destination);
  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(lim);
  const sfx = ctx.createGain();
  sfx.gain.value = BUS_REF.sfx * getVol("sfx") ** 2;
  sfx.connect(master);
  const music = ctx.createGain();
  music.gain.value = BUS_REF.music * getVol("music") ** 2;
  music.connect(master);
  const duck = ctx.createGain();
  duck.connect(music);
  // vang rẻ: 3 đường trễ hồi tiếp lệch nhau, lọc thông thấp trong vòng (đuôi ấm) — như sirenSynth
  const verb = ctx.createGain();
  verb.gain.value = 0.5;
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.55;
  verbOut.connect(master);
  for (const [d, fb] of [
    [0.0557, 0.5],
    [0.0743, 0.47],
    [0.0891, 0.44],
  ] as const) {
    const dl = ctx.createDelay(0.3);
    dl.delayTime.value = d * 1.6;
    const g = ctx.createGain();
    g.gain.value = fb;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    verb.connect(dl);
    dl.connect(lp);
    lp.connect(g);
    g.connect(dl);
    lp.connect(verbOut);
  }
  // một bộ đệm nhiễu trắng 2 s dùng lại cho mọi tiếng nhiễu (phát từ vị trí ngẫu nhiên)
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return { ctx, master, sfx, music, duck, verb, noise };
}

/**
 * Lấy lõi âm thanh (tạo nếu cần). null khi: chạy phía server, tắt âm thanh chung, hoặc chưa có thao tác người dùng
 * (create = false: chỉ trả về lõi đã có).
 */
export function audioCore(create = true): Core | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  if (!core) {
    if (!create || !audioUnlocked()) return null;
    core = build();
    if (!core) return null;
    emit();
  }
  if (core.ctx.state === "suspended" && !document.hidden) core.ctx.resume().catch(() => {});
  return core;
}

/** AudioContext dùng chung (cho bộ tổng hợp khác như Mê cung Hoạ âm) — null nếu chưa được phép */
export function sharedContext(): AudioContext | null {
  return audioCore()?.ctx ?? null;
}
/** Nút đầu vào bus hiệu ứng (bộ tổng hợp khác nối vào đây để theo âm lượng Hiệu ứng + công tắc chung) */
export function sfxInput(): AudioNode | null {
  return audioCore()?.sfx ?? null;
}

/** Ngữ cảnh đang chạy được (đã mở khoá, đang bật, tab hiện) */
export function audioRunning(): boolean {
  return !!core && soundOn() && core.ctx.state === "running";
}

// ───────────── Giọng ─────────────

export type Voice = { c: AudioContext; out: GainNode; t: number; gain: number; core: Core };

function makeVoice(cat: VoiceCat, prio: number, dur: number, dest: AudioNode, send: number): Voice | null {
  const k = audioCore();
  if (!k || k.ctx.state !== "running") return null;
  const c = k.ctx;
  const g0 = pool.request(cat, prio, c.currentTime, dur);
  if (!g0) return null;
  for (const id of g0.steal) {
    const g = liveGain.get(id);
    if (g) {
      // cướp giọng: tắt nhanh 6 ms (không "click")
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0, c.currentTime, 0.006);
      liveGain.delete(id);
    }
  }
  const out = c.createGain();
  out.gain.value = g0.gain;
  out.connect(dest);
  if (send > 0) {
    const s = c.createGain();
    s.gain.value = send;
    out.connect(s);
    s.connect(k.verb);
    setTimeout(() => s.disconnect(), (dur + 2.5) * 1000);
  }
  liveGain.set(g0.id, out);
  setTimeout(
    () => {
      liveGain.delete(g0.id);
      pool.release(g0.id);
      out.disconnect();
    },
    (dur + 2.5) * 1000,
  );
  return { c, out, t: c.currentTime + 0.004, gain: g0.gain, core: k };
}

/** Một giọng hiệu ứng: nối vào bus Hiệu ứng (+ gửi vang). null = tắt / quá số giọng */
export function sfxVoice(cat: Exclude<VoiceCat, "music">, prio: number, dur: number, send = 0.2): Voice | null {
  const k = audioCore();
  if (!k) return null;
  return makeVoice(cat, prio, dur, k.sfx, send);
}

/** Một giọng nhạc: nối vào nút vùng (đã qua crossfade) */
export function musicVoice(dest: AudioNode, dur: number, send = 0.3, prio = 1): Voice | null {
  return makeVoice("music", prio, dur, dest, send);
}

/** Đếm giọng đang sống (kiểm thử trong trình duyệt) */
export function voiceStats() {
  return { sfx: pool.count(), music: pool.count("music"), duckDb: duckLevel };
}

/** Giảm nhạc nền khi có đòn lớn (power 1 = nặng, 1,5+ = tuyệt kỹ) */
export function duckMusic(power = 1) {
  const k = core;
  if (!k || k.ctx.state !== "running") return;
  const c = k.ctx;
  const t = c.currentTime;
  duckLevel = duckDb(power, duckLevel);
  const g = k.duck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(dbToGain(-duckLevel), t + DUCK.attack);
  g.setValueAtTime(dbToGain(-duckLevel), t + DUCK.attack + DUCK.hold);
  g.setTargetAtTime(1, t + DUCK.attack + DUCK.hold, DUCK.release / 3);
  const lvl = duckLevel;
  setTimeout(() => {
    if (duckLevel === lvl) duckLevel = 0;
  }, (DUCK.attack + DUCK.hold + DUCK.release) * 1000);
}

// ───────────── Mở khoá / bật tắt / ẩn tab ─────────────

if (typeof window !== "undefined") {
  const unlock = () => {
    gestured = true;
    // tạo + resume NGAY trong sự kiện người dùng (iOS Safari đòi hỏi)
    const k = audioCore();
    if (k && k.ctx.state !== "running") k.ctx.resume().then(emit, () => {});
    emit();
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!core) return;
    if (document.hidden) core.ctx.suspend().then(emit, () => {});
    else if (soundOn()) core.ctx.resume().then(emit, () => {});
  });
  const applyOn = () => {
    if (!core) {
      emit();
      return;
    }
    const t = core.ctx.currentTime;
    if (soundOn()) {
      core.ctx.resume().then(emit, () => {});
      core.master.gain.setTargetAtTime(1, t, 0.05);
    } else {
      core.master.gain.setTargetAtTime(0, t, 0.03);
      setTimeout(() => {
        if (!soundOn() && core) core.ctx.suspend().then(emit, () => {});
      }, 200);
    }
    emit();
  };
  window.addEventListener("world:sound", applyOn);
  window.addEventListener("storage", (e) => {
    if (e.key === "world.sfx") applyOn();
  });
}
