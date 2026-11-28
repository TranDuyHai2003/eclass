"use client";
/**
 * Phát nhạc nền RENDER SẴN (scripts/audio-render.py → public/world/audio, manifest lib/world/musicTracks.ts).
 *  - Tải lười theo bản (fetch → decodeAudioData trên OfflineAudioContext 32 kHz: ~½ bộ nhớ), giữ tối đa 3 bản (LRU).
 *    Opus (.ogg) trước, lỗi / không hỗ trợ (Safari cũ) → AAC (.m4a). Thiếu file → bỏ qua, không ném lỗi.
 *  - Lập lịch theo đồng hồ AudioContext (tick 50 ms của musicDirector, nhìn trước 1,2 s): nền (bed) mỗi vòng, câu giai điệu mỗi
 *    khe (CellPlanner: biến thể / nghỉ, không lặp liền), lớp dọc "dissonance" / "boss", glitch 1 ô nhịp; cập nhật MUSIC_KEY theo hợp âm
 *    từng ô (SFX có cao độ vẫn hợp với nhạc).
 *  - Mê cung Hoạ âm: lưới nhịp neo theo HARMONIC (96 BPM, ClockAnchor + bù outputLatency); decomposition → lọc thông thấp,
 *    dissonance → trộn lớp bất hoà + glitch.
 *  - Stinger (amen / victory / defeat / bossReveal / portal): sprite một file, dịch giọng về chủ âm đang phát, đi bus Hiệu ứng,
 *    nhạc nền hạ ~6 dB trong lúc phát.
 */
import { TRACKS, STINGERS } from "@/lib/world/musicTracks";
import { CellPlanner, ClockAnchor, barSec, glitchChance, layerMix, lowpassFor, loopSec, stingerRate, type TrackDef } from "@/lib/world/musicStems";
import { mulberry32 } from "@/lib/world/music";
import { HARMONIC } from "@/lib/world/harmonicState";
import { MUSIC_KEY } from "./sfxKit";
import { audioCore, audioRunning, sfxVoice, type Core } from "./engine";

const BASE = "/world/audio/";
const AHEAD = 1.2;

// ───────────── tải / giải mã ─────────────

let ext: ".ogg" | ".m4a" | null = null;
function pickExt(): ".ogg" | ".m4a" {
  if (ext) return ext;
  try {
    ext = document.createElement("audio").canPlayType('audio/ogg; codecs="opus"') ? ".ogg" : ".m4a";
  } catch {
    ext = ".m4a";
  }
  return ext;
}

let decoder: BaseAudioContext | null = null;
function decoderCtx(core: Core): BaseAudioContext {
  if (decoder) return decoder;
  try {
    const O = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    decoder = O ? new O(2, 1, 32000) : core.ctx;
  } catch {
    decoder = core.ctx;
  }
  return decoder;
}

function decode(c: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((res, rej) => {
    try {
      const p = c.decodeAudioData(data, res, rej) as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === "function") p.then(res, rej);
    } catch (e) {
      rej(e);
    }
  });
}

const cache = new Map<string, Promise<AudioBuffer | null>>();
const ready = new Map<string, AudioBuffer>();
const loads = { ok: 0, fail: 0 };

async function fetchDecode(core: Core, f: string, e: string): Promise<AudioBuffer | null> {
  try {
    const r = await fetch(BASE + f + e);
    if (!r.ok) return null;
    return await decode(decoderCtx(core), await r.arrayBuffer());
  } catch {
    return null;
  }
}

function load(core: Core, f: string): Promise<AudioBuffer | null> {
  let p = cache.get(f);
  if (!p) {
    p = (async () => {
      let b = await fetchDecode(core, f, pickExt());
      if (!b && ext === ".ogg") {
        b = await fetchDecode(core, f, ".m4a");
        if (b) ext = ".m4a";
      }
      if (b) {
        ready.set(f, b);
        loads.ok++;
      } else loads.fail++;
      return b;
    })();
    cache.set(f, p);
  }
  return p;
}

const files = (t: TrackDef) => [t.bed?.f, ...t.cells.map((c) => c.f), ...t.layers.map((l) => l.f), ...t.glitch.map((g) => g.f)].filter((x): x is string => !!x);
const recent: string[] = [];
function touch(id: string) {
  const i = recent.indexOf(id);
  if (i >= 0) recent.splice(i, 1);
  recent.unshift(id);
  // giữ bộ đệm của 3 bản gần nhất (+ stinger)
  const keep = new Set<string>([STINGERS.f]);
  for (const r of recent.slice(0, 3)) if (TRACKS[r]) files(TRACKS[r]).forEach((f) => keep.add(f));
  for (const k of [...cache.keys()]) if (!keep.has(k)) (cache.delete(k), ready.delete(k));
  recent.length = Math.min(recent.length, 3);
}

// ───────────── điều khiển (do musicDirector cập nhật) ─────────────

export type StemCtrl = { boss: boolean; harmonic: boolean };

