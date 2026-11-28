"use client";
/**
 * M1 — ba quái "quy luật" mới: hiểu quy luật toán học thì thắng.
 *  • Ma Tham Lam (ghoul): đi theo thuật toán tham lam trên lưới → dụ vào lòng rào chữ U (cực tiểu địa phương) là nó kẹt,
 *    hở giáp ×2,2; còn đang lao tới thì "nuốt đòn" ×0,35. Mũi tên trên đầu luôn chỉ ĐƯỜNG THẲNG tới bạn (heuristic).
 *  • Hộ Vệ Nguyên Tố (warden): khiên số n (lưới a × b viên gạch); loạt c đòn rồi ngừng tay → c | n thì n ← n / c,
 *    về 1 thì vỡ; c ∤ n thì phản đòn. Số nguyên tố chỉ có 1 hàng gạch và chỉ vỡ bởi đúng p đòn liền.
 *  • Cua Chuông (crab): bàn Galton trên lưng thả 20 viên sỏi → cột sỏi thành biểu đồ hình chuông trên mặt đất;
 *    hai đuôi (ngang hông cua) gần như không có sỏi, mà hông lại là chỗ hở mai.
 * Logic thuần + test: lib/world/greedyGhoul.ts, primeWarden.ts, galtonCrab.ts. Cách nhận đòn: ruleHit.ts.
 * Mô hình: Blender `monsters/rule_monsters.glb` (m_ghoul / m_warden / m_crab, nạp ở CombatScene; + lair_post = trụ đá rune của rào chữ U,
 * warden_tile = viên gạch khiên). Bản ghép khối cơ bản dưới đây chỉ là dự phòng khi thiếu node.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { floatText, Label3D } from "../ui/Labels";
import { unlockNote } from "../story/quest";
import { GRADIENT } from "../fx/shaders";
import { emitBurst, emitSpark } from "../fx/Sparks";
import { impact } from "../fx/Lensing";
import { ENV, playerHurt, type Enemy } from "./combat";
import { strike } from "../fx/StrikeFx";
import { isRuleKind, type RuleKind } from "./ruleHit";
import { ghoulTarget, greedyStep, lairBlocked, lairCells } from "@/lib/world/greedyGhoul";
import { isPrime, tileGrid, wardenOpen, wardenTick } from "@/lib/world/primeWarden";
import { ROWS, SPREAD, TELE_MS, VOLLEY_EVERY, binomPmf, laneAngle, pebbleTimes, volleyDuration, volleyLanes } from "@/lib/world/galtonCrab";

const V = new THREE.Vector3();
const RULE_GLB = worldAsset("monsters/rule_monsters.glb");
useGLTF.preload(RULE_GLB);

/** Các lưới con của một node GLB (đã toon hoá), hình học đưa về khung của node — dùng cho InstancedMesh */
function useGlbParts(name: string): { geo: THREE.BufferGeometry; mat: THREE.Material }[] {
  const gltf = useGLTF(RULE_GLB);
  const parts = useMemo(() => {
    const src = gltf.scene.getObjectByName(name);
    if (!src) return [];
    const base = toonize(src);
    base.updateMatrixWorld(true);
    const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    base.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) out.push({ geo: m.geometry.clone().applyMatrix4(m.matrixWorld), mat: m.material as THREE.Material });
    });
    return out;
  }, [gltf, name]);
  useEffect(() => () => parts.forEach((p) => (p.geo.dispose(), p.mat.dispose())), [parts]);
  return parts;
}

// ───────────── AI (gọi từ vòng lặp Enemies) ─────────────

