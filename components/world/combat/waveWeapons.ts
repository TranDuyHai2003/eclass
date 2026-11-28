"use client";
/**
 * Giáo Sin + Khiên Con lắc — trạng thái chạy từng khung (ngoài React) và các điểm nối vào combat.ts (WEAPON_EXT).
 * Toán / lý thuần ở lib/world/sineLance.ts và lib/world/pendShield.ts (có test); ở đây chỉ nối vào quái, hiệu ứng, âm thanh.
 * Nạp module này (WaveWeaponsFx trong CombatFx, HUD) là tự đăng ký.
 */
import * as THREE from "three";
import { create } from "zustand";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { floatText } from "../ui/Labels";
import { impact, shockwave } from "../fx/Lensing";
import { emitHit, emitSpark } from "../fx/Sparks";
import { HOLD_MS, type Shape } from "@/lib/world/combo";
import * as SL from "@/lib/world/sineLance";
import * as PS from "@/lib/world/pendShield";
import { WEAPON_DEFS } from "./items";
import { strike } from "../fx/StrikeFx";
import { ENV, WEAPON_EXT, addFx, curWeapon, damageEnemy, enemies, hitRadius, useCombat, type Enemy, type ExtHitCtx } from "./combat";

const fmt = (n: number, d = 2) => n.toFixed(d).replace(".", ",");
const V = new THREE.Vector3();
const V2 = new THREE.Vector3();
const nowS = () => performance.now() / 1000;
const vi = () => useWorld.getState().lang === "vi";

/** Tham số hiện trên HUD (đổi ít) — giá trị đổi từng khung đọc thẳng LANCE / SHIELD */
export const useWaveW = create<{ lamIdx: number; lenIdx: number; streak: number; grade: PS.ParryGrade | null; gradeAt: number }>(() => ({
  lamIdx: 1,
  lenIdx: 1,
  streak: 0,
  grade: null,
  gradeAt: 0,
}));
export const curLam = () => SL.LANCE_LAMBDAS[useWaveW.getState().lamIdx];
export const curLen = () => PS.SHIELD_LENGTHS[useWaveW.getState().lenIdx];

// ───────────── Giáo Sin ─────────────

type CrestState = { dy: number; hitAt: number; fbAt: number };
export const LANCE = {
  packets: [] as SL.Packet[],
  /** lần phát bó sóng gần nhất (s) — kim pha trên HUD: Δφ = 2π·(t − t₀)/T */
  last: null as { t: number; T: number; lam: number } | null,
  /** sóng dừng đang chạy (vẽ nút / bụng trên đất) */
  standing: null as { t0: number; until: number; ox: number; oz: number; dx: number; dz: number; lam: number; D: number } | null,
  crest: new Map<number, CrestState>(),
  nextId: 1,
  /** lúc nhát đâm gần nhất (hiện chấm đỉnh / nút sáng lên) */
  thrustAt: -1e9,
};

function addPacket(p: Omit<SL.Packet, "id">) {
  LANCE.packets.push({ ...p, id: LANCE.nextId++ });
  if (LANCE.packets.length > 12) LANCE.packets.splice(0, LANCE.packets.length - 12);
}

