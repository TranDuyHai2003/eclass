"use client";
/**
 * Trọng lực kỳ dị của Mê cung Hoạ âm (logic thuần: lib/world/sirenGravity.ts).
 *  - sirenField (truyền vào Player qua prop `field`): hệ số trọng lực (Đảo Trăng), bẻ hướng đi (Hành lang nón sáng),
 *    tự lái khi ở Hành tinh tí hon / Lồng Escher / quanh Hố đen, và hệ quy chiếu "lên" (đã làm mượt) cho nhân vật + máy quay.
 *  - Máy quay chống chóng mặt: hướng "lên" xoay về đích với tốc độ góc tối đa ~125°/s và trễ mũ 0,25 s (easeUp);
 *    hệ quy chiếu cập nhật bằng phép quay NGẮN NHẤT mỗi khung (vận chuyển song song) → không lật / không giật roll;
 *    khi trở lại trọng lực thường, phần xoắn còn lại quanh trục y gộp vào camYaw → khớp liền mạch.
 *  - gravityAfterPlayer (gọi từ bộ điều khiển cổng, sau Player): đệm nảy, lỗ sâu, thấu kính hố đen.
 *  - Hình: hành tinh hoạ âm cầu (dấu của Y₃² tô hai màu giấy), hố đen + đĩa bồi tụ cắt giấy, hai miệng lỗ sâu
 *    (mặt cầu lấy mẫu cubemap chụp ở miệng kia, tia nhìn bị bẻ theo 1/b → vành Einstein, mép kéo giãn).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { CAM, addFx, air, motion } from "../../combat/combat";
import { LENS, impact } from "../../fx/Lensing";
import { REDUCE_MOTION_KEY, reduceMotion } from "../../fx/fxClock";
import { strike } from "../../fx/StrikeFx";
import type { PlayerField } from "../Hub";
import { sfx } from "@/lib/world/sfx";
import { BODY, surfAt } from "@/lib/world/sirenMaze";
import {
  CUBE,
  G0,
  HOLE,
  MOON,
  PLANET,
  WORM,
  bounceSpeed,
  coneAt,
  cubeCamT,
  coneSteer,
  dot,
  easeUp,
  enterMode,
  gravityScale,
  stepGravity,
  upOf,
  wormEnter,
  wormTraverse,
  type GState,
  type V3,
} from "@/lib/world/sirenGravity";
import { carryHorizontal } from "./SirenPortals";
import { synth } from "./sirenSynth";
import { setNetTilt } from "../../net";

/** Trạng thái dùng chung giữa Player (drive) và bộ điều khiển sau Player */
export const GF = {
  st: { mode: "world", pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, face: { k: 1, s: -1 } } as GState,
  q: new THREE.Quaternion(),
  up: [0, 1, 0] as V3,
  active: false,
  /** vận tốc ước lượng ở chế độ thường (để vào vùng trọng lực kỳ dị không mất đà) */
  vel: new THREE.Vector3(),
  prev: new THREE.Vector3(),
  prevOk: false,
  wasGrounded: true,
  lastVy: 0,
  wormLock: 0 as 0 | 1 | 2,
};
/**
 * Giảm chuyển động: máy quay giữ chân trời thế giới (không lật / nghiêng theo hành tinh, tường), chỉ nhân vật xoay.
 * Mặc định theo cài đặt hệ điều hành (prefers-reduced-motion); bật / tắt bằng setReduceMotion (lưu localStorage).
 */
// (đọc tuỳ chọn ở fx/fxClock.ts — dùng chung cho hiệu ứng hậu kỳ / khói / phép; giữ export cũ cho các module Siren)
const KEY_RM = REDUCE_MOTION_KEY;
export { reduceMotion };
export function setReduceMotion(on: boolean) {
  try {
    localStorage.setItem(KEY_RM, on ? "on" : "off");
  } catch {}
  RM.on = on;
}
const RM = { on: false };
const YV = new THREE.Vector3(0, 1, 0);
const Q1 = new THREE.Quaternion();
const QI = new THREE.Quaternion();
const VA = new THREE.Vector3();
const VB = new THREE.Vector3();