/** Đồng hồ riêng chạy MỌI khung hình (kể cả lúc bị khựng / đang vung): sỏi đang bay, chốt loạt đòn của khiên */
export function ruleTick(e: Enemy, p: THREE.Vector3, now: number) {
  const r = e.rule;
  if (r.warden) {
    const s = r.warden;
    const res = wardenTick(s, now);
    if (!res) return;
    const at = V.copy(e.pos).setY(e.pos.y + 2.3);
    if (res.kind === "divide") {
      floatText(at, `÷${res.by} → ${res.n}`, "crit");
      sfx.chime(2);
      // chia cho ước: LỒNG trực giao, số thanh = số chia (2–8)
      strike("cage", e.pos.x, e.pos.y, e.pos.z, { r: 1.6, n: res.by, color: "#9ec8ff" });
      emitBurst(e.pos.x, e.pos.y + 1.2, e.pos.z, "#9ec8ff", 14, 4);
    } else if (res.kind === "break") {
      floatText(at, `÷${res.by} → 1`, "crit");
      sfx.shatter();
      strike("star", e.pos.x, e.pos.y + 0.05, e.pos.z, { r: 2.6, n: 5, color: "#9ec8ff" });
      emitBurst(e.pos.x, e.pos.y + 1.2, e.pos.z, "#ffffff", 30, 7);
      impact(0.35);
      e.windup = 0;
      unlockNote("prime");
    } else if (res.kind === "one") {
      floatText(at, `÷1 = ${s.n}`, "info");
      sfx.miss();
    } else if (res.kind === "reject") {
      // không phải ước: khiên phản đòn — sóng xung kích quanh hộ vệ
      floatText(at, `${res.count} ∤ ${s.n}`, "info");
      sfx.miss();
      sfx.impact(0.9);
      // phản đòn: trường lục giác + vách cong đúng bán kính 3,2 m (vùng gây sát thương bên dưới)
      strike("hex", e.pos.x, e.pos.y + 0.06, e.pos.z, { r: 3.2, color: "#ff3d6e" });
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < 3.2 && Math.abs(p.y - e.pos.y) < 1.6) playerHurt(10, e.pos);
    } else if (res.kind === "reshield") {
      floatText(at, `${res.n}`, "info");
      strike("shell", e.pos.x, e.pos.y + 0.06, e.pos.z, { r: 2, color: "#9ec8ff" });
    }
    return;
  }
  if (r.crab) {
    const c = r.crab;
    if (!c.st) return;
    const el = now - c.t0;
    if (c.st === 1 && el >= TELE_MS) c.st = 2;
    while (c.landed < c.lanes.length && pebbleTimes(c.landed).land <= el) {
      const k = c.lanes[c.landed++];
      c.stacks[k]++;
      const a = c.yaw0 + laneAngle(k);
      const x = c.ox + Math.sin(a) * c.r;
      const z = c.oz + Math.cos(a) * c.r;
      const gy = ENV.ground(x, z);
      for (let i = 0; i < 3; i++) emitSpark(x, gy + 0.1, z, (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3, "#ffe6b0", { size: 0.04, life: 0.3, gravity: 9 });
      if (c.landed % 2) sfx.click();
      if (Math.hypot(p.x - x, p.z - z) < 0.95 && p.y - gy < 1.4) playerHurt(4, V.set(x, gy, z));
    }
    if (el >= volleyDuration(c.lanes.length)) {
      c.st = 0;
      c.doneAt = now;
      c.nextAt = now + VOLLEY_EVERY;
    }
  }
}

function wander(e: Enemy, now: number, speed: number, out: { x: number; z: number }) {
  const t = now / 1000 + e.seed;
  const hx = e.home.x + Math.cos(t * 0.3) * 2.5 - e.pos.x;
  const hz = e.home.z + Math.sin(t * 0.37) * 2.5 - e.pos.z;
  const hd = Math.hypot(hx, hz);
  if (hd > 0.3) {
    out.x = (hx / hd) * speed * 0.35;
    out.z = (hz / hd) * speed * 0.35;
    e.yaw = Math.atan2(hx, hz);
  }
}

