"use client";
/**
 * Cổng dịch chuyển kiểu Portal của Mê cung Hoạ âm.
 *  - PortalSurfaces: mặt xoáy lục axit (1 lệnh vẽ, instancing) + khung giấy răng sò màu theo cặp (1 lệnh vẽ).
 *  - PortalViews: 1–2 cổng gần, trong tầm nhìn, quay mặt về máy quay được "nhìn xuyên": vẽ cảnh từ máy quay ảo
 *    (M_ảo = M_đích · R_y(π) · M_nguồn⁻¹ · M_máy) vào render target độ phân giải thấp — tối đa MỘT lượt vẽ cảnh phụ mỗi khung
 *    (hai ô đến hạn thì luân phiên), mỗi ô ≤ 30 Hz ở mức cao, ≤ 12 Hz ở laptop / điện thoại (lib/world/perfGate); khung nhìn ảo
 *    chỉ ôm hình chữ nhật cổng trên màn hình (setViewOffset) và cắt mặt phẳng gần xiên (Lengyel) theo mặt cổng đích.
 *    Máy yếu: chỉ mặt xoáy.
 *  - usePortalDriver: sau khi Player di chuyển mỗi khung — phát hiện thân xuyên mặt cổng, dịch chuyển + xoay vận tốc
 *    (rơi vào sàn → bắn ngang ra tường…), khoá cổng đích tới khi rời đủ xa, lỗ hổng vòng lặp (đáy ↔ trời, màn đối tâm),
 *    tốc độ rơi tối đa, bật / tắt bay lượn (ngoài đấu trường), giữ đà ngang sau khi bị bắn ra (mượn kênh lướt của Player).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld, timeScale } from "../../store";
import { CAM, addFx, motion } from "../../combat/combat";
import { strike } from "../../fx/StrikeFx";
import { FLIGHT, useFlight } from "../../flight";
import { useGfx } from "../../gfx";
import { GF, gravityAfterPlayer } from "./SirenGravity";
import { synth } from "./sirenSynth";
import { setWind, sfx } from "@/lib/world/sfx";
import { ARENA_R } from "@/lib/world/boss";
import { portalPassOrder, portalPeriodMs, portalSlots } from "@/lib/world/perfGate";
import { zoneAtWorld } from "@/lib/world/zoneGraph";
import {
  BODY,
  DRAG_AIR,
  DRAG_GROUND,
  PAIRS,
  PORTALS,
  PORTAL_BY_ID,
  REARM,
  TERMINAL,
  VOID,
  basis,
  crossing,
  inAperture,
  mapCamYaw,
  mazeGround,
  nearestLanding,
  toLocal,
  traverse,
  wrapXZ,
  wrapY,
  type Portal,
  type V3,
} from "@/lib/world/sirenMaze";

/** Ma trận thế giới của khung cổng: cột = (right, up, n), gốc = tâm */
function portalMatrix(p: Portal, lift = 0): THREE.Matrix4 {
  const b = basis(p);
  return new THREE.Matrix4().set(b.r[0], b.u[0], b.n[0], p.c[0] + b.n[0] * lift, b.r[1], b.u[1], b.n[1], p.c[1] + b.n[1] * lift, b.r[2], b.u[2], b.n[2], p.c[2] + b.n[2] * lift, 0, 0, 0, 1);
}
const FLIP = new THREE.Matrix4().makeRotationY(Math.PI);
/** T = M_đích · R_y(π) · M_nguồn⁻¹ — cổng tĩnh → tính một lần cho mỗi cổng */
const XFORM = new Map<string, THREE.Matrix4>();
function portalTransform(src: Portal, dst: Portal): THREE.Matrix4 {
  let T = XFORM.get(src.id);
  if (!T) XFORM.set(src.id, (T = portalMatrix(dst).multiply(FLIP).multiply(portalMatrix(src).invert())));
  return T;
}
/** ma trận đặt mặt cổng live (lệch 3,5 cm ra trước mặt cổng, co theo bán kính) — cũng tĩnh */
const FACE_M = new Map<string, THREE.Matrix4>();
function liveFaceMatrix(p: Portal): THREE.Matrix4 {
  let M = FACE_M.get(p.id);
  if (!M) FACE_M.set(p.id, (M = portalMatrix(p, 0.035).multiply(new THREE.Matrix4().makeScale(p.rx, p.ry, 1))));
  return M;
}
const PAIR_INDEX: Record<string, number> = Object.fromEntries(Object.keys(PAIRS).map((k, i) => [k, i]));
/** độ mở hình của từng cổng (0…1 vẽ vành bằng epicycle, 1…2 mặt xoáy nở, 2 = mở hẳn) — chỉ HÌNH */
export const PORTAL_OPEN = new Float32Array(PORTALS.length);
/** người chơi trong bán kính này thì cổng bắt đầu "tự vẽ" (một lần mỗi lần vào màn) */
const OPEN_NEAR = 30;