function resetGF() {
  RM.on = reduceMotion();
  GF.st = { mode: "world", pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, face: { k: 1, s: -1 } };
  GF.q.identity();
  GF.up = [0, 1, 0];
  GF.active = false;
  GF.prevOk = false;
  GF.wormLock = 0;
}

/** Cập nhật hệ quy chiếu: xoay "lên" về đích (mượt, giới hạn tốc độ góc) bằng phép quay ngắn nhất */
function updateFrame(dt: number, target: V3) {
  const next = easeUp(GF.up, target, dt, 2.2, 0.25);
  VA.set(...GF.up);
  VB.set(...next);
  Q1.setFromUnitVectors(VA, VB);
  GF.q.premultiply(Q1).normalize();
  GF.up = next;
  if (GF.st.mode === "world" && GF.active && VB.angleTo(YV) < 2e-3) {
    // đã về trọng lực thường: gộp phần xoắn quanh y vào góc máy quay / góc nhân vật → hệ quy chiếu về đơn vị
    VA.set(0, 0, 1).applyQuaternion(GF.q);
    const th = Math.atan2(VA.x, VA.z);
    const w = useWorld.getState();
    // giảm chuyển động: máy quay vốn theo thế giới → chỉ gộp vào góc nhân vật
    useWorld.setState(RM.on ? { playerYaw: w.playerYaw + th } : { camYaw: w.camYaw + th, playerYaw: w.playerYaw + th });
    GF.q.identity();
    GF.up = [0, 1, 0];
    GF.active = false;
  } else if (GF.st.mode !== "world" || VB.angleTo(YV) > 2e-3) GF.active = true;
}

/** Hướng điều khiển (thế giới) theo máy quay, trong hệ quy chiếu hiện tại */
function inputDir(out: THREE.Vector3, hole: boolean) {
  const w = useWorld.getState();
  const locked = !!w.overlay;
  const { x, y } = locked ? { x: 0, y: 0 } : w.input;
  const yaw = w.camYaw;
  if (hole) {
    // không trọng lực "lên": đẩy theo đúng hướng nhìn (cả ngẩng / cúi)
    const cp = Math.cos(w.camPitch);
    out.set(-Math.sin(yaw) * cp * y + Math.cos(yaw) * x, -Math.sin(w.camPitch) * y, -Math.cos(yaw) * cp * y - Math.sin(yaw) * x);
  } else {
    out.set(-Math.sin(yaw) * y + Math.cos(yaw) * x, 0, -Math.cos(yaw) * y - Math.sin(yaw) * x);
    // máy quay theo hệ "lên" → hướng điều khiển xoay theo; giảm chuyển động: máy quay theo thế giới, stepGravity tự chiếu
    // hướng lên mặt tiếp xúc (nhìn gần dọc trục "lên" thì dùng hướng phải của máy quay để không mất điều khiển)
    if (!RM.on) out.applyQuaternion(GF.q);
    else {
      VB.set(...upOf(GF.st));
      if (Math.abs(out.clone().normalize().dot(VB)) > 0.9 && out.lengthSq() > 0) out.set(Math.cos(yaw) * (x || 1), 0, -Math.sin(yaw) * (x || 1));
    }
  }
  if (out.lengthSq() > 1) out.normalize();
  return out;
}
const DIR = new THREE.Vector3();

/** Rời vùng trọng lực kỳ dị: trả đà cho Player (vy + đà ngang) */
function leaveTo(vel: V3) {
  motion.vy = vel[1];
  motion.grounded = false;
  carryHorizontal(vel[0], vel[2]);
}