/** Di chuyển / ra đòn theo quy luật (chỉ khi không đang vung đòn). out = vận tốc đi bộ (m/s) */
export function ruleMove(e: Enemy, p: THREE.Vector3, now: number, chasing: boolean, stunned: boolean, out: { x: number; z: number }) {
  out.x = 0;
  out.z = 0;
  const dx = p.x - e.pos.x;
  const dz = p.z - e.pos.z;
  const d = Math.hypot(dx, dz);
  const r = e.rule;
  if (r.ghoul) {
    const g = r.ghoul;
    if (stunned || e.hopAt || now < g.nextAt) return;
    g.nextAt = now + 300;
    g.ci = Math.round(e.pos.x - e.home.x);
    g.cj = Math.round(e.pos.z - e.home.z);
    const [tx, tz] = chasing ? ghoulTarget(p.x - e.home.x, p.z - e.home.z) : [0, 0];
    if (chasing && d < 1.5 && !g.stuck && now - e.atkAt > 1300 && Math.abs(p.y - e.pos.y) < 1.6) {
      e.yaw = Math.atan2(dx, dz);
      e.windup = now;
      return;
    }
    const s = greedyStep(g.ci, g.cj, tx, tz, lairBlocked);
    if (s.stuck) {
      if (!g.stuck) {
        g.stuck = true;
        g.stuckAt = now;
        g.told = false;
      }
      if (!g.told && chasing) {
        g.told = true;
        floatText(V.copy(e.pos).setY(e.pos.y + 2), "?", "info");
      }
      e.yaw = Math.atan2(dx, dz);
      return;
    }
    g.stuck = false;
    if (s.i === g.ci && s.j === g.cj) return;
    e.from.copy(e.pos);
    e.to.set(e.home.x + s.i, e.pos.y, e.home.z + s.j);
    e.hopAt = now;
    e.yaw = Math.atan2(s.i - g.ci, s.j - g.cj);
    return;
  }
  if (r.warden) {
    if (stunned) return;
    if (!chasing) return wander(e, now, 0.9, out);
    e.yaw = Math.atan2(dx, dz);
    if (d > 1.3) {
      out.x = (dx / d) * 0.9;
      out.z = (dz / d) * 0.9;
    } else if (now - e.atkAt > 1500) e.windup = now;
    return;
  }
  if (r.crab) {
    const c = r.crab;
    if (c.st) {
      e.yaw = c.yaw0;
      return;
    }
    if (stunned) return;
    if (!chasing) return wander(e, now, 2.4, out);
    e.yaw = Math.atan2(dx, dz);
    if (d < 1.6 && now - e.atkAt > 1300) {
      e.windup = now;
      return;
    }
    if (now >= c.nextAt && d < 9) {
      // bắt đầu loạt sỏi: hướng nhìn + bán kính máng chốt cứng tới hết loạt (cua đứng yên)
      c.st = 1;
      c.t0 = now;
      c.yaw0 = e.yaw;
      c.lanes = volleyLanes(e.seed + c.round);
      c.round++;
      c.r = Math.max(2.6, Math.min(6.5, d));
      c.landed = 0;
      c.stacks.fill(0);
      c.ox = e.pos.x;
      c.oz = e.pos.z;
      sfx.chime(1);
      return;
    }
    // cua bò ngang: giữ khoảng 4,5 m, trượt sang hai bên
    const nx = dx / Math.max(0.01, d);
    const nz = dz / Math.max(0.01, d);
    const radial = Math.max(-2.4, Math.min(2.4, (d - 4.5) * 1.5));
    const side = Math.sin(now / 1000 * 0.9 + e.seed) * 2.1;
    out.x = nx * radial + nz * side;
    out.z = nz * radial - nx * side;
  }
}

// ───────────── Mô hình (ghép khối cơ bản, cùng phong cách monsters2.glb) ─────────────

type Tr = [number, number, number];
function bake(geo: THREE.BufferGeometry, p: Tr, r: Tr = [0, 0, 0], s: Tr = [1, 1, 1]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s)));
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
  return g;
}
const toon = (name: string, color: string) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT });
  m.name = name;
  return m;
};
const glow = (name: string, color: string, k = 2.2) => {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
  m.name = `glow_${name}`;
  return m;
};
/** gộp các mảnh cùng vật liệu thành 1 mesh (ít draw call); tên dùng để tìm lại khi hoạt hoạ */
function part(root: THREE.Object3D, mat: THREE.Material, geos: THREE.BufferGeometry[], name = "", pivot?: Tr) {
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged ?? new THREE.BufferGeometry(), mat);
  mesh.name = name;
  if (pivot) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...pivot);
    mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    mesh.name = "";
    g.add(mesh);
    root.add(g);
    return g;
  }
  root.add(mesh);
  return mesh;
}

