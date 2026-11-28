"use client";
/**
 * Nhánh W — "mặt trời" đĩa than khổng lồ có cần kim máy hát cào (Blender: blender-src/siren-src → public/world/siren/vinyl_sun.glb).
 * Vênh tỉ lệ: kim máy hát to hơn cả mê cung, treo giữa trời; loa kèn hoa loa kèn mọc sau đĩa "lắng nghe".
 *  - Đĩa quay KHOÁ NHỊP (1 vòng / ô nhịp 96 BPM, recordAngle), rãnh + vệt bóng dị hướng vẽ trong shader (không texture).
 *    Nhãn đĩa in sóng vuông Fourier Σ sin((2k+1)x)/(2k+1) với số hoạ âm còn sống → phân rã thấy sóng vuông mòn thành sin.
 *  - Cần kim: lò xo (springStep) đuổi theo needleTarget — trôi vào rãnh trong theo ô nhịp, gõ nhẹ mỗi phách,
 *    bất hoà → nhảy rãnh / cào theo stop-motion 8 Hz; đĩa vênh (warp) theo bất hoà.
 *  - Loa kèn "thở" theo phách bằng lò xo; phân rã → cần / loa tối dần thành bóng giấy.
 * Gộp mọi vật liệu thành màu đỉnh lúc tải → 3 lệnh vẽ (đĩa, cần, đế + loa). Không cấp phát mỗi khung.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { needleTarget, recordAngle } from "@/lib/world/sirenWorld";
import { worldAsset } from "@/lib/world/avatars";
import { GRADIENT } from "../../fx/shaders";
import { reduceMotion } from "./SirenGravity";

const VINYL_GLB = worldAsset("siren/vinyl_sun.glb");
useGLTF.preload(VINYL_GLB);

/** vị trí so với máy quay (bám 0,9 → gần như cố định trên trời, thị sai rất nhẹ) và cỡ (bán kính đĩa, m) */
const FOLLOW = 0.9;
const OFFSET = new THREE.Vector3(-150, 120, -215);
const SCALE = 46;

/** gộp mọi mesh con của một nút thành một hình học có màu đỉnh = màu vật liệu (trong hệ toạ độ của nút) */
function bake(node: THREE.Object3D): THREE.BufferGeometry | null {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  node.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const g = m.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    // glb_slim bỏ NORMAL của vật liệu glow_* → tự tính để mọi phần cùng bộ thuộc tính (mergeGeometries đòi hỏi)
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    // glow_* (đầu kim): sáng hơn hẳn
    const c = mat.color.clone().multiplyScalar(mat.name.startsWith("glow_") ? 1.6 : 1);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  });
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