export const sirenField: PlayerField = {
  gravity: (p) => gravityScale(p.x, p.y, p.z),
  steer: (dir, p) => {
    const c = coneAt(p.x, p.y, p.z);
    if (!c) return;
    const [dx, dz] = coneSteer(dir.x, dir.z, c);
    dir.set(dx, 0, dz);
  },
  drive: (dt) => {
    const w = useWorld.getState();
    const p = w.player;
    // bị dịch chuyển từ ngoài (hồi sinh, lệnh dev…) → thôi tự lái, trả về trọng lực thường
    if (GF.st.mode !== "world" && Math.hypot(p.x - GF.st.pos[0], p.y - GF.st.pos[1], p.z - GF.st.pos[2]) > 2) GF.st = { ...GF.st, mode: "world", grounded: false };
    if (GF.st.mode === "world") {
      const m = enterMode([p.x, p.y, p.z]);
      if (m === "world") {
        updateFrame(dt, [0, 1, 0]);
        return false;
      }
      GF.st = { mode: m, pos: [p.x, p.y, p.z], vel: [GF.vel.x, GF.vel.y, GF.vel.z], grounded: m === "cube" && motion.grounded, face: { k: 1, s: -1 } };
      if (m === "cube" && GF.st.grounded) GF.st.pos[1] = CUBE.c[1] - CUBE.a;
      motion.gliding = false;
      motion.dashUntil = 0;
      sfx.harmonic(m === "planet" ? 3 : m === "cube" ? 4 : 1);
    }
    const jumped = GF.st.grounded && !motion.grounded && motion.vy > 0;
    const r = stepGravity(GF.st, { dir: [...inputDir(DIR, GF.st.mode === "hole").toArray()] as V3, run: w.input.run, jump: jumped }, dt);
    GF.st = r;
    p.set(r.pos[0], r.pos[1], r.pos[2]);
    const up = upOf(r);
    motion.grounded = r.grounded;
    motion.vy = dot(r.vel, up);
    motion.gliding = false;
    motion.plunging = false;
    air.height = 0;
    // nhân vật quay theo hướng đi (tính trong hệ quy chiếu hiện tại)
    VA.set(...r.vel).applyQuaternion(QI.copy(GF.q).invert());
    if (Math.hypot(VA.x, VA.z) > 0.4) {
      let d = Math.atan2(VA.x, VA.z) - w.playerYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      w.playerYaw += d * Math.min(1, dt * 10);
    }
    if (r.event === "face") {
      sfx.harmonic(5);
      w.addShake(0.08);
    }
    if (r.event === "exit") {
      GF.st = { ...r, mode: "world" };
      leaveTo(r.vel);
    }
    if (r.event === "swallowed") {
      // bị kéo giãn qua chân trời → nhả ra phía trên Đảo Trăng (rơi chậm vào vùng trọng lực ¼)
      const old = p.clone();
      p.set(MOON.x + 3, 66, MOON.z - 3);
      CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(VA.subVectors(p, old));
      GF.st = { ...r, mode: "world", pos: [p.x, p.y, p.z] };
      leaveTo([0, -2, 0]);
      impact(1.2);
      sfx.shatter();
      strike("tendril", p.x, p.y, p.z, { r: 3, color: "#a8ff54" });
    }
    updateFrame(dt, upOf(GF.st));
    return true;
  },
  frame: () => (GF.active ? GF.q : null),
  camFrame: () => (RM.on || !GF.active ? null : GF.q),
};

/** Máy quay trong Lồng Escher: luôn ở trong lòng lồng */
export function gravityCamClamp(pos: THREE.Vector3, target: THREE.Vector3): boolean {
  if (GF.st.mode === "cube") {
    // kéo máy quay về phía nhân vật dọc cần máy (không trượt dọc tường) cho tới khi nằm trong lòng lồng
    const t = cubeCamT([target.x, target.y, target.z], [pos.x, pos.y, pos.z]);
    pos.lerpVectors(target, pos, t);
    return true;
  }
  return GF.st.mode !== "world";
}

/**
 * Sau khi Player di chuyển (gọi từ bộ điều khiển cổng): ước lượng vận tốc, đệm nảy, lỗ sâu.
 * prev / cur: tâm thân khung trước / khung này; shift: cộng dồn độ dời để máy quay dời theo.
 */