function buildGhoul(): THREE.Object3D {
  const root = new THREE.Group();
  const S = new THREE.SphereGeometry(1, 18, 12);
  const C = new THREE.ConeGeometry(1, 1, 9);
  const cloak = toon("ghoul_cloak", "#5a4382");
  const cream = toon("ghoul_bone", "#efe4ff");
  const gold = toon("ghoul_gold", "#ffcf5a");
  // thân áo choàng: nón úp ngược thuôn xuống, viền rách bằng vài nón nhỏ
  const body = [bake(S, [0, 1.42, 0], [0, 0, 0], [0.5, 0.48, 0.48]), bake(C, [0, 0.82, 0], [Math.PI, 0, 0], [0.56, 1.15, 0.5])];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    body.push(bake(C, [Math.sin(a) * 0.32, 0.22, Math.cos(a) * 0.3], [Math.PI, 0, 0], [0.13, 0.36, 0.13]));
  }
  body.push(bake(C, [0, 1.92, -0.05], [-0.4, 0, 0], [0.42, 0.42, 0.36])); // mũ trùm
  part(root, cloak, body);
  // mặt nạ xương + răng
  part(root, cream, [bake(S, [0, 1.4, 0.3], [0, 0, 0], [0.34, 0.3, 0.2]), ...[-0.12, -0.04, 0.04, 0.12].map((x) => bake(C, [x, 1.25, 0.43], [Math.PI, 0, 0], [0.035, 0.09, 0.035]))]);
  // miệng "đói" + mắt phát sáng
  part(root, glow("ghoul_mouth", "#ff5fb8"), [bake(S, [0, 1.3, 0.42], [0, 0, 0], [0.16, 0.05, 0.05])]);
  part(root, glow("ghoul_eye", "#ffe66b"), [bake(S, [-0.12, 1.47, 0.44], [0, 0, 0], [0.06, 0.07, 0.04]), bake(S, [0.12, 1.47, 0.44], [0, 0, 0], [0.06, 0.07, 0.04])]);
  // hai tay vươn ra phía trước (vồ lấy): gốc ở vai để lắc
  for (const sgn of [-1, 1]) part(root, cloak, [bake(C, [sgn * 0.42, 1.08, 0.38], [Math.PI / 2 + 0.25, 0, -sgn * 0.2], [0.1, 0.62, 0.1]), bake(S, [sgn * 0.5, 1.0, 0.7], [0, 0, 0], [0.09, 0.07, 0.11])], sgn < 0 ? "armL" : "armR", [sgn * 0.42, 1.15, 0.12]);
  // đồng xu vàng lủng lẳng (tham lam)
  const coinG = new THREE.CylinderGeometry(1, 1, 0.2, 14);
  part(root, gold, [0, 1, 2].map((i) => bake(coinG, [Math.sin(i * 2.1) * 0.38, 0.62 + i * 0.06, Math.cos(i * 2.1) * 0.3], [Math.PI / 2, 0, i], [0.1, 0.5, 0.1])));
  // mũi tên heuristic trên đầu: luôn chỉ đường thẳng tới người chơi
  const arrow = new THREE.Group();
  arrow.name = "arrow";
  arrow.position.set(0, 2.45, 0);
  const am = glow("ghoul_arrow", "#ff5fb8", 1.8);
  const shaft = new THREE.Mesh(bake(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), [0, 0, 0.05], [Math.PI / 2, 0, 0]), am);
  const tip = new THREE.Mesh(bake(C, [0, 0, 0.38], [Math.PI / 2, 0, 0], [0.11, 0.22, 0.11]), am);
  arrow.add(shaft, tip);
  root.add(arrow);
  S.dispose();
  C.dispose();
  coinG.dispose();
  return root;
}

function buildWarden(): THREE.Object3D {
  const root = new THREE.Group();
  const B = new THREE.BoxGeometry(1, 1, 1);
  const O = new THREE.OctahedronGeometry(1, 0);
  const S = new THREE.SphereGeometry(1, 14, 10);
  const stone = toon("warden_stone", "#6a7fa6");
  const dark = toon("warden_dark", "#3b4766");
  const ivory = toon("warden_ivory", "#eef2ff");
  // bệ + thân tháp (obelisk) + vai
  part(root, dark, [bake(B, [0, 0.12, 0], [0, 0, 0], [1.0, 0.24, 0.8]), bake(B, [-0.62, 1.42, 0], [0, 0, 0.25], [0.36, 0.3, 0.46]), bake(B, [0.62, 1.42, 0], [0, 0, -0.25], [0.36, 0.3, 0.46])]);
  part(root, stone, [bake(B, [0, 0.9, 0], [0, 0, 0], [0.78, 1.3, 0.55]), bake(B, [0, 1.62, 0], [0, 0, 0], [0.62, 0.22, 0.48])]);
  // đầu kim cương + mắt
  part(root, ivory, [bake(O, [0, 2.0, 0], [0, Math.PI / 4, 0], [0.3, 0.38, 0.3])]);
  part(root, glow("warden_eye", "#9ec8ff"), [bake(S, [0, 2.02, 0.2], [0, 0, 0], [0.08, 0.08, 0.06])]);
  // vạch nguyên tố trên ngực: 2 · 3 · 5 · 7 khía
  const ticks: THREE.BufferGeometry[] = [];
  [2, 3, 5, 7].forEach((n, row) => {
    for (let i = 0; i < n; i++) ticks.push(bake(B, [(i - (n - 1) / 2) * 0.08, 1.3 - row * 0.15, 0.28], [0, 0, 0], [0.035, 0.09, 0.02]));
  });
  part(root, glow("warden_glyph", "#9ec8ff", 1.6), ticks);
  // tay cầm khiên (khiên gạch vẽ riêng ở RuleWorldFx)
  part(root, stone, [bake(B, [-0.62, 1.0, 0.25], [0.5, 0, 0], [0.22, 0.6, 0.22]), bake(B, [0.62, 1.0, 0.25], [0.5, 0, 0], [0.22, 0.6, 0.22])]);
  B.dispose();
  O.dispose();
  S.dispose();
  return root;
}