function lanceThrust(sh: Extract<Shape, { k: "sine" }>, ctx: ExtHitCtx): number {
  const { p, yaw } = ctx;
  const lam = curLam();
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const now = nowS();
  const charged = sh.packet === "charged";
  const A = charged ? SL.chargeAmplitude(WEAPON_EXT.heldMs, HOLD_MS) : SL.A_CHAIN;
  // Nhát đâm tức thì: mọi quái trên đường đâm, hệ số theo vị trí trên sóng (đỉnh ×1,5 · nút ×0,7)
  let n = 0;
  for (const e of enemies) {
    if (e.deadAt) continue;
    const rx = e.pos.x - p.x;
    const rz = e.pos.z - p.z;
    const s = rx * fx + rz * fz;
    const d = Math.abs(rx * fz - rz * fx);
    if (s < -0.3 || s > sh.len + 0.45 || d > 0.95 + (charged ? A * 0.5 : 0)) continue;
    const m = SL.crestMul(Math.max(0, s), lam);
    damageEnemy(e, ctx.dmg * m, p, 3 + 2 * m);
    if (m >= 1.42) floatText(V.set(e.pos.x, e.pos.y + 2.2, e.pos.z), vi() ? "đỉnh sóng ×1,5" : "crest ×1.5", "crit");
    else if (m <= 0.78) floatText(V.set(e.pos.x, e.pos.y + 2.2, e.pos.z), vi() ? "nút sóng ×0,7" : "node ×0.7", "info");
    n++;
  }
  // Bó sóng chạy ra từ mũi giáo
  const ox = p.x + fx * 0.35;
  const oz = p.z + fz * 0.35;
  addPacket({ ox, oz, dx: fx, dz: fz, t0: now, A, lam, v: SL.WAVE_V, cycles: charged ? 3 : 2, range: charged ? 14 : 7, dmgK: charged ? 0.6 : 0.25, src: charged ? "charged" : "chain" });
  LANCE.last = { t: now, T: lam / SL.WAVE_V, lam };
  LANCE.thrustAt = performance.now();
  // Hiệu ứng: tia đâm + loé ở mũi; tụ lực: sóng xung kích + chấn
  const tip = V.set(p.x + fx * sh.len, p.y + 1.15, p.z + fz * sh.len);
  addFx("beam", V2.set(p.x + fx * 0.4, p.y + 1.15, p.z + fz * 0.4), { to: tip.clone(), color: ctx.perfect ? "#fff2b0" : ctx.color });
  emitSpark(tip.x, tip.y, tip.z, fx * 3, 0.5, fz * 3, "#e8fbff", { kind: 1, size: charged ? 1.6 : 0.9, life: 0.1, bright: 3 });
  sfx.waveCrest(A);
  if (charged) {
    shockwave(tip.clone(), 0.35 + 0.35 * (A / SL.A_MAX));
    impact(0.35 + 0.3 * (A / SL.A_MAX));
    strike("muzzle", tip.x, tip.y, tip.z, { yaw, color: ctx.color });
    useWorld.getState().addShake(0.1 + 0.15 * (A / SL.A_MAX));
    floatText(V.set(p.x, p.y + 2.3, p.z), `A = ${fmt(A)} m · λ = ${fmt(lam, 1)} m`, "info");
  }
  return n;
}

function lanceStanding(ctx: ExtHitCtx): number {
  const { p, yaw } = ctx;
  const lam = curLam();
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const D = 2 * lam;
  const now = nowS();
  const ox = p.x + fx * 0.35;
  const oz = p.z + fz * 0.35;
  const [a, b] = SL.standingPair(LANCE.nextId, ox, oz, fx, fz, now, 0.6, lam, D, 0.5, 5);
  LANCE.nextId += 2;
  LANCE.packets.push(a, b);
  LANCE.standing = { t0: now, until: now + (5 * lam) / SL.WAVE_V, ox, oz, dx: fx, dz: fz, lam, D };
  LANCE.last = { t: now, T: lam / SL.WAVE_V, lam };
  // vách phản xạ
  strike("wall", ox + fx * D, p.y + 0.06, oz + fz * D, { yaw, color: "#e8fbff" });
  floatText(V.set(p.x, p.y + 2.3, p.z), vi() ? `Sóng dừng · nút cách nhau λ/2 = ${fmt(lam / 2)} m` : `Standing wave · nodes λ/2 = ${fmt(lam / 2)} m apart`, "info");
  sfx.circle();
  return 0;
}

