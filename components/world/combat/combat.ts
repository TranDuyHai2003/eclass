"use client";
/**
 * Combat core (no React): weapons, jump/dash motion, skill + burst, monster registry, hit tests and FX queues.
 * Hot paths mutate plain objects (no allocations per frame); only HUD-facing numbers live in a small zustand store.
 *
 * Mechanics are math-flavoured on purpose:
 *  - Parabola Bow: arrows fly on a real ballistic parabola; auto-aim solves for the launch angle.
 *  - Tangent Dash (E): dash along your facing direction (the tangent of your path), hitting everything on the segment.
 *  - Fourier Staff: a ring wave that hits everything inside a disc in front of you.
 *  - Integral Nova (Q): energy accumulates with each hit (a running sum) and releases as one big area hit.
 */
import * as THREE from "three";
import { create } from "zustand";
import { useWorld } from "../store";
import { elementSource, sfx } from "@/lib/world/sfx";
import { weaponElement } from "@/lib/world/musicVoices";
import { floatText } from "../ui/Labels";
import { WEAPON_DEFS, loadoutList, rollDrops, type WeaponDef } from "./items";
import { questEvent, unlockNote } from "../story/quest";
import { impact, shockwave } from "../fx/Lensing";
import { emitHit } from "../fx/Sparks";
import { emitCollapse } from "../fx/Puffs";
import { strike } from "../fx/StrikeFx";
import { TRAIL_TIP } from "../fx/WeaponTrail";
import { initRule, ruleHit, type RuleState } from "./ruleHit";
import { BUFFER_MS, bufferPress, clearBuf, dashDecision, hasBuffered, newBuf, takeBuffered } from "@/lib/world/inputBuffer";
/** (để công cụ kiểm thử đọc trạng thái vệt chém) */
export { TRAIL_TIP };
import { HOLD_MS, MASH_LIMIT, MOVESETS, judge, moveTimes, nextStep, rhythmMul, type Hit, type Move, type MoveTimes, type Moveset, type Shape } from "@/lib/world/combo";

/** Vũ khí đang cầm = ô thứ `weapon` trong bộ trang bị (tối đa 3) */
export function curWeapon(): WeaponDef {
  const list = loadoutList();
  return WEAPON_DEFS[list[useCombat.getState().weapon % Math.max(1, list.length)] ?? "blade"];
}
export const SKILL_CD = 5000;
elementSource(() => weaponElement(curWeapon().id));
export const ENERGY_MAX = 100;

export const useCombat = create<{
  hp: number;
  maxHp: number;
  energy: number;
  weapon: number;
  skillAt: number;
  downUntil: number;
  /** Lúc đánh gần nhất (vũ khí bay vung lên) */
  swingAt: number;
  /** Lúc niệm phép vẽ gần nhất (hồi chiêu) */
  spellAt: number;
  /** Chế độ ngắm (cung): camera qua vai + tâm ngắm; aimAt = lúc bắt đầu giữ (tích lực 1 s) */
  aiming: boolean;
  aimAt: number;
  /** Thể lực (né, đòn tụ lực) */
  stamina: number;
  /** Số đòn trúng liên tiếp (đứt sau 2,6 s) */
  combo: number;
  comboAt: number;
  /** Lời đánh giá gần nhất (Nhịp ×n, loạn nhịp, né hoàn hảo…) */
  judge: { text: string; kind: "perfect" | "miss" | "dodge" | "info"; at: number } | null;
  /** Lúc bắt đầu Khúc xạ thời gian */
  slowAt: number;
}>(() => ({ hp: 100, maxHp: 100, energy: 0, weapon: 0, skillAt: -1e9, downUntil: 0, swingAt: -1e9, spellAt: -1e9, aiming: false, aimAt: 0, stamina: 100, combo: 0, comboAt: 0, judge: null, slowAt: -1e9 }));

/** Camera hiện tại (Player đăng ký) — để bắn theo tâm ngắm */
/** fovKick (độ) + dolly (hệ số khoảng cách) cho hiệu ứng điện ảnh, vd. dolly-zoom khi bốt du hành */
/** shift: dịch chuyển tức thời cả máy quay (khi thế giới "quấn" người chơi về một ô giống hệt — vd. Thư viện Babel vô hạn) */
/** focus: boss to đang đối mặt (vd. Siren) → máy quay tự lùi xa + hạ góc khi đứng sát (B1); self: nhóm nhân vật của mình (bóng mờ khi lướt) */
export const CAM: { cam: THREE.Camera | null; fovKick: number; dolly: number; shift: THREE.Vector3 | null; hideSelf: boolean; focus: { x: number; z: number; near: number; far: number } | null; self: THREE.Object3D | null } = { cam: null, fovKick: 0, dolly: 1, shift: null, hideSelf: false, focus: null, self: null };
export const CHARGE_MS = 1000;
export function startAim() {
  if (!ENV.armed || useWorld.getState().overlay) return;
  useCombat.setState({ aiming: true, aimAt: performance.now() });
}
export function endAim(fire: boolean) {
  const c = useCombat.getState();
  if (!c.aiming) return;
  const charged = performance.now() - c.aimAt >= CHARGE_MS;
  useCombat.setState({ aiming: false });
  if (fire && curWeapon().id === "bow") shootAimed(charged);
}
const RAY_D = new THREE.Vector3();
/** Bắn theo tia camera qua tâm màn hình (tên gần thẳng, rơi nhẹ); tích lực: ×2,2 sát thương, xuyên thấu */
export function shootAimed(charged: boolean) {
  const cam = CAM.cam;
  if (!cam || !canAct()) return;
  const now = performance.now();
  const w = useWorld.getState();
  const wp = curWeapon();
  cam.getWorldDirection(RAY_D);
  const p = w.player;
  w.playerYaw = Math.atan2(RAY_D.x, RAY_D.z);
  const from = new THREE.Vector3(p.x, p.y + 1.4, p.z).addScaledVector(new THREE.Vector3(RAY_D.x, 0, RAY_D.z).normalize(), 0.6);
  // Điểm ngắm 40 m dọc tia camera → hướng bắn từ tay
  const aimPt = cam.position.clone().addScaledVector(RAY_D, 40);
  const speed = charged ? 46 : 34;
  const vel = aimPt.sub(from).normalize().multiplyScalar(speed);
  vel.y += 0.5 * GRAVITY * (40 / speed); // bù trọng lực để chạm đúng tâm ngắm
  projectiles.push({ pos: from, vel, born: now, dmg: wp.atk * (charged ? 2.2 : 1), color: charged ? "#ffd27a" : wp.color, alive: true, trail: [], pierce: charged });
  if (projectiles.length > 24) projectiles.splice(0, projectiles.length - 24);
  w.act("cast", 380);
  useCombat.setState({ swingAt: now });
  if (charged) {
    strike("muzzle", from.x, from.y, from.z, { yaw: Math.atan2(vel.x, vel.z), color: "#ffd27a" });
    w.addShake(0.12);
  }
  sfx.cast();
}

/** Chuyển động đặc biệt của nhân vật (Player đọc mỗi khung hình) */
export const motion = { wade: 1, swimming: false, vy: 0, grounded: true, dashUntil: 0, dashDir: new THREE.Vector3(0, 0, 1), dashSpeed: 22, dodgeAt: -1e9, landAt: -1e9, gliding: false, plunging: false, plungeFrom: 0 };
/** Cột gió nâng tàu lượn (x, z, bán kính, độ cao đỉnh) — mỗi cảnh tự đăng ký */
export const updrafts: { x: number; z: number; r: number; top: number }[] = [];
/** Độ cao so với mặt đất hiện tại (để biết có đủ cao để lượn / bổ nhào) */
export const air = { height: 0 };