export function gravityAfterPlayer(dt: number, prev: THREE.Vector3, cur: THREE.Vector3, shift: THREE.Vector3) {
  const w = useWorld.getState();
  const p = w.player;
  if (GF.st.mode !== "world") {
    GF.prevOk = false;
    return;
  }
  // vận tốc (để vào vùng trọng lực kỳ dị giữ đà)
  if (GF.prevOk) GF.vel.set((cur.x - prev.x) / dt, motion.vy, (cur.z - prev.z) / dt);
  GF.prevOk = true;
  // ── đệm nảy: vừa tiếp đất trên đệm với tốc độ đủ lớn → bật lên e · v
  if (motion.grounded && !GF.wasGrounded && GF.lastVy < -2.5) {
    const s = surfAt(p.x, p.z, p.y);
    if (s?.bounce) {
      const vin = GF.lastVy - G0 * gravityScale(p.x, p.y, p.z) * dt;
      const v = bounceSpeed(vin, s.bounce);
      if (v) {
        motion.vy = v;
        motion.grounded = false;
        strike("spring", p.x, p.y + 0.05, p.z, { r: 1, yaw: useWorld.getState().camYaw, color: s.bounce > 1 ? "#a8ff54" : "#ffba35" });
        // cao độ nốt theo vận tốc bật (nảy cao dần → nốt lên dần)
        synth.bounce(v);
      }
    }
  }
  // tiếng tiếp đất theo vật liệu khu (giấy / gỗ / kim loại ống đàn / thuỷ tinh giao thoa), to theo vận tốc chạm
  if (motion.grounded && !GF.wasGrounded && GF.lastVy < -4 && motion.vy <= 0) {
    const s = surfAt(p.x, p.z, p.y);
    if (s && !s.bounce) synth.impact(s.zone === "over" ? "metal" : s.zone === "inter" || s.zone === "moon" ? "glass" : s.zone === "escher" || s.zone === "void" ? "wood" : "paper", -GF.lastVy);
  }
  GF.wasGrounded = motion.grounded;
  GF.lastVy = motion.vy;
  // ── lỗ sâu
  const mouths: [V3, V3, 1 | 2][] = [
    [WORM.a, WORM.b, 1],
    [WORM.b, WORM.a, 2],
  ];
  if (GF.wormLock) {
    const m = GF.wormLock === 1 ? WORM.b : WORM.a;
    if (Math.hypot(cur.x - m[0], cur.y - m[1], cur.z - m[2]) > WORM.R * 1.4) GF.wormLock = 0;
  }
  for (const [m, o, id] of mouths) {
    if (GF.wormLock === (id === 1 ? 2 : 1)) continue;
    if (!wormEnter(m, [prev.x, prev.y, prev.z], [cur.x, cur.y, cur.z])) continue;
    const r = wormTraverse(m, o, [cur.x, cur.y, cur.z], [GF.vel.x, GF.vel.y, GF.vel.z]);
    const old = p.clone();
    p.set(r.pos[0], r.pos[1] - BODY, r.pos[2]);
    shift.add(VA.subVectors(p, old));
    leaveTo(r.vel);
    GF.wormLock = id;
    GF.prevOk = false;
    impact(1.1);
    w.addShake(0.2);
    // Doppler: lao vào miệng (tần số vọt lên) rồi rời miệng kia (trầm xuống)
    synth.whoosh(220, 1400, 0.9, 0.9);
    strike("spokes", o[0], o[1], o[2], { r: 2.4, color: "#a8ff54" });
    break;
  }
}

// ───────────── Hình ─────────────

