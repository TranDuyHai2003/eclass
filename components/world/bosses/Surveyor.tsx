"use client";
/**
 * Kẻ Khảo sát Gấp — lớp vẽ + nối với combat (logic thuần ở lib/world/foldbackSurveyor.ts).
 * Model Blender `boss/surveyor.glb` (bảng ở docs/ai-reviews/voxel-world/BOSSES.md; nạp nền, hình khối tạm khi chưa nạp): đầu toa + 11 toa gốm (2 InstancedMesh),
 * thước đo, thấu kính (điểm yếu), khiên fresnel; MỘT lưới sàn vẽ mọi báo trước (floorCue.ts); cọc khảo sát instanced.
 * Toa nối đuôi nhau theo VẾT của toa đầu (bộ đệm vòng, lấy mẫu theo độ dài cung) → "đi lại cùng lộ trình chậm một nhịp".
 * Không cấp phát trong useFrame (vectơ / ma trận tạm dùng lại; HUD cập nhật ≤ 8 lần/s).
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { GRADIENT } from "../fx/shaders";
import { ENV, enemies, playerHurt, spawnEnemy, useCombat, type Enemy } from "../combat/combat";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { bumpCombat } from "../audio/combatLayer";
import { impact, shockwave } from "../fx/Lensing";
import { emitBurst, emitSpark } from "../fx/Sparks";
import { Label3D, floatText } from "../ui/Labels";
import { t as tt } from "@/lib/world/i18n";
import { spawnDrop } from "../craft/invStore";
import { SV, atkStage, cartOffset, headS, hitSurveyor, lineText, measureHead, newSurveyor, reflect, routeAt, ruleText, surveyorHurt, surveyorMul, tickSurveyor, type P2 } from "@/lib/world/foldbackSurveyor";
import { ArenaGround, cellGeometry, fresnelMaterial, surveyorFloorMaterial, surveyorFloorUniforms, updateCellHeights } from "./floorCue";
import { loadProgress, saveProgress, toast, useBossUi, type Fight } from "./bossStore";
import { applySurveyor, packSurveyor, surveyorEvent, type SvPack, type SvSeen } from "@/lib/world/bossNet";
import { encEnd, encHit, encPeers, encRole, encSend, encSlot, encTakeHits, shiftNow } from "./encounterNet";
import { enableVertexColors, useBossGlb } from "./bossGlb";
import { worldAsset } from "@/lib/world/avatars";

const SV_GLB = worldAsset("boss/surveyor.glb");

const STAKE_NAMES = ["A", "B", "C"];
const TRN = 512;
/** sau bao lâu đứng ngoài đấu trường thì boss rút lui (ms) / số lần gục tối đa */
const LEAVE_MS = 6000;
const LEAVE_R = 26;
const MAX_DOWNS = 3;

/** Vết của toa đầu: bộ đệm vòng (x, z, độ dài cung tích luỹ) */
class Trail {
  x = new Float32Array(TRN);
  z = new Float32Array(TRN);
  s = new Float64Array(TRN);
  n = 0;
  head = -1;
  reset(x: number, z: number) {
    this.n = 1;
    this.head = 0;
    this.x[0] = x;
    this.z[0] = z;
    this.s[0] = 0;
  }
  push(x: number, z: number, min = 0.15) {
    const h = this.head;
    const L = Math.hypot(x - this.x[h], z - this.z[h]);
    if (L < min) return;
    const nh = (h + 1) % TRN;
    this.x[nh] = x;
    this.z[nh] = z;
    this.s[nh] = this.s[h] + L;
    this.head = nh;
    this.n = Math.min(this.n + 1, TRN);
  }
}

const tmpP: P2 & { du?: number; dv?: number } = { u: 0, v: 0 };
const DUMMY = new THREE.Object3D();
const COL_COLD = new THREE.Color("#f2e6cc");
const COL_HOT = new THREE.Color("#ff8c6e");
const COL_ECHO = new THREE.Color("#c9b8ff");
const TMPC = new THREE.Color();
const V1 = new THREE.Vector3();

