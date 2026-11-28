"use client";
/**
 * Cỗ máy Định lý (màn kết rút gọn): khối hai mươi mặt vỡ lơ lửng; mỗi mặt bay về chỗ theo tiến độ giữ (shader dời từng mặt
 * theo pháp tuyến, 1 lệnh vẽ). N phiến bổ đề quanh bệ; đủ người đứng 3 giây → Định lý phục hồi.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MagicCircle } from "../../fx/Effects";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { GLYPHS, SEAT_COLORS } from "@/lib/world/vault/run";
import { ENGINE_FLOOR_R, FIN_HOLD, plate, type EState } from "@/lib/world/vault/threshold";
import { useVault } from "../vaultClient";

const icoVert = /* glsl */ `
attribute vec3 aCenter;
attribute float aSeed;
uniform float uK;
uniform float uTime;
varying float vSeed;
varying vec3 vN;
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
void main() {
  vSeed = aSeed;
  float k = 1.0 - uK;
  vec3 dir = normalize(aCenter);
  vec3 local = position - aCenter;
  // mặt vỡ: xoay lệch + bay ra theo pháp tuyến, trôi nhẹ
  local = rotY((aSeed - 0.5) * 5.0 * k + sin(uTime + aSeed * 9.0) * 0.2 * k) * local;
  vec3 p = aCenter + local + dir * k * (1.6 + aSeed * 2.4) + vec3(0.0, sin(uTime * 0.8 + aSeed * 7.0) * 0.25 * k, 0.0);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const icoFrag = /* glsl */ `
uniform float uK;
uniform float uTime;
varying float vSeed;
varying vec3 vN;
void main() {
  float l = 0.45 + 0.55 * max(0.0, dot(vN, normalize(vec3(0.4, 0.8, 0.5))));
  vec3 gold = vec3(1.0, 0.8, 0.42);
  vec3 col = mix(vec3(0.35, 0.3, 0.6), gold, uK) * l;
  col += gold * (0.25 + 0.75 * uK) * (0.6 + 0.4 * sin(uTime * 2.0 + vSeed * 20.0)) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

function shardGeometry() {
  const g = new THREE.IcosahedronGeometry(2.4, 0).toNonIndexed();
  const pos = g.attributes.position;
  const centers = new Float32Array(pos.count * 3);
  const seeds = new Float32Array(pos.count);
  for (let f = 0; f < pos.count / 3; f++) {
    const c = new THREE.Vector3();
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(pos, f * 3 + k));
    c.multiplyScalar(1 / 3);
    const sd = (Math.sin(f * 12.9898) * 43758.5453) % 1;
    for (let k = 0; k < 3; k++) {
      centers.set([c.x, c.y, c.z], (f * 3 + k) * 3);
      seeds[f * 3 + k] = Math.abs(sd);
    }
  }
  g.setAttribute("aCenter", new THREE.BufferAttribute(centers, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  g.computeVertexNormals();
  return g;
}

export function FinaleRoom() {
  const n = useVault((s) => s.run?.n ?? 2);
  const occ = useVault((s) => ((s.run?.st as EState | null)?.occ ?? []).join(","));
  const occArr = occ ? occ.split(",").map(Number) : [];
  const shards = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => shardGeometry(), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 }, uTime: { value: 0 } }, vertexShader: icoVert, fragmentShader: icoFrag }), []);
  const floor = useMemo(() => toonMaterial("#2b2550", { rim: "#ffd27a", rimPower: 9 }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
      floor.dispose();
    },
    [geo, mat, floor],
  );
  useFrame((_, dt) => {
    const r = useVault.getState().run;
    const st = r?.st as EState | null;
    const want = r?.phase === "done" || r?.phase === "clear" ? 1 : st ? Math.min(0.92, (st.occ.filter((x) => x >= 0).length / st.occ.length) * 0.5 + (st.hold / FIN_HOLD) * 0.42) : 0;
    mat.uniforms.uK.value += (want - mat.uniforms.uK.value) * (1 - Math.exp(-dt * 2.5));
    mat.uniforms.uTime.value += dt;
    if (shards.current) shards.current.rotation.y += dt * (0.15 + mat.uniforms.uK.value * 0.5);
  });
  return (
    <group>
      <mesh material={floor} position={[0, -0.3, 0]}>
        <cylinderGeometry args={[ENGINE_FLOOR_R + 0.5, ENGINE_FLOOR_R, 0.6, 56]} />
      </mesh>
      <MagicCircle radius={ENGINE_FLOOR_R - 0.8} position={[0, 0.02, 0]} color="#ffd27a" color2="#7fa8ff" intensity={0.4} spin={0.2} />
      <mesh material={floor} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[1.6, 2, 1.2, 24]} />
      </mesh>
      <mesh ref={shards} geometry={geo} material={mat} position={[0, 6, 0]} />
      {Array.from({ length: n }, (_, i) => {
        const [x, z] = plate(n, i);
        const on = (occArr[i] ?? -1) >= 0;
        return (
          <group key={i} position={[x, 0.04, z]}>
            <MagicCircle radius={0.95} color={SEAT_COLORS[i]} color2="#ffffff" intensity={on ? 1.8 : 0.6} spin={on ? 2 : 0.5} />
            <Label3D text={GLYPHS[i]} position={[0, 0.5, 0]} variant="small" maxDist={30} />
          </group>
        );
      })}
      <hemisphereLight args={["#ffe6b8", "#1d1838", 0.85]} />
      <directionalLight position={[8, 16, 10]} intensity={1.4} color="#fff0d0" />
      <pointLight position={[0, 6, 0]} intensity={24} distance={24} color="#ffd27a" decay={1.3} />
    </group>
  );
}