function buildCrab(): THREE.Object3D {
  const root = new THREE.Group();
  const S = new THREE.SphereGeometry(1, 18, 12);
  const Cy = new THREE.CylinderGeometry(1, 1, 1, 8);
  const shell = toon("crab_shell", "#ff7f6e");
  const belly = toon("crab_belly", "#ffe3cf");
  const board = toon("crab_board", "#f4e3c1");
  part(root, shell, [bake(S, [0, 0.55, 0], [0, 0, 0], [0.78, 0.36, 0.62])]);
  part(root, belly, [bake(S, [0, 0.42, 0.05], [0, 0, 0], [0.66, 0.2, 0.55])]);
  // 6 chân xoè hai bên
  const legs: THREE.BufferGeometry[] = [];
  for (const sgn of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const z = 0.25 - i * 0.28;
      legs.push(bake(Cy, [sgn * 0.78, 0.32, z], [0, 0, sgn * 0.9], [0.05, 0.55, 0.05]), bake(Cy, [sgn * 1.02, 0.14, z], [0, 0, -sgn * 0.35], [0.045, 0.32, 0.045]));
    }
  part(root, shell, legs);
  // hai càng (lắc / kẹp)
  for (const sgn of [-1, 1]) part(root, shell, [bake(Cy, [sgn * 0.62, 0.5, 0.48], [Math.PI / 2 - 0.3, 0, -sgn * 0.5], [0.07, 0.45, 0.07]), bake(S, [sgn * 0.78, 0.55, 0.8], [0, 0, 0], [0.2, 0.16, 0.22]), bake(S, [sgn * 0.84, 0.6, 1.0], [0.3, 0, 0], [0.06, 0.06, 0.16]), bake(S, [sgn * 0.72, 0.5, 1.0], [-0.2, 0, 0], [0.06, 0.05, 0.14])], sgn < 0 ? "clawL" : "clawR", [sgn * 0.5, 0.5, 0.3]);
  // mắt trên cuống
  part(root, belly, [bake(Cy, [-0.18, 0.92, 0.42], [0.2, 0, 0], [0.035, 0.32, 0.035]), bake(Cy, [0.18, 0.92, 0.42], [0.2, 0, 0], [0.035, 0.32, 0.035])]);
  part(root, glow("crab_eye", "#2a1a3a", 0.6), [bake(S, [-0.18, 1.1, 0.46], [0, 0, 0], [0.07, 0.07, 0.07]), bake(S, [0.18, 1.1, 0.46], [0, 0, 0], [0.07, 0.07, 0.07])]);
  // bàn Galton dựng trên lưng: tấm tam giác + 8 hàng đinh phát sáng + 9 máng ở đáy
  const tri = new THREE.Shape();
  tri.moveTo(-0.62, 0);
  tri.lineTo(0.62, 0);
  tri.lineTo(0, 0.95);
  tri.closePath();
  const triG = new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false });
  part(root, board, [bake(triG, [0, 0.82, -0.25]), ...Array.from({ length: 10 }, (_, k) => bake(new THREE.BoxGeometry(0.02, 0.16, 0.05), [(k - 4.5) * 0.124, 0.9, -0.17]))]);
  const pegs: THREE.BufferGeometry[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let i = 0; i <= row; i++) pegs.push(bake(S, [(i - row / 2) * 0.115, 1.66 - row * 0.085, -0.17], [0, 0, 0], [0.022, 0.022, 0.022]));
  part(root, glow("peg", "#ffd27a", 1.4), pegs);
  triG.dispose();
  S.dispose();
  Cy.dispose();
  return root;
}

const RULE_BASE = new Map<RuleKind, THREE.Object3D>();
/** Mô hình gốc (dựng một lần) — bản sao + vật liệu riêng do cloneWithOwnMaterials lo (nháy trắng, tan biến) */
export function ruleModelBase(kind: RuleKind): THREE.Object3D {
  let b = RULE_BASE.get(kind);
  if (!b) {
    b = kind === "ghoul" ? buildGhoul() : kind === "warden" ? buildWarden() : buildCrab();
    RULE_BASE.set(kind, b);
  }
  return b;
}

