"use client";
/**
 * Khiên Đường tròn Đơn vị (vẽ vòng tròn) — bong bóng HIỆN SUỐT thời gian khiên còn hiệu lực (combat.ts → ward):
 *  • mở: nảy 0 → 1,12 → 1 trong 0,35 s, lưới lục giác "mọc" từ chân lên (dissolve theo độ cao);
 *  • thân: viền fresnel sáng, lưới lục giác mảnh trên mặt cầu, dải quét sáng chạy dọc, lõi gần trong suốt (thấy nhân vật);
 *  • bị đánh: gợn sóng lan từ phía đòn đánh + loé sáng; còn < 1 s: nhấp nháy báo sắp hết;
 *  • hết: tan rã thành mảnh (dissolve theo nhiễu) 0,4 s.
 * Kèm vòng phép mỏng dưới chân quay chậm. 2 lệnh vẽ, cộng sáng (không ghi depth).
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ward } from "../combat/combat";
import { useWorld } from "../store";

const VS = /* glsl */ `varying vec3 vN; varying vec3 vW; varying vec3 vL;
  void main(){ vL = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = /* glsl */ `uniform vec3 uCol; uniform vec3 uCol2; uniform float uT; uniform float uOpen; uniform float uEnd; uniform float uHit; uniform vec3 uHitDir; uniform float uBlink;
  varying vec3 vN; varying vec3 vW; varying vec3 vL;
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // khoảng cách tới cạnh lưới lục giác (toạ độ 2D)
  float hexEdge(vec2 p){
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hc = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hc.xy * s, p - (hc.zw + 0.5) * s);
    vec2 q = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? h.xy : h.zw;
    q = abs(q);
    return 0.5 - max(dot(q, s * 0.5), q.x);
  }
  void main(){
    vec3 V = normalize(cameraPosition - vW);
    float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.6);
    // toạ độ cầu cho lưới lục giác (kinh độ × vĩ độ)
    float lon = atan(vL.z, vL.x);
    float lat = asin(clamp(vL.y, -1.0, 1.0));
    vec2 uv = vec2(lon * 3.2, lat * 3.6);
    float e = hexEdge(uv);
    float grid = 1.0 - smoothstep(0.02, 0.06, e);
    // mọc từ chân lên khi mở; tan rã theo nhiễu khi hết
    float rise = smoothstep(uOpen * 2.4 - 1.2 - 0.15, uOpen * 2.4 - 1.2, vL.y) ;
    float n = h1(floor(uv * 1.0));
    float gone = step(n, uEnd);
    // dải quét sáng chạy lên xuống
    float band = exp(-pow((vL.y - sin(uT * 1.3) * 0.9) * 6.0, 2.0));
    // gợn sóng tại phía bị đánh
    float hd = acos(clamp(dot(vL, normalize(uHitDir)), -1.0, 1.0));
    float ring = exp(-pow((hd - uHit * 2.4) * 7.0, 2.0)) * (1.0 - uHit);
    float a = fr * 0.85 + grid * (0.09 + 0.22 * fr) + band * 0.12 * (0.4 + grid) + ring * 0.9;
    a *= (1.0 - rise) * (1.0 - gone) * uBlink;
    vec3 col = mix(uCol, uCol2, grid * 0.6 + ring * 0.5) * (1.0 + ring * 1.5);
    if (a < 0.003) discard;
    gl_FragColor = vec4(col * a, 1.0);
  }`;

const RING_FS = /* glsl */ `uniform vec3 uCol; uniform float uT; uniform float uK; varying vec2 vUv;
  void main(){
    vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
    float rim = exp(-pow((r - 0.92) * 40.0, 2.0)) + 0.6 * exp(-pow((r - 0.78) * 60.0, 2.0));
    float ticks = step(0.55, fract(a * 6.0 / 3.14159 + uT * 0.3)) * exp(-pow((r - 0.85) * 30.0, 2.0)) * 0.8;
    float glow = smoothstep(1.0, 0.3, r) * 0.08;
    float f = (rim + ticks + glow) * uK;
    if (f < 0.004) discard;
    gl_FragColor = vec4(uCol * f, 1.0);
  }`;

export function Ward() {
  const { bubble, ring } = useMemo(() => {
    const bubble = new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Color("#7fd8ff").multiplyScalar(1.6) },
        uCol2: { value: new THREE.Color("#fff2c4").multiplyScalar(1.8) },
        uT: { value: 0 },
        uOpen: { value: 0 },
        uEnd: { value: 0 },
        uHit: { value: 1 },
        uHitDir: { value: new THREE.Vector3(0, 0, 1) },
        uBlink: { value: 1 },
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color("#8fe3ff").multiplyScalar(2) }, uT: { value: 0 }, uK: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: RING_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { bubble, ring };
  }, []);
  const g = useRef<THREE.Group>(null);
  const r = useRef<THREE.Mesh>(null);
  const warm = useRef(0);
  useFrame((state) => {
    // 2 khung đầu: hiện trong suốt để biên dịch shader sẵn (không khựng lúc niệm phép lần đầu)
    if (warm.current < 2) {
      warm.current++;
      if (g.current) g.current.visible = true;
      if (r.current) r.current.visible = true;
      bubble.uniforms.uBlink.value = 0;
      ring.uniforms.uK.value = 0;
      return;
    }
    const now = performance.now();
    const t = state.clock.elapsedTime;
    const active = now < ward.until;
    const sinceEnd = now - ward.until;
    const vis = active || sinceEnd < 400;
    if (g.current) g.current.visible = vis;
    if (r.current) r.current.visible = vis;
    if (!vis) return;
    const p = useWorld.getState().player;
    const age = (now - ward.born) / 1000;
    // mở nảy: 0 → 1,12 → 1
    const o = Math.min(1, age / 0.35);
    const pop = o < 1 ? Math.sin(o * Math.PI * 0.5) * 1.12 - Math.sin(o * Math.PI) * 0.12 * o : 1;
    g.current?.position.set(p.x, p.y + 0.95, p.z);
    g.current?.scale.setScalar(1.08 * Math.max(0.05, pop));
    r.current?.position.set(p.x, p.y + 0.04, p.z);
    r.current?.rotation.set(-Math.PI / 2, 0, t * 0.6);
    const U = bubble.uniforms;
    U.uT.value = t;
    U.uOpen.value = Math.min(1, age / 0.45);
    U.uEnd.value = active ? 0 : Math.min(1, sinceEnd / 400);
    U.uHit.value = Math.min(1, (now - ward.hitAt) / 450);
    U.uHitDir.value.copy(ward.hitDir);
    const left = ward.until - now;
    U.uBlink.value = left < 1000 && active ? 0.55 + 0.45 * Math.sin(now / 45) : 1;
    ring.uniforms.uT.value = t;
    ring.uniforms.uK.value = (active ? Math.min(1, age / 0.3) : 1 - U.uEnd.value) * (now - ward.hitAt < 200 ? 1.8 : 1);
  });
  return (
    <>
      <group ref={g} visible={false}>
        <mesh material={bubble} renderOrder={12}>
          <icosahedronGeometry args={[1, 5]} />
        </mesh>
      </group>
      <mesh ref={r} material={ring} visible={false} renderOrder={12}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
    </>
  );
}
