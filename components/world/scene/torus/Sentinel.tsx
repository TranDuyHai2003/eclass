"use client";
/**
 * Mắt Canh Xuyến (Torus Warden) — kẻ canh Đảo Bốn Góc. Khiên gương luôn quay về phía người chơi theo vectơ NGẮN NHẤT
 * (ảnh gần nhất), nên bắn thẳng vào mặt nó luôn bị chặn; lưng có "mắt" hồng là chỗ yếu.
 * Nó bắn quả cầu năng lượng bay thẳng (không trọng lực) — né được thì quả cầu bay hết một vòng L và đâm vào LƯNG nó.
 * Ngủ (khiên gập, lõi xám) cho tới khi Chuông rung. Hình: khối thủ tục gọn (chờ mô hình Blender `tw_warden`), vẽ ở 9 ô.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { playerHurt } from "../../combat/combat";
import { useWorld } from "../../store";
import { toonMaterial } from "../../fx/shaders";
import { TORUS_L, segHitsCapsule, tiles, torusDist, wrap } from "@/lib/world/torus";
import { ISLAND_BY_ID, SENTINEL, arrowVsSentinel, sentinelFacing, shieldBlocks, turnToward } from "@/lib/world/torusWorld";
import { orbs, useTorus, warden, type Orb } from "./torusState";
import { wardenBlocked, wardenDamaged } from "./torusGame";
import { sfx } from "@/lib/world/sfx";

const L = TORUS_L;
const OFFS = tiles(1);
const PROPS_GLB = worldAsset("torus/torus_props.glb");
const Y0 = ISLAND_BY_ID.corner.top + ISLAND_BY_ID.corner.dome;
const MAX_ORBS = 10;
const TELL = 650; // ms báo trước khi bắn
const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const P = new THREE.Vector3();
const HIT = new THREE.Vector3();

const shieldFrag = /* glsl */ `
uniform float uT; uniform float uOn; uniform float uFlash; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  // gương ánh xà cừ + vòng khắc + lưới ô vuông (biểu tượng ô vuông dán mép)
  vec3 c = mix(vec3(0.55, 0.75, 1.0), vec3(1.0, 0.72, 0.9), 0.5 + 0.5 * sin(a * 2.0 + r * 6.0 + uT * 0.8));
  c *= 0.55 + 0.45 * smoothstep(1.0, 0.2, r);
  float ring = smoothstep(0.03, 0.0, abs(r - 0.82)) + smoothstep(0.02, 0.0, abs(r - 0.6));
  vec2 g = abs(fract(p * 2.5) - 0.5);
  float grid = smoothstep(0.03, 0.0, min(g.x, g.y) - 0.0) * step(r, 0.58);
  c += vec3(1.0, 0.85, 0.5) * ring * 0.9 + vec3(0.9, 1.0, 1.0) * grid * 0.35;
  c = mix(c * 0.35, c, uOn);
  c += vec3(1.0) * uFlash;
  gl_FragColor = vec4(c * 1.15, 1.0);
}`;

/** mảnh Blender (torus_props.glb: sw_*) với vật liệu của Mắt Canh (lõi / mắt đổi màu theo trạng thái) */
function partFrom(scene: THREE.Object3D | null, name: string, mats: ReturnType<typeof makeMats>): THREE.Object3D | null {
  const src = scene?.getObjectByName(name);
  if (!src) return null;
  const o = src.clone(true);
  o.position.set(0, 0, 0);
  o.rotation.set(0, 0, 0);
  const pick = (m: THREE.Material) => (m.name === "glow_core" ? mats.core : m.name === "glow_eye" ? mats.eye : m.name === "t_dark" ? mats.dark : m.name.startsWith("t_stone") ? mats.stone : mats.gold);
  o.traverse((x) => {
    const mesh = x as THREE.Mesh;
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(pick) : pick(mesh.material);
  });
  return o;
}

