"use client";
/**
 * Âm Shepard liên tục cho cầu thang Penrose (Chiếu nghỉ Escher): 7 sóng sin cách nhau một quãng tám, cao độ theo độ cao "mở"
 * của người chơi (mỗi vòng thang = một quãng tám) → leo lên thì nghe như lên mãi, đi xuống thì xuống mãi, đứng yên thì ngân.
 * Giống setWind (lib/world/sfx.ts): các nút tạo một lần, mỗi khung chỉ đặt mục tiêu (setTargetAtTime); nối vào bus Hiệu ứng.
 */
import { audioCore } from "./engine";
import { shepardVoices } from "@/lib/world/penroseStair";

const N = 7;
let rig: { ctx: AudioContext; out: GainNode; osc: OscillatorNode[]; g: GainNode[]; slot: number[] } | null = null;

/** level 0…1 (0 = tắt dần), octavePos = độ cao mở / độ cao một vòng */
export function setShepardStair(level: number, octavePos: number) {
  const k = level > 0.01 || rig ? audioCore() : null;
  if (!k || k.ctx.state !== "running") return;
  const c = k.ctx;
  if (!rig || rig.ctx !== c) {
    if (level <= 0.01) return;
    const out = c.createGain();
    out.gain.value = 0;
    // lọc nhẹ cho ấm (bớt chói ở giọng cao)
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    out.connect(lp);
    lp.connect(k.sfx);
    const osc: OscillatorNode[] = [];
    const g: GainNode[] = [];
    for (let i = 0; i < N; i++) {
      const o = c.createOscillator();
      o.type = "sine";
      const gi = c.createGain();
      gi.gain.value = 0;
      o.connect(gi);
      gi.connect(out);
      o.start();
      osc.push(o);
      g.push(gi);
    }
    rig = { ctx: c, out, osc, g, slot: new Array(N).fill(-1) };
  }
  const t = c.currentTime;
  const L = Math.max(0, Math.min(1, level));
  rig.out.gain.setTargetAtTime(L * 0.05, t, 0.35);
  const v = shepardVoices(octavePos, N);
  for (let i = 0; i < N; i++) {
    // giọng vừa quay vòng (đỉnh ↔ đáy, lúc đó gần như im) → đặt tần số tức thời, không trượt qua cả dải
    const jump = rig.slot[i] >= 0 && Math.abs(v[i].slot - rig.slot[i]) > 1;
    if (jump) rig.osc[i].frequency.setValueAtTime(v[i].hz, t);
    else rig.osc[i].frequency.setTargetAtTime(v[i].hz, t, 0.05);
    rig.slot[i] = v[i].slot;
    rig.g[i].gain.setTargetAtTime(v[i].amp, t, 0.08);
  }
}