const SWIRL = /* glsl */ `
float aa(float x, float e){ float w = fwidth(x) + 1e-4; return smoothstep(e - w, e + w, x); }
// mặt xoáy cổng: hai dải xoắn ốc ngược chiều, lõi tối, vành răng sò màu cặp
vec4 swirl(vec2 p, float t, vec3 pairCol, float seed){
  float r = length(p);
  float a = atan(p.y, p.x);
  float rim = 0.9 + 0.045 * sin(a * 14.0 + t * 1.5 + seed);
  if (r > rim + 0.06) return vec4(0.0);
  float tw = a * 3.0 + log(r + 0.03) * 6.0 - t * 4.0 + seed;
  float b1 = aa(sin(tw), 0.15);
  float b2 = aa(sin(-a * 2.0 + r * 11.0 - t * 2.3 + seed), 0.55);
  vec3 deep = vec3(0.03, 0.2, 0.12);
  vec3 acid = vec3(0.66, 1.0, 0.33);
  vec3 col = mix(deep, acid * 1.7, b1 * smoothstep(0.05, 0.6, r));
  col = mix(col, vec3(0.92, 1.0, 0.8) * 2.2, b2 * b1 * 0.5);
  // lõi: xoáy sâu tối dần
  col *= 0.35 + 0.65 * smoothstep(0.0, 0.45, r);
  // vành màu cặp + viền mực
  float ring = aa(r, rim - 0.1);
  col = mix(col, pairCol * 1.9, ring);
  col = mix(col, vec3(0.13, 0.09, 0.17), aa(r, rim) );
  float alpha = 1.0 - aa(r, rim + 0.05);
  return vec4(col, alpha);
}`;

/**
 * Cổng "mở" bằng epicycle (nhánh B siren-witch): chuỗi 3 vectơ quay vẽ vành trước, rồi mặt xoáy nở ra như mống mắt.
 * Vành r(θ) = R + A·sin(14θ + φ) viết đúng thành tổng vectơ quay: z(θ) = R·e^{iθ} − (A/2)i·e^{i(15θ+φ)} + (A/2)i·e^{−i(13θ+φ)}.
 * vOpen 0…1 = phần vành đã vẽ, 1…2 = mặt xoáy nở; ≥ 2 = như cũ. Chỉ HÌNH — dịch chuyển không phụ thuộc.
 */
const EPI_RIM = /* glsl */ `
float segD(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
// trả về (vành đã vẽ, cánh tay + vòng epicycle) — mặt nạ 0…1
vec2 epiRim(vec2 p, float t, float seed, float draw, float amp){
  float r = length(p);
  float a = atan(p.y, p.x);
  float phi = t * 1.5 + seed;
  float a0 = 1.5707963;
  float f = fract((a - a0) / 6.2831853);
  float rim = 0.9 + amp * sin(a * 14.0 + phi);
  float w = fwidth(r) * 1.5 + 0.012;
  float line = (1.0 - smoothstep(0.03, 0.03 + w, abs(r - rim))) * step(f, draw);
  float th = a0 + 6.2831853 * draw;
  float h = amp * 0.5;
  vec2 j1 = 0.9 * vec2(cos(th), sin(th));
  float b1 = 15.0 * th + phi;
  vec2 j2 = j1 + h * vec2(sin(b1), -cos(b1));
  float b2 = -(13.0 * th + phi);
  vec2 j3 = j2 + h * vec2(-sin(b2), cos(b2));
  float arms = 1.0 - smoothstep(0.012, 0.012 + w, min(segD(p, vec2(0.0), j1), min(segD(p, j1, j2), segD(p, j2, j3))));
  float circ = 1.0 - smoothstep(0.006, 0.006 + w, min(abs(r - 0.9), min(abs(length(p - j1) - h), abs(length(p - j2) - h))));
  float nib = 1.0 - smoothstep(0.03, 0.06, length(p - j3));
  return vec2(line, max(arms, max(circ * 0.45, nib)) * step(draw, 0.999));
}`;