/** Môi trường hiện tại (mặt đất cho đạn / quái) */
/** ground(x, z, y?): có y → mặt đất thật dưới độ cao đó (hang / phần nhô trong thế giới voxel) */
export const ENV = { ground: (_x: number, _z: number, _y?: number) => 0, armed: false };
/** Bất tử ngắn sau khi hồi phục */
export const guard = { until: 0 };
/** Khiên phép (vẽ vòng tròn): chặn đòn tới khi hết hạn; hitAt / hitDir cho gợn sóng trên bong bóng */
export const ward = { until: 0, born: -1e9, hitAt: -1e9, hitDir: new THREE.Vector3(0, 0, 1) };

// ───────────── Quái ─────────────

export type EnemyKind = "slime" | "wisp" | "mite" | "siren" | "node" | "knight" | "zeno" | "twinA" | "twinB" | "ghoul" | "warden" | "crab" | "surveyor" | "ledger" | "moth";
export const ENEMY: Record<EnemyKind, { hp: number; speed: number; dmg: number; color: string; name: { en: string; vi: string } }> = {
  slime: { hp: 60, speed: 2.3, dmg: 8, color: "#7fd8c9", name: { en: "Noise Slime", vi: "Slime Nhiễu" } },
  wisp: { hp: 45, speed: 3.1, dmg: 6, color: "#c8a6ff", name: { en: "Möbius Wisp", vi: "Hồn Möbius" } },
  siren: { hp: 1e9, speed: 0, dmg: 0, color: "#c8a6ff", name: { en: "Fourier Siren", vi: "Nàng Tiên Cá Fourier" } },
  node: { hp: 1e9, speed: 0, dmg: 0, color: "#9fe6ff", name: { en: "Interference Node", vi: "Nút Giao thoa" } },
  knight: { hp: 70, speed: 0, dmg: 12, color: "#c8a6ff", name: { en: "Knight Imp", vi: "Quỷ Mã Cờ" } },
  zeno: { hp: 95, speed: 1.3, dmg: 8, color: "#7cf0a0", name: { en: "Zeno Tortoise", vi: "Rùa Zeno" } },
  twinA: { hp: 160, speed: 0, dmg: 10, color: "#9fe6ff", name: { en: "Interference Twin α", vi: "Song Sinh Giao Thoa α" } },
  twinB: { hp: 160, speed: 0, dmg: 10, color: "#ff9ecb", name: { en: "Interference Twin β", vi: "Song Sinh Giao Thoa β" } },
  mite: { hp: 80, speed: 2.8, dmg: 9, color: "#ffb46b", name: { en: "Sierpiński Mite", vi: "Bọ Sierpiński" } },
  ghoul: { hp: 110, speed: 0, dmg: 14, color: "#b48cff", name: { en: "Greedy Ghoul", vi: "Ma Tham Lam" } },
  warden: { hp: 90, speed: 0.9, dmg: 12, color: "#9ec8ff", name: { en: "Prime Warden", vi: "Hộ Vệ Nguyên Tố" } },
  crab: { hp: 120, speed: 2.4, dmg: 9, color: "#ff9ecb", name: { en: "Bell Crab", vi: "Cua Chuông" } },
  // Vùng Kỳ quan — boss + sự kiện (components/world/bosses/*): AI + hình vẽ riêng qua Enemy.ext
  surveyor: { hp: 1e9, speed: 0, dmg: 0, color: "#f4ead2", name: { en: "Foldback Surveyor", vi: "Kẻ Khảo sát Gấp" } },
  ledger: { hp: 1e9, speed: 0, dmg: 0, color: "#8fc8ff", name: { en: "Rain Ledger", vi: "Sổ Mưa" } },
  moth: { hp: 40, speed: 0, dmg: 7, color: "#ffc86b", name: { en: "Period Moth", vi: "Bướm Chu kỳ" } },
};

/** Sát thương cần dồn để ngắt một đòn đang vung */
const POISE: Record<EnemyKind, number> = { slime: 14, wisp: 10, mite: 30, siren: 1e9, node: 1e9, knight: 18, zeno: 40, twinA: 1e9, twinB: 1e9, ghoul: 26, warden: 40, crab: 30, surveyor: 1e9, ledger: 1e9, moth: 1e9 };
const twinHitAt: Record<string, number> = { twinA: -1e9, twinB: -1e9 };

/** Boss phó bản nhận đòn qua handler (máu thật nằm ở BossSim / server) */
let bossHandler: ((e: Enemy, amount: number) => void) | null = null;
export function setBossHandler(h: ((e: Enemy, amount: number) => void) | null) {
  bossHandler = h;
}
export function isBossPart(e: Enemy) {
  return e.kind === "siren" || e.kind === "node" || !!e.ext?.boss;
}

/**
 * Quái do module ngoài điều khiển (boss / sự kiện Vùng Kỳ quan): CombatScene bỏ qua AI của chúng, combat chỉ gọi các móc:
 *  mul: hệ số sát thương theo quy luật lúc này (âm = đòn bị nuốt, vd. bướm đang bay quá tầm với);
 *  boss: nhận sát thương thực (máu nằm ở mô phỏng riêng — như bossHandler của Siren).
 */
export interface EnemyExt {
  mul?: (e: Enemy, from: THREE.Vector3, now: number) => number;
  boss?: (e: Enemy, amount: number) => void;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  maxHp: number;
  yaw: number;
  hitAt: number;
  deadAt: number;
  /** Bắt đầu vung đòn (báo trước ~0,45 s để người chơi kịp né) */
  windup: number;
  /** mốc windup đã phát âm báo trước (tránh phát lặp mỗi khung) */
  tellAt?: number;
  atkAt: number;
  seed: number;
  /** Bọ taxicab: trục đang đi (0 = x, 1 = z), lúc bắt đầu nhảy ô, điểm đi/đến */
  axis: 0 | 1;
  hopAt: number;
  /** Rùa Zeno: số hạng thứ k của chuỗi và lúc trúng gần nhất */
  zk: number;
  zAt: number;
  poise: number;
  poiseAt: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Bị hất lên không: độ cao (m) + vận tốc đứng (m/s) — đánh tiếp khi còn trên không thì lơ lửng (juggle) */
  air: number;
  airV: number;
  /** Trạng thái riêng của quái "quy luật" (Ma Tham Lam, Hộ Vệ Nguyên Tố, Cua Chuông) — xem ruleHit.ts */
  rule: RuleState;
  /** quái do module ngoài điều khiển (xem EnemyExt) */
  ext?: EnemyExt;
}

/** Hồn Möbius chỉ "có thật" nửa chu kỳ: dễ tổn thương khi sin(2πt/T) > 0 (T = 3 s) */
export const WISP_PERIOD = 3;
export function wispPhase(e: Enemy, now = performance.now()): number {
  return Math.sin(((now / 1000 + e.seed) * 2 * Math.PI) / WISP_PERIOD);
}
export const enemies: Enemy[] = [];
let enemyId = 1;

export function spawnEnemy(kind: EnemyKind, at: THREE.Vector3): Enemy {
  const e: Enemy = { id: enemyId++, kind, pos: at.clone(), home: at.clone(), vel: new THREE.Vector3(), hp: ENEMY[kind].hp, maxHp: ENEMY[kind].hp, yaw: 0, hitAt: -1e9, deadAt: 0, windup: 0, atkAt: 0, seed: Math.random() * 100, axis: 0, hopAt: 0, zk: 0, zAt: 0, poise: 0, poiseAt: 0, from: at.clone(), to: at.clone(), air: 0, airV: 0, rule: {} };
  e.rule = initRule(kind, e.seed);
  enemies.push(e);
  return e;
}
export function respawn(e: Enemy, at: THREE.Vector3) {
  e.pos.copy(at);
  e.home.copy(at);
  e.vel.set(0, 0, 0);
  e.hp = e.maxHp;
  e.deadAt = 0;
  e.windup = 0;
  e.hopAt = 0;
  e.from.copy(at);
  e.to.copy(at);
  e.rule = initRule(e.kind, e.seed);
}
export function clearEnemies() {
  enemies.length = 0;
}

