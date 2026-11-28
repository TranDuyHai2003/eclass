"use client";
/**
 * Cung Vòng (Arc Bow) — Cung Parabol khi ở trong Quần đảo Xuyến:
 *  1. mũi tên bay qua mép thì QUẤN lại (thay bằng một vật thể mới ở toạ độ ô gốc → vệt sáng cũ tắt dần ở mép, vệt mới bắt đầu,
 *     không có vệt dài vắt ngang bản đồ); trạng thái logic một bản, hình mũi tên được vẽ thêm ở 8 ô lân cận;
 *  2. va chạm đoạn bay từng khung với Hộp Chuông (vách / chuông), Mắt Canh (khiên / lưng) và CHÍNH BẠN (sau 4 m bay);
 *  3. đang giương cung: chấm đường bay dự đoán (cùng công thức với shootAimed + cùng tích phân với CombatScene) quấn qua mép,
 *     vẽ ở cả 9 ô; điểm cuối đổi màu theo thứ sẽ trúng (lưng bạn · chuông · lưng Mắt Canh · khiên · đất).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAM, CHARGE_MS, GRAVITY, curWeapon, projectiles, useCombat, type Projectile } from "../../combat/combat";
import { useWorld } from "../../store";
import { TORUS_L, segHitsCapsule, tiles, wrap } from "@/lib/world/torus";
import { ISLAND_BY_ID, arrowVsBellBox, arrowVsSentinel, shieldBlocks } from "@/lib/world/torusWorld";
import { boxWall, ringBell, selfHit, wardenBlocked, wardenDamaged } from "./torusGame";
import { useTorus, warden } from "./torusState";

const L = TORUS_L;
const OFFS = tiles(1);
const ECHO_OFFS = OFFS.slice(1);
const MAX_ARROWS = 24;
const DOTS = 64;
const SELF_AFTER = 4; // m — bỏ qua thân mình lúc mũi tên vừa rời tay
const CORNER_Y = ISLAND_BY_ID.corner.top + ISLAND_BY_ID.corner.dome;

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const D = new THREE.Vector3();
const ZF = new THREE.Vector3(0, 0, 1);
const COL = new THREE.Color();
const SHIFT = new THREE.Vector3();

/** mục tiêu hiện của dự đoán */
type PreviewEnd = "self" | "bell" | "back" | "shield" | "wall" | "ground" | "time";
const END_COLOR: Record<PreviewEnd, string> = { self: "#ff5f7a", bell: "#ffe27a", back: "#7cf0ff", shield: "#9aa3b5", wall: "#d8cfc0", ground: "#ffffff", time: "#ffffff" };

function wardenAlive(lit: boolean) {
  return lit && useTorus.getState().wardenHp > 0;
}