/** Hoạt hoạ thân theo quy luật (gọi trong EnemyBody) */
export function ruleAnimate(e: Enemy, b: THREE.Group, model: { obj: THREE.Object3D; glow: THREE.MeshBasicMaterial[] } | null, now: number, punch: number, wind: number) {
  const t = now / 1000 + e.seed;
  const ud = model?.obj.userData as { parts?: Record<string, THREE.Object3D | undefined> } | undefined;
  if (model && ud && !ud.parts) ud.parts = { armL: model.obj.getObjectByName("armL"), armR: model.obj.getObjectByName("armR"), arrow: model.obj.getObjectByName("arrow"), clawL: model.obj.getObjectByName("clawL"), clawR: model.obj.getObjectByName("clawR") };
  const P = ud?.parts ?? {};
  if (e.rule.ghoul) {
    const g = e.rule.ghoul;
    const hop = e.hopAt ? Math.min(1, (now - e.hopAt) / 260) : 0;
    b.position.y = 0.18 + Math.sin(t * 2.2) * 0.1 + 4 * hop * (1 - hop) * 0.15;
    // kẹt: lắc ngang bối rối (đi tới đi lui trong lòng chữ U); đang lao: chúi người tới
    b.rotation.z = g.stuck ? Math.sin(t * 7) * 0.2 : 0;
    b.rotation.x = g.stuck ? -0.1 : 0.22 + wind * 0.3;
    b.position.x = g.stuck ? Math.sin(t * 3.1) * 0.25 : 0;
    const reach = g.stuck ? -0.5 : Math.sin(t * 5) * 0.25 - wind * 0.9;
    if (P.armL) P.armL.rotation.x = reach;
    if (P.armR) P.armR.rotation.x = g.stuck ? -0.5 : -Math.sin(t * 5) * 0.25 - wind * 0.9;
    if (P.arrow) {
      const p = useWorld.getState().player;
      P.arrow.rotation.y = Math.atan2(p.x - e.pos.x, p.z - e.pos.z) - e.yaw - b.rotation.y;
      P.arrow.position.y = 2.45 + Math.sin(t * 4) * 0.05;
    }
    b.scale.setScalar(1 + punch + wind * 0.15);
  } else if (e.rule.warden) {
    const open = wardenOpen(e.rule.warden, now);
    b.position.y = Math.sin(t * 1.4) * 0.02;
    b.rotation.z = open ? Math.sin(t * 9) * 0.05 : 0;
    b.scale.set(1 + punch, 1 - punch * 0.5 + wind * 0.18, 1 + punch);
    if (model) for (const m of model.glow) m.color.copy(m.userData.base as THREE.Color).multiplyScalar(open ? 0.35 : 1 + wind);
  } else if (e.rule.crab) {
    const c = e.rule.crab;
    const busy = c.st > 0;
    b.position.y = busy ? 0 : Math.abs(Math.sin(t * 9)) * 0.04;
    b.rotation.z = busy ? 0 : Math.sin(t * 9) * 0.05;
    b.scale.set(1 + punch, 1 - punch * 0.7, 1 + punch);
    const snap = wind ? wind * 0.6 : busy ? 0.15 : Math.max(0, Math.sin(t * 3)) * 0.35;
    if (P.clawL) P.clawL.rotation.y = snap;
    if (P.clawR) P.clawR.rotation.y = -snap;
    // bàn Galton sáng rực khi báo trước / thả sỏi
    if (model) {
      const k = c.st === 1 ? 1.6 + Math.sin(now / 60) * 0.6 : c.st === 2 ? 1.6 : 0.8;
      for (const m of model.glow) if (m.name === "glow_peg") m.color.copy(m.userData.base as THREE.Color).multiplyScalar(k);
    }
  }
}

// ───────────── Hiệu ứng thế giới: rào sào huyệt, khiên gạch + số, quạt chuông + sỏi ─────────────

const LAIR = lairCells();
const fanShader = {
  vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: /* glsl */ `
    uniform float uPmf[9]; uniform float uK; uniform float uR; uniform float uT; uniform float uSpread;
    varying vec2 vP;
    void main(){
      float a = atan(vP.x, -vP.y);
      float r = length(vP);
      if (abs(a) > uSpread * 4.5 || r < 0.7) discard;
      int k = int(floor(a / uSpread + 4.5));
      float p = 0.0;
      for (int i = 0; i < 9; i++) if (i == k) p = uPmf[i];
      float h = p / 0.2734;                     // 1 ở máng giữa (đỉnh chuông)
      // cột "biểu đồ" toả ra theo xác suất (lớn dần lúc báo trước)
      float reach = 0.7 + (uR + 0.8 - 0.7) * h * uK;
      float fill = 1.0 - smoothstep(reach - 0.06, reach, r);
      float edge = 1.0 - smoothstep(0.0, 0.035, abs(fract(a / uSpread + 0.5) - 0.5) * uSpread * r);
      float ring = 1.0 - smoothstep(0.0, 0.08, abs(r - uR));
      vec3 col = mix(vec3(0.6, 0.85, 1.0), vec3(1.0, 0.25, 0.35), smoothstep(0.08, 0.7, h));
      float inside = 1.0 - smoothstep(uR + 0.6, uR + 1.2, r);
      float alpha = fill * (0.1 + 0.45 * h) * (0.75 + 0.25 * sin(uT * 10.0)) + (edge * 0.25 + ring * 0.35) * inside;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(col * 1.3, alpha);
    }`,
};