/** Bó sóng đi qua quái: mỗi lần đỉnh (cực trị của tổng y) đi qua là một đòn ∝ |y| — chồng chập tính đúng tổng */
function tickLance() {
  const t = nowS();
  const ps = LANCE.packets;
  for (let i = ps.length - 1; i >= 0; i--) if (!SL.packetAlive(ps[i], t)) ps.splice(i, 1);
  if (LANCE.standing && t > LANCE.standing.until) LANCE.standing = null;
  if (!ps.length) {
    LANCE.crest.clear();
    return;
  }
  const atk = WEAPON_DEFS.lance.atk;
  const now = performance.now();
  for (const e of enemies) {
    if (e.deadAt) continue;
    const sp = SL.superpose(ps, e.pos.x, e.pos.z, t);
    let st = LANCE.crest.get(e.id);
    if (sp.n === 0) {
      if (st) st.dy = 0;
      continue;
    }
    if (!st) LANCE.crest.set(e.id, (st = { dy: 0, hitAt: -1e9, fbAt: -1e9 }));
    const kind = SL.classify(sp);
    if (kind === "destructive" && now - st.fbAt > 900) {
      st.fbAt = now;
      floatText(V.set(e.pos.x, e.pos.y + 2.1, e.pos.z), vi() ? "triệt tiêu (ngược pha)" : "cancelled (out of phase)", "info");
      sfx.interfere(false);
    }
    if (SL.crestEvent(st.dy, sp.dy, sp.y) && now - st.hitAt > 90) {
      st.hitAt = now;
      const dmg = SL.crestDamage(atk, sp);
      crestHit(e, dmg, sp, kind);
      if (kind === "constructive" && now - st.fbAt > 900) {
        st.fbAt = now;
        floatText(V.set(e.pos.x, e.pos.y + 2.4, e.pos.z), vi() ? `tăng cường! |y| = ${fmt(Math.abs(sp.y))} m` : `constructive! |y| = ${fmt(Math.abs(sp.y))} m`, "crit");
        sfx.interfere(true);
      }
    }
    st.dy = sp.dy;
  }
}

function crestHit(e: Enemy, dmg: number, sp: SL.Superpose, kind: SL.Interference) {
  // đẩy theo hướng sóng của bó gần nhất (lấy bó đầu tiên phủ quái)
  const p = LANCE.packets.find((q) => SL.packetCovers(q, e.pos.x, e.pos.z, nowS()));
  const from = V2.set(e.pos.x - (p?.dx ?? 0), e.pos.y, e.pos.z - (p?.dz ?? 0));
  damageEnemy(e, Math.max(1, dmg), from, 1.2);
  const big = kind === "constructive";
  emitHit(e.pos.x, e.pos.y + 1 + Math.sign(sp.y) * 0.3, e.pos.z, big ? "#fff2b0" : "#9fe6ff", p?.dx ?? 0, p?.dz ?? 0, big ? 1.4 : 0.8);
  sfx.waveCrest(Math.abs(sp.y), big);
  if (big) {
    useWorld.getState().hitstop(45);
    impact(0.25);
  }
}

// ───────────── Khiên Con lắc ─────────────

export const SHIELD = {
  psi: Math.PI / 2,
  theta0: PS.THETA_BASE,
  guarding: false,
  guardAt: -1e9,
  lastPerfectAt: -1e9,
  /** lúc đập khiên gần nhất (quả lắc bị hất ra trước — chỉ hình) */
  kickAt: -1e9,
  /** đếm số lần qua đáy (tích tắc) */
  bottomN: 0,
  /** mốc đồng hồ của pha (ms) — pha chạy theo đồng hồ thật, không theo dt đã kẹp của khung hình (máy chậm vẫn đúng nhịp) */
  tickAt: -1,
  drive: null as { start: number; n: number; done: number; dmg: number; color: string } | null,
};

/** Đưa pha quả lắc tới thời điểm `now` (gọi cả lúc đòn quái chạm, không đợi khung kế) */
function syncShield(now = performance.now()) {
  if (SHIELD.tickAt < 0) SHIELD.tickAt = now;
  const dt = Math.min(1, Math.max(0, (now - SHIELD.tickAt) / 1000));
  SHIELD.tickAt = now;
  SHIELD.psi = PS.advance(SHIELD.psi, dt, curLen());
  SHIELD.theta0 = PS.decay(SHIELD.theta0, dt);
}

/** góc lệch hiển thị (rad, + = ra sau lưng) kèm cú hất khi đập */
export function shieldAngle(now = performance.now()): number {
  const base = PS.angleAt(SHIELD.theta0, SHIELD.psi);
  const k = (now - SHIELD.kickAt) / 380;
  return k >= 0 && k < 1 ? base - 1.5 * Math.sin(Math.PI * k) : base;
}