function makeState(fight: Fight) {
  const { cx, cz, y: refY, seed } = fight;

  // giờ thật gán ở khung đầu (khởi tạo phải thuần — không gọi performance.now() khi render)
  const sim = newSurveyor(seed, 0);
  const ground = new ArenaGround(cx, cz, 14, 14, refY);
  // trong đấu trường: lưới đã lấy mẫu (có khối người chơi xây); ngoài: mặt cột tự nhiên (đã đệm, rẻ)
  const at = (x: number, z: number) => (Math.abs(x - cx) <= 14 && Math.abs(z - cz) <= 14 ? ground.at(x, z) : ENV.ground(x, z));
  const trail = new Trail();
  // cuộn sẵn đoàn toa thành vòng quanh tâm (chào sân)
  trail.reset(cx + 4, cz);
  for (let i = 1; i <= 80; i++) trail.push(cx + 4 * Math.cos((i / 80) * Math.PI * 2 * 1.2), cz + 4 * Math.sin((i / 80) * Math.PI * 2 * 1.2), 0);
  return {
    cx,
    cz,
    refY,
    seed,
    started: false,
    sim,
    ground,
    at,
    trail,
    /** toa đầu là một Enemy (tạo trong effect — useMemo có thể chạy 2 lần ở StrictMode) */
    e: null as Enemy | null,
    hx: trail.x[trail.head],
    hz: trail.z[trail.head],
    yaw: 0,
    lower: 0,
    rise: 0,
    fold: 0,
    idleA: 0,
    lastHeadS: 0,
    row: 0,
    hudAt: 0,
    bumpAt: 0,
    infoAt: 0,
    awayMs: 0,
    downs: 0,
    /** nhiều người: phiên bản gói đã áp (khách), lần gửi gần nhất (chủ), trạng thái đã thấy để suy sự kiện */
    ver: -1,
    sentAt: 0,
    seen: { mode: "intro", atkT0: 0, pinned: 0, tries: 0 } as SvSeen,
    peers: [] as number[],
    others: [] as number[],
    wasDown: false,
    endAt: 0,
    ended: false,
    teleSfx: 0,
    slamDone: 0,
  };
}
type State = ReturnType<typeof makeState>;

/** toa đầu là một Enemy (tạo trong effect — khởi tạo trong render có thể chạy 2 lần ở StrictMode); trả hàm dọn */
function attachHead(S: State): () => void {
  const e = spawnEnemy("surveyor", new THREE.Vector3(S.hx, S.refY, S.hz));
  S.e = e;
  if (process.env.NODE_ENV !== "production") Object.assign(window, { __surveyor: S, __enemies: enemies });
  e.ext = {
    boss: (en, amount) => {
      const now = performance.now();
      const m = surveyorMul(S.sim, now);
      // khách: đòn gửi cho chủ trận (chủ áp hệ số); số hiện ngay là dự đoán theo trạng thái đã đồng bộ
      const guest = encRole(S.seed) === "guest";
      if (guest && m > 0) encHit(S.seed, "b", amount);
      const dealt = guest ? Math.round(amount * m) : hitSurveyor(S.sim, amount, now);
      V1.set(en.pos.x, en.pos.y + 2.2, en.pos.z);
      const lg = useWorld.getState().lang;
      if (m <= 0) {
        if (now - S.infoAt > 500) {
          S.infoAt = now;
          floatText(V1, S.sim.mode === "seal" ? (lg === "vi" ? "Đối xứng!" : "Symmetry!") : "∅", "info");
          sfx.shield();
        }
        return;
      }
      floatText(V1, String(dealt), m >= SV.MUL.lowered ? "crit" : "dmg");
      if (m < 0.5 && now - S.infoAt > 1200) {
        S.infoAt = now;
        floatText(V1.setY(V1.y + 0.5), lg === "vi" ? "giáp" : "armor", "info");
      }
    },
  };
  return () => {
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
    S.e = null;
    useBossUi.setState({ on: false, seal: null });
  };
}

/** tài nguyên GPU (tạo một lần mỗi trận) */
function makeRes(S: State) {
  const { cx, cz } = S;
  const U = surveyorFloorUniforms();
  U.uCenter.value.set(cx, cz);
  U.uHalf.value = SV.HALF;
  U.uLaneHalf.value = SV.LANE_HALF;
  U.uBarLen.value = SV.BAR_LEN;
  U.uBarW.value = SV.BAR_W;
  const floorGeo = cellGeometry(S.ground);
  const floorMat = surveyorFloorMaterial(U);
  const toon = (c: string, em = "#000000", k = 0) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT, emissive: em, emissiveIntensity: k });
  // toa: thân (gốc ở đáy) + quai vòm trên nóc
  const cartGeo = new THREE.BoxGeometry(1.0, 0.72, 1.25);
  cartGeo.translate(0, 0.52, 0);
  const archGeo = new THREE.TorusGeometry(0.38, 0.07, 6, 14, Math.PI);
  archGeo.rotateY(Math.PI / 2);
  archGeo.translate(0, 0.88, 0);
  const cartMat = toon("#ffffff");
  const archMat = toon("#3a2c4a", "#6b4bd6", 0.35);
  // đầu toa
  const headGeo = new THREE.BoxGeometry(1.4, 1.0, 1.9);
  headGeo.translate(0, 0.72, 0);
  const headMat = toon("#f4ead2");
  const roofGeo = new THREE.TorusGeometry(0.62, 0.1, 8, 18, Math.PI);
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(0, 1.22, -0.1);
  const roofMat = toon("#2e2340", "#7a5cff", 0.4);
  const lensGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 28);
  lensGeo.rotateX(Math.PI / 2);
  lensGeo.translate(0, 0.78, 0.98);
  const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.2, 1.3), toneMapped: false });
  const lensRimGeo = new THREE.TorusGeometry(0.46, 0.06, 8, 28);
  lensRimGeo.translate(0, 0.78, 1.02);
  // thước: dài 6 m, vạch chia mỗi 0,5 m (shader theo toạ độ cục bộ)
  const rulerGeo = new THREE.BoxGeometry(0.22, 0.06, 6);
  rulerGeo.translate(0, 0, 3);
  const rulerMat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec3 vP;
      void main() {
        float minor = step(0.9, fract(vP.z * 2.0)) * step(0.0, vP.x);
        float major = step(0.94, fract(vP.z)) ;
        vec3 c = mix(vec3(1.0, 0.95, 0.8), vec3(0.12, 0.08, 0.14), max(minor * 0.8, major));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const shieldGeo = new THREE.IcosahedronGeometry(2.1, 2);
  const shieldMat = fresnelMaterial("#9fa8ff", 2.0, 1.6);
  // cọc khảo sát (vàng) + cột sáng ảnh đã ghim (bạc hà) — một InstancedMesh mỗi loại
  const stakeGeo = new THREE.CylinderGeometry(0.09, 0.12, 1.6, 8);
  stakeGeo.translate(0, 0.8, 0);
  const stakeMat = toon("#ffd36b", "#ffb300", 0.5);
  const beamGeo = new THREE.CylinderGeometry(0.35, 0.35, 4, 16, 1, true);
  beamGeo.translate(0, 2, 0);
  const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 1.0), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  return { U, floorGeo, floorMat, cartGeo, archGeo, cartMat, archMat, headGeo, headMat, roofGeo, roofMat, lensGeo, lensMat, lensRimGeo, rulerGeo, rulerMat, shieldGeo, shieldMat, stakeGeo, stakeMat, beamGeo, beamMat };
}
type Res = ReturnType<typeof makeRes>;
function disposeRes(R: Res) {
  for (const v of Object.values(R)) if (v && typeof (v as { dispose?: () => void }).dispose === "function") (v as { dispose: () => void }).dispose();
}