function buildWarden(mats: ReturnType<typeof makeMats>, glb: THREE.Object3D | null) {
  const g = new THREE.Group();
  // lõi pha lê (bát diện kéo dài) — bản Blender: lưỡng tháp 8 mặt + vành / chóp vàng
  const coreGlb = partFrom(glb, "sw_core", mats);
  const core = coreGlb ?? new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mats.core);
  if (!coreGlb) core.scale.set(0.8, 1.6, 0.8);
  core.position.y = SENTINEL.cy;
  core.name = "core";
  g.add(core);
  // hai vòng quay quanh lõi
  for (let i = 0; i < 2; i++) {
    const ring = partFrom(glb, `sw_ring${i}`, mats) ?? new THREE.Mesh(new THREE.TorusGeometry(0.95 + i * 0.22, 0.045, 6, 40), mats.gold);
    ring.position.y = SENTINEL.cy;
    ring.name = `ring${i}`;
    g.add(ring);
  }
  // khiên gương phía trước (+z cục bộ) + viền vàng
  const shield = new THREE.Group();
  shield.name = "shield";
  shield.position.set(0, SENTINEL.cy, 1.05);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), mats.shield);
  const rim = partFrom(glb, "sw_rim", mats) ?? new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 8, 40), mats.gold);
  const back = new THREE.Mesh(new THREE.CircleGeometry(1.16, 40), mats.dark);
  back.rotation.y = Math.PI;
  back.position.z = -0.03;
  shield.add(face, rim, back);
  g.add(shield);
  // "mắt" yếu ở lưng (−z cục bộ)
  const eye = partFrom(glb, "sw_eye", mats) ?? new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mats.eye);
  eye.position.set(0, SENTINEL.cy + 0.1, -0.5);
  eye.name = "eye";
  g.add(eye);
  // ba mảnh đá trôi dưới chân
  for (let i = 0; i < 3; i++) {
    const r = partFrom(glb, "sw_rock", mats) ?? new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mats.stone);
    const a = (i / 3) * Math.PI * 2;
    r.position.set(Math.cos(a) * 0.7, 0.55, Math.sin(a) * 0.7);
    r.name = `rock${i}`;
    g.add(r);
  }
  return g;
}

function makeMats() {
  return {
    core: new THREE.MeshBasicMaterial({ color: new THREE.Color("#b48cff").multiplyScalar(1.6), toneMapped: false }),
    eye: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff5fa8").multiplyScalar(2.4), toneMapped: false }),
    gold: toonMaterial("#e8b64c", { rim: "#fff0c0" }),
    dark: toonMaterial("#3b3356", { rim: "#9d8cff" }),
    stone: toonMaterial("#c9bfb1"),
    shield: new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uOn: { value: 0 }, uFlash: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: shieldFrag,
      toneMapped: false,
    }),
    orb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8ad8").multiplyScalar(2.6), toneMapped: false }),
  };
}

function fireOrb(now: number, chestY: number) {
  const fx = Math.sin(warden.yaw);
  const fz = Math.cos(warden.yaw);
  let o: Orb | undefined = orbs.find((q) => !q.alive);
  if (!o && orbs.length < MAX_ORBS) {
    o = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, born: 0, alive: false };
    orbs.push(o);
  }
  if (!o) return;
  o.x = wrap(SENTINEL.x + fx * 1.5);
  o.z = wrap(SENTINEL.z + fz * 1.5);
  o.y = Math.min(Y0 + SENTINEL.body.y1 - 0.3, Math.max(Y0 + SENTINEL.body.y0 + 0.3, chestY));
  o.vx = fx * SENTINEL.orbSpeed;
  o.vy = 0;
  o.vz = fz * SENTINEL.orbSpeed;
  o.born = now;
  o.alive = true;
  sfx.cast();
}