// ───────────── Hiệu ứng ─────────────

export type FxKind = "slash" | "ring" | "nova" | "dash" | "spark" | "bolt" | "beam" | "hit" | "crater" | "vring";
export interface Fx {
  id: number;
  kind: FxKind;
  pos: THREE.Vector3;
  yaw: number;
  born: number;
  color: string;
  size: number;
  flip: boolean;
  to?: THREE.Vector3;
}
export const fxs: Fx[] = [];
let fxId = 1;
export function addFx(kind: FxKind, pos: THREE.Vector3, opts: Partial<Omit<Fx, "id" | "kind" | "pos" | "born">> = {}) {
  const now = performance.now();
  // Dọn hiệu ứng cũ
  for (let i = fxs.length - 1; i >= 0; i--) if (now - fxs[i].born > 1600) fxs.splice(i, 1);
  fxs.push({ id: fxId++, kind, pos: pos.clone(), yaw: 0, born: now, color: "#ffffff", size: 1, flip: false, ...opts });
}

/** Vật bay theo quỹ đạo tham số quanh người chơi (con lắc tròn, xoắn ốc vàng) */
export interface Orbiter {
  kind: "pendulum" | "spiral";
  born: number;
  dur: number;
  yaw: number;
  color: string;
  dmg: number;
  pos: THREE.Vector3;
  hits: Map<number, number>;
}
export const orbiters: Orbiter[] = [];

export interface Projectile {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  born: number;
  dmg: number;
  color: string;
  alive: boolean;
  trail: THREE.Vector3[];
  /** Thiên thạch: nổ diện rộng khi chạm */
  big?: boolean;
  /** Tên tích lực: xuyên qua quái */
  pierce?: boolean;
}
export const projectiles: Projectile[] = [];
export const GRAVITY = 9.8;

// ───────────── Gây sát thương ─────────────

const TMP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1.5, 0);

export function damageEnemy(e: Enemy, dmg: number, from: THREE.Vector3, push = 4) {
  if (e.deadAt) return;
  const now = performance.now();
  // Hồn Möbius lệch pha: đòn đi xuyên qua (phải canh nhịp khi vầng sáng bừng lên)
  if (e.kind === "wisp" && wispPhase(e, now) <= 0) {
    if (now - e.hitAt > 250) floatText(TMP.copy(e.pos).add(UP), "phase ∅", "info");
    e.hitAt = now - 200;
    sfx.miss();
    return;
  }
  // Rùa Zeno: đòn thứ k trong chuỗi chỉ gây ½ᵏ (tổng < 2 lần đòn đầu) — nghỉ ≥ 1,2 s để chuỗi về đầu
  if (e.kind === "zeno") {
    e.zk = now - e.zAt < 1200 ? e.zk + 1 : 0;
    e.zAt = now;
    dmg *= Math.pow(0.5, e.zk);
    if (e.zk >= 2) unlockNote("zeno");
  }
  // Song sinh giao thoa: chỉ chịu sát thương khi CẢ HAI bị trúng trong 0,2 s (chồng chập cùng pha)
  if (e.kind === "twinA" || e.kind === "twinB") {
    twinHitAt[e.kind] = now;
    const other = e.kind === "twinA" ? "twinB" : "twinA";
    if (now - twinHitAt[other] > 200) {
      if (now - e.hitAt > 250) floatText(TMP.copy(e.pos).add(UP), "out of phase", "info");
      e.hitAt = now;
      sfx.miss();
      unlockNote("interference");
      return;
    }
    // Cùng pha: gây sát thương lên cả hai
    for (const o of enemies) if (o !== e && o.kind === other && !o.deadAt) o.hp -= dmg;
  }
  // Quái quy luật (Ma Tham Lam / Hộ Vệ Nguyên Tố / Cua Chuông): hệ số theo quy luật; âm = khiên nuốt đòn (chỉ đếm)
  if (e.ext?.mul) {
    const m = e.ext.mul(e, from, now);
    if (m < 0) {
      emitHit(e.pos.x, e.pos.y + 1.2, e.pos.z, "#9ec8ff", e.pos.x - from.x, e.pos.z - from.z, 0.7);
      return;
    }
    dmg *= m;
  }
  if (e.rule.ghoul || e.rule.warden || e.rule.crab) {
    const m = ruleHit(e, from, now);
    if (m < 0) {
      emitHit(e.pos.x, e.pos.y + 1.2, e.pos.z, "#9ec8ff", e.pos.x - from.x, e.pos.z - from.z, 0.7);
      return;
    }
    dmg *= m;
  }
  // Mai Sierpiński đỡ đòn phía trước: chỉ 30% sát thương — đánh từ hai bên / sau lưng
  if (e.kind === "mite") {
    const a = Math.atan2(from.x - e.pos.x, from.z - e.pos.z) - e.yaw;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.9) {
      dmg *= 0.3;
      if (now - e.hitAt > 250) floatText(TMP.copy(e.pos).add(UP).setY(e.pos.y + 1.9), "shell", "info");
    }
  }
  const crit = HIT_MOD.crit || Math.random() < 0.18;
  const amount = Math.round(dmg * (crit ? 1.8 : 1) * (0.9 + Math.random() * 0.2));
  e.hp -= amount;
  e.hitAt = now;
  // Thế đứng (poise): chỉ ngắt đòn đang vung khi dồn đủ sát thương trong ~1,5 s
  e.poise = now - e.poiseAt > 1500 ? amount : e.poise + amount;
  e.poiseAt = now;
  if (e.poise >= POISE[e.kind]) {
    e.windup = 0;
    e.poise = 0;
  }
  TMP.subVectors(e.pos, from).setY(0);
  // tia trúng đòn dùng chung (glint + 5–9 tia ngắn xoè theo hướng đòn), đỉnh sáng ngay khung xác nhận trúng
  emitHit(e.pos.x, e.pos.y + 0.8, e.pos.z, crit ? "#ffd27a" : "#bfe8ff", TMP.x, TMP.z, crit ? 1.4 : 1);
  if (TMP.lengthSq() > 1e-4) e.vel.addScaledVector(TMP.normalize(), push);
  // Hất tung / đánh tiếp trên không (quái nhỏ — không áp cho boss)
  if (!isBossPart(e) && e.kind !== "twinA" && e.kind !== "twinB") {
    if (HIT_MOD.launch > 0) {
      e.airV = Math.max(e.airV, HIT_MOD.launch);
      e.windup = 0;
    } else if (e.air > 0.05) e.airV = Math.max(e.airV, 2.4);
  }
  if (isBossPart(e)) {
    e.hp += amount;
    // Boss: không đẩy lùi / không trừ máu cục bộ — chuyển cho đấu trường (và server khi chơi tổ đội)
    e.hitAt = now;
    useCombat.setState({ energy: Math.min(ENERGY_MAX, useCombat.getState().energy + (crit ? 7 : 4)) });
    addFx("hit", TMP.copy(e.pos).setY(e.pos.y + (e.kind === "siren" ? 2.6 : 1.3)), { color: crit ? "#ffd27a" : "#ffffff", size: crit ? 2.2 : 1.6, yaw: Math.random() * 6 });
    sfx.hit(crit ? 2 : 0);
    if (e.ext?.boss) e.ext.boss(e, amount);
    else bossHandler?.(e, amount);
    return;
  }
  floatText(TMP.copy(e.pos).add(UP), String(amount), crit ? "crit" : "dmg");
  // Tia sáng trúng đòn (sao 4 cánh) + vụn pha lê
  addFx("hit", TMP.copy(e.pos).setY(e.pos.y + 0.7), { color: crit ? "#ffd27a" : "#ffffff", size: crit ? 1.6 : 1.1, yaw: Math.random() * 6 });
  useWorld.getState().burst([e.pos.x, e.pos.y + 0.7, e.pos.z], crit ? "#ffd27a" : ENEMY[e.kind].color, crit ? 14 : 8);
  const c = useCombat.getState();
  useCombat.setState({ energy: Math.min(ENERGY_MAX, c.energy + (crit ? 7 : 4)) });
  sfx.hit(crit ? 2 : 0);
  if (e.hp <= 0) {
    e.deadAt = now;
    useCombat.setState({ energy: Math.min(ENERGY_MAX, useCombat.getState().energy + 10) });
    // VFX-AAA: gục = sụp thành bụi + làn hơi màu quái (dư âm) và ít tia hơn (trước: 40 tia toả cầu đều)
    useWorld.getState().burst([e.pos.x, e.pos.y + 0.6, e.pos.z], ENEMY[e.kind].color, 28);
    emitCollapse(e.pos.x, e.pos.y, e.pos.z, ENEMY[e.kind].color);
    sfx.shatter();
    rollDrops(e.kind, e.pos);
    questEvent({ type: "kill", kind: e.kind });
  }
}