type Meshes = Record<"carts" | "arches" | "stakes" | "beams", RefObject<THREE.InstancedMesh | null>> & Record<"head" | "body", RefObject<THREE.Group | null>> & Record<"ruler" | "shield", RefObject<THREE.Mesh | null>>;

/** một khung: mô phỏng + chuyển động + đẩy uniform / instance (không cấp phát) */
function stepSurveyor(S: State, R: Res, M: Meshes, st: RootState, rawDt: number, setSealView: (v: { key: number; stakes: P2[] } | null) => void, onEnd: (r: "win" | "retreat") => void) {
    const dt = Math.min(0.05, rawDt);
  const now = performance.now();
  const time = st.clock.elapsedTime;
  if (!S.started) {
    S.started = true;
    S.sim = newSurveyor(S.seed, now);
  }
  const { sim, trail, at, cx, cz } = S;
  const w = useWorld.getState();
  const p = w.player;
  const pu = p.x - cx;
  const pv = p.z - cz;
  // độ cao mặt đất: lấy mẫu lại từng hàng (≈ 1 s / vòng) → sàn báo trước bám theo khối người chơi xây / phá
  const g = S.ground;
  for (let i = 0; i < g.nx; i++) g.h[S.row * g.nx + i] = ENV.ground(g.x0 + i + 0.5, g.z0 + S.row + 0.5, g.refY + 4);
  S.row = (S.row + 1) % g.nz;
  if (S.row === 0) updateCellHeights(R.floorGeo, g);

  // nhiều người: chủ (hoặc chơi một mình) mô phỏng; khách áp gói của chủ rồi suy ra sự kiện để phát âm / thưởng riêng
  const role = encRole(S.seed);
  let ev: string | null = null;
  if (!S.ended) {
    if (role === "guest") {
      const sl = encSlot(S.seed);
      if (sl && sl.state && sl.ver !== S.ver) {
        S.ver = sl.ver;
        applySurveyor(sim, sl.state as SvPack, shiftNow());
      }
      ev = surveyorEvent(S.seen, sim);
    } else {
      // vị trí người khác trong trận (toạ độ đấu trường) — ghim ảnh / bị nhắm như chủ
      encPeers(cx, cz, 30, S.peers);
      S.others.length = 0;
      for (let k = 0; k < S.peers.length; k += 2) S.others.push(S.peers[k] - cx, S.peers[k + 1] - cz);
      ev = tickSurveyor(sim, now, pu, pv, S.others.length ? S.others : undefined);
      if (role === "host") {
        const hits = encTakeHits(S.seed);
        if (hits) for (const h of hits) if (h.k === "b") hitSurveyor(sim, h.d, now);
        if (now - S.sentAt > 125) {
          S.sentAt = now;
          encSend(S.seed, packSurveyor(sim, shiftNow()));
        }
      }
    }
  }
  const a = sim.atk;
  const stage = a ? atkStage(a, now) : null;
  if (ev === "tele" && a) {
    const d = Math.hypot(S.hx - p.x, S.hz - p.z);
    sfx.telegraph(Math.min(d, 6));
  } else if (ev === "seal" && sim.seal) {
    sfx.shield();
    impact(0.45);
    setSealView({ key: now, stakes: sim.seal.stakes });
    toast(tt(w.lang, "bxSeal"), "warn");
  } else if (ev === "fail" && sim.seal) {
    sfx.miss();
    setSealView({ key: now, stakes: sim.seal.stakes });
    toast(tt(w.lang, "bxSealFail"), "warn");
  } else if (ev === "pin" && sim.seal) {
    sfx.chime(3);
    for (let i = 0; i < sim.seal.stakes.length; i++)
      if (sim.seal.pinned[i]) {
        const im = sim.seal.images[i];
        emitBurst(cx + im.u, at(cx + im.u, cz + im.v) + 0.4, cz + im.v, "#8fffd0", 14, 4);
      }
  } else if (ev === "fold") {
    sfx.fold(1.6);
    impact(0.95);
    w.addShake(0.4);
    V1.set(cx, at(cx, cz) + 1, cz);
    shockwave(V1, 1.1);
    R.U.uFoldFlash.value = time;
    setSealView(null);
    toast(tt(w.lang, "bxFolded"), "win");
  } else if (ev === "dead") {
    S.endAt = now;
    sfx.fanfare();
    impact(1.1);
    w.addShake(0.6);
    V1.set(S.hx, at(S.hx, S.hz) + 1, S.hz);
    shockwave(V1, 1.3);
    emitBurst(S.hx, V1.y + 0.5, S.hz, "#ffe6a8", 60, 8);
    // phần thưởng: Mảnh Gương ×4–6 + Thấu kính Khảo sát (đồ rơi khối — nam châm hút vào túi)
    const n = 4 + Math.floor(Math.random() * 3);
    spawnDrop("mirror_shard", n, S.hx, V1.y + 0.5, S.hz);
    spawnDrop("survey_lens", 1, S.hx, V1.y + 0.8, S.hz);
    const pr = loadProgress();
    pr.surveyor++;
    saveProgress(pr);
    toast(`${tt(w.lang, "bxSurveyorWin")} ${tt(w.lang, "bxReward", { items: `${w.lang === "vi" ? "Mảnh Gương Gấp" : "Fold Mirror Shard"} ×${n} · ${w.lang === "vi" ? "Thấu kính Khảo sát" : "Survey Lens"}` })}`, "win");
  }
  // thắng: kết thúc sau màn gập lại
  if (sim.mode === "dead" && !S.ended && now - S.endAt > 3800) {
    S.ended = true;
    if (role === "host") encSend(S.seed, packSurveyor(sim, shiftNow()));
    encEnd(S.seed, "win");
    onEnd("win");
    return;
  }
  // khách: chủ đã kết thúc / mất trận (không phải thắng) → rời trận
  const slot = role === "solo" ? encSlot(S.seed) : null;
  if (!S.ended && slot?.ended && slot.ended !== "win") {
    S.ended = true;
    toast(tt(w.lang, "bxRetreat"), "warn");
    onEnd("retreat");
    return;
  }

  // ── đòn trúng người chơi (nhảy qua toa / đứng dưới hang thì thoát) ──
  if (!S.ended && sim.mode !== "dead") {
    const gy = at(p.x, p.z);
    const air = p.y - gy;
    if (air < 1.3 && air > -3) {
      const dmg = surveyorHurt(sim, now, pu, pv);
      if (dmg > 0) {
        V1.set(S.hx, gy, S.hz);
        playerHurt(dmg, V1);
      }
    }
    if (a && a.kind === "measure" && stage === "strike" && S.slamDone !== a.t0) {
      S.slamDone = a.t0;
      sfx.impact(1.2);
      w.addShake(0.3);
      impact(0.5);
      const b = a.bars!;
      for (let k = -3; k <= 3; k++)
        for (const off of b.off) {
          const x = cx + b.ou + b.du * k * 2 + b.nu * off;
          const z = cz + b.ov + b.dv * k * 2 + b.nv * off;
          emitSpark(x, at(x, z) + 0.2, z, 0, 2.5, 0, "#fff3d0", { size: 0.06, life: 0.35 });
        }
    }
    // rút lui: đứng ngoài quá lâu / gục quá nhiều lần. Nhiều người: chủ chỉ rút khi KHÔNG còn ai trong đấu trường
    // (gục nhiều lần chỉ tính khi đánh một mình); khách đi xa thì chỉ mình rời trận
    const company = role !== "guest" && S.others.length > 0;
    S.awayMs = Math.hypot(pu, pv) > LEAVE_R && !company ? S.awayMs + dt * 1000 : 0;
    const down = useCombat.getState().hp <= 0;
    if (down && !S.wasDown) S.downs++;
    S.wasDown = down;
    if (S.awayMs > LEAVE_MS || (S.downs >= MAX_DOWNS && role === "solo")) {
      S.ended = true;
      toast(tt(w.lang, role === "guest" ? "bxLeftFight" : "bxRetreat"), "warn");
      encEnd(S.seed, "retreat");
      onEnd("retreat");
      return;
    }
    // nhạc chiến đấu: giữ lớp trống / bass suốt trận, mạnh hơn ở pha sau
    if (now - S.bumpAt > 1500 && Math.hypot(pu, pv) < 30) {
      S.bumpAt = now;
      bumpCombat(sim.phase >= 2 ? 0.42 : 0.3);
    }
  }

  // ── chuyển động toa đầu ──
  let tx = S.hx;
  let tz = S.hz;
  let speed = 6;
  let lowerT = 0;
  if (sim.mode === "intro") {
    S.rise = Math.min(1, S.rise + dt / 1.6);
    S.idleA += dt * 0.9;
    tx = cx + 4 * Math.cos(S.idleA);
    tz = cz + 4 * Math.sin(S.idleA);
    speed = 5;
  } else if (sim.mode === "stun" || sim.mode === "dead") {
    tx = cx;
    tz = cz;
    speed = 9;
    lowerT = 1;
  } else if (a && a.route && stage === "tele") {
    tx = cx + a.route.pts[0];
    tz = cz + a.route.pts[1];
    const left = Math.max(0.15, (a.t0 + a.tele * 0.85 - now) / 1000);
    speed = Math.max(5, Math.hypot(tx - S.hx, tz - S.hz) / left);
  } else if (a && a.route && stage === "strike") {
    const sh = headS(a, now);
    // đi qua đỉnh gấp: ghi đúng đỉnh vào vết (toa sau rẽ đúng góc)
    for (let k = 1; k < a.route.cum.length - 1; k++) if (S.lastHeadS < a.route.cum[k] && sh >= a.route.cum[k]) trail.push(cx + a.route.pts[k * 2], cz + a.route.pts[k * 2 + 1], 0);
    S.lastHeadS = sh;
    routeAt(a.route, sh, tmpP);
    S.hx = cx + tmpP.u;
    S.hz = cz + tmpP.v;
    S.yaw = Math.atan2(tmpP.du ?? 0, tmpP.dv ?? 1);
    speed = 0;
  } else if (a && a.bars) {
    measureHead(a.bars, tmpP);
    tx = cx + tmpP.u;
    tz = cz + tmpP.v;
    const left = Math.max(0.15, (a.t0 + a.tele * 0.8 - now) / 1000);
    speed = stage === "tele" ? Math.max(5, Math.hypot(tx - S.hx, tz - S.hz) / left) : 3;
    if (stage === "recover") lowerT = 1;
  } else {
    // rảnh (đánh) / khiên: đoàn toa lượn vòng quanh tâm
    const r = sim.mode === "seal" ? 10.5 : 6;
    S.idleA += dt * (sim.mode === "seal" ? 0.5 : 0.45);
    tx = cx + r * Math.cos(S.idleA);
    tz = cz + r * Math.sin(S.idleA);
    speed = sim.mode === "seal" ? 6 : 6.5;
  }
  if (!(a && a.route && stage === "strike")) S.lastHeadS = 0;
  if (speed > 0) {
    const dx = tx - S.hx;
    const dz = tz - S.hz;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, speed * dt);
    if (d > 1e-3) {
      S.hx += (dx / d) * step;
      S.hz += (dz / d) * step;
      if (step > 1e-3) S.yaw = lerpAngle(S.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
    }
    // ngắm về phía khe khi Thả Thước (toa đầu nhìn dọc thước)
    if (a && a.bars && stage !== "tele") S.yaw = lerpAngle(S.yaw, Math.atan2(-a.bars.du, -a.bars.dv), Math.min(1, dt * 8));
  }
  trail.push(S.hx, S.hz);
  S.lower += (lowerT - S.lower) * Math.min(1, dt * 6);
  const foldT = sim.mode === "stun" || sim.mode === "dead" ? 1 : 0;
  S.fold += (foldT - S.fold) * Math.min(1, dt * 3);
  const hy = at(S.hx, S.hz);
  if (S.e) {
    S.e.pos.set(S.hx, hy + 0.6, S.hz);
    if (sim.mode === "dead") S.e.deadAt = S.e.deadAt || now;
  }

  // ── vẽ toa đầu ──
  const hg = M.head.current;
  if (hg) {
    const sink = (1 - S.rise) * 2.2;
    hg.position.set(S.hx, hy - sink, S.hz);
    hg.rotation.y = S.yaw;
    if (M.body.current) {
      // hạ thấp: chúi mũi xuống (thấu kính sát đất = điểm yếu lộ ra); chết: thu nhỏ
      M.body.current.rotation.x = S.lower * 0.5;
      M.body.current.position.y = -S.lower * 0.35;
      const k = sim.mode === "dead" ? Math.max(0.001, 1 - (now - S.endAt) / 3000) : 1;
      M.body.current.scale.setScalar(k);
    }
    const m = surveyorMul(sim, now);
    // thấu kính: tối khi đang giáp, vàng rực khi lộ điểm yếu
    if (m >= SV.MUL.recover) R.lensMat.color.setRGB(1.6, 1.25 + 0.3 * Math.sin(time * 10), 0.35);
    else if (m > 0) R.lensMat.color.setRGB(0.25, 0.75, 0.85);
    else R.lensMat.color.setRGB(0.55, 0.6, 1.4);
    if (M.shield.current) {
      M.shield.current.visible = sim.mode === "seal";
      (R.shieldMat.uniforms.uTime as { value: number }).value = time;
    }
    // thước: báo trước → giơ lên; đập → nằm ngang chạm đất; hồi chiêu → cuộn lại
    if (M.ruler.current) {
      let lift = -1.1;
      let len = 0.25;
      if (a && a.bars) {
        const k = Math.min(1, (now - a.t0) / a.tele);
        if (stage === "tele") {
          lift = -1.1 + 0.6 * k;
          len = 0.3 + 1.7 * k;
        } else if (stage === "strike") {
          lift = 0.08;
          len = 2;
        } else {
          const r = (now - a.t0 - a.tele - a.dur) / a.rec;
          lift = 0.08;
          len = 2 * (1 - r) + 0.3 * r;
        }
      } else if (sim.mode === "seal") {
        lift = -1.5; // dựng đứng như cọc tiêu
        len = 0.5;
      }
      M.ruler.current.rotation.x = -lift;
      M.ruler.current.scale.set(1, 1, len);
    }
  }

  // ── 11 toa theo vết (+ tiếng vọng ở pha 3); khi gập: xếp thành vòm trên đầu toa ──
  const cm = M.carts.current;
  const am = M.arches.current;
  if (cm && am) {
    const echo = sim.phase === 3;
    let i = trail.head;
    let cnt = 1;
    const s0 = trail.s[trail.head] + Math.hypot(S.hx - trail.x[trail.head], S.hz - trail.z[trail.head]);
    const sh = a && a.route && stage === "strike" ? headS(a, now) : -1e9;
    for (let k = 1; k < SV.CARTS; k++) {
      const target = s0 - cartOffset(k, echo);
      while (cnt < trail.n && trail.s[i] > target) {
        i = (i - 1 + TRN) % TRN;
        cnt++;
      }
      const j = (i + 1) % TRN;
      let x: number;
      let z: number;
      let yaw: number;
      if (cnt >= trail.n || trail.s[i] > target) {
        x = trail.x[i];
        z = trail.z[i];
        yaw = S.yaw;
      } else {
        const L = trail.s[j] - trail.s[i] || 1;
        const f = Math.min(1, Math.max(0, (target - trail.s[i]) / L));
        const jx = j === (trail.head + 1) % TRN ? S.hx : trail.x[j];
        const jz = j === (trail.head + 1) % TRN ? S.hz : trail.z[j];
        x = trail.x[i] + (jx - trail.x[i]) * f;
        z = trail.z[i] + (jz - trail.z[i]) * f;
        yaw = Math.atan2(jx - trail.x[i], jz - trail.z[i]);
      }
      let y = at(x, z);
      let rx = 0;
      if (S.fold > 0.01) {
        // vòm: nửa vòng tròn bán kính 3,2 m dựng trên đầu toa, vuông góc hướng nhìn
        const ang = (Math.PI * k) / SV.CARTS;
        const ax = S.hx + Math.cos(S.yaw) * Math.cos(ang) * 3.2;
        const az = S.hz - Math.sin(S.yaw) * Math.cos(ang) * 3.2;
        const ay = hy + 0.4 + Math.sin(ang) * 3.2;
        x += (ax - x) * S.fold;
        z += (az - z) * S.fold;
        y += (ay - y) * S.fold;
        rx = S.fold * (ang - Math.PI / 2);
      }
      const dead = sim.mode === "dead" ? Math.max(0, 1 - (now - S.endAt - k * 120) / 600) : 1;
      const rise = Math.min(1, S.rise * 1.2 - k * 0.02);
      DUMMY.position.set(x, y - (1 - Math.max(0, rise)) * 1.6, z);
      DUMMY.rotation.set(rx, yaw, 0, "YXZ");
      DUMMY.scale.setScalar(Math.max(0.001, dead));
      DUMMY.updateMatrix();
      cm.setMatrixAt(k - 1, DUMMY.matrix);
      am.setMatrixAt(k - 1, DUMMY.matrix);
      // toa đang ở trên lộ trình lúc đánh = nóng (gây sát thương)
      const sk = sh - cartOffset(k, echo);
      const hot = a && a.route && sk >= 0 && sk <= a.route.len + 1;
      TMPC.copy(hot ? COL_HOT : echo && k >= SV.ECHO_FROM ? COL_ECHO : COL_COLD);
      cm.setColorAt(k - 1, TMPC);
    }
    cm.count = am.count = SV.CARTS - 1;
    cm.instanceMatrix.needsUpdate = true;
    am.instanceMatrix.needsUpdate = true;
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
  }

  // ── sàn báo trước ──
  const U = R.U;
  U.uTime.value = time;
  U.uFade.value = Math.min(1, U.uFade.value + dt * 1.5) * (sim.mode === "dead" ? Math.max(0, 1 - (now - S.endAt) / 3000) : 1);
  U.uStage.value = 0;
  U.uFoldOn.value = 0;
  U.uBarOn.value = 0;
  if (a && stage) {
    U.uStage.value = stage === "tele" ? 1 : stage === "strike" ? 2 : 3;
    U.uTele.value = stage === "tele" ? (now - a.t0) / a.tele : stage === "recover" ? (now - a.t0 - a.tele - a.dur) / a.rec : 0;
    if (a.route) {
      const pts = a.route.pts;
      U.uR0.value.set(pts[0], pts[1]);
      U.uR1.value.set(pts[2], pts[3]);
      if (pts.length > 4) U.uR2.value.set(pts[4], pts[5]);
      U.uRN.value = pts.length / 2;
      U.uRLen.value = a.route.len;
      U.uHeadS.value = headS(a, now);
      U.uBody.value = cartOffset(SV.CARTS - 1, a.echo) + 0.6;
      U.uEcho.value.set(a.echo ? cartOffset(SV.ECHO_FROM - 1, true) + 0.6 : 0, a.echo ? cartOffset(SV.ECHO_FROM, true) - 0.6 : 0);
      if (stage === "recover") U.uStage.value = 0;
    } else U.uRN.value = 0;
    if (a.fold && stage !== "recover") {
      U.uFoldOn.value = 1;
      U.uFold.value.set(a.fold.a, a.fold.b, a.fold.c);
    }
    if (a.bars) {
      const b = a.bars;
      U.uBarOn.value = 1;
      U.uBarO.value.set(b.ou, b.ov);
      U.uBarD.value.set(b.du, b.dv);
      U.uBarOff.value.set(b.off[0], b.off[1]);
    }
  }
  const seal = sim.mode === "seal" ? sim.seal : null;
  U.uSealOn.value = seal ? 1 : 0;
  const stakeVecs = [U.uStake0.value, U.uStake1.value, U.uStake2.value];
  const imgVecs = [U.uImg0.value, U.uImg1.value, U.uImg2.value];
  let hold = 0;
  if (seal) {
    U.uSeal.value.set(seal.line.a, seal.line.b, seal.line.c);
    for (let k = 0; k < 3; k++) {
      const s = seal.stakes[k];
      stakeVecs[k].set(s ? s.u : 0, s ? s.v : 0, s ? 1 : -1);
      const im = seal.images[k];
      imgVecs[k].set(im ? im.u : 0, im ? im.v : 0, im && seal.pinned[k] ? 1 : -1);
      if (s) hold = Math.max(hold, seal.hold[k] / SV.PIN_MS);
    }
    const gh = reflect(seal.line, pu, pv, tmpP);
    U.uGhost.value.set(gh.u, gh.v, seal.ghost ? 1 : 0);
  } else if (sim.mode !== "stun") {
    for (let k = 0; k < 3; k++) {
      stakeVecs[k].z = -1;
      imgVecs[k].z = -1;
    }
  }
  U.uPlayer.value.set(pu, pv, hold);

  // cọc 3D + cột sáng ảnh đã ghim
  const sm = M.stakes.current;
  const bm = M.beams.current;
  if (sm && bm) {
    let ns = 0;
    let nb = 0;
    if (seal)
      for (let k = 0; k < seal.stakes.length; k++) {
        const s = seal.stakes[k];
        DUMMY.position.set(cx + s.u, at(cx + s.u, cz + s.v), cz + s.v);
        DUMMY.rotation.set(0, time * 0.8, 0);
        DUMMY.scale.setScalar(1);
        DUMMY.updateMatrix();
        sm.setMatrixAt(ns++, DUMMY.matrix);
        if (seal.pinned[k]) {
          const im = seal.images[k];
          DUMMY.position.set(cx + im.u, at(cx + im.u, cz + im.v), cz + im.v);
          DUMMY.scale.set(1, 0.9 + 0.1 * Math.sin(time * 4 + k), 1);
          DUMMY.updateMatrix();
          bm.setMatrixAt(nb++, DUMMY.matrix);
        }
      }
    sm.count = ns;
    bm.count = nb;
    sm.instanceMatrix.needsUpdate = true;
    bm.instanceMatrix.needsUpdate = true;
  }

  // ── HUD (≤ 8 lần / s) ──
  if (now - S.hudAt > 125) {
    S.hudAt = now;
    const sl = sim.seal;
    useBossUi.setState({
      on: true,
      id: "surveyor",
      hp: sim.hp,
      maxHp: sim.maxHp,
      phase: sim.phase,
      mode: sim.mode === "fight" && a && stage === "recover" ? (a.kind === "measure" ? "lowered" : "fight") : sim.mode,
      atk: a && stage !== "recover" ? a.kind : null,
      pu: Math.round(pu),
      pv: Math.round(pv),
      seal:
        sim.mode === "seal" && sl
          ? {
              line: lineText(sl.line),
              rule: ruleText(sl.line),
              stakes: sl.stakes.map((s, k) => ({ name: STAKE_NAMES[k], u: s.u, v: s.v, pinned: sl.pinned[k] })),
              ghost: sl.ghost,
              left: Math.max(0, Math.ceil((SV.SEAL_MS - (now - sl.t0)) / 1000)),
              tries: sl.tries,
              wrong: now - sl.wrongAt < 1500,
            }
          : null,
      ledger: null,
    });
  }
}