/** Nút "dip" chung trước duck: hạ nhạc dưới stinger */
let dip: GainNode | null = null;
function dipNode(core: Core): GainNode {
  if (!dip || dip.context !== core.ctx) {
    dip = core.ctx.createGain();
    dip.connect(core.duck);
  }
  return dip;
}

export class StemPlayer {
  def: TrackDef;
  out: GainNode;
  private lp: BiquadFilterNode | null = null;
  private bed: GainNode;
  private cells: GainNode;
  private glitch: GainNode;
  private layer: Record<string, GainNode> = {};
  private planner: CellPlanner;
  private rng: () => number;
  private anchor = new ClockAnchor();
  private epoch = NaN;
  private nLoop = 0;
  private nSlot = 0;
  private nBar = 0;
  private started = false;
  private lastH = NaN;
  private keyQ: { t: number; ch: number[] }[] = [];
  private srcs = new Set<AudioBufferSourceNode>();
  dead = false;
  failed = false;
  private startAt: number;
  private fadeIn: number;
  ctrl: StemCtrl = { boss: false, harmonic: false };

  constructor(
    def: TrackDef,
    private core: Core,
    delay = 0.3,
    fadeIn = 3.5,
  ) {
    this.def = def;
    const c = core.ctx;
    this.rng = mulberry32((Date.now() & 0xffff) ^ 0x51e1);
    this.planner = new CellPlanner(def, this.rng);
    this.out = c.createGain();
    this.out.gain.value = 0;
    let tail: AudioNode = this.out;
    if (def.layers.some((l) => l.param === "dissonance")) {
      this.lp = c.createBiquadFilter();
      this.lp.type = "lowpass";
      this.lp.frequency.value = 16000;
      this.lp.connect(this.out);
      tail = this.lp;
    }
    this.out.connect(dipNode(core));
    const g = () => {
      const n = c.createGain();
      n.connect(tail);
      return n;
    };
    this.bed = g();
    this.cells = g();
    this.glitch = g();
    this.glitch.gain.value = 0.8;
    for (const l of def.layers) {
      this.layer[l.param] = g();
      this.layer[l.param].gain.value = 0;
    }
    this.startAt = c.currentTime + delay;
    this.fadeIn = fadeIn;
    touch(def.id);
    files(def).forEach((f) => void load(core, f));
    if (def.bed)
      void load(core, def.bed.f).then((b) => {
        if (!b) this.failed = true;
      });
    else this.failed = true;
  }

  private play(f: string, t: number, dest: AudioNode, offset = 0) {
    const b = ready.get(f);
    if (!b || offset >= b.duration) return;
    const s = this.core.ctx.createBufferSource();
    s.buffer = b;
    s.connect(dest);
    s.onended = () => {
      s.disconnect();
      this.srcs.delete(s);
    };
    this.srcs.add(s);
    s.start(Math.max(t, this.core.ctx.currentTime), offset);
  }

  /** lưới (epoch = thời điểm ctx của ô 0) */
  grid() {
    return Number.isFinite(this.epoch) ? { t0: this.epoch, beat: 60 / this.def.bpm, bpm: this.def.bpm } : null;
  }

