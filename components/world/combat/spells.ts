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
import { ENV, GRAVITY, damageEnemy, enemies, guard, hitRadius, hitRay, nearestEnemy, projectiles, useCombat, ward } from "./combat";
import { emitBurst } from "../fx/Sparks";
import { fxBolt, fxLevel, fxMeteor, fxShield, fxVortex, fxWave } from "../fx/SpellFx";
import { SPELL_PALETTE, spellParticles } from "@/lib/world/spellFx";

import type { SpellId } from "@/lib/world/sigil";
export type { SpellId };

export const SPELLS: Record<SpellId, { name: { en: string; vi: string }; color: string; idea: { en: string; vi: string } }> = {
  shield: { name: { en: "Unit Circle Ward", vi: "Khiên Đường tròn Đơn vị" }, color: SPELL_PALETTE.shield.body, idea: { en: "x² + y² = 1: every point is the same distance from the centre.", vi: "x² + y² = 1: mọi điểm cách tâm như nhau." } },
  bolt: { name: { en: "Step-Function Bolt", vi: "Sét Hàm Bậc thang" }, color: SPELL_PALETTE.bolt.body, idea: { en: "A function can jump: each corner is a discontinuity the lightning follows.", vi: "Hàm số có thể nhảy bậc: mỗi góc gãy là một điểm gián đoạn tia sét đi theo." } },
  vortex: { name: { en: "Event Horizon", vi: "Chân trời Sự kiện" }, color: SPELL_PALETTE.vortex.body, idea: { en: "Inside the horizon, every path leads inward — even light cannot escape.", vi: "Trong chân trời sự kiện, mọi đường đi đều dẫn vào trong — ánh sáng cũng không thoát." } },
  meteor: { name: { en: "Ballistic Meteor", vi: "Thiên thạch Đạn đạo" }, color: SPELL_PALETTE.meteor.body, idea: { en: "Gravity bends every free fall into a parabola y = ax² + bx + c.", vi: "Trọng lực uốn mọi chuyển động rơi tự do thành parabol y = ax² + bx + c." } },
  wave: { name: { en: "Superposition Wave", vi: "Sóng Chồng chập" }, color: SPELL_PALETTE.wave.body, idea: { en: "Waves add up: three crests travelling together hit as one.", vi: "Sóng cộng lại: ba đỉnh sóng đi cùng nhau đánh như một." } },
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
    floatText(p.clone().setY(p.y + 2), `+${Math.round(20 * mult)}`, "info");
    // vòng khép dưới chân + mảnh khi chặn / hết khiên: fx/SpellFx.tsx đọc thẳng `ward`; ở đây chỉ glint hồi máu (theo ngân sách)
    fxShield();
    sfx.spell("shield");
  } else if (id === "bolt") {
    sfx.spell("bolt");
    let from = new THREE.Vector3(p.x, p.y + 1.4, p.z);
    let cur = nearestEnemy(p, 12);
    const hit = new Set<number>();
    let dmg = 26 * mult;
    // các bước nảy → fx/SpellFx.tsx vẽ sét BẬC THANG lan dần từng bước (45 ms / bước), đầu nhọn vát mặt, quạt vết gãy khi trúng
    const hops: number[] = [];
    for (let hop = 0; hop < 5 && cur; hop++) {
      const to = new THREE.Vector3(cur.pos.x, cur.pos.y + 0.6, cur.pos.z);
      hops.push(from.x, from.y, from.z, to.x, to.y, to.z);
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
    if (!hit.size) {
      const to = from.clone().addScaledVector(fwd, 5);
      hops.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
    fxBolt(hops, !hit.size);
    w.addShake(0.2);
  } else if (id === "vortex") {
    const at = new THREE.Vector3(p.x, p.y + 0.06, p.z).addScaledVector(fwd, 4.5);
    const v = { pos: at, born: now, dur: 1700, dmg: 34 * mult, done: false };
    vortices.push(v);
    // mép 2,8 m + tay xoắn + hạt bị hút + sập: fx/SpellFx.tsx
    fxVortex(v);
    emitBurst(at.x, at.y + 0.6, at.z, SPELL_PALETTE.vortex.accent, Math.round(spellParticles("vortex", fxLevel()) / 2), 4);
    sfx.spell("vortex");
  } else if (id === "meteor") {
    const t = nearestEnemy(p, 18);
    const target = t ? t.pos.clone() : new THREE.Vector3(p.x, ENV.ground(p.x + fwd.x * 8, p.z + fwd.z * 8), p.z).addScaledVector(fwd, 8);
    const from = target.clone().add(new THREE.Vector3(-4, 14, -3));
    const T = 0.75;
    // v = (Δ + ½gT²ŷ)/T: thiên thạch rơi theo parabol đúng nghĩa
    const vel = target.clone().sub(from).add(new THREE.Vector3(0, 0.5 * GRAVITY * T * T, 0)).divideScalar(T);
    const pr = { pos: from, vel, born: now, dmg: 40 * mult, color: col, alive: true, trail: [], big: true };
    projectiles.push(pr);
    // dấu chân thật 3,2 m + 3 tab đếm ngược + đường parabol dự báo + va chạm: fx/SpellFx.tsx
    fxMeteor(pr, target, T);
    sfx.spell("meteor");
  } else {
    sfx.spell("wave");
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    for (const k of [-1.1, 0, 1.1]) hitRay(new THREE.Vector3(p.x, p.y + 0.8, p.z).addScaledVector(side, k), yaw, 11, 0.8, 18 * mult);
    // rèm sóng chồng chập quét đúng 11 m + 3 làn sin + giọt bọt: fx/SpellFx.tsx
    fxWave(p.x, p.y, p.z, fwd.x, fwd.z);
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
    // dòng hút (hạt bị kéo vào tâm) + mép + tay xoắn: fx/SpellFx.tsx
    if (age > v.dur && !v.done) {
      v.done = true;
      hitRadius(v.pos, 2.8, v.dmg, 7);
      // vòng co → bung vòng gãy + chớp lõi + tia (theo ngân sách) + sóng xung kích: fx/SpellFx.tsx
      useWorld.getState().addShake(0.45);
      sfx.explode("void", 1.1);
    }
    if (age > v.dur + 400) vortices.splice(i, 1);
  }
}

// DEV: niệm phép không cần vẽ (đo hiệu năng / xem hiệu ứng) — window.__cast("meteor", 1.5); bỏ qua hồi chiêu
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production")
  (window as unknown as { __cast: unknown }).__cast = (id: SpellId, mult = 1.2) => {
    useCombat.setState({ spellAt: -1e9 });
    const was = ENV.armed;
    ENV.armed = true;
    const ok = castSpell(id, mult);
    ENV.armed = was;
    return ok;
  };