export function ArcBow({ ground, lit }: { ground: (x: number, z: number) => number; lit: () => boolean }) {
  const res = useMemo(() => {
    // mũi tên bản sao: thân mảnh + mũi (dọc +z)
    const shaft = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 5).rotateX(Math.PI / 2);
    const head = new THREE.ConeGeometry(0.07, 0.2, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    const geo = mergeTwo(shaft, head);
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const echoes = new THREE.InstancedMesh(geo, mat, MAX_ARROWS * ECHO_OFFS.length);
    echoes.frustumCulled = false;
    echoes.count = 0;
    echoes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_ARROWS * ECHO_OFFS.length * 3), 3);
    const dotGeo = new THREE.OctahedronGeometry(0.07, 0);
    const dotMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, DOTS * OFFS.length);
    dots.frustumCulled = false;
    dots.count = 0;
    dots.renderOrder = 8;
    dots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(DOTS * OFFS.length * 3), 3);
    const endGeo = new THREE.TorusGeometry(0.42, 0.06, 6, 24);
    const endMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, depthWrite: false, transparent: true });
    const ends = new THREE.InstancedMesh(endGeo, endMat, OFFS.length);
    ends.frustumCulled = false;
    ends.count = 0;
    ends.renderOrder = 8;
    return { geo, mat, echoes, dotGeo, dotMat, dots, endGeo, endMat, ends, pts: new Float32Array(DOTS * 4), prev: new WeakMap<Projectile, THREE.Vector3>(), flown: new WeakMap<Projectile, number>() };
  }, []);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
      res.dotGeo.dispose();
      res.dotMat.dispose();
      res.endGeo.dispose();
      res.endMat.dispose();
      res.echoes.dispose();
      res.dots.dispose();
      res.ends.dispose();
      useTorus.setState({ aimSelf: false });
    },
    [res],
  );

  useFrame(() => {
    const w = useWorld.getState();
    const p = w.player;
    const isLit = lit();
    // ── 1–2. va chạm + quấn mép cho mũi tên thật
    for (let i = 0; i < projectiles.length; i++) {
      const pr = projectiles[i];
      if (!pr.alive || pr.big) continue;
      const b = pr.pos;
      let a = res.prev.get(pr);
      if (!a) {
        a = b.clone();
        res.prev.set(pr, a);
      }
      const flown = (res.flown.get(pr) ?? 0) + Math.hypot(b.x - a.x, b.z - a.z);
      res.flown.set(pr, flown);
      const box = arrowVsBellBox(a.x, a.y, a.z, b.x, b.y, b.z);
      if (box) {
        pr.alive = false;
        if (box === "bell") ringBell(b);
        else boxWall(b);
        continue;
      }
      if (wardenAlive(isLit) && arrowVsSentinel(a.x, a.y, a.z, b.x, b.y, b.z, CORNER_Y) !== null) {
        pr.alive = false;
        if (shieldBlocks(Math.sin(warden.yaw), Math.cos(warden.yaw), pr.vel.x, pr.vel.z)) wardenBlocked(b);
        else wardenDamaged(b, false);
        continue;
      }
      if (flown > SELF_AFTER && segHitsCapsule(a.x, a.y, a.z, b.x, b.y, b.z, p.x, p.z, p.y + 0.15, p.y + 1.75, 0.42)) {
        pr.alive = false;
        selfHit(b);
        continue;
      }
      const sx = wrap(b.x) - b.x;
      const sz = wrap(b.z) - b.z;
      if (Math.abs(sx) > 1e-9 || Math.abs(sz) > 1e-9) {
        SHIFT.set(sx, 0, sz);
        const np: Projectile = { ...pr, pos: pr.pos.clone().add(SHIFT), vel: pr.vel.clone(), trail: pr.trail.map((t) => t.clone().add(SHIFT)) };
        pr.alive = false; // vật cũ: vệt sáng tắt dần ở mép (không vỡ, không nổ)
        projectiles[i] = np;
        res.prev.set(np, b.clone().add(SHIFT));
        res.flown.set(np, flown);
      } else a.copy(b);
    }

    // ── mũi tên ở 8 ô lân cận
    let n = 0;
    for (const pr of projectiles) {
      if (!pr.alive || pr.big) continue;
      D.copy(pr.vel).normalize();
      Q.setFromUnitVectors(ZF, D);
      COL.set(pr.color).multiplyScalar(2);
      for (const [i, j] of ECHO_OFFS) {
        if (n >= MAX_ARROWS * ECHO_OFFS.length) break;
        M.compose(P.set(pr.pos.x + i * L, pr.pos.y, pr.pos.z + j * L), Q, S.set(1.1, 1.1, 1.1));
        res.echoes.setMatrixAt(n, M);
        res.echoes.setColorAt(n, COL);
        n++;
      }
    }
    res.echoes.count = n;
    res.echoes.instanceMatrix.needsUpdate = true;
    if (res.echoes.instanceColor) res.echoes.instanceColor.needsUpdate = true;

    // ── 3. đường bay dự đoán khi đang giương Cung Vòng
    const c = useCombat.getState();
    const cam = CAM.cam;
    const show = c.aiming && cam && curWeapon().id === "bow";
    if (!show) {
      res.dots.count = 0;
      res.ends.count = 0;
      if (useTorus.getState().aimEnd !== null) useTorus.setState({ aimSelf: false, aimEnd: null });
      return;
    }
    cam.getWorldDirection(D);
    const charged = performance.now() - c.aimAt >= CHARGE_MS;
    const speed = charged ? 46 : 34;
    const h = Math.hypot(D.x, D.z) || 1;
    let x = p.x + (D.x / h) * 0.6;
    let y = p.y + 1.4;
    let z = p.z + (D.z / h) * 0.6;
    // điểm ngắm 40 m dọc tia máy quay (giống shootAimed)
    S.copy(cam.position).addScaledVector(D, 40).sub(P.set(x, y, z)).normalize().multiplyScalar(speed);
    const vx = S.x;
    let vy = S.y + 0.5 * GRAVITY * (40 / speed);
    const vz = S.z;
    const dt = 1 / 60;
    let flown = 0;
    let end: PreviewEnd = "time";
    let k = 0;
    for (let step = 0; step < 180; step++) {
      const ax = x;
      const ay = y;
      const az = z;
      vy -= GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      flown += Math.hypot(x - ax, z - az);
      const box = arrowVsBellBox(ax, ay, az, x, y, z);
      if (box) end = box;
      else if (wardenAlive(isLit) && arrowVsSentinel(ax, ay, az, x, y, z, CORNER_Y) !== null) end = shieldBlocks(Math.sin(warden.yaw), Math.cos(warden.yaw), vx, vz) ? "shield" : "back";
      else if (flown > SELF_AFTER && segHitsCapsule(ax, ay, az, x, y, z, p.x, p.z, p.y + 0.15, p.y + 1.75, 0.42)) end = "self";
      else if (y < ground(x, z)) end = "ground";
      const wx = wrap(x);
      const wz = wrap(z);
      if (step % 3 === 2 || end !== "time") {
        if (k < DOTS) {
          res.pts[k * 4] = wx;
          res.pts[k * 4 + 1] = y;
          res.pts[k * 4 + 2] = wz;
          res.pts[k * 4 + 3] = flown;
          k++;
        }
      }
      x = wx;
      z = wz;
      if (end !== "time") break;
    }
    // vẽ chấm ở cả 9 ô: vàng trước khi qua mép đầu tiên, ngả lam sau đó (đã "đi vòng")
    let di = 0;
    for (let q = 0; q < k; q++) {
      const f = res.pts[q * 4 + 3];
      COL.set("#ffd27a").lerp(TEAL, Math.min(1, f / L));
      COL.multiplyScalar(1.8);
      const s = q === k - 1 ? 1.8 : 1;
      for (const [i, j] of OFFS) {
        M.compose(P.set(res.pts[q * 4] + i * L, res.pts[q * 4 + 1], res.pts[q * 4 + 2] + j * L), Q.identity(), S.set(s, s, s));
        res.dots.setMatrixAt(di, M);
        res.dots.setColorAt(di, COL);
        di++;
      }
    }
    res.dots.count = di;
    res.dots.instanceMatrix.needsUpdate = true;
    if (res.dots.instanceColor) res.dots.instanceColor.needsUpdate = true;
    // vòng đánh dấu điểm cuối (quay mặt về máy quay)
    if (k > 0 && end !== "time") {
      res.endMat.color.set(END_COLOR[end]).multiplyScalar(2.2);
      Q.copy(cam.quaternion);
      let ei = 0;
      for (const [i, j] of OFFS) {
        P.set(res.pts[(k - 1) * 4] + i * L, res.pts[(k - 1) * 4 + 1], res.pts[(k - 1) * 4 + 2] + j * L);
        // vòng đánh dấu sát máy quay (vd. ngay lưng mình) che cả màn hình → bỏ bản đó
        if (P.distanceToSquared(cam.position) < 9) continue;
        M.compose(P, Q, S.set(1, 1, 1));
        res.ends.setMatrixAt(ei++, M);
      }
      res.ends.count = ei;
      res.ends.instanceMatrix.needsUpdate = true;
    } else res.ends.count = 0;
    if (useTorus.getState().aimEnd !== end) useTorus.setState({ aimSelf: end === "self", aimEnd: end });
  });

  return (
    <>
      <primitive object={res.echoes} />
      <primitive object={res.dots} />
      <primitive object={res.ends} />
    </>
  );
}

const TEAL = new THREE.Color("#7cf0ff");

/** gộp hai hình (đều có position + normal, không chỉ mục) */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.index ? a.toNonIndexed() : a;
  const B = b.index ? b.toNonIndexed() : b;
  const g = new THREE.BufferGeometry();
  const pa = A.getAttribute("position").array as Float32Array;
  const pb = B.getAttribute("position").array as Float32Array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa);
  pos.set(pb, pa.length);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  a.dispose();
  b.dispose();
  return g;
}