/** Đánh trúng mọi quái trong hình quạt (bán kính range, góc mở arc) */
export function hitArc(origin: THREE.Vector3, yaw: number, range: number, arc: number, dmg: number): number {
  let n = 0;
  for (const e of enemies) {
    if (e.deadAt) continue;
    const dx = e.pos.x - origin.x;
    const dz = e.pos.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range + 0.4) continue;
    let da = Math.atan2(dx, dz) - yaw;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (d < 0.9 || Math.abs(da) < arc / 2) {
      damageEnemy(e, dmg, origin);
      n++;
    }
  }
  return n;
}

export function hitRadius(center: THREE.Vector3, r: number, dmg: number, push = 5): number {
  let n = 0;
  for (const e of enemies) {
    if (e.deadAt) continue;
    if (Math.hypot(e.pos.x - center.x, e.pos.z - center.z) <= r + 0.4) {
      damageEnemy(e, dmg, center, push);
      n++;
    }
  }
  return n;
}

/** Đánh trúng quái nằm gần đoạn thẳng a→b (cú lướt) */
export function hitSegment(a: THREE.Vector3, b: THREE.Vector3, w: number, dmg: number): number {
  let n = 0;
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const L2 = abx * abx + abz * abz || 1;
  for (const e of enemies) {
    if (e.deadAt) continue;
    const t = Math.max(0, Math.min(1, ((e.pos.x - a.x) * abx + (e.pos.z - a.z) * abz) / L2));
    const d = Math.hypot(e.pos.x - (a.x + abx * t), e.pos.z - (a.z + abz * t));
    if (d < w) {
      damageEnemy(e, dmg, a, 6);
      n++;
    }
  }
  return n;
}

