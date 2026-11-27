"use client";
/**
 * Drawn spells: the shape you draw IS the math, and how precisely you draw it sets the power.
 *   circle   → Unit Circle Ward (shield + heal)        closed curve, constant radius
 *   zigzag   → Step-Function Bolt (chain lightning)    ≥ 3 sharp corners
 *   spiral   → Event Horizon (vortex that pulls in)    total turning > 1.5 turns
 *   parabola → Ballistic Meteor (falls on the target)  one extremum, quadratic fit
 *   sine     → Superposition Wave (3 parallel beams)   x-monotone, crosses its mean ≥ 2×
 * Recognition is feature-based curve fitting on a resampled stroke (cheap, no training data);
 * precision = how well the stroke fits the ideal curve → Perfect ×1.5 / Good ×1.2 / OK ×1 / Rough ×0.6.
 */
import * as THREE from "three";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { floatText } from "../ui/Labels";
import { questEvent } from "../story/quest";
import { ENV, GRAVITY, addFx, damageEnemy, enemies, guard, hitRadius, hitRay, nearestEnemy, projectiles, useCombat, ward } from "./combat";
import { emitBurst, emitSpark } from "../fx/Sparks";

import type { SpellId } from "@/lib/world/sigil";
export type { SpellId };

export const SPELLS: Record<SpellId, { name: { en: string; vi: string }; color: string; idea: { en: string; vi: string } }> = {
  shield: { name: { en: "Unit Circle Ward", vi: "Khiên Đường tròn Đơn vị" }, color: "#9fe6ff", idea: { en: "x² + y² = 1: every point is the same distance from the centre.", vi: "x² + y² = 1: mọi điểm cách tâm như nhau." } },
  bolt: { name: { en: "Step-Function Bolt", vi: "Sét Hàm Bậc thang" }, color: "#c8dcff", idea: { en: "A function can jump: each corner is a discontinuity the lightning follows.", vi: "Hàm số có thể nhảy bậc: mỗi góc gãy là một điểm gián đoạn tia sét đi theo." } },
  vortex: { name: { en: "Event Horizon", vi: "Chân trời Sự kiện" }, color: "#8b5cff", idea: { en: "Inside the horizon, every path leads inward — even light cannot escape.", vi: "Trong chân trời sự kiện, mọi đường đi đều dẫn vào trong — ánh sáng cũng không thoát." } },
  meteor: { name: { en: "Ballistic Meteor", vi: "Thiên thạch Đạn đạo" }, color: "#ffb45a", idea: { en: "Gravity bends every free fall into a parabola y = ax² + bx + c.", vi: "Trọng lực uốn mọi chuyển động rơi tự do thành parabol y = ax² + bx + c." } },
  wave: { name: { en: "Superposition Wave", vi: "Sóng Chồng chập" }, color: "#ff9ecb", idea: { en: "Waves add up: three crests travelling together hit as one.", vi: "Sóng cộng lại: ba đỉnh sóng đi cùng nhau đánh như một." } },
};

export { recognize, tier } from "@/lib/world/sigil";

// ───────────── Hiệu ứng phép ─────────────

export const SPELL_CD = 3500;
/** Lỗ đen đang hút (CombatFx xử lý mỗi khung hình) */
export const vortices: { pos: THREE.Vector3; born: number; dur: number; dmg: number; done: boolean }[] = [];