const FACE_VERT = /* glsl */ `
attribute vec3 aPair;
attribute float aSeed;
attribute float aOpen;
varying vec2 vP;
varying vec3 vPair;
varying float vSeed;
varying float vOpen;
void main(){
  vP = position.xy;
  vPair = aPair;
  vSeed = aSeed;
  vOpen = aOpen;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FACE_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vP;
varying vec3 vPair;
varying float vSeed;
varying float vOpen;
${SWIRL}
${EPI_RIM}
void main(){
  if (vOpen >= 2.0) {
    vec4 s = swirl(vP, uTime, vPair, vSeed);
    if (s.a < 0.5) discard;
    gl_FragColor = vec4(s.rgb, 1.0);
    return;
  }
  float draw = clamp(vOpen, 0.0, 1.0);
  float iris = clamp(vOpen - 1.0, 0.0, 1.0);
  // mống mắt: mặt xoáy nở từ tâm (vành phồng to khi vẽ rồi co về vành thật)
  float ir = iris * iris * (3.0 - 2.0 * iris);
  vec4 s = swirl(vP / max(ir, 0.001), uTime, vPair, vSeed);
  if (ir > 0.001 && s.a >= 0.5) { gl_FragColor = vec4(s.rgb, 1.0); return; }
  vec2 e = epiRim(vP, uTime, vSeed, draw, 0.045 + 0.075 * (1.0 - ir));
  if (max(e.x, e.y) < 0.5) discard;
  vec3 col = e.x > 0.5 ? vPair * 2.4 : vec3(2.2, 1.9, 1.4);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Khung giấy răng sò (vành phẳng có bề dày) — hình học dùng chung, co giãn theo rx, ry từng cổng */
function frameGeometry(): THREE.BufferGeometry {
  const seg = 96;
  const pos: number[] = [];
  const nor: number[] = [];
  const ring = (i: number, rr: number, z: number) => {
    const a = (i / seg) * Math.PI * 2;
    return [Math.cos(a) * rr, Math.sin(a) * rr, z] as V3;
  };
  const push = (vs: V3[], n: V3) => {
    for (const v of vs) {
      pos.push(...v);
      nor.push(...n);
    }
  };
  for (let i = 0; i < seg; i++) {
    const outer = (k: number) => 1.18 + 0.07 * Math.cos(((k / seg) * Math.PI * 2) * 12);
    const a0 = ring(i, 0.98, 0.06);
    const a1 = ring(i + 1, 0.98, 0.06);
    const b0 = ring(i, outer(i), 0.06);
    const b1 = ring(i + 1, outer(i + 1), 0.06);
    push([a0, b0, b1, a0, b1, a1], [0, 0, 1]);
    const c0 = ring(i, outer(i), -0.12);
    const c1 = ring(i + 1, outer(i + 1), -0.12);
    const ang = ((i + 0.5) / seg) * Math.PI * 2;
    push([b0, c0, c1, b0, c1, b1], [Math.cos(ang), Math.sin(ang), 0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function PortalSurfaces({ group }: { group: React.RefObject<THREE.Group | null> }) {
  const { faces, frames, faceMat } = useMemo(() => {
    const n = PORTALS.length;
    const geo = new THREE.CircleGeometry(1, 48);
    const pairCol = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    const col = new THREE.Color();
    const faceMat = new THREE.ShaderMaterial({ vertexShader: FACE_VERT, fragmentShader: FACE_FRAG, uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide, toneMapped: false });
    const faces = new THREE.InstancedMesh(geo, faceMat, n);
    const frameMat = new THREE.MeshToonMaterial({ color: "#ffffff" });
    const frames = new THREE.InstancedMesh(frameGeometry(), frameMat, n);
    const S = new THREE.Matrix4();
    PORTALS.forEach((p, i) => {
      S.makeScale(p.rx, p.ry, 1);
      faces.setMatrixAt(i, portalMatrix(p, 0.02).multiply(S));
      frames.setMatrixAt(i, portalMatrix(p, 0.02).multiply(S));
      col.set(PAIRS[p.pair].color);
      pairCol.set([col.r, col.g, col.b], i * 3);
      frames.setColorAt(i, col);
      seeds[i] = i * 1.7;
    });
    geo.setAttribute("aPair", new THREE.InstancedBufferAttribute(pairCol, 3));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    PORTAL_OPEN.fill(0);
    geo.setAttribute("aOpen", new THREE.InstancedBufferAttribute(PORTAL_OPEN, 1).setUsage(THREE.DynamicDrawUsage));
    faces.frustumCulled = false;
    frames.frustumCulled = false;
    return { faces, frames, faceMat };
  }, []);
  useEffect(
    () => () => {
      faces.geometry.dispose();
      frames.geometry.dispose();
      faceMat.dispose();
      (frames.material as THREE.Material).dispose();
    },
    [faces, frames, faceMat],
  );
  useFrame((_, dt) => {
    faceMat.uniforms.uTime.value += dt;
    // mở cổng khi người chơi tới gần: vẽ vành 1,3 s rồi mống mắt nở 0,6 s; đã mở thì giữ nguyên
    const pl = useWorld.getState().player;
    const h = Math.min(dt, 0.1);
    let dirty = false;
    for (let i = 0; i < PORTALS.length; i++) {
      const o = PORTAL_OPEN[i];
      if (o >= 2) continue;
      const c = PORTALS[i].c;
      if (o === 0 && Math.hypot(pl.x - c[0], pl.y - c[1], pl.z - c[2]) > OPEN_NEAR) continue;
      PORTAL_OPEN[i] = Math.min(2, o + (o < 1 ? h / 1.3 : h / 0.6));
      dirty = true;
    }
    if (dirty) (faces.geometry.getAttribute("aOpen") as THREE.InstancedBufferAttribute).needsUpdate = true;
  });
  return (
    <group ref={group} name="perf:portals">
      <primitive object={faces} />
      <primitive object={frames} />
      <PortalViews hide={group} />
    </group>
  );
}

// ───────────── Nhìn xuyên cổng (render-to-texture) ─────────────
const LIVE_FRAG = /* glsl */ `
uniform sampler2D tView;
uniform vec4 uRect;   // hình chữ nhật cổng lúc chụp (toạ độ chuẩn hoá 0..1 của khung nhìn)
uniform vec4 uVp;     // khung nhìn đang vẽ (px)
uniform float uTime;
uniform vec3 uPair;
uniform float uSeed;
uniform float uFade;
varying vec2 vP;
${SWIRL}
void main(){
  vec4 s = swirl(vP, uTime, uPair, uSeed);
  if (s.a < 0.5) discard;
  vec2 sp = (gl_FragCoord.xy - uVp.xy) / uVp.zw;
  vec2 uv = clamp((sp - uRect.xy) / uRect.zw, 0.0, 1.0);
  vec3 view = texture2D(tView, uv).rgb;
  float r = length(vP);
  // giữa: cảnh phía bên kia; mép: xoáy năng lượng
  float k = smoothstep(0.62, 0.86, r);
  vec3 col = mix(view, s.rgb, max(k, 1.0 - uFade));
  gl_FragColor = vec4(col, 1.0);
}`;
const LIVE_VERT = /* glsl */ `
varying vec2 vP;
void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface Slot {
  rt: THREE.WebGLRenderTarget;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  portal: Portal | null;
  at: number;
  fade: number;
}

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();
const SPHERE = new THREE.Sphere();
const FRUSTUM = new THREE.Frustum();
const PV = new THREE.Matrix4();
const PLANE = new THREE.Plane();
const CLIP = new THREE.Vector4();
const Q4 = new THREE.Vector4();
const INV = new THREE.Matrix4();
const DST_C = new THREE.Vector3();