/** DEV: danh sách quái quy luật đang có (window.__ruleEnemies) để kiểm tra trên trình duyệt */
const DEV_RULE = new Set<Enemy>();
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __ruleEnemies: unknown }).__ruleEnemies = DEV_RULE;

export function RuleWorldFx({ e }: { e: Enemy }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    DEV_RULE.add(e);
    return () => void DEV_RULE.delete(e);
  }, [e]);
  if (!isRuleKind(e.kind)) return null;
  if (e.kind === "ghoul") return <GhoulLair e={e} />;
  if (e.kind === "warden") return <WardenShield e={e} />;
  return <CrabVolley e={e} />;
}

function GhoulLair({ e }: { e: Enemy }) {
  // trụ đá rune (Blender lair_post: gốc = mặt đất giữa ô, chìm 0,25 dưới đất) — mỗi vật liệu một InstancedMesh
  const parts = useGlbParts("lair_post");
  const inst = useMemo(() => parts.map(({ geo, mat }) => new THREE.InstancedMesh(geo, mat, LAIR.length)), [parts]);
  useEffect(() => () => inst.forEach((im) => im.dispose()), [inst]);
  const last = useRef({ x: NaN, z: NaN, dead: -1 });
  useEffect(() => void (last.current.dead = -1), [inst]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), up: new THREE.Vector3(0, 1, 0) }), []);
  useFrame(() => {
    if (!inst.length) return;
    const dead = e.deadAt ? 1 : 0;
    // rào chỉ dời khi tổ dời (hồi sinh ở chỗ khác)
    if (last.current.x === e.home.x && last.current.z === e.home.z && last.current.dead === dead) return;
    last.current = { x: e.home.x, z: e.home.z, dead };
    LAIR.forEach(([i, j], n) => {
      const x = e.home.x + i;
      const z = e.home.z + j;
      // xoay 90°·k theo ô (đỡ lặp), cao lệch nhẹ
      tmp.q.setFromAxisAngle(tmp.up, (((i * 7 + j * 13) % 4) + 4) % 4 * (Math.PI / 2));
      tmp.s.set(1, 0.92 + ((((i * 5 + j * 3) % 3) + 3) % 3) * 0.06, 1);
      tmp.m.compose(tmp.p.set(x, ENV.ground(x, z), z), tmp.q, tmp.s);
      inst.forEach((im) => im.setMatrixAt(n, tmp.m));
    });
    inst.forEach((im) => {
      im.visible = !dead;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    });
  });
  return (
    <>
      {inst.map((im) => (
        <primitive key={im.uuid} object={im} />
      ))}
    </>
  );
}

const MAX_TILES = 30;
function WardenShield({ e }: { e: Enemy }) {
  const g = useRef<THREE.Group>(null);
  const tiles = useRef<THREE.InstancedMesh>(null);
  const label = useRef<HTMLDivElement | null>(null);
  // viên gạch vát (Blender warden_tile, mặt trước có chóp thoi); dự phòng hộp nếu thiếu node
  const tileParts = useGlbParts("warden_tile");
  const res = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.92 });
    const geo = tileParts[0]?.geo.clone() ?? new THREE.BoxGeometry(0.17, 0.17, 0.05);
    return { mat, geo };
  }, [tileParts]);
  useEffect(() => () => (res.mat.dispose(), res.geo.dispose()), [res]);
  const col = useMemo(() => ({ base: new THREE.Color("#5f8fe0").multiplyScalar(1.4), prime: new THREE.Color("#ffd27a").multiplyScalar(1.5), lit: new THREE.Color("#ffffff").multiplyScalar(2.4), over: new THREE.Color("#ff3d6e").multiplyScalar(2), m: new THREE.Matrix4(), txt: "" }), []);
  useFrame(() => {
    const s = e.rule.warden;
    const grp = g.current;
    const tm = tiles.current;
    if (!s || !grp || !tm) return;
    const now = performance.now();
    const open = wardenOpen(s, now);
    grp.visible = !e.deadAt;
    grp.position.set(e.pos.x, e.pos.y + e.air, e.pos.z);
    grp.rotation.y = e.yaw;
    tm.visible = !open;
    // khiên: lưới rows × cols (số nguyên tố = 1 hàng, màu vàng); các viên đã "đếm" sáng trắng
    const [rows, cols] = tileGrid(s.n);
    const prime = isPrime(s.n);
    const over = s.count > s.n;
    let k = 0;
    const flash = Math.max(0, 1 - (now - e.hitAt) / 160);
    for (let r = 0; r < rows && k < MAX_TILES; r++)
      for (let c = 0; c < cols && k < MAX_TILES; c++, k++) {
        col.m.makeTranslation((c - (cols - 1) / 2) * 0.21, 1.15 + ((rows - 1) / 2 - r) * 0.21, 0.72 + flash * 0.04);
        tm.setMatrixAt(k, col.m);
        tm.setColorAt(k, over ? col.over : k < s.count ? col.lit : prime ? col.prime : col.base);
      }
    tm.count = k;
    tm.instanceMatrix.needsUpdate = true;
    if (tm.instanceColor) tm.instanceColor.needsUpdate = true;
    const txt = e.deadAt ? "" : open ? "✦ 1 ✦" : s.count ? `${s.n}  ·  ${s.count}` : `${s.n}`;
    if (label.current && txt !== col.txt) {
      col.txt = txt;
      label.current.textContent = txt;
    }
  });
  return (
    <group ref={g}>
      <instancedMesh ref={tiles} args={[res.geo, res.mat, MAX_TILES]} frustumCulled={false} />
      <Label3D position={[0, 2.75, 0]} maxDist={30} onEl={(el) => void (label.current = el)} />
    </group>
  );
}