function shieldBash(sh: Extract<Shape, { k: "bob" }>, ctx: ExtHitCtx): number {
  const { p, yaw } = ctx;
  syncShield();
  const ratio = PS.keRatio(SHIELD.theta0, SHIELD.psi);
  const mul = PS.bashMul(SHIELD.theta0, SHIELD.psi);
  SHIELD.kickAt = performance.now();
  let n = 0;
  for (const e of enemies) {
    if (e.deadAt) continue;
    const dx = e.pos.x - p.x;
    const dz = e.pos.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > sh.range + 0.4) continue;
    const da = Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw));
    if (d > 0.9 && Math.abs(da) > sh.arc / 2) continue;
    damageEnemy(e, ctx.dmg * mul, p, 4 + 4 * ratio);
    n++;
  }
  if (n > 0 && ratio > 0.85) {
    // đập đúng lúc quả lắc ở đáy = "đẩy xích đu" đúng nhịp → biên độ tăng nhẹ
    SHIELD.theta0 = Math.min(PS.THETA_MAX, SHIELD.theta0 + 0.05);
    floatText(V.set(p.x, p.y + 2.3, p.z), vi() ? `đáy · ½mv² ×${fmt(mul, 1)}` : `bottom · ½mv² ×${fmt(mul, 1)}`, "crit");
  }
  sfx.pendTick(ratio > 0.85);
  return n;
}

function shieldRelease(ctx: ExtHitCtx): number {
  const L = curLen();
  const { r, mul } = PS.releaseBurst(L, SHIELD.theta0);
  const E = PS.kineticMax(L, SHIELD.theta0);
  const p = ctx.p;
  const at = V.set(p.x + Math.sin(ctx.yaw) * 0.8, p.y + 0.06, p.z + Math.cos(ctx.yaw) * 0.8).clone();
  const n = hitRadius(at, r, ctx.dmg * mul, 9);
  // xả năng lượng con lắc: xích catenary căng tới đúng bán kính r rồi đứt
  strike("chain", at.x, at.y, at.z, { r, yaw: ctx.yaw, color: ctx.color });
  addFx("crater", at.clone().setY(at.y - 0.03), { color: ctx.color, size: r * 0.6, yaw: Math.random() * 6 });
  shockwave(at.clone().setY(at.y + 0.8), 0.5 + 0.5 * (r / 4.8));
  impact(0.6 + 0.4 * (r / 4.8));
  useWorld.getState().hitstop(90);
  sfx.explode("time", 0.8 + 0.5 * (r / 4.8));
  floatText(V.set(p.x, p.y + 2.4, p.z), vi() ? `Giải phóng E = mgL(1 − cos θ₀) = ${fmt(E)} J` : `Release E = mgL(1 − cos θ₀) = ${fmt(E)} J`, "crit");
  SHIELD.theta0 = PS.THETA_BASE;
  useWaveW.setState({ streak: 0 });
  return n;
}

function shieldDrive(sh: Extract<Shape, { k: "drive" }>, ctx: ExtHitCtx): number {
  SHIELD.drive = { start: nowS(), n: sh.pulses, done: 0, dmg: ctx.dmg, color: ctx.color };
  floatText(V.set(ctx.p.x, ctx.p.y + 2.3, ctx.p.z), vi() ? `Mỗi nhịp cách T = ${fmt(PS.period(curLen()))} s` : `One pulse every T = ${fmt(PS.period(curLen()))} s`, "info");
  return 0;
}