  tick() {
    if (this.dead || this.failed) return;
    const c = this.core.ctx;
    const now = c.currentTime;
    const d = this.def;
    if (!d.bed || !ready.get(d.bed.f)) return;
    const bar = barSec(d);
    const loop = loopSec(d);
    const slot = bar * d.slotBars;
    const lat = (c as AudioContext & { outputLatency?: number }).outputLatency || c.baseLatency || 0;
    const H = this.ctrl.harmonic;
    // chỉ lấy mẫu khi HARMONIC vừa đổi (khung mới) — mẫu cũ sẽ kéo lệch neo
    if (H && HARMONIC.time !== this.lastH) {
      this.lastH = HARMONIC.time;
      this.epoch = this.anchor.update(now - HARMONIC.time) - lat;
    }
    if (H && !Number.isFinite(this.epoch)) return;
    if (!this.started) {
      this.started = true;
      // khởi động: bản thường bắt đầu ở ô 0 ngay; bản theo HARMONIC vào giữa vòng hiện tại
      if (!H) this.epoch = Math.max(now + 0.05, this.startAt);
      const t0 = now + 0.08;
      const k = Math.floor((t0 - this.epoch) / loop);
      const off = t0 - (this.epoch + k * loop);
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(0, now);
      this.out.gain.linearRampToValueAtTime(d.level, now + this.fadeIn);
      if (off > 0.02 && off < loop - 1) {
        this.play(d.bed.f, t0, this.bed, off);
        for (const l of d.layers) this.play(l.f, t0, this.layer[l.param], off);
        this.nLoop = k + 1;
      } else this.nLoop = Math.max(0, Math.ceil((now - this.epoch) / loop - 1e-6));
      this.nSlot = Math.max(0, Math.ceil((now - this.epoch) / slot - 1e-6));
      this.nBar = Math.max(0, Math.ceil((now - this.epoch) / bar - 1e-6));
    }
    // trễ quá (tab ẩn / khựng) hoặc neo nhảy lùi: bỏ phần lỡ, nối lại lưới tương lai
    if (this.epoch + this.nLoop * loop < now - 0.5 || this.epoch + this.nLoop * loop > now + loop + 1) {
      // nối lại lưới tương lai (neo nhảy lùi xa — hiếm — thì phần đã lịch vẫn kêu nốt)
      this.nLoop = Math.ceil((now - this.epoch) / loop - 1e-6);
      this.nSlot = Math.ceil((now - this.epoch) / slot - 1e-6);
      this.nBar = Math.ceil((now - this.epoch) / bar - 1e-6);
      this.keyQ.length = 0;
    }
    for (; this.epoch + this.nLoop * loop < now + AHEAD; this.nLoop++) {
      const t = this.epoch + this.nLoop * loop;
      this.play(d.bed.f, t, this.bed);
      for (const l of d.layers) this.play(l.f, t, this.layer[l.param]);
    }
    const nSlots = Math.max(1, Math.floor(d.bars / d.slotBars));
    for (; this.epoch + this.nSlot * slot < now + AHEAD; this.nSlot++) {
      const f = this.planner.next(this.nSlot % nSlots);
      if (f) this.play(f, this.epoch + this.nSlot * slot, this.cells);
    }
    const dis = H ? HARMONIC.dissonance : 0;
    for (; this.epoch + this.nBar * bar < now + AHEAD; this.nBar++) {
      const t = this.epoch + this.nBar * bar;
      this.keyQ.push({ t, ch: d.chords[this.nBar % d.bars] ?? [0, 4, 7] });
      if (d.glitch.length && this.rng() < glitchChance(dis)) this.play(d.glitch[Math.floor(this.rng() * d.glitch.length)].f, t, this.glitch);
    }
    while (this.keyQ.length && this.keyQ[0].t <= now) {
      const k = this.keyQ.shift()!;
      MUSIC_KEY.root = d.root;
      MUSIC_KEY.scale = d.scale;
      MUSIC_KEY.chord = k.ch;
    }
    // trộn lớp dọc
    const mix = layerMix(dis);
    if (this.layer.dissonance) {
      this.bed.gain.setTargetAtTime(mix.clean, now, 0.3);
      this.layer.dissonance.gain.setTargetAtTime(mix.dis, now, 0.3);
    }
    if (this.layer.boss) this.layer.boss.gain.setTargetAtTime(this.ctrl.boss ? 1 : 0, now, 0.8);
    if (this.lp) this.lp.frequency.setTargetAtTime(lowpassFor(H ? HARMONIC.decomposition : 0), now, 0.4);
  }

  stop(fade = 3) {
    if (this.dead) return;
    this.dead = true;
    const c = this.core.ctx;
    const t = c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(
      () => {
        this.srcs.forEach((s) => {
          try {
            s.stop();
          } catch {}
        });
        this.srcs.clear();
        try {
          this.out.disconnect();
        } catch {}
      },
      (fade + 0.3) * 1000,
    );
  }

  debug() {
    return { track: this.def.id, epoch: this.epoch, loop: this.nLoop, slot: this.nSlot, bar: this.nBar, srcs: this.srcs.size, failed: this.failed, anchor: this.anchor.offset };
  }
}

// ───────────── stinger ─────────────

let lastSting: { s: AudioBufferSourceNode; at: number } | null = null;

/** Tải trước sprite stinger (gọi khi âm thanh đã mở khoá) */
export function preloadStingers() {
  const k = audioCore(false);
  if (k) void load(k, STINGERS.f);
}

/** Phát stinger; false nếu chưa tải / tắt âm (bên gọi có thể dùng tiếng tổng hợp cũ) */
export function playStinger(name: string, gain = 1): boolean {
  const k = audioCore(false);
  const cue = STINGERS.cues[name];
  if (!k || !cue || !audioRunning()) return false;
  const b = ready.get(STINGERS.f);
  if (!b) {
    void load(k, STINGERS.f);
    return false;
  }
  const c = k.ctx;
  const rate = stingerRate(STINGERS.root, MUSIC_KEY.root);
  const dur = cue.dur / rate;
  const v = sfxVoice("ui", 5, dur + 0.2, 0);
  if (!v) return false;
  if (lastSting && c.currentTime - lastSting.at < 0.25) return true;
  if (lastSting) {
    try {
      lastSting.s.stop(c.currentTime + 0.08);
    } catch {}
  }
  const s = c.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = 0.9 * gain;
  s.connect(g);
  g.connect(v.out);
  s.onended = () => {
    s.disconnect();
    g.disconnect();
  };
  s.start(v.t, cue.at, cue.dur);
  lastSting = { s, at: c.currentTime };
  // hạ nhạc nền ~6 dB trong lúc stinger kêu
  const d = dipNode(k);
  const t = c.currentTime;
  d.gain.cancelScheduledValues(t);
  d.gain.setTargetAtTime(0.5, t, 0.05);
  d.gain.setTargetAtTime(1, t + dur * 0.7, 0.5);
  return true;
}

export function stemLoadStats() {
  return { ...loads, cached: ready.size, ext };
}