export function castSpell(id: SpellId, mult: number): boolean {
  const w = useWorld.getState();
  const c = useCombat.getState();
  const now = performance.now();
  if (!ENV.armed || now - c.spellAt < SPELL_CD) return false;
  useCombat.setState({ spellAt: now, swingAt: now });
  questEvent({ type: "cast", mult });
  const p = w.player;
  const yaw = w.playerYaw;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const col = SPELLS[id].color;
  w.act("cast", 800);
  if (id === "shield") {
    useCombat.setState({ hp: Math.min(c.maxHp, c.hp + Math.round(20 * mult)) });
    // khiên bong bóng thật: chặn mọi đòn trong ~6 s × độ chính xác của nét vẽ (fx/Ward.tsx hiển thị)
    ward.born = now;
    ward.until = now + 6000 * mult;
    guard.until = now + 300;
    addFx("nova", p.clone().setY(p.y + 0.05), { color: col, size: 2.2 });
    addFx("ring", p.clone().setY(p.y + 0.05), { color: "#ffffff", size: 1.6 });
    floatText(p.clone().setY(p.y + 2), `+${Math.round(20 * mult)}`, "info");
    // glint hồi máu bạc hà bay lên quanh người
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      emitSpark(p.x + Math.cos(a) * 0.7, p.y + 0.3 + Math.random() * 0.8, p.z + Math.sin(a) * 0.7, 0, 0.9 + Math.random() * 0.6, 0, i % 3 ? "#79F6BD" : "#fff4d4", { kind: i % 3 ? 0 : 1, size: i % 3 ? 0.04 : 0.2, life: 0.9, drag: 0.8, gravity: -0.3, stretch: 0.05 });
    }
    sfx.shield();
  } else if (id === "bolt") {
    let from = new THREE.Vector3(p.x, p.y + 1.4, p.z);
    let cur = nearestEnemy(p, 12);
    const hit = new Set<number>();
    let dmg = 26 * mult;
    for (let hop = 0; hop < 5 && cur; hop++) {
      const to = new THREE.Vector3(cur.pos.x, cur.pos.y + 0.6, cur.pos.z);
      addFx("bolt", from, { to, color: col });
      // tia nhỏ toé tại mỗi điểm nảy + vài tia dọc đường sét
      for (let s = 0; s < 5; s++) {
        const u = Math.random();
        emitSpark(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u, from.z + (to.z - from.z) * u, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, "#c9b6ff", { size: 0.03, life: 0.18, stretch: 0.05, drag: 6 });
      }
      damageEnemy(cur, dmg, from, 2);
      hit.add(cur.id);
      from = to;
      dmg *= 0.75;
      let best: typeof cur | null = null;
      let bd = 7;
      for (const e of enemies) {
        if (e.deadAt || hit.has(e.id)) continue;
        const d = e.pos.distanceTo(cur.pos);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      cur = best;
    }
    if (!hit.size) addFx("bolt", from, { to: from.clone().addScaledVector(fwd, 5), color: col });
    w.addShake(0.2);
    sfx.shield();
  } else if (id === "vortex") {
    const at = new THREE.Vector3(p.x, p.y + 0.06, p.z).addScaledVector(fwd, 4.5);
    vortices.push({ pos: at, born: now, dur: 1700, dmg: 34 * mult, done: false });
    emitBurst(at.x, at.y + 0.6, at.z, "#8648EE", 18, 4);
    addFx("nova", at, { color: col, size: 3.5 });
    sfx.circle();
  } else if (id === "meteor") {
    const t = nearestEnemy(p, 18);
    const target = t ? t.pos.clone() : new THREE.Vector3(p.x, ENV.ground(p.x + fwd.x * 8, p.z + fwd.z * 8), p.z).addScaledVector(fwd, 8);
    const from = target.clone().add(new THREE.Vector3(-4, 14, -3));
    const T = 0.75;
    // v = (Δ + ½gT²ŷ)/T: thiên thạch rơi theo parabol đúng nghĩa
    const vel = target.clone().sub(from).add(new THREE.Vector3(0, 0.5 * GRAVITY * T * T, 0)).divideScalar(T);
    projectiles.push({ pos: from, vel, born: now, dmg: 40 * mult, color: col, alive: true, trail: [], big: true });
    sfx.cast();
  } else {
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const k of [-1.1, 0, 1.1]) {
      const o = new THREE.Vector3(p.x, p.y + 0.8, p.z).addScaledVector(side, k);
      addFx("beam", o, { to: o.clone().addScaledVector(fwd, 11), color: col });
      hitRay(o, yaw, 11, 0.8, 18 * mult);
      // vệt ngắn chạy theo mép trước của mỗi sóng
      for (let s = 0; s < 4; s++) emitSpark(o.x, o.y, o.z, fwd.x * (14 + s * 3) + side.x * (Math.random() - 0.5) * 2, (Math.random() - 0.3) * 1.5, fwd.z * (14 + s * 3) + side.z * (Math.random() - 0.5) * 2, s % 2 ? "#39C5F3" : "#B7F8FF", { size: 0.05, life: 0.45, stretch: 0.03, drag: 2.5, gravity: 0 });
    }
    addFx("ring", p.clone().setY(p.y + 0.05).addScaledVector(fwd, 2), { color: col, size: 2.4 });
    sfx.circle();
  }
  return true;
}

/** Gọi mỗi khung hình: lỗ đen hút quái vào tâm rồi sập xuống */
export function updateVortices(dt: number) {
  const now = performance.now();
  for (let i = vortices.length - 1; i >= 0; i--) {
    const v = vortices[i];
    const age = now - v.born;
    for (const e of enemies) {
      if (e.deadAt) continue;
      const dx = v.pos.x - e.pos.x;
      const dz = v.pos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 7 && d > 0.3) {
        // Lực hút ~ 1/r (mềm) — càng gần càng bị kéo mạnh
        const f = Math.min(14, 9 / d) * dt;
        e.vel.x += (dx / d) * f;
        e.vel.z += (dz / d) * f;
      }
    }
    // dòng hút: vệt sáng từ mép đĩa xoáy lao vào tâm (vận tốc hướng tâm + tiếp tuyến)
    if (!v.done && Math.random() < dt * 22) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 1.2;
      emitSpark(v.pos.x + Math.cos(a) * r, v.pos.y + 0.4 + Math.random() * 1.2, v.pos.z + Math.sin(a) * r, -Math.cos(a) * r * 2.2 - Math.sin(a) * 3, 0.6, -Math.sin(a) * r * 2.2 + Math.cos(a) * 3, Math.random() < 0.3 ? "#FFABD8" : "#8648EE", { size: 0.04, life: 0.45, stretch: 0.05, drag: 0.5, gravity: 0 });
    }
    if (age > v.dur && !v.done) {
      v.done = true;
      emitBurst(v.pos.x, v.pos.y + 1, v.pos.z, "#FFABD8", 26, 8);
      hitRadius(v.pos, 2.8, v.dmg, 7);
      addFx("ring", v.pos, { color: "#ffffff", size: 3 });
      useWorld.getState().addShake(0.45);
      useWorld.getState().burst([v.pos.x, v.pos.y + 0.8, v.pos.z], "#8b5cff", 60);
      sfx.shatter();
    }
    if (age > v.dur + 400) vortices.splice(i, 1);
  }
}
