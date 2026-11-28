"use client";
/**
 * Điều phối nhạc nền theo vùng: mỗi vùng một ZonePlayer (bộ soạn Composer + hàng đợi sự kiện + nền liên tục),
 * lập lịch theo đồng hồ AudioContext (tick 50 ms, nhìn trước 0,25 s — "A Tale of Two Clocks"); đổi vùng = crossfade
 * (cũ tắt dần ~3 s, mới vào sau 0,8 s, lên trong ~3,5 s). Quảng trường đổi ngày ↔ đêm ở ranh giới câu (cùng tập nốt).
 * Thêm ba dòng "chuông xa" chu kỳ 23 / 29 / 37 s (vòng lặp lệch nhau kiểu Eno) ở các vùng tĩnh.
 */
import { Composer, enoOnsets, midiToHz, SCALES, chordPcs, zoneProfile, type MusicEvent, type ZoneProfile } from "@/lib/world/music";
import { audioCore, audioRunning, getVol, onAudioChange } from "./engine";
import { playEvent, startBed } from "./instruments";
import { MUSIC_KEY } from "./sfxKit";

const TICK_MS = 50;
const LOOKAHEAD = 0.25;
const COMPOSE_AHEAD = 1.5;
const FADE_OUT = 3;
const FADE_IN = 3.5;

type Q = { t: number; ev?: MusicEvent; key?: { root: number; scale: readonly number[]; chord: number[] } };

class ZonePlayer {
  out: GainNode;
  composer: Composer;
  q: Q[] = [];
  next: number;
  bed: (() => void) | null = null;
  enoT: number;
  scene: string;
  dead = false;
  /** debug: câu / dãy số đang chơi */
  last = "";

  constructor(
    public p: ZoneProfile,
    scene: string,
    private c: AudioContext,
    dest: AudioNode,
    noise: AudioBuffer,
    delay = 0.8,
  ) {
    this.scene = scene;
    this.composer = new Composer(p, (Date.now() & 0xffff) ^ 0x5eed);
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    const t = c.currentTime;
    this.out.gain.setValueAtTime(0, t + delay);
    this.out.gain.linearRampToValueAtTime(p.level, t + delay + FADE_IN);
    this.next = t + delay;
    this.enoT = t + delay;
    const bedKind = p.extras.includes("drone") ? "drone" : p.extras.includes("wind") ? "wind" : null;
    if (bedKind) this.bed = startBed(bedKind, c, this.out, p, noise);
  }

  setProfile(p: ZoneProfile) {
    this.composer.setProfile(p);
    this.p = p;
    this.out.gain.setTargetAtTime(p.level, this.c.currentTime, 2);
  }

  tick() {
    if (this.dead) return;
    const now = this.c.currentTime;
    // tab vừa hiện lại / bị khựng: bỏ sự kiện quá hạn, neo lại mốc câu
    if (this.next < now - 0.5) {
      this.q = this.q.filter((x) => x.t >= now);
      this.next = now + 0.2;
    }
    while (this.next < now + COMPOSE_AHEAD) {
      const ph = this.composer.nextPhrase();
      const p = this.composer.p;
      this.last = `${p.id}:${ph.kind}${ph.seq ? ":" + ph.seq : ""}`;
      this.q.push({ t: this.next, key: { root: p.root, scale: SCALES[p.scale], chord: chordPcs(p.chords[ph.chord]) } });
      for (const ev of ph.events) this.q.push({ t: this.next + ev.at, ev });
      this.next += ph.dur;
    }
    // chuông xa (Eno): chỉ vùng tĩnh, rất nhỏ, nốt hợp âm
    if (this.p.mode !== "sequence") {
      for (const o of enoOnsets(this.enoT, now + LOOKAHEAD)) {
        const ch = MUSIC_KEY.chord;
        const pc = ch[(o.stream * 2) % ch.length] ?? 0;
        this.q.push({ t: o.t, ev: { at: 0, kind: "lead", hz: [midiToHz(this.p.root + 24 + pc)], dur: 2, vel: 0.25 } });
      }
      this.enoT = now + LOOKAHEAD;
    }
    if (this.q.length > 1) this.q.sort((a, b) => a.t - b.t);
    while (this.q.length && this.q[0].t < now + LOOKAHEAD) {
      const x = this.q.shift()!;
      if (x.t < now - 0.05) continue;
      if (x.key) {
        MUSIC_KEY.root = x.key.root;
        MUSIC_KEY.scale = x.key.scale;
        MUSIC_KEY.chord = x.key.chord;
      } else if (x.ev) playEvent(x.ev, Math.max(x.t, now), this.out, this.p);
    }
  }

  stop(fade = FADE_OUT) {
    if (this.dead) return;
    this.dead = true;
    const t = this.c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + fade);
    this.bed?.();
    this.q = [];
    setTimeout(() => this.out.disconnect(), (fade + 4) * 1000);
  }
}

let player: ZonePlayer | null = null;
let want: { scene: string; night: number } | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let unsub: (() => void) | null = null;

function apply() {
  const k = audioCore(false);
  const run = !!want && audioRunning() && getVol("music") > 0.001 && !!k;
  if (!run || !k) {
    // tắt âm / chưa mở khoá / âm lượng nhạc 0: dừng hẳn (đỡ tốn CPU)
    if (player && (!audioRunning() || getVol("music") <= 0.001)) {
      player.stop(0.4);
      player = null;
    }
    if (timer && !player) {
      clearInterval(timer);
      timer = null;
    }
    return;
  }
  const p = zoneProfile(want!.scene, want!.night);
  if (player && player.scene === want!.scene && p) {
    // cùng vùng: chỉ đổi hồ sơ (ngày ↔ đêm) — áp dụng từ câu kế
    if (player.p.id !== p.id) player.setProfile(p);
  } else {
    player?.stop();
    player = p ? new ZonePlayer(p, want!.scene, k.ctx, k.duck, k.noise, player ? 0.8 : 0.3) : null;
  }
  if (player && !timer) timer = setInterval(() => player?.tick(), TICK_MS);
  if (!player && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Đặt vùng hiện tại (gọi khi đổi cảnh, và định kỳ ở Quảng trường với mức đêm). scene = null: dừng nhạc. */
export function setMusicZone(scene: string | null, night = 0) {
  want = scene ? { scene, night } : null;
  if (!unsub) unsub = onAudioChange(apply);
  if (!scene) {
    player?.stop();
    player = null;
  }
  apply();
}

/** Trạng thái để kiểm thử trong trình duyệt */
export function musicDebug() {
  return { zone: player?.p.id ?? null, scene: player?.scene ?? null, queued: player?.q.length ?? 0, last: player?.last ?? "", key: { ...MUSIC_KEY } };
}