const SH_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main(){
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
/** Hành tinh hoạ âm cầu: Y₃²(θ, φ) ∝ sin²θ·cosθ·cos2φ — vùng dương / âm hai màu giấy, đường nút viền mực, chấm bán sắc */
const PLANET_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
varying vec3 vN;
varying vec3 vW;
float aa(float x, float e){ float w = fwidth(x) + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  vec3 n = normalize(vN);
  float ct = n.y;
  float st2 = 1.0 - ct * ct;
  float ph = atan(n.z, n.x) + uTime * 0.15;
  float y32 = st2 * ct * cos(2.0 * ph);
  vec3 a = vec3(1.0, 0.55, 0.72);
  vec3 b = vec3(0.4, 0.86, 0.95);
  vec3 col = mix(b, a, aa(y32, 0.0));
  col = mix(vec3(0.13, 0.09, 0.17), col, aa(abs(y32), 0.025));
  vec2 g = fract(vec2(ph * 6.0, ct * 6.0)) - 0.5;
  col *= 1.0 - 0.12 * (1.0 - aa(length(g), 0.22));
  float ndl = dot(n, uSun);
  col *= ndl > 0.2 ? 1.08 : ndl > -0.2 ? 0.86 : 0.68;
  gl_FragColor = vec4(col, 1.0);
}`;

function Planet() {
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SH_VERT, fragmentShader: PLANET_FRAG, uniforms: { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(12, 20, 8).normalize() } } }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={PLANET.c} material={mat} name="perf:planet">
      <sphereGeometry args={[PLANET.R, 48, 32]} />
    </mesh>
  );
}

/** Đĩa bồi tụ cắt giấy: các dải lửa xoay, sáng dần vào trong */
const DISK_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
float aa(float x, float e){ float w = fwidth(x) + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0 || r < 0.32) discard;
  float a = atan(p.y, p.x);
  float band = aa(sin(a * 7.0 + 18.0 / (r + 0.2) - uTime * 3.0), 0.2);
  vec3 hot = vec3(1.0, 0.85, 0.5) * 2.4;
  vec3 cool = vec3(0.9, 0.25, 0.55);
  vec3 col = mix(cool, hot, smoothstep(0.95, 0.35, r));
  col *= 0.55 + 0.45 * band;
  // viền mực mép trong / ngoài
  col = mix(vec3(0.1, 0.05, 0.12), col, aa(r, 0.345) * (1.0 - aa(r, 0.985)));
  gl_FragColor = vec4(col, 1.0);
}`;
const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function BlackHole() {
  const disk = useMemo(() => new THREE.ShaderMaterial({ vertexShader: UV_VERT, fragmentShader: DISK_FRAG, uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide, toneMapped: false }), []);
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2c8").multiplyScalar(3), toneMapped: false }), []);
  const { camera } = useThree();
  useEffect(
    () => () => {
      disk.dispose();
      ring.dispose();
      LENS.on = 0;
    },
    [disk, ring],
  );
  useFrame((_, dt) => {
    disk.uniforms.uTime.value += dt;
    // thấu kính hấp dẫn (hậu kỳ, chỉ uốn bầu trời phía sau): tâm = hình chiếu hố đen
    VA.set(...HOLE.c);
    const d = VA.distanceTo(camera.position);
    VA.project(camera);
    const vis = VA.z < 1 && Math.abs(VA.x) < 1.4 && Math.abs(VA.y) < 1.4 && d < 140;
    LENS.on = vis ? 1 : 0;
    if (vis) {
      LENS.center.set(VA.x * 0.5 + 0.5, VA.y * 0.5 + 0.5);
      const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
      const rs = HOLE.rs / d / (2 * Math.tan(fov / 2));
      LENS.rin = rs * 1.15;
      LENS.re = rs * 1.7;
    }
  });
  return (
    <group position={HOLE.c} name="perf:hole">
      <mesh>
        <sphereGeometry args={[HOLE.rs, 32, 16]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh material={disk} rotation-x={-Math.PI / 2 + 0.35}>
        <planeGeometry args={[HOLE.rs * 7, HOLE.rs * 7]} />
      </mesh>
      <mesh material={ring}>
        <torusGeometry args={[HOLE.rs * 1.5, 0.05, 6, 64]} />
      </mesh>
    </group>
  );
}

/** Miệng lỗ sâu: tia nhìn bị bẻ theo 1/b (b = tham số va chạm / bán kính), lấy mẫu cubemap chụp ở miệng kia */
const WORM_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WORM_FRAG = /* glsl */ `
uniform samplerCube uDest;
uniform float uHas;
uniform vec3 uCenter;
uniform float uR;
uniform float uTime;
varying vec3 vW;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 c = uCenter - cameraPosition;
  vec3 side = c - d * dot(c, d);
  float l = length(side);
  float b = l / uR;
  // góc bẻ ~ k / b: tâm nhìn xuyên gần thẳng, mép bị bẻ mạnh (kéo giãn tiếp tuyến) → vành Einstein ở b ≈ 0,9
  float bendK = 0.9 * asin(clamp(0.9 * uR / max(length(c), uR * 1.05), 0.0, 1.0));
  float a = min(1.4, bendK / max(b, 0.08)) * smoothstep(0.0, 0.12, b);
  vec3 ray = d * cos(a) + side / max(l, 1e-5) * sin(a);
  vec3 col;
  if (uHas > 0.5) col = textureCube(uDest, ray).rgb;
  else {
    // chưa có ảnh chụp: xoáy lục axit
    float ang = atan(ray.z, ray.x);
    col = mix(vec3(0.03, 0.15, 0.1), vec3(0.66, 1.0, 0.33), step(0.0, sin(ang * 5.0 + ray.y * 8.0 - uTime * 2.0)));
  }
  float w = max(fwidth(b), 0.002);
  float ring = 1.0 - smoothstep(0.01, 0.01 + w, abs(b - 0.9));
  col = mix(col, vec3(0.85, 1.0, 0.6) * 2.0, ring * 0.6);
  // vành tối mỏng ngoài cùng (viền giấy)
  col = mix(col, vec3(0.08, 0.05, 0.1), smoothstep(0.96, 0.995, b));
  gl_FragColor = vec4(col, 1.0);
}`;

function Wormholes() {
  const { gl, scene } = useThree();
  const quality = useWorld((s) => s.quality);
  const group = useRef<THREE.Group>(null);
  const parts = useMemo(() => {
    return [WORM.a, WORM.b].map((c, i) => {
      const rt = new THREE.WebGLCubeRenderTarget(quality === "high" ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      const cam = new THREE.CubeCamera(0.3, 400, rt);
      // miệng i nhìn thấy cảnh quanh miệng kia
      const o = i === 0 ? WORM.b : WORM.a;
      cam.position.set(o[0], o[1], o[2]);
      const mat = new THREE.ShaderMaterial({
        vertexShader: WORM_VERT,
        fragmentShader: WORM_FRAG,
        uniforms: { uDest: { value: rt.texture }, uHas: { value: 0 }, uCenter: { value: new THREE.Vector3(...c) }, uR: { value: WORM.R }, uTime: { value: 0 } },
        toneMapped: false,
      });
      return { c, rt, cam, mat };
    });
  }, [quality]);
  useEffect(
    () => () => {
      for (const p of parts) {
        p.rt.dispose();
        p.mat.dispose();
      }
    },
    [parts],
  );
  // chụp cubemap một lần sau khi cảnh đã nạp (máy yếu: không chụp, dùng xoáy)
  const shot = useRef(0);
  useEffect(() => {
    shot.current = performance.now() + 1500;
  }, [parts]);
  useFrame((_, dt) => {
    for (const p of parts) p.mat.uniforms.uTime.value += dt;
    if (!shot.current || performance.now() < shot.current || quality === "low") return;
    shot.current = 0;
    const vis = group.current?.visible ?? true;
    if (group.current) group.current.visible = false;
    const sh = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    for (const p of parts) {
      p.cam.update(gl, scene);
      p.mat.uniforms.uHas.value = 1;
    }
    gl.shadowMap.autoUpdate = sh;
    if (group.current) group.current.visible = vis;
  }, 0.6);
  return (
    <group ref={group} name="perf:worm">
      {parts.map((p, i) => (
        <group key={i} position={p.c}>
          <mesh material={p.mat}>
            <sphereGeometry args={[WORM.R, 48, 32]} />
          </mesh>
          {/* khung giấy: hai vòng nghiêng như hộp số hồi chuyển */}
          <mesh rotation-x={Math.PI / 2}>
            <torusGeometry args={[WORM.R * 1.12, 0.09, 6, 64]} />
            <meshToonMaterial color="#a8ff54" />
          </mesh>
          <mesh rotation-y={Math.PI / 2} rotation-z={0.6}>
            <torusGeometry args={[WORM.R * 1.2, 0.06, 6, 64]} />
            <meshToonMaterial color="#ff64b0" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Mọi phần trọng lực kỳ dị (hình + đặt lại trạng thái khi rời cảnh) */
export function GravityZones() {
  useEffect(() => {
    resetGF();
    // người khác thấy mình nghiêng / lộn ngược theo trọng lực (gửi kèm ảnh chụp mạng)
    setNetTilt(() => (GF.active ? [GF.q.x, GF.q.y, GF.q.z, GF.q.w] : null));
    // DEV: móc kiểm thử (đọc / đặt trạng thái trọng lực kỳ dị từ console)
    if (process.env.NODE_ENV !== "production") (window as unknown as { __siren: unknown }).__siren = { GF };
    return () => {
      setNetTilt(null);
      resetGF();
      LENS.on = 0;
    };
  }, []);
  return (
    <>
      <Planet />
      <BlackHole />
      <Wormholes />
    </>
  );
}