function CrabVolley({ e }: { e: Enemy }) {
  const fan = useRef<THREE.Mesh>(null);
  const peb = useRef<THREE.InstancedMesh>(null);
  const res = useMemo(() => {
    const fanM = new THREE.ShaderMaterial({
      ...fanShader,
      uniforms: { uPmf: { value: Array.from({ length: 9 }, (_, k) => binomPmf(ROWS, k)) }, uK: { value: 0 }, uR: { value: 4 }, uT: { value: 0 }, uSpread: { value: SPREAD } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const fanG = new THREE.CircleGeometry(8, 72);
    const pebM = new THREE.MeshToonMaterial({ color: "#ffe6b0", gradientMap: GRADIENT, emissive: "#6a4a10" });
    const pebG = new THREE.IcosahedronGeometry(0.11, 1);
    return { fanM, fanG, pebM, pebG };
  }, []);
  useEffect(() => () => Object.values(res).forEach((r) => r.dispose()), [res]);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const seen = useMemo(() => new Array(9).fill(0), []);
  useFrame(() => {
    const c = e.rule.crab;
    const f = fan.current;
    const pm = peb.current;
    if (!c || !f || !pm) return;
    const now = performance.now();
    const el = now - c.t0;
    const showFan = c.st > 0 && !e.deadAt;
    f.visible = showFan;
    if (showFan) {
      f.position.set(c.ox, ENV.ground(c.ox, c.oz) + 0.07, c.oz);
      f.rotation.set(-Math.PI / 2, c.yaw0, 0, "YXZ");
      res.fanM.uniforms.uK.value = Math.min(1, el / TELE_MS);
      res.fanM.uniforms.uR.value = c.r;
      res.fanM.uniforms.uT.value = now / 1000;
    }
    // sỏi: bay theo parabol từ đỉnh bàn Galton tới máng, rồi chồng thành cột (biểu đồ chuông) — còn 3 s sau loạt
    const keep = c.st > 0 || now - c.doneAt < 3000;
    let n = 0;
    if (keep && !e.deadAt) {
      seen.fill(0);
      const topX = c.ox - Math.sin(c.yaw0) * 0.18;
      const topZ = c.oz - Math.cos(c.yaw0) * 0.18;
      const topY = e.pos.y + 1.25;
      for (let i = 0; i < c.lanes.length; i++) {
        const { drop, land } = pebbleTimes(i);
        if (el < drop && c.st > 0) continue;
        const k = c.lanes[i];
        const a = c.yaw0 + laneAngle(k);
        const x = c.ox + Math.sin(a) * c.r;
        const z = c.oz + Math.cos(a) * c.r;
        const gy = ENV.ground(x, z) + 0.11 + seen[k] * 0.2;
        seen[k]++;
        if (el < land && c.st > 0) {
          const h = (el - drop) / (land - drop);
          V.set(topX + (x - topX) * h, topY + (gy - topY) * h + 4 * h * (1 - h) * 1.4, topZ + (z - topZ) * h);
        } else V.set(x, gy, z);
        m.makeTranslation(V.x, V.y, V.z);
        pm.setMatrixAt(n++, m);
      }
    }
    pm.count = n;
    pm.visible = n > 0;
    if (n) pm.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <mesh ref={fan} geometry={res.fanG} material={res.fanM} visible={false} renderOrder={3} />
      <instancedMesh ref={peb} args={[res.pebG, res.pebM, 24]} frustumCulled={false} visible={false} />
    </>
  );
}