/** Mặt phẳng gần xiên (Lengyel): cắt mọi thứ phía sau mặt cổng đích khỏi khung nhìn ảo */
function obliqueClip(cam: THREE.PerspectiveCamera, n: THREE.Vector3, c: THREE.Vector3): boolean {
  PLANE.setFromNormalAndCoplanarPoint(n, TMP2.copy(c).addScaledVector(n, 0.01)).applyMatrix4(cam.matrixWorldInverse);
  CLIP.set(PLANE.normal.x, PLANE.normal.y, PLANE.normal.z, PLANE.constant);
  if (CLIP.w >= -1e-4) return false;
  const P = cam.projectionMatrix;
  Q4.set(Math.sign(CLIP.x), Math.sign(CLIP.y), 1, 1).applyMatrix4(INV.copy(P).invert());
  const d = CLIP.dot(Q4);
  if (!Number.isFinite(d) || d <= 1e-6) return false;
  CLIP.multiplyScalar(2 / d);
  const e = P.elements;
  e[2] = CLIP.x - e[3];
  e[6] = CLIP.y - e[7];
  e[10] = CLIP.z - e[11];
  e[14] = CLIP.w - e[15];
  cam.projectionMatrixInverse.copy(P).invert();
  return true;
}

function PortalViews({ hide }: { hide: React.RefObject<THREE.Group | null> }) {
  const { gl, scene, camera } = useThree();
  const quality = useWorld((s) => s.quality);
  const refl = useGfx((s) => s.reflections);
  const count = portalSlots(quality, refl);
  const period = portalPeriodMs(quality);
  const size = quality === "high" ? 512 : 320;
  const slots = useMemo<Slot[]>(() => {
    const geo = new THREE.CircleGeometry(1, 48);
    return Array.from({ length: count }, () => {
      const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false });
      const mat = new THREE.ShaderMaterial({
        vertexShader: LIVE_VERT,
        fragmentShader: LIVE_FRAG,
        uniforms: { tView: { value: rt.texture }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uVp: { value: new THREE.Vector4(0, 0, 1, 1) }, uTime: { value: 0 }, uPair: { value: new THREE.Color() }, uSeed: { value: 0 }, uFade: { value: 0 } },
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      mesh.onBeforeRender = (r) => {
        r.getCurrentViewport(mat.uniforms.uVp.value);
      };
      return { rt, mesh, mat, portal: null, at: 0, fade: 0 };
    });
  }, [count, size]);
  useEffect(
    () => () => {
      for (const s of slots) {
        s.rt.dispose();
        s.mat.dispose();
      }
      slots[0]?.mesh.geometry.dispose();
    },
    [slots],
  );
  const vcam = useMemo(() => new THREE.PerspectiveCamera(), []);
  const buf = useMemo(() => new THREE.Vector2(), []);

  // chạy sau Player (máy quay đã đặt) và trước EffectComposer (ưu tiên 1)
  useFrame((_, dt) => {
    if (!slots.length) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.updateMatrixWorld();
    PV.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    FRUSTUM.setFromProjectionMatrix(PV);
    // chọn cổng: gần, trong khung nhìn, quay mặt về máy quay
    const cands: { p: Portal; d: number }[] = [];
    for (let pi = 0; pi < PORTALS.length; pi++) {
      const p = PORTALS[pi];
      if (PORTAL_OPEN[pi] < 1.9) continue; // cổng chưa mở xong (đang tự vẽ bằng epicycle) — chưa nhìn xuyên
      TMP.set(p.c[0], p.c[1], p.c[2]);
      const d = TMP.distanceTo(cam.position);
      if (d > 45) continue;
      const facing = (cam.position.x - p.c[0]) * p.n[0] + (cam.position.y - p.c[1]) * p.n[1] + (cam.position.z - p.c[2]) * p.n[2];
      if (facing <= 0.05) continue;
      SPHERE.set(TMP, Math.max(p.rx, p.ry) * 1.2);
      if (!FRUSTUM.intersectsSphere(SPHERE)) continue;
      cands.push({ p, d });
    }
    cands.sort((a, b) => a.d - b.d);
    const want = cands.slice(0, slots.length).map((c) => c.p);
    // giữ cổng cũ trong ô cũ (tránh nháy)
    for (const s of slots) if (s.portal && !want.includes(s.portal)) s.portal = null;
    for (const p of want) if (!slots.some((s) => s.portal === p)) {
      const free = slots.find((s) => !s.portal);
      if (free) {
        free.portal = p;
        free.at = 0;
        free.fade = 0;
      }
    }
    const now = performance.now();
    gl.getDrawingBufferSize(buf);
    for (const s of slots) {
      s.mat.uniforms.uTime.value += dt;
      const p = s.portal;
      s.mesh.visible = !!p;
      if (!p) continue;
      s.mesh.matrix.copy(liveFaceMatrix(p));
      s.mesh.matrixWorld.copy(s.mesh.matrix);
      (s.mat.uniforms.uPair.value as THREE.Color).set(PAIRS[p.pair].color);
      s.mat.uniforms.uSeed.value = PORTALS.indexOf(p) * 1.7;
    }
    // tối đa MỘT lượt vẽ cảnh phụ mỗi khung: ô đến hạn lâu chưa vẽ nhất; ô không vẽ được (khung quá nhỏ…) nhường ô kế
    for (const si of portalPassOrder(slots.map((s) => ({ active: !!s.portal, at: s.at })), now, period)) {
      const s = slots[si];
      const p = s.portal!;
      // hình chữ nhật cổng trên màn hình
      const b = basis(p);
      let x0 = 1;
      let y0 = 1;
      let x1 = 0;
      let y1 = 0;
      let behind = false;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const ca = Math.cos(a) * p.rx * 1.05;
        const sa = Math.sin(a) * p.ry * 1.05;
        TMP.set(p.c[0] + b.r[0] * ca + b.u[0] * sa, p.c[1] + b.r[1] * ca + b.u[1] * sa, p.c[2] + b.r[2] * ca + b.u[2] * sa);
        Q4.set(TMP.x, TMP.y, TMP.z, 1).applyMatrix4(PV);
        if (Q4.w <= 0.01) {
          behind = true;
          break;
        }
        const sx = (Q4.x / Q4.w) * 0.5 + 0.5;
        const sy = (Q4.y / Q4.w) * 0.5 + 0.5;
        x0 = Math.min(x0, sx);
        y0 = Math.min(y0, sy);
        x1 = Math.max(x1, sx);
        y1 = Math.max(y1, sy);
      }
      if (behind) {
        x0 = 0;
        y0 = 0;
        x1 = 1;
        y1 = 1;
      }
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(1, x1);
      y1 = Math.min(1, y1);
      if (x1 - x0 < 0.004 || y1 - y0 < 0.004) continue;
      // máy quay ảo
      const dst = PORTAL_BY_ID[p.to];
      const T = portalTransform(p, dst);
      vcam.matrixAutoUpdate = false;
      vcam.matrix.multiplyMatrices(T, cam.matrixWorld);
      vcam.matrixWorld.copy(vcam.matrix);
      vcam.matrixWorldInverse.copy(vcam.matrixWorld).invert();
      vcam.matrix.decompose(vcam.position, vcam.quaternion, vcam.scale);
      vcam.fov = cam.fov;
      vcam.aspect = cam.aspect;
      vcam.near = cam.near;
      vcam.far = cam.far;
      vcam.layers.mask = cam.layers.mask;
      vcam.setViewOffset(buf.x, buf.y, x0 * buf.x, (1 - y1) * buf.y, (x1 - x0) * buf.x, (y1 - y0) * buf.y);
      vcam.updateProjectionMatrix();
      if (!obliqueClip(vcam, TMP.set(dst.n[0], dst.n[1], dst.n[2]), DST_C.set(dst.c[0], dst.c[1], dst.c[2]))) continue;
      // vẽ (ẩn mọi cổng để không đệ quy; không cập nhật bóng đổ)
      const prevRt = gl.getRenderTarget();
      const shadowAuto = gl.shadowMap.autoUpdate;
      const shadowNeeds = gl.shadowMap.needsUpdate;
      const autoClear = gl.autoClear;
      const vis = hide.current?.visible ?? true;
      if (hide.current) hide.current.visible = false;
      try {
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = false;
        gl.autoClear = true;
        gl.setRenderTarget(s.rt);
        gl.render(scene, vcam);
      } finally {
        gl.setRenderTarget(prevRt);
        gl.autoClear = autoClear;
        gl.shadowMap.autoUpdate = shadowAuto;
        gl.shadowMap.needsUpdate = shadowNeeds;
        if (hide.current) hide.current.visible = vis;
      }
      (s.mat.uniforms.uRect.value as THREE.Vector4).set(x0, y0, x1 - x0, y1 - y0);
      s.at = now;
      // mờ dần vào trong ~3 lần vẽ (giữ cùng cảm giác khi nhịp vẽ thấp hơn)
      s.fade = Math.min(1, s.fade + 0.34);
      s.mat.uniforms.uFade.value = s.fade;
      break;
    }
  }, 0.5);
  return (
    <>
      {slots.map((s, i) => (
        <primitive key={i} object={s.mesh} />
      ))}
    </>
  );
}