export function Sentinel({ ground, lit }: { ground: (x: number, z: number) => number; lit: () => boolean }) {
  const mats = useMemo(() => makeMats(), []);
  const gltf = useGLTF(PROPS_GLB);
  const copies = useMemo(() => {
    const t = buildWarden(mats, gltf.scene);
    return OFFS.map(() => t.clone());
  }, [mats, gltf]);
  const orbGeo = useMemo(() => new THREE.IcosahedronGeometry(0.32, 1), []);
  const orbMesh = useMemo(() => {
    const im = new THREE.InstancedMesh(orbGeo, mats.orb, MAX_ORBS * OFFS.length);
    im.frustumCulled = false;
    im.count = 0;
    return im;
  }, [orbGeo, mats]);
  useEffect(() => {
    orbs.length = 0;
    warden.yaw = Math.PI;
    warden.fireAt = performance.now() + 2500;
    warden.deadAt = useTorus.getState().wardenHp <= 0 ? 1 : 0;
    return () => {
      orbs.length = 0;
      for (const m of Object.values(mats)) m.dispose();
      orbGeo.dispose();
      orbMesh.dispose();
      copies[0].traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    };
  }, [mats, orbGeo, orbMesh, copies]);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const w = useWorld.getState();
    const p = w.player;
    const awake = lit() && useTorus.getState().wardenHp > 0;
    const dead = useTorus.getState().wardenHp <= 0;
    const near = torusDist(p.x, p.z, SENTINEL.x, SENTINEL.z) < SENTINEL.aggro;
    if (awake) {
      const f = sentinelFacing(p.x, p.z);
      if (near) warden.yaw = turnToward(warden.yaw, f.x, f.z, dt);
    }
    // bắn: lõi bừng sáng TELL ms trước (báo hiệu) rồi phóng theo hướng đang nhìn
    if (awake && near) {
      if (now >= warden.fireAt) {
        fireOrb(now, p.y + 1.15);
        warden.fireAt = now + SENTINEL.fireEvery * 1000;
      }
    } else warden.fireAt = Math.max(warden.fireAt, now + 1500);
    // ── quả cầu: bay thẳng, quấn mép; trúng bạn / trúng lưng chủ / chạm đất / hết tuổi
    for (const o of orbs) {
      if (!o.alive) continue;
      const ax = o.x;
      const ay = o.y;
      const az = o.z;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.z += o.vz * dt;
      const age = now - o.born;
      if (age > 150 && segHitsCapsule(ax, ay, az, o.x, o.y, o.z, p.x, p.z, p.y + 0.1, p.y + 1.8, 0.5)) {
        o.alive = false;
        w.burst([o.x, o.y, o.z], "#ff8ad8", 20);
        playerHurt(SENTINEL.orbDmg, HIT.set(o.x, o.y, o.z));
      } else if (age > 1200 && !dead && arrowVsSentinel(ax, ay, az, o.x, o.y, o.z, Y0) !== null) {
        o.alive = false;
        HIT.set(o.x, o.y, o.z);
        if (shieldBlocks(Math.sin(warden.yaw), Math.cos(warden.yaw), o.vx, o.vz)) wardenBlocked(HIT);
        else wardenDamaged(HIT, true);
      } else if (o.y < ground(o.x, o.z) || age > SENTINEL.orbLife * 1000) {
        o.alive = false;
        w.burst([o.x, o.y, o.z], "#ff8ad8", 8);
      }
      o.x = wrap(o.x);
      o.z = wrap(o.z);
    }
    let n = 0;
    for (const o of orbs) {
      if (!o.alive) continue;
      const s = 1 + 0.15 * Math.sin(now / 70);
      for (const [i, j] of OFFS) {
        M.compose(P.set(o.x + i * L, o.y, o.z + j * L), Q.identity(), S.set(s, s, s));
        orbMesh.setMatrixAt(n++, M);
      }
    }
    orbMesh.count = n;
    orbMesh.instanceMatrix.needsUpdate = true;

    // ── hình: 9 bản, cùng tư thế
    const t = now / 1000;
    const tell = awake && near && warden.fireAt - now < TELL;
    const flash = Math.max(0, 1 - (now - warden.hitAt) / 220);
    const block = Math.max(0, 1 - (now - warden.blockAt) / 260);
    mats.shield.uniforms.uT.value = t;
    mats.shield.uniforms.uOn.value += ((awake ? 1 : 0) - mats.shield.uniforms.uOn.value) * Math.min(1, dt * 3);
    mats.shield.uniforms.uFlash.value = block * 0.8;
    mats.core.color.set(awake ? (tell ? "#ffe0f4" : "#b48cff") : "#8f86a8").multiplyScalar(awake ? (tell ? 3.2 : 1.6) + flash * 2 : 0.9);
    const on = mats.shield.uniforms.uOn.value as number;
    copies.forEach((g, k) => {
      const [i, j] = OFFS[k];
      g.visible = !dead || now - warden.deadAt < 600;
      if (!g.visible) return;
      const deadK = dead ? Math.min(1, (now - warden.deadAt) / 600) : 0;
      g.position.set(SENTINEL.x + i * L, Y0 + Math.sin(t * 1.3) * 0.08 * on - deadK * 1.2, SENTINEL.z + j * L);
      g.rotation.y = warden.yaw;
      g.scale.setScalar(1 - deadK * 0.9);
      const core = g.children[0];
      core.rotation.y = t * (awake ? 1.4 : 0.3);
      g.children[1].rotation.set(Math.PI / 2 + Math.sin(t * 0.7) * 0.4, t * 0.9, 0);
      g.children[2].rotation.set(Math.PI / 2 + Math.cos(t * 0.6) * 0.5, -t * 0.7, 0.4);
      const sh = g.children[3];
      // khiên gập xuống khi ngủ, dựng lên khi thức; giật lùi khi chặn đòn
      sh.rotation.x = (1 - on) * 1.35;
      sh.position.set(0, SENTINEL.cy - (1 - on) * 1.0, 1.05 - block * 0.18);
      for (let r = 0; r < 3; r++) {
        const rock = g.children[5 + r];
        const a = (r / 3) * Math.PI * 2 + t * 0.6;
        rock.position.set(Math.cos(a) * 0.75, 0.5 + Math.sin(t * 2 + r) * 0.08, Math.sin(a) * 0.75);
      }
    });
  });

  return (
    <>
      {copies.map((g, k) => (
        <primitive key={k} object={g} />
      ))}
      <primitive object={orbMesh} />
    </>
  );
}