function tickShield() {
  const L = curLen();
  const prevN = Math.floor((SHIELD.psi - Math.PI / 2) / Math.PI);
  const prevPsi = SHIELD.psi;
  syncShield();
  // số lần qua đáy (đáy ở ψ = π/2 + nπ); pha quấn 2π → cộng 2 để so liên tục
  const nNow = Math.floor((SHIELD.psi - Math.PI / 2) / Math.PI) + (SHIELD.psi < prevPsi ? 2 : 0);
  const isShield = ENV.armed && curWeapon().id === "shield";
  if (SHIELD.guarding && !isShield) endGuard();
  // tích tắc mỗi lần qua đáy trong thế đỡ (nghe được nhịp T/2)
  if (SHIELD.guarding && nNow !== prevN) {
    SHIELD.bottomN++;
    sfx.pendTick(false);
  }
  // dao động cưỡng bức: một nhịp mỗi chu kỳ T
  const dr = SHIELD.drive;
  if (dr) {
    const t = nowS();
    const T = PS.period(L);
    if (t >= dr.start + dr.done * T) {
      dr.done++;
      const w = useWorld.getState();
      const p = w.player;
      const k = (SHIELD.theta0 - PS.THETA_BASE) / (PS.THETA_MAX - PS.THETA_BASE);
      const r = 2.6 + 1.2 * k;
      const at = V.set(p.x, p.y + 0.06, p.z).clone();
      hitRadius(at, r, dr.dmg * (0.8 + 0.8 * k), 5);
      strike("piston", at.x, at.y, at.z, { r, color: dr.color });
      shockwave(at.clone().setY(at.y + 0.8), 0.3);
      w.addShake(0.12);
      sfx.pendTick(true);
      sfx.hit(1);
      // mỗi nhịp cưỡng bức đúng chu kỳ riêng = cộng hưởng: biên độ tăng
      SHIELD.theta0 = Math.min(PS.THETA_MAX, SHIELD.theta0 + 0.06);
      if (dr.done >= dr.n) SHIELD.drive = null;
    }
  }
}

function startGuard() {
  const now = performance.now();
  if (now - SHIELD.guardAt < 200) return;
  SHIELD.guarding = true;
  SHIELD.guardAt = now;
  // buông từ đỉnh phía sau: tới đáy sau đúng T/4
  SHIELD.psi = PS.GUARD_PSI;
  SHIELD.tickAt = now;
  const w = useWorld.getState();
  w.act("slash", 30000, { name: "Sword_Block", from: 0.2, speed: 0.9 });
  sfx.pendTick(true);
}
function endGuard() {
  if (!SHIELD.guarding) return;
  SHIELD.guarding = false;
  const w = useWorld.getState();
  if (w.action?.clip?.name === "Sword_Block") w.set({ action: null });
}

/** Bị đánh khi đang thế đỡ: chấm theo pha quả lắc */
function shieldGuard(dmg: number, from?: THREE.Vector3): number | null {
  if (!SHIELD.guarding || curWeapon().id !== "shield") return null;
  syncShield();
  const L = curLen();
  const grade = PS.parryGrade(SHIELD.psi, L);
  const w = useWorld.getState();
  const p = w.player;
  const now = performance.now();
  useWaveW.setState({ grade, gradeAt: now });
  if (grade === "perfect") {
    const streak = now - SHIELD.lastPerfectAt < 4000 ? useWaveW.getState().streak + 1 : 1;
    SHIELD.lastPerfectAt = now;
    const E = PS.kineticMax(L, SHIELD.theta0);
    const mul = PS.counterMul(L, SHIELD.theta0);
    // phản đòn vào quái vừa đánh (gần điểm xuất phát đòn), không có thì quái gần nhất
    let target: Enemy | null = null;
    let bd = from ? 2.4 : 3.5;
    const ref = from ?? p;
    for (const e of enemies) {
      if (e.deadAt) continue;
      const d = Math.hypot(e.pos.x - ref.x, e.pos.z - ref.z);
      if (d < bd) {
        bd = d;
        target = e;
      }
    }
    if (target) damageEnemy(target, WEAPON_DEFS.shield.atk * mul, V2.set(p.x, p.y, p.z), 10);
    SHIELD.theta0 = PS.pump(SHIELD.theta0, streak - 1);
    useWaveW.setState({ streak });
    const bob = V.set(p.x + Math.sin(w.playerYaw) * 0.6, p.y + 0.7, p.z + Math.cos(w.playerYaw) * 0.6);
    emitHit(bob.x, bob.y, bob.z, "#ffd27a", Math.sin(w.playerYaw), Math.cos(w.playerYaw), 1.7);
    strike("wedge", p.x, p.y + 0.05, p.z, { r: 2.2, arc: 0.55, yaw: w.playerYaw, color: "#ffc86b" });
    shockwave(bob.clone(), 0.55);
    impact(0.7);
    w.hitstop(120);
    w.addShake(0.22);
    sfx.parry("perfect");
    useCombat.setState({ judge: { text: streak >= 2 ? (vi() ? `Đỡ hoàn hảo · Cộng hưởng ×${streak}` : `Perfect parry · Resonance ×${streak}`) : vi() ? "Đỡ hoàn hảo" : "Perfect parry", kind: "perfect", at: now } });
    floatText(V.set(p.x, p.y + 2.5, p.z), `½mv² = ${fmt(E)} J`, "crit");
    return 0;
  }
  if (grade === "weak") useWaveW.setState({ streak: 0 });
  sfx.parry(grade);
  floatText(V.set(p.x, p.y + 2.3, p.z), grade === "good" ? (vi() ? "đỡ 70%" : "blocked 70%") : vi() ? "đỡ 30% — quả lắc ở biên" : "blocked 30% — bob at the edge", "info");
  return dmg * (1 - PS.blockFraction(grade));
}