const RECORD_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vCol;
varying vec2 vP;
varying float vFront;
void main(){
  vCol = color;
  vP = position.xy;
  vFront = normal.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RECORD_FRAG = /* glsl */ `
uniform float uRot, uHarm, uDecomp, uBeatPhase;
varying vec3 vCol;
varying vec2 vP;
varying float vFront;
const vec3 C_VOID = vec3(0.094, 0.082, 0.122);
const vec3 C_IVORY = vec3(0.875, 0.831, 0.71);
float aaLine(float d, float w){ float f = fwidth(d) + 1e-5; return 1.0 - smoothstep(w - f, w + f, abs(d)); }
void main(){
  float r = length(vP);
  float a = atan(vP.y, vP.x);
  vec3 c = vCol;
  bool label = vCol.r > 0.2 && vCol.g < 0.15;
  bool vinyl = vCol.r < 0.08 && vCol.g < 0.08;
  if (vinyl && vFront > 0.5 && r > 0.34 && r < 0.985) {
    // rãnh xoắn + khoảng lặng giữa các "bài" (số bài = số hoạ âm còn sống)
    float g = 0.5 + 0.5 * sin(r * 520.0 + a * 0.5);
    float tracks = fract((r - 0.36) / 0.62 * uHarm);
    float gap = aaLine(tracks - 0.5, 0.015) * step(1.5, uHarm);
    // vệt bóng dị hướng: đứng yên theo ánh sáng trong khi đĩa quay (góc thế giới = a + uRot)
    float aw = a + uRot;
    float sheen = pow(abs(cos(aw - 0.9)), 40.0) * (0.55 + 0.45 * g);
    c = mix(vec3(0.05, 0.045, 0.07), vec3(0.11, 0.1, 0.14), g * 0.6);
    c += sheen * vec3(0.55, 0.5, 0.62) + pow(abs(cos(aw + 2.2)), 60.0) * vec3(0.25, 0.32, 0.36) * g;
    c = mix(c, vec3(0.02), gap * 0.8);
  } else if (label && vFront > 0.5) {
    // nhãn son: hai vòng in ngà + sóng vuông Fourier (rút gọn theo số hoạ âm) quanh nhãn
    float x = a * 3.0;
    float sq = 0.0;
    for (int k = 0; k < 8; k++) {
      if (float(k) >= uHarm) break;
      float n = float(2 * k + 1);
      sq += sin(n * x) / n;
    }
    sq *= 1.2732395;
    float wave = aaLine(r - (0.24 + 0.035 * sq), 0.006);
    float rings = aaLine(r - 0.305, 0.005) + aaLine(r - 0.12, 0.004);
    c = mix(c, C_IVORY, clamp(wave + rings, 0.0, 1.0));
    // nhịp: nhãn loé rất nhẹ đầu phách
    c *= 1.0 + 0.25 * pow(1.0 - uBeatPhase, 6.0);
  } else {
    c *= 0.7 + 0.3 * max(vFront, 0.0);
  }
  // phân rã: mất màu, rồi chìm vào bóng giấy
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), uDecomp);
  c = mix(c, C_VOID * 1.4, smoothstep(0.6, 1.0, uDecomp) * 0.7);
  gl_FragColor = vec4(c, 1.0);
}`;

export function VinylSun() {
  const gltf = useGLTF(VINYL_GLB);
  const built = useMemo(() => {
    const root = gltf.scene.getObjectByName("sw_sun") ?? gltf.scene;
    const get = (n: string) => root.getObjectByName(n);
    const rec = get("sw_record");
    const arm = get("sw_arm");
    const base = get("sw_armbase");
    const horn = get("sw_horn");
    if (!rec || !arm || !base || !horn) return null;
    const recGeo = bake(rec);
    const armGeo = bake(arm);
    const baseGeo = bake(base);
    const hornGeo = bake(horn);
    if (!recGeo || !armGeo || !baseGeo || !hornGeo) return null;
    // đế + loa: cùng một lệnh vẽ (đặt loa vào hệ toạ độ đĩa); loa thở bằng scale riêng → giữ tách? gộp đế vào loa (đế đứng yên)
    baseGeo.translate(base.position.x, base.position.y, base.position.z);
    const recMat = new THREE.ShaderMaterial({
      vertexShader: RECORD_VERT,
      fragmentShader: RECORD_FRAG,
      uniforms: { uRot: { value: 0 }, uHarm: { value: 8 }, uDecomp: { value: 0 }, uBeatPhase: { value: 0 } },
      fog: false,
      toneMapped: false,
    });
    const toon = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, fog: false });
    return {
      recGeo,
      armGeo,
      baseGeo,
      hornGeo,
      recMat,
      armMat: toon(),
      hornMat: toon(),
      armAt: arm.position.clone(),
      hornAt: horn.position.clone(),
    };
  }, [gltf]);
  useEffect(
    () => () => {
      if (!built) return;
      [built.recGeo, built.armGeo, built.baseGeo, built.hornGeo].forEach((g) => g.dispose());
      [built.recMat, built.armMat, built.hornMat].forEach((m) => m.dispose());
    },
    [built],
  );
  const group = useRef<THREE.Group>(null);
  const record = useRef<THREE.Mesh>(null);
  const arm = useRef<THREE.Mesh>(null);
  const horn = useRef<THREE.Mesh>(null);
  const armSpring = useRef<Spring>({ x: -0.17, v: 0 });
  const hornSpring = useRef<Spring>({ x: 1, v: 0 });
  const lastBeat = useRef(-1);
  const calm = useMemo(() => reduceMotion(), []);
  const face = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), OFFSET.clone().negate().normalize()), []);
  const tint = useMemo(() => new THREE.Color(), []);
  useFrame(({ camera }, dt) => {
    const g = group.current;
    if (!g || !built) return;
    const H = HARMONIC;
    g.position.copy(camera.position).multiplyScalar(FOLLOW).add(OFFSET);
    g.quaternion.copy(face);
    if (record.current) {
      const rot = recordAngle(H.beat);
      record.current.rotation.set(calm ? 0 : Math.sin(H.beat * Math.PI * 0.5) * 0.05 * H.dissonance, 0, rot);
      const u = built.recMat.uniforms;
      u.uRot.value = rot;
      u.uHarm.value = 1 + 7 * (1 - H.decomposition);
      u.uDecomp.value = H.decomposition;
      u.uBeatPhase.value = H.beatPhase;
    }
    // cần kim: lò xo hơi nảy (ζ 0,35) → vượt đích rồi rung khi nhảy rãnh
    const target = needleTarget(H.beat, H.stopTime, calm ? 0 : H.dissonance);
    springStep(armSpring.current, target, 16, 0.35, dt);
    if (arm.current) {
      arm.current.rotation.z = armSpring.current.x;
      // nhấc kim khi cào (bất hoà)
      arm.current.rotation.x = calm ? 0 : -Math.abs(armSpring.current.v) * 0.04;
    }
    // loa thở: mỗi phách đá lò xo một cái
    const beatN = Math.floor(H.beat);
    if (beatN !== lastBeat.current) {
      lastBeat.current = beatN;
      if (!calm) hornSpring.current.v += 0.9;
    }
    springStep(hornSpring.current, 1, 9, 0.28, dt);
    if (horn.current) horn.current.scale.setScalar(hornSpring.current.x);
    // phân rã: cần / loa chìm thành bóng giấy
    tint.setScalar(1 - H.decomposition * 0.82);
    built.armMat.color.copy(tint);
    built.hornMat.color.copy(tint);
  });
  if (!built) return null;
  return (
    <group ref={group} scale={SCALE} name="perf:vinyl">
      <mesh ref={record} geometry={built.recGeo} material={built.recMat} frustumCulled={false} />
      <mesh ref={arm} geometry={built.armGeo} material={built.armMat} position={built.armAt} frustumCulled={false} />
      <mesh geometry={built.baseGeo} material={built.hornMat} frustumCulled={false} />
      <mesh ref={horn} geometry={built.hornGeo} material={built.hornMat} position={built.hornAt} frustumCulled={false} />
    </group>
  );
}