export function SurveyorFight({ fight, onEnd }: { fight: Fight; onEnd: (r: "win" | "retreat") => void }) {
  const { cx, cz } = fight;
  const S = useMemo(() => makeState(fight), [fight]);
  // nhận đòn: máu nằm ở sim (combat.ts chuyển sát thương qua e.ext.boss)
  useEffect(() => attachHead(S), [S]);
  const R = useMemo(() => makeRes(S), [S]);
  useEffect(() => () => disposeRes(R), [R]);
  const carts = useRef<THREE.InstancedMesh>(null);
  const arches = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ruler = useRef<THREE.Mesh>(null);
  const shield = useRef<THREE.Mesh>(null);
  const stakes = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const headMesh = useRef<THREE.Mesh>(null);
  const roofMesh = useRef<THREE.Mesh>(null);
  const lensMesh = useRef<THREE.Mesh>(null);
  const rimMesh = useRef<THREE.Mesh>(null);
  // model Blender: thay hình học (màu từng phần nằm ở màu đỉnh); vật liệu cũ giữ nguyên nhịp màu (toa nóng / lạnh, thấu kính)
  const glb = useBossGlb(SV_GLB);
  useEffect(() => {
    if (!glb) return;
    const G = glb;
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color("#8f6bff").multiplyScalar(2.2), toneMapped: false, vertexColors: true });
    const swap = (m: THREE.Mesh | null, g?: THREE.BufferGeometry, mat?: THREE.Material) => {
      if (!m || !g) return;
      m.geometry = g;
      if (mat) m.material = mat;
    };
    enableVertexColors(R.cartMat, R.headMat, R.stakeMat);
    swap(carts.current, G.sv_cart);
    swap(arches.current, G.sv_cart_arch, glow);
    swap(stakes.current, G.sv_stake);
    swap(headMesh.current, G.sv_head);
    swap(roofMesh.current, G.sv_head_glow, glow);
    swap(lensMesh.current, G.sv_lens);
    swap(ruler.current, G.sv_ruler);
    if (rimMesh.current && G.sv_head) rimMesh.current.visible = false;
    return () => glow.dispose();
  }, [glb, R]);
  // nhãn cọc: chỉ đổi khi dựng khiên / làm lại (hiếm) → state React
  const [sealView, setSealView] = useState<{ key: number; stakes: P2[] } | null>(null);
  useEffect(() => {
    const m = carts.current;
    if (!m) return;
    for (let i = 0; i < SV.CARTS; i++) m.setColorAt(i, COL_COLD);
  }, []);

  const M: Meshes = { carts, arches, head, body, ruler, shield, stakes, beams };
  useFrame((st, rawDt) => stepSurveyor(S, R, M, st, rawDt, setSealView, onEnd));

  const gy = S.ground.at(cx, cz);
  const axisLabels: [string, number, number][] = [
    ["O (0; 0)", 0, 0],
    ["x = 8", 8, 0],
    ["x = −8", -8, 0],
    ["z = 8", 0, 8],
    ["z = −8", 0, -8],
  ];
  return (
    <group>
      <mesh geometry={R.floorGeo} material={R.floorMat} renderOrder={3} frustumCulled={false} />
      <instancedMesh ref={carts} args={[R.cartGeo, R.cartMat, SV.CARTS]} frustumCulled={false} />
      <instancedMesh ref={arches} args={[R.archGeo, R.archMat, SV.CARTS]} frustumCulled={false} />
      <instancedMesh ref={stakes} args={[R.stakeGeo, R.stakeMat, 3]} frustumCulled={false} />
      <instancedMesh ref={beams} args={[R.beamGeo, R.beamMat, 3]} frustumCulled={false} renderOrder={4} />
      <group ref={head}>
        <group ref={body}>
          <mesh ref={headMesh} geometry={R.headGeo} material={R.headMat} />
          <mesh ref={roofMesh} geometry={R.roofGeo} material={R.roofMat} />
          <mesh ref={lensMesh} geometry={R.lensGeo} material={R.lensMat} />
          <mesh ref={rimMesh} geometry={R.lensRimGeo} material={R.roofMat} />
          <mesh ref={ruler} geometry={R.rulerGeo} material={R.rulerMat} position={[0, 0.45, 0.9]} />
        </group>
        <mesh ref={shield} geometry={R.shieldGeo} material={R.shieldMat} position={[0, 1, 0]} visible={false} renderOrder={5} />
      </group>
      {axisLabels.map(([text, u, v]) => (
        <Label3D key={text} text={text} position={[cx + u, gy + 0.6, cz + v]} variant="small" maxDist={40} />
      ))}
      {sealView &&
        sealView.stakes.map((s, k) => (
          <Label3D key={`${sealView.key}-${k}`} text={`${STAKE_NAMES[k]} (${fmt(s.u)}; ${fmt(s.v)})`} position={[cx + s.u, S.ground.at(cx + s.u, cz + s.v) + 2.1, cz + s.v]} variant="warn" maxDist={45} />
        ))}
    </group>
  );
}

const fmt = (n: number) => (n < 0 ? `−${-n}` : `${n}`);

function lerpAngle(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}