/** Khung xương quả lắc của các bản sao mô hình khiên đang dùng (WaveWeaponsFx xoay theo trọng lực mỗi khung) */
export type PendRig = { pivot: THREE.Object3D; chain: THREE.Object3D | null; bob: THREE.Object3D | null };
export const PEND_RIGS = new Set<PendRig>();
/** Gọi trong useEffect khi một bản sao mô hình được gắn: có node `pend_pivot` thì đăng ký; trả hàm huỷ */
export function registerPendRig(obj: THREE.Object3D): (() => void) | undefined {
  const pivot = obj.getObjectByName("pend_pivot");
  if (!pivot) return undefined;
  const rig: PendRig = { pivot, chain: pivot.getObjectByName("chain") ?? null, bob: pivot.getObjectByName("bob") ?? null };
  PEND_RIGS.add(rig);
  return () => void PEND_RIGS.delete(rig);
}

// ───────────── Đổi tham số (phím X / nút HUD) ─────────────

export function tuneLance() {
  const lamIdx = (useWaveW.getState().lamIdx + 1) % SL.LANCE_LAMBDAS.length;
  useWaveW.setState({ lamIdx });
  const lam = SL.LANCE_LAMBDAS[lamIdx];
  const p = useWorld.getState().player;
  floatText(V.set(p.x, p.y + 2.3, p.z), `λ = ${fmt(lam, 1)} m · f = v/λ = ${fmt(SL.WAVE_V / lam)} Hz`, "info");
  sfx.click();
}
export function tuneShield() {
  syncShield();
  const lenIdx = (useWaveW.getState().lenIdx + 1) % PS.SHIELD_LENGTHS.length;
  useWaveW.setState({ lenIdx });
  const L = PS.SHIELD_LENGTHS[lenIdx];
  const p = useWorld.getState().player;
  floatText(V.set(p.x, p.y + 2.3, p.z), `L = ${fmt(L)} m · T = 2π√(L/g) = ${fmt(PS.period(L))} s`, "info");
  sfx.knock();
}
/** Thế đỡ (chuột phải / nút Đỡ) */
export function shieldGuardInput(down: boolean) {
  if (down) startGuard();
  else endGuard();
}

// ───────────── Đăng ký vào combat.ts ─────────────

WEAPON_EXT.shape = (sh, ctx) => {
  switch (sh.k) {
    case "sine":
      return lanceThrust(sh, ctx);
    case "standing":
      return lanceStanding(ctx);
    case "bob":
      return shieldBash(sh, ctx);
    case "release":
      return shieldRelease(ctx);
    case "drive":
      return shieldDrive(sh, ctx);
    default:
      return 0;
  }
};
WEAPON_EXT.guard = shieldGuard;
WEAPON_EXT.release.add("lance");
WEAPON_EXT.releaseFullMs = HOLD_MS + SL.FULL_MS;
WEAPON_EXT.alt.shield = shieldGuardInput;
WEAPON_EXT.tune.lance = tuneLance;
WEAPON_EXT.tune.shield = tuneShield;

/** Mỗi khung (WaveWeaponsFx gọi) */
export function tickWaveWeapons() {
  tickLance();
  tickShield();
}