export function nearestEnemy(p: THREE.Vector3, maxD: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxD;
  for (const e of enemies) {
    if (e.deadAt) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Có quái ngay trước mặt (để chuột trái trong thế giới khối ưu tiên đánh thay vì phá khối) */
export function enemyInFront(p: THREE.Vector3, yaw: number, range = 3.2): boolean {
  for (const e of enemies) {
    if (e.deadAt) continue;
    const dx = e.pos.x - p.x;
    const dz = e.pos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
    if (Math.abs(da) < 1.1) return true;
  }
  return false;
}

// ───────────── Hành động của người chơi ─────────────

function canAct() {
  const w = useWorld.getState();
  return ENV.armed && !w.overlay && performance.now() > useCombat.getState().downUntil;
}

/** Quái nằm gần đoạn thẳng a→b (tia sáng xuyên thấu) */
export function hitRay(a: THREE.Vector3, yaw: number, len: number, w: number, dmg: number): number {
  const b = new THREE.Vector3(a.x + Math.sin(yaw) * len, a.y, a.z + Math.cos(yaw) * len);
  return hitSegment(a, b, w, dmg);
}

/** Đánh một nhát (bấm và thả ngay) — dùng cho điều khiển tự động (vd. thế giới khối) */
export function attack() {
  attackDown();
  attackUp();
}

// ───────────── Thế võ: chuỗi đòn, nhịp, tụ lực, né ─────────────
// Dữ liệu + chấm nhịp thuần ở lib/world/combo.ts; ở đây là máy trạng thái chạy theo khung hình (tickCombat gọi từ Player).

export const STAMINA_MAX = 100;
const DODGE_COST = 18;
const CHARGED_COST = 22;
/** Khúc xạ thời gian (sau né hoàn hảo): quái chậm còn 25% */
export const SLOW = { until: 0, scale: 0.25 };
export function enemyScale(now = performance.now()) {
  return now < SLOW.until ? SLOW.scale : 1;
}
/** Sửa đổi cho nhát đang ra (chí mạng chắc chắn sau né hoàn hảo) */
const HIT_MOD = { crit: false, launch: 0 };

/** Ngữ cảnh một khung trúng cho vũ khí mở rộng */
export type ExtHitCtx = { p: THREE.Vector3; yaw: number; dmg: number; color: string; perfect: boolean; kind: "chain" | "charged" | "skill"; finisher: boolean };
/**
 * Điểm nối cho vũ khí có cơ chế riêng (Giáo Sin, Khiên Con lắc — combat/waveWeapons.ts tự đăng ký khi nạp):
 *  shape: thực thi các hình đòn mới (trả số quái trúng); guard: can thiệp khi người chơi bị đánh (trả sát thương còn lại, null = bỏ qua);
 *  release: vũ khí tụ lực khi THẢ chuột (heldMs = thời gian giữ của lần vừa thả); alt: chuột phải; tune: phím X.
 */
export const WEAPON_EXT: {
  shape: ((sh: Shape, ctx: ExtHitCtx) => number) | null;
  guard: ((dmg: number, from?: THREE.Vector3) => number | null) | null;
  release: Set<string>;
  releaseFullMs: number;
  heldMs: number;
  alt: Partial<Record<string, (down: boolean) => void>>;
  tune: Partial<Record<string, () => void>>;
} = { shape: null, guard: null, release: new Set(), releaseFullMs: 1400, heldMs: 0, alt: {}, tune: {} };
/** Chuột phải với vũ khí có thế riêng (vd. thế đỡ Khiên Con lắc); false = không có → dùng mặc định (né / ngắm) */
export function weaponAlt(down: boolean): boolean {
  const f = WEAPON_EXT.alt[curWeapon().id];
  if (!f) return false;
  if (down && !canAct()) return true;
  f(down);
  return true;
}
/** Phím X: chỉnh tham số vũ khí (λ của Giáo Sin, dây L của Khiên Con lắc) */
export function weaponTune() {
  if (!ENV.armed || useWorld.getState().overlay) return;
  WEAPON_EXT.tune[curWeapon().id]?.();
}

type Cur = { move: Move; kind: "chain" | "charged" | "skill"; t0: number; tm: MoveTimes; next: number; perfect: boolean; yaw: number; finisher: boolean; crit: boolean; cued: boolean };
const CB = {
  cur: null as Cur | null,
  step: 0,
  lastChainAt: -1e9,
  lastTm: null as MoveTimes | null,
  /** đệm phím 150 ms (lib/world/inputBuffer.ts) */
  buf: newBuf(),
  /** mốc hết bước lao của nhát đang vung (lướt huỷ được cả bước lao) */
  lungeUntil: 0,
  presses: 0,
  mashed: false,
  streak: 0,
  holding: false,
  downAt: 0,
  chargedFired: false,
  counterUntil: 0,
  staminaAt: 0,
  comboAt: 0,
};

/** Vệt chém đang "ghi" (đang ra đòn) */
export function trailActive(): boolean {
  return !!CB.cur;
}
/** Vệt chém chuyển vàng khi nhát đang ra là nhát giữ Nhịp */
export function rhythmGold(): boolean {
  return !!CB.cur?.perfect;
}
/** Mức tụ lực 0..1 khi đang giữ chuột (chỉ hiện sau ~0,13 s để bấm nhanh không loé vòng) */
export function chargeLevel(): number {
  if (!CB.holding || CB.chargedFired) return 0;
  const k = (performance.now() - CB.downAt) / (WEAPON_EXT.release.has(curWeapon().id) ? WEAPON_EXT.releaseFullMs : HOLD_MS);
  return k < 0.35 ? 0 : Math.min(1, k);
}
/** Thời gian đang giữ chuột (ms; 0 = không giữ / đã ra đòn tụ lực) */
export function holdMs(): number {
  return CB.holding && !CB.chargedFired ? performance.now() - CB.downAt : 0;
}
/** Giật máy quay (dolly-in) rồi trả về: tuyệt kỹ, đòn kết */
const PUNCH = { at: -1e9, amt: 0, dur: 600, live: false };
function camPunch(amt: number, dur = 600) {
  PUNCH.at = performance.now();
  PUNCH.amt = amt;
  PUNCH.dur = dur;
  PUNCH.live = true;
}

function moveset(): Moveset {
  return MOVESETS[curWeapon().id] ?? MOVESETS.blade;
}

/** Thông báo đánh giá trên HUD */
function judgeText(text: string, kind: "perfect" | "miss" | "dodge" | "info") {
  useCombat.setState({ judge: { text, kind, at: performance.now() } });
}

/** Hướng ra đòn: quái gần trong 7 m; không có thì theo hướng phím di chuyển (so với máy quay) */
function aimYaw(): number {
  const w = useWorld.getState();
  const t = nearestEnemy(w.player, 7);
  if (t) w.playerYaw = Math.atan2(t.pos.x - w.player.x, t.pos.z - w.player.z);
  else {
    const { x, y } = w.input;
    if (Math.hypot(x, y) > 0.2) {
      const yaw = w.camYaw;
      w.playerYaw = Math.atan2(-Math.sin(yaw) * y + Math.cos(yaw) * x, -Math.cos(yaw) * y - Math.sin(yaw) * x);
    }
  }
  return w.playerYaw;
}

function startMove(move: Move, kind: Cur["kind"], perfect: boolean, finisher = false) {
  const now = performance.now();
  const w = useWorld.getState();
  const speedMul = perfect ? 1.15 : 1;
  const tm = moveTimes(move, speedMul);
  const yaw = aimYaw();
  const crit = now < CB.counterUntil;
  if (crit) CB.counterUntil = 0;
  CB.cur = { move, kind, t0: now, tm, next: 0, perfect, yaw, finisher, crit, cued: false };
  clearBuf(CB.buf);
  CB.lungeUntil = 0;
  CB.presses = 0;
  CB.mashed = false;
  w.act(move.pose, tm.end + 40, { name: move.clip, from: move.from, speed: move.speed * speedMul });
  useCombat.setState({ swingAt: now });
  if (move.pose === "slash") setTimeout(() => sfx.swing(finisher || kind !== "chain"), Math.max(0, (tm.hits[0] ?? 120) - 90));
  // Lao tới: đi hết quãng `lunge` trong lúc vào đòn (tới khung trúng cuối)
  if (move.lunge) {
    const until = Math.max(120, Math.min(tm.hits.length ? Math.max(...tm.hits) : tm.end * 0.5, move.iframe ? 520 : 260));
    motion.dashDir.set(Math.sin(yaw), 0, Math.cos(yaw));
    motion.dashSpeed = move.lunge / (until / 1000);
    motion.dashUntil = now + until;
    CB.lungeUntil = motion.dashUntil;
  }
  if (move.iframe) guard.until = Math.max(guard.until, now + (tm.hits.length ? Math.max(...tm.hits) : 300) + 80);
}

/** Bấm đánh (chuột trái xuống / chạm nút) */
export function attackDown() {
  if (!canAct()) return;
  const now = performance.now();
  // Trên không đủ cao → bổ nhào (plunge): lao thẳng xuống, chạm đất nổ sóng xung kích
  if (!motion.grounded && air.height > 1.6 && !motion.plunging) {
    motion.plunging = true;
    motion.gliding = false;
    motion.vy = -26;
    motion.plungeFrom = useWorld.getState().player.y;
    useWorld.getState().act("slash", 900);
    return;
  }
  if (curWeapon().id === "bow" && useCombat.getState().aiming) {
    shootAimed(false);
    return;
  }
  CB.holding = true;
  CB.downAt = now;
  CB.chargedFired = false;
  const set = moveset();
  const cur = CB.cur;
  if (cur) {
    CB.presses++;
    if (CB.presses >= MASH_LIMIT && !CB.mashed) {
      // Bấm loạn trong một nhát → mất nhịp (phải canh, không bấm bừa)
      CB.mashed = true;
      if (CB.streak > 0) judgeText("loạn nhịp", "miss");
      CB.streak = 0;
    }
    // Tụ lực / kỹ năng: hết khung trúng (cancelFrom) thì bấm là vào chuỗi ngay; sớm hơn → đệm 150 ms
    if (cur.kind !== "chain") {
      if (now - cur.t0 >= cur.tm.cancelFrom) {
        CB.step = 0;
        chainNext(set, false);
      } else bufferPress(CB.buf, now);
      return;
    }
    const j = judge(now - cur.t0, cur.tm);
    if (j === "early") {
      // H1 đệm phím: ghi nhớ lần bấm; tới linkOpen (≤ 150 ms sau) nhát kế ra ngay, không đợi hết hoạt ảnh
      bufferPress(CB.buf, now);
      return;
    }
    chainNext(set, j === "perfect" && !CB.mashed);
    return;
  }
  // Đang rảnh: còn trong ân hạn của nhát trước → nối chuỗi; quá trễ → về nhát 1
  if (CB.lastTm) {
    const j = judge(now - CB.lastChainAt, CB.lastTm);
    if (j === "late") {
      CB.step = 0;
      CB.streak = 0;
    }
    chainNext(set, j === "perfect");
    return;
  }
  CB.step = 0;
  chainNext(set, false);
}

function chainNext(set: Moveset, perfect: boolean) {
  const idx = CB.step % set.chain.length;
  const finisher = idx === set.chain.length - 1;
  if (perfect) {
    CB.streak++;
    judgeText(CB.streak >= 3 && finisher ? `Nhịp ×${CB.streak} · Kết cường hoá` : `Nhịp ×${CB.streak}`, "perfect");
    sfx.chime(Math.min(4, CB.streak));
  } else if (idx > 0) CB.streak = 0;
  startMove(set.chain[idx], "chain", perfect, finisher);
  CB.lastChainAt = performance.now();
  CB.lastTm = CB.cur!.tm;
  CB.step = nextStep(idx, set.chain.length);
}

/** Thả chuột */
export function attackUp() {
  // vũ khí tụ lực khi thả (Giáo Sin): giữ đủ HOLD_MS thì thả ra là đòn tụ lực, giữ càng lâu càng mạnh
  if (CB.holding && !CB.chargedFired && WEAPON_EXT.release.has(curWeapon().id) && canAct()) {
    const now = performance.now();
    if (now - CB.downAt >= HOLD_MS) {
      CB.chargedFired = true;
      WEAPON_EXT.heldMs = now - CB.downAt;
      fireCharged(now);
    }
  }
  CB.holding = false;
}

/** Né (Shift / chuột phải / nút né): lướt ngắn có khung bất tử; chỉ huỷ được pha thu thế của đòn */
export function dodge() {
  if (!canAct() || !motion.grounded) return;
  const now = performance.now();
  const c = useCombat.getState();
  if (c.stamina < DODGE_COST) {
    judgeText("hết thể lực", "info");
    return;
  }
  // H1 huỷ đòn bằng lướt: đang vung (kể cả pha vào đòn / bước lao của chính nhát đó) → huỷ ngay rồi lướt
  const dd = dashDecision(!!CB.cur, now, motion.dashUntil, CB.lungeUntil);
  if (dd === "busy") return;
  const midSwing = !!CB.cur && now - CB.cur.t0 < CB.cur.tm.cancelFrom;
  CB.cur = null;
  CB.lungeUntil = 0;
  clearBuf(CB.buf);
  const w = useWorld.getState();
  if (dd === "cancel" && midSwing) useCombat.setState({ judge: { text: "huỷ đòn", kind: "info", at: now } });
  const { x, y } = w.input;
  let yaw: number;
  if (Math.hypot(x, y) > 0.2) {
    const cy = w.camYaw;
    yaw = Math.atan2(-Math.sin(cy) * y + Math.cos(cy) * x, -Math.cos(cy) * y - Math.sin(cy) * x);
  } else yaw = w.playerYaw + Math.PI; // không bấm hướng → lùi lại
  w.playerYaw = Math.hypot(x, y) > 0.2 ? yaw : w.playerYaw;
  motion.dashDir.set(Math.sin(yaw), 0, Math.cos(yaw));
  motion.dashSpeed = 13;
  motion.dashUntil = now + 330;
  motion.dodgeAt = now;
  guard.until = Math.max(guard.until, now + 300);
  useCombat.setState({ stamina: c.stamina - DODGE_COST });
  CB.staminaAt = now;
  w.act("roll", 560, { name: "Roll", from: 0.05, speed: 2.1 });
  const p = w.player;
  addFx("dash", TMP.set(p.x, p.y + 0.9, p.z), { to: new THREE.Vector3(p.x + Math.sin(yaw) * 4.2, p.y + 0.9, p.z + Math.cos(yaw) * 4.2), color: "#bfe8ff" });
  sfx.dash();
}

/** Né hoàn hảo: gọi khi đòn quái lẽ ra trúng trong khung bất tử ngay sau khi né */
function perfectDodge() {
  const now = performance.now();
  if (now < SLOW.until) return;
  SLOW.until = now + 2200;
  CB.counterUntil = now + 2600;
  const w = useWorld.getState();
  judgeText("Né hoàn hảo · Khúc xạ thời gian", "dodge");
  SLOW.scale = 0.25;
  impact(0.8);
  camPunch(0.06, 500);
  useCombat.setState({ slowAt: now });
  w.addShake(0.15);
  const p = w.player;
  strike("dial", p.x, p.y + 0.05, p.z, { r: 4, color: "#9fe6ff", yaw: w.playerYaw });
  sfx.chime(5);
}

/** Kỹ năng E: thế riêng của vũ khí */
export function skill() {
  if (!canAct()) return;
  const now = performance.now();
  const c = useCombat.getState();
  if (now - c.skillAt < SKILL_CD) return;
  const cur = CB.cur;
  if (cur && now - cur.t0 < cur.tm.cancelFrom && cur.kind !== "chain") return;
  useCombat.setState({ skillAt: now });
  startMove(moveset().skill, "skill", false);
  CB.step = 0;
  CB.lastTm = null;
}

/** Ra đòn tụ lực (huỷ pha thu thế của nhát đang ra; còn đang vung thì bỏ) */
function fireCharged(now: number) {
  const cur = CB.cur;
  const free = !cur || now - cur.t0 >= cur.tm.cancelFrom;
  if (!free) return;
  const c = useCombat.getState();
  if (c.stamina >= CHARGED_COST) {
    useCombat.setState({ stamina: c.stamina - CHARGED_COST });
    CB.staminaAt = now;
    startMove(moveset().charged, "charged", false);
    CB.step = 0;
    CB.lastTm = null;
    const p = useWorld.getState().player;
    strike("sigil", p.x, p.y + 0.05, p.z, { r: 1.2, n: 6, color: curWeapon().color });
  } else judgeText("hết thể lực", "info");
}

/** Bước combat mỗi khung hình (Player gọi) */
export function tickCombat(dt: number) {
  const now = performance.now();
  const c = useCombat.getState();
  // thể lực hồi sau 0,6 s không dùng
  if (c.stamina < STAMINA_MAX && now - CB.staminaAt > 600) useCombat.setState({ stamina: Math.min(STAMINA_MAX, c.stamina + 30 * dt) });
  // giữ chuột đủ lâu → đòn tụ lực (huỷ pha thu thế của nhát đang ra)
  if (CB.holding && !CB.chargedFired && now - CB.downAt >= HOLD_MS && canAct() && !WEAPON_EXT.release.has(curWeapon().id)) {
    CB.chargedFired = true;
    fireCharged(now);
  }
  if (PUNCH.live) {
    const k = (now - PUNCH.at) / PUNCH.dur;
    if (k >= 1) {
      CAM.dolly = 1;
      PUNCH.live = false;
    } else CAM.dolly = 1 - PUNCH.amt * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
  }
  const cur = CB.cur;
  if (!cur) return;
  const el = now - cur.t0;
  while (cur.next < cur.move.hits.length && el >= cur.tm.hits[cur.next]) execHit(cur, cur.move.hits[cur.next++]);
  // Tín hiệu nhịp: vũ khí loé đúng lúc mở cửa sổ hoàn hảo (chỉ với chuỗi đòn thường)
  if (!cur.cued && cur.kind === "chain" && el >= cur.tm.perfectFrom) {
    cur.cued = true;
    const p = useWorld.getState().player;
    // loé ở mũi vũ khí (vệt chém vừa ghi) — không có thì trước ngực
    const at = now - TRAIL_TIP.at < 120 ? TRAIL_TIP.pos : TMP.set(p.x + Math.sin(cur.yaw) * 0.55, p.y + 1.25, p.z + Math.cos(cur.yaw) * 0.55);
    addFx("spark", at, { color: "#fff6c8", size: 0.7 });
  }
  // H1 đệm phím: lần bấm sớm (≤ BUFFER_MS) ra đòn ngay khi được phép — chuỗi: linkOpen; tụ lực / kỹ năng: cancelFrom
  if (hasBuffered(CB.buf)) {
    const open = cur.t0 + (cur.kind === "chain" ? cur.tm.linkOpen : cur.tm.cancelFrom);
    const r = takeBuffered(CB.buf, now, open, BUFFER_MS);
    if (r === "fire") {
      if (cur.kind !== "chain") CB.step = 0;
      chainNext(moveset(), false);
      return;
    }
  }
  if (el >= cur.tm.end) CB.cur = null;
}

/** Đang ở pha khởi động / ra đòn (chưa được di chuyển) */
export function attackLocked(): boolean {
  const cur = CB.cur;
  return !!cur && performance.now() - cur.t0 < cur.tm.cancelFrom;
}
/** Di chuyển trong pha thu thế → huỷ đòn (như game hành động) */
export function cancelRecovery() {
  const cur = CB.cur;
  if (cur && performance.now() - cur.t0 >= cur.tm.cancelFrom && !hasBuffered(CB.buf)) {
    CB.cur = null;
    const w = useWorld.getState();
    if (w.action && (w.action.pose === "slash" || w.action.pose === "cast")) w.set({ action: null });
  }
}

function execHit(cur: Cur, h: Hit) {
  const w = useWorld.getState();
  const wp = curWeapon();
  const p = w.player;
  const yaw = cur.yaw;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const dmg = wp.atk * h.mul * rhythmMul(cur.perfect, CB.streak, cur.finisher);
  HIT_MOD.crit = cur.crit;
  HIT_MOD.launch = h.launch ?? 0;
  const color = cur.perfect ? "#fff2b0" : wp.color;
  let n = 0;
  const sh = h.shape;
  switch (sh.k) {
    case "arc":
      n = hitArc(p, yaw, sh.range, sh.arc, dmg);
      break;
    case "line": {
      const a = p.clone();
      const b = a.clone().addScaledVector(fwd, sh.len);
      if (sh.len > 4) addFx("dash", a.clone().setY(a.y + 0.9), { to: b.clone().setY(a.y + 0.9), color });
      n = hitSegment(a.clone().addScaledVector(fwd, -0.4), b, sh.w, dmg);
      if (sh.len <= 4) addFx("beam", a.clone().setY(a.y + 1.1).addScaledVector(fwd, 0.4), { to: b.clone().setY(a.y + 1.1), color });
      break;
    }
    case "circle": {
      const at = p.clone().addScaledVector(fwd, sh.fwd).setY(p.y + 0.06);
      strike("rupture", at.x, at.y, at.z, { r: sh.r, yaw, color });
      n = hitRadius(at, sh.r, dmg, h.push ?? 5);
      break;
    }
    case "torque":
      // Mô-men = lực × cánh tay đòn: quái càng xa (trong tầm) càng đau, bị hất càng mạnh
      strike("wedge", p.x, p.y + 0.06, p.z, { r: sh.range, arc: 1.0, yaw, color });
      for (const e of enemies) {
        if (e.deadAt) continue;
        const dx = e.pos.x - p.x;
        const dz = e.pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > sh.range) continue;
        const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
        if (Math.abs(da) > 1.0 && d > 0.9) continue;
        damageEnemy(e, dmg * (0.55 + 0.25 * d), p, 3 + 2.2 * d);
        n++;
      }
      break;
    case "arrow": {
      const target = nearestEnemy(p, 22);
      const from = new THREE.Vector3(p.x, p.y + 1.35, p.z).addScaledVector(fwd, 0.6);
      const speed = sh.charged ? 24 : 15;
      for (let i = 0; i < sh.n; i++) {
        const da = sh.n > 1 ? (i / (sh.n - 1) - 0.5) * 2 * sh.spread : 0;
        const vel = new THREE.Vector3();
        if (target) {
          const dx = target.pos.x - from.x;
          const dz = target.pos.z - from.z;
          const dist = Math.hypot(dx, dz);
          const t = Math.max(0.12, dist / speed);
          const dy = target.pos.y + 0.6 - from.y;
          const ang = Math.atan2(dx, dz) + da;
          vel.set(Math.sin(ang) * speed, (dy + 0.5 * GRAVITY * t * t) / t, Math.cos(ang) * speed);
        } else vel.set(Math.sin(yaw + da) * speed, 3.2, Math.cos(yaw + da) * speed);
        projectiles.push({ pos: from.clone(), vel, born: performance.now(), dmg, color: sh.charged ? "#ffd27a" : color, alive: true, trail: [], pierce: sh.charged });
      }
      if (projectiles.length > 32) projectiles.splice(0, projectiles.length - 32);
      sfx.cast();
      HIT_MOD.crit = false;
      return;
    }
    case "rain": {
      const target = nearestEnemy(p, 18);
      const c0 = target ? target.pos.clone() : p.clone().addScaledVector(fwd, 7);
      for (let i = 0; i < sh.n; i++) {
        const a = (i / sh.n) * Math.PI * 2;
        const land = c0.clone().add(new THREE.Vector3(Math.cos(a) * sh.r * Math.sqrt((i % 3) / 3 + 0.2), 0, Math.sin(a) * sh.r * Math.sqrt((i % 3) / 3 + 0.2)));
        const from = new THREE.Vector3(p.x, p.y + 1.5, p.z);
        const t = 1.1 + (i % 3) * 0.12;
        const vel = new THREE.Vector3((land.x - from.x) / t, (land.y - from.y + 0.5 * GRAVITY * t * t) / t, (land.z - from.z) / t);
        projectiles.push({ pos: from, vel, born: performance.now(), dmg, color, alive: true, trail: [] });
      }
      strike("grid", c0.x, c0.y + 0.05, c0.z, { r: sh.r, yaw, color });
      sfx.cast();
      HIT_MOD.crit = false;
      return;
    }
    case "beams": {
      const o = new THREE.Vector3(p.x, p.y + 1.1, p.z).addScaledVector(fwd, 0.5);
      const tints = ["#ff7a9c", "#ffb36b", "#fff6c8", "#8ff0a8", "#7ad8ff", "#9f8cff", "#e0a0ff"];
      const full = sh.spread >= Math.PI * 2 - 1e-3;
      for (let i = 0; i < sh.n; i++) {
        const da = full ? (i / sh.n) * Math.PI * 2 : sh.n > 1 ? (i / (sh.n - 1) - 0.5) * sh.spread : 0;
        const to = o.clone().add(new THREE.Vector3(Math.sin(yaw + da) * sh.len, 0, Math.cos(yaw + da) * sh.len));
        addFx("beam", o, { to, color: sh.n === 1 ? (cur.perfect ? "#fff2b0" : "#f4f0ff") : tints[i % tints.length] });
        n += hitRay(o, yaw + da, sh.len, sh.n === 1 && cur.kind === "charged" ? 1.2 : 0.75, dmg);
      }
      sfx.cast();
      break;
    }
    case "chain": {
      let from = new THREE.Vector3(p.x, p.y + 1.2, p.z);
      let curE = nearestEnemy(p, sh.range);
      const hit = new Set<number>();
      let d = dmg;
      for (let hop = 0; hop < sh.hops && curE; hop++) {
        const to = new THREE.Vector3(curE.pos.x, curE.pos.y + 0.6, curE.pos.z);
        addFx("bolt", from, { to, color });
        damageEnemy(curE, d, from, 2);
        hit.add(curE.id);
        n++;
        from = to;
        d *= 0.72;
        let best: Enemy | null = null;
        let bd = 6;
        for (const e of enemies) {
          if (e.deadAt || hit.has(e.id)) continue;
          const dd = e.pos.distanceTo(curE.pos);
          if (dd < bd) {
            bd = dd;
            best = e;
          }
        }
        curE = best;
      }
      if (!hit.size) addFx("bolt", from, { to: from.clone().addScaledVector(fwd, 4), color });
      sfx.cast();
      break;
    }
    case "orbit": {
      const k = sh.count ?? 1;
      for (let i = 0; i < k; i++) orbiters.push({ kind: sh.kind, born: performance.now() + i * 120, dur: sh.dur, yaw: yaw + (i * Math.PI * 2) / k, color, dmg, pos: new THREE.Vector3(), hits: new Map() });
      sfx.circle();
      HIT_MOD.crit = false;
      return;
    }
    case "wave": {
      const at = p.clone().addScaledVector(fwd, sh.fwd).setY(p.y + 0.06);
      strike("crest", at.x, at.y, at.z, { r: sh.r, yaw, color });
      addFx("spark", at, { color, size: 1 });
      n = hitRadius(at, sh.r, dmg * (sh.rings > 1 ? 1 : 1), h.push ?? 4);
      sfx.circle();
      break;
    }
    case "pull": {
      for (const e of enemies) {
        if (e.deadAt) continue;
        const v = new THREE.Vector3(p.x - e.pos.x, 0, p.z - e.pos.z);
        const d = v.length();
        if (d > sh.r || d < 0.8) continue;
        e.vel.addScaledVector(v.normalize(), 9);
        damageEnemy(e, dmg, p, -2);
        n++;
      }
      strike("tendril", p.x, p.y + 0.06, p.z, { r: sh.r, yaw, color });
      break;
    }
    default:
      n = WEAPON_EXT.shape?.(sh, { p, yaw, dmg, color, perfect: cur.perfect, kind: cur.kind, finisher: cur.finisher }) ?? 0;
  }
  HIT_MOD.crit = false;
  HIT_MOD.launch = 0;
  if (h.fx === "slash" || h.fx === "slashFlip") addFx("slash", TMP.copy(p).addScaledVector(fwd, 0.7).setY(p.y + 1.0), { yaw, color, size: cur.finisher ? 1.35 : 1.05, flip: h.fx === "slashFlip" });
  if (h.fx === "nova") {
    const at = p.clone().addScaledVector(fwd, sh.k === "circle" ? sh.fwd : 0).setY(p.y + 0.06);
    strike("star", at.x, at.y, at.z, { r: sh.k === "circle" ? sh.r : 3, yaw, color, n: 6 });
    if (cur.finisher && CB.streak >= 3) addFx("crater", at.clone().setY(p.y + 0.03), { color, size: 1.6, yaw: Math.random() * 6 });
  }
  if (h.shake) w.addShake(h.shake * (cur.finisher && CB.streak >= 3 ? 1.6 : 1));
  if (n > 0) {
    // khựng hình khi trúng: cảm giác "chạm" (nặng hơn với nhát kết / đòn nặng)
    const heavy = cur.finisher || cur.kind !== "chain";
    w.hitstop(heavy ? 85 : cur.perfect ? 50 : 35);
    // chấn màn hình: nhát kết / tụ lực / kỹ năng; nhát Nhịp nhẹ hơn
    if (heavy) {
      impact(cur.finisher && CB.streak >= 3 ? 0.95 : 0.55);
      sfx.impact(cur.finisher && CB.streak >= 3 ? 1.3 : 0.9);
      if (cur.finisher) camPunch(0.07, 380);
    } else if (cur.perfect) impact(0.18);
    const now = performance.now();
    const combo = now - CB.comboAt < 2600 ? useCombat.getState().combo + n : n;
    CB.comboAt = now;
    useCombat.setState({ combo, comboAt: now });
  } else if (h.fx === "slash" || h.fx === "slashFlip") sfx.whiff();
}

export function jump() {
  if (!ENV.armed && useWorld.getState().scene === "valley") return;
  if (useWorld.getState().overlay) return;
  // Đang bơi: nhảy = đạp nước nổi lên (sát bờ thì đủ đà trèo lên)
  if (motion.swimming) {
    motion.vy = Math.max(motion.vy, 5.6);
    sfx.step();
    return;
  }
  // Trên không: bấm nhảy lần nữa = mở / gập tàu lượn (cần cao ≥ 1,2 m)
  if (!motion.grounded) {
    if (motion.gliding) motion.gliding = false;
    else if (air.height > 0.9 && !motion.plunging) {
      motion.gliding = true;
      motion.vy = Math.max(motion.vy, -1);
      sfx.circle();
    }
    return;
  }
  motion.vy = 7.4;
  motion.grounded = false;
  useWorld.getState().act("jump", 650);
  sfx.step();
}

export function burst() {
  if (!canAct()) return;
  const c = useCombat.getState();
  if (c.energy < ENERGY_MAX) return;
  const w = useWorld.getState();
  const now = performance.now();
  useCombat.setState({ energy: 0, swingAt: now });
  const melee = ["blade", "lever", "spiral", "lance", "shield"].includes(curWeapon().id);
  w.act(melee ? "slash" : "cast", 1000, melee ? { name: "Sword_Heavy_Combo", from: 2.2, speed: 0.85 } : { name: "Spell_Simple_Shoot", from: 0, speed: 0.55 });
  CB.cur = null;
  // điện ảnh: thế giới gần như đứng hình 0,6 s, máy quay giật vào, màn hình chấn
  SLOW.until = now + 650;
  SLOW.scale = 0.08;
  camPunch(0.22, 900);
  impact(1.1);
  sfx.impact(1.5);
  const color = curWeapon().color;
  const p0 = w.player;
  // pha tụ: vòng phép dựng đứng trước ngực + vòng thu lại dưới chân
  strike("converge", p0.x, p0.y + 0.05, p0.z, { r: 2.2, n: 8, yaw: w.playerYaw, color });
  sfx.chime(3);
  // bung đúng khung trúng của animation (≈ 0,38 s)
  setTimeout(() => {
    const ww = useWorld.getState();
    const at = ww.player.clone().setY(ww.player.y + 0.06);
    HIT_MOD.launch = 9;
    strike("drop", at.x, at.y, at.z, { r: 7, yaw: ww.playerYaw, color });
    addFx("crater", at.clone().setY(at.y - 0.03), { color, size: 3, yaw: Math.random() * 6 });
    hitRadius(at, 7, 55, 9);
    HIT_MOD.launch = 0;
    ww.hitstop(140);
    ww.addShake(0.8);
    ww.burst([at.x, at.y + 1.2, at.z], color, 90);
    impact(1.2);
    shockwave(at.clone().setY(at.y + 1), 1.3);
    sfx.impact(1.6);
    sfx.explode(undefined, 1.4);
  }, melee ? 380 : 260);
}

export function cycleWeapon(dir = 1) {
  if (!ENV.armed) return;
  const n = loadoutList().length;
  if (n < 2) return;
  const c = useCombat.getState();
  const weapon = (c.weapon + dir + n) % n;
  useCombat.setState({ weapon, swingAt: performance.now() });
  const p = useWorld.getState().player;
  strike("helix", p.x, p.y + 0.05, p.z, { r: 0.8, yaw: useWorld.getState().playerYaw, color: curWeapon().color });
  sfx.click();
}

/** Quái đánh trúng người chơi */
export function playerHurt(dmg: number, from?: THREE.Vector3) {
  const now = performance.now();
  const c = useCombat.getState();
  // Né hoàn hảo: đòn trúng ngay trong khung bất tử vừa né (≤ 220 ms) → Khúc xạ thời gian
  if (now - motion.dodgeAt < 220 && c.hp > 0) {
    perfectDodge();
    return;
  }
  // khiên phép đang bật: chặn trọn đòn, bong bóng gợn sóng tại phía bị đánh
  if (now < ward.until) {
    ward.hitAt = now;
    if (from) ward.hitDir.set(from.x - useWorld.getState().player.x, 0.2, from.z - useWorld.getState().player.z).normalize();
    sfx.shield();
    return;
  }
  if (now < c.downUntil || now < guard.until || now < motion.dashUntil + 120) return; // đang lướt thì né được (khung bất tử)
  // vũ khí có thế đỡ riêng (Khiên Con lắc): chặn một phần / toàn bộ, có thể phản đòn
  const left = WEAPON_EXT.guard?.(dmg, from);
  if (left != null) {
    if (left <= 0) return;
    dmg = Math.max(1, Math.round(left));
  }
  const w = useWorld.getState();
  const hp = Math.max(0, c.hp - dmg);
  useCombat.setState({ hp });
  w.set({ shieldAt: now });
  w.addShake(0.35);
  w.act("hurt", 450);
  floatText(TMP.copy(w.player).add(UP), `-${dmg}`, "hurt");
  sfx.hurt();
  if (hp <= 0) useCombat.setState({ downUntil: now + 1800 });
}

/** Bổ nhào chạm đất: sát thương vùng theo độ cao rơi (thế năng mgh → động năng) */
export function plungeImpact(at: THREE.Vector3, fall: number) {
  const w = useWorld.getState();
  const dmg = 22 + Math.min(40, fall * 4);
  const r = 2.6 + Math.min(1.6, fall * 0.12);
  hitRadius(at, r, dmg, 8);
  strike("crater", at.x, at.y + 0.05, at.z, { r, yaw: w.playerYaw, color: curWeapon().color });
  addFx("crater", at.clone().setY(at.y + 0.03), { color: curWeapon().color, size: r * 0.7, yaw: Math.random() * 6 });
  w.addShake(0.35 + Math.min(0.4, fall * 0.04));
  w.hitstop(60);
  w.burst([at.x, at.y + 0.4, at.z], curWeapon().color, 40);
  impact(0.6);
  shockwave(at.clone().setY(at.y + 0.3), 0.6 + Math.min(0.6, fall * 0.05));
  sfx.explode("earth", 0.7 + Math.min(0.6, fall * 0.05));
  sfx.impact(1.1);
}