// ───────────── Bộ điều khiển dịch chuyển (chạy sau Player mỗi khung) ─────────────

/** Đà ngang sau cú bắn (cổng, lỗ sâu, rời hành tinh…) — mượn kênh lướt của Player (dashDir / dashSpeed / dashUntil) */
const LAUNCH = { dir: new THREE.Vector3(), speed: 0, until: 0, last: new THREE.Vector3() };
/** Giao vận tốc ngang (vx, vz) cho người chơi: đang bay lượn → FLIGHT.vel; không thì trượt / bay theo quán tính */
export function carryHorizontal(vx: number, vz: number) {
  const hs = Math.hypot(vx, vz);
  const now = performance.now();
  if (FLIGHT.enabled && motion.gliding) FLIGHT.vel.set(vx, 0, vz);
  else if (hs > 1.2) {
    LAUNCH.dir.set(vx / hs, 0, vz / hs);
    LAUNCH.speed = hs;
    LAUNCH.until = now + 80;
    LAUNCH.last.copy(useWorld.getState().player);
    motion.dashDir.copy(LAUNCH.dir);
    motion.dashSpeed = hs;
    motion.dashUntil = LAUNCH.until;
  } else LAUNCH.speed = 0;
}

export function usePortalDriver() {
  const st = useRef({ prev: new THREE.Vector3(), init: false, lock: "" as string, lockAt: 0, cool: 0, wraps: 0, launch: LAUNCH });
  useEffect(() => {
    st.current.init = false;
    return () => {
      FLIGHT.enabled = false;
      useFlight.setState({ soaring: false, enabled: false });
      setWind(0);
    };
  }, []);
  useFrame((_, rawDt) => {
    const S = st.current;
    const w = useWorld.getState();
    const p = w.player;
    const now = performance.now();
    const dt = Math.max(1e-3, Math.min(0.05, rawDt) * timeScale());
    // bay lượn: mọi nơi trừ vùng trời thấp của đấu trường (giữ trận boss như cũ)
    // đồ thị khu (giai đoạn 2): ở khu khác hub thì không bay lượn (câu đố đi bộ), không quấn biên / đáy (khu tự lo rơi)
    const inHubZone = zoneAtWorld(p.x, p.z) === "hub";
    const inArena = (Math.hypot(p.x, p.z) < ARENA_R + 1.5 && p.y < 14) || !inHubZone;
    if (FLIGHT.enabled === inArena) useFlight.setState({ enabled: !inArena });
    FLIGHT.enabled = !inArena;
    if (motion.vy < -TERMINAL) motion.vy = -TERMINAL;
    if (motion.grounded) S.wraps = 0;
    const cur = new THREE.Vector3(p.x, p.y + BODY, p.z);
    if (!S.init) {
      S.init = true;
      S.prev.copy(cur);
      S.launch.last.copy(p);
      return;
    }
    const shift = new THREE.Vector3();
    // ── giữ đà ngang sau cú bắn (dùng kênh lướt của Player: dashDir / dashSpeed / dashUntil)
    const L = S.launch;
    if (L.speed > 0) {
      const overridden = motion.dashUntil !== L.until;
      const stalled = Math.hypot(p.x - L.last.x, p.z - L.last.z) < L.speed * dt * 0.2;
      if (overridden || stalled || (FLIGHT.enabled && motion.gliding)) {
        if (FLIGHT.enabled && motion.gliding && !overridden) FLIGHT.vel.copy(L.dir).multiplyScalar(L.speed);
        L.speed = 0;
        if (!overridden) motion.dashUntil = 0;
      } else {
        L.speed *= Math.exp(-(motion.grounded ? DRAG_GROUND : DRAG_AIR) * dt);
        if (L.speed < 1.2) {
          L.speed = 0;
          motion.dashUntil = 0;
        } else {
          motion.dashDir.copy(L.dir);
          motion.dashSpeed = L.speed;
          L.until = now + 80;
          motion.dashUntil = L.until;
        }
      }
    }
    L.last.copy(p);
    // ── cổng
    if (S.lock) {
      const lp = PORTAL_BY_ID[S.lock];
      const l = toLocal(lp, [cur.x, cur.y, cur.z]);
      if (l[2] > REARM || !inAperture(lp, l[0], l[1], 1.6) || now - S.lockAt > 2500) S.lock = "";
    }
    if (now > S.cool && GF.st.mode === "world") {
      const a: V3 = [S.prev.x, S.prev.y, S.prev.z];
      const b: V3 = [cur.x, cur.y, cur.z];
      for (const src of PORTALS) {
        if (src.id === S.lock) continue;
        const hit = crossing(src, a, b);
        if (!hit) continue;
        const dst = PORTAL_BY_ID[src.to];
        const v: V3 = [(cur.x - S.prev.x) / dt, motion.vy, (cur.z - S.prev.z) / dt];
        const r = traverse(src, dst, hit, v);
        const yaw = mapCamYaw(src, dst, w.camYaw, r.vel);
        const old = p.clone();
        p.set(r.pos[0], r.pos[1] - BODY, r.pos[2]);
        shift.add(TMP.subVectors(p, old));
        motion.vy = r.vel[1];
        motion.grounded = false;
        motion.plunging = false;
        const hs = Math.hypot(r.vel[0], r.vel[2]);
        carryHorizontal(r.vel[0], r.vel[2]);
        const playerYaw = hs > 0.5 ? Math.atan2(r.vel[0], r.vel[2]) : w.playerYaw + (yaw - w.camYaw);
        useWorld.setState({ camYaw: yaw, playerYaw });
        S.lock = dst.id;
        S.lockAt = now;
        S.cool = now + 90;
        // hiệu ứng: vòng loé màu cặp ở cổng đích + hoạ âm bậc theo cặp
        const col = PAIRS[src.pair].color;
        // tới cổng đích: lá sáng dạng mống mắt (màu cặp cổng) xoay mở
        strike("iris", dst.c[0], dst.c[1], dst.c[2], { r: 1.6, color: col });
        addFx("spark", p.clone().setY(p.y + 1), { color: "#a8ff54", size: 1.2 });
        sfx.harmonic(2 + PAIR_INDEX[src.pair]);
        synth.whoosh(380 + 90 * PAIR_INDEX[src.pair], 620 + 120 * PAIR_INDEX[src.pair], 0.5, Math.min(1, 0.4 + Math.hypot(...r.vel) / 20));
        w.addShake(0.12);
        break;
      }
    }
    // ── trọng lực kỳ dị sau khi Player di chuyển: đệm nảy, lỗ sâu, hố đen…
    gravityAfterPlayer(dt, S.prev, cur, shift);
    // ── lỗ hổng vòng lặp: đáy ↔ trời
    const dy = inHubZone ? wrapY(p.y) : 0;
    if (dy) {
      p.y += dy;
      shift.y += dy;
      S.wraps++;
      // rơi vòng lặp quá 3 lần trên vực → kéo về phía trên mặt đất gần nhất (vẫn rơi từ trời xuống)
      if (S.wraps >= 3 && mazeGround(p.x, p.z, 1e4) === VOID) {
        const [lx, lz] = nearestLanding(p.x, p.z);
        shift.x += lx - p.x;
        shift.z += lz - p.z;
        p.x = lx;
        p.z = lz;
        S.wraps = 0;
      }
      sfx.circle();
    }
    // ── màn sân khấu: bước ra phía đối tâm
    const wx = inHubZone ? wrapXZ(p.x, p.z) : null;
    if (wx) {
      shift.x += wx[0] - p.x;
      shift.z += wx[1] - p.z;
      p.x = wx[0];
      p.z = wx[1];
      // bước qua mép sân khấu: khung cổng trực giao dựng ở chỗ hiện ra
      strike("gate", p.x, p.y, p.z, { r: 2, yaw: useWorld.getState().playerYaw, color: "#ff64b0" });
      sfx.circle();
    }
    if (GF.st.mode !== "world") L.speed = 0;
    if (shift.lengthSq() > 0) CAM.shift = (CAM.shift ?? new THREE.Vector3()).add(shift);
    S.prev.set(p.x, p.y + BODY, p.z);
  }, 0.25);
}
