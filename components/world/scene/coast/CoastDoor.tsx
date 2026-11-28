"use client";
/**
 * Cổng Bờ Sóng ở Quảng trường: vòm đá (CHỖ GIỮ — node Blender `hx_coast_gate` trong coast_props.glb thay thế khi có), mặt cổng là
 * mặt nước nhìn từ trên với hai nguồn sóng giao thoa (vân bụng / nút hyperbol trôi ra ngoài) — đúng công thức của Đầm Giao thoa.
 * Bấm F → lỗ sâu tới vùng "coast". Gắn trong Hub.tsx (vị trí COAST_DOOR ở lib/world/hubLayout.ts).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { COAST_DOOR } from "@/lib/world/hubLayout";
import { MagicCircle } from "../../fx/Effects";
import { useWorld } from "../../store";
import { Label3D } from "../../ui/Labels";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { GlbOr, toon } from "./CoastProps";

const HUB_GATES_GLB = worldAsset("props/hub_gates.glb");

const faceFrag = /* glsl */ `
uniform float uT; varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  vec2 s1 = vec2(-0.28, 0.62), s2 = vec2(0.28, 0.62);
  float r1 = length(p - s1), r2 = length(p - s2);
  float k = 6.2831853 / 0.22;
  float h = sin(k * r1 - uT * 4.0) + sin(k * r2 - uT * 4.0);
  float M = abs(2.0 * cos(k * (r1 - r2) * 0.5));
  vec3 c = mix(vec3(0.06, 0.32, 0.5), vec3(0.16, 0.66, 0.72), 0.5 + 0.25 * h);
  c = mix(c, vec3(0.45, 1.0, 0.9), smoothstep(0.35, 0.0, M) * 0.7);
  c = mix(c, vec3(0.97, 0.99, 1.0), smoothstep(1.5, 1.95, h) * 0.8);
  c += vec3(1.0, 0.85, 0.5) * (smoothstep(0.06, 0.0, r1) + smoothstep(0.06, 0.0, r2)) * 2.0;
  c *= 0.75 + 0.25 * smoothstep(1.0, 0.4, r);
  gl_FragColor = vec4(c, 1.0);
}`;

export function CoastDoor() {
  const vi = useWorld((s) => s.lang === "vi");
  // khung cổng Blender trong GLB nhỏ của Quảng trường (không tải cả coast_props.glb ở Quảng trường)
  const glb = useGLTF(HUB_GATES_GLB).scene;
  const face = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: faceFrag,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => face.dispose(), [face]);
  useFrame((_, dt) => {
    face.uniforms.uT.value += dt;
  });
  const d = COAST_DOOR;
  return (
    <group>
      <group position={[d.dx, 0, d.dz]} rotation-y={d.yaw}>
        <GlbOr glb={glb} name="hx_coast_gate">
          {[-1.85, 1.85].map((s) => (
            <mesh key={s} material={toon("#d9d0bd")} position={[s, 1.75, -0.05]}>
              <boxGeometry args={[0.5, 3.5, 0.55]} />
            </mesh>
          ))}
          <mesh material={toon("#d9d0bd")} position={[0, 3.5, -0.05]}>
            <torusGeometry args={[1.85, 0.27, 8, 24, Math.PI]} />
          </mesh>
        </GlbOr>
        <mesh material={face} position={[0, 1.75, 0.02]}>
          <circleGeometry args={[1.55, 48]} />
        </mesh>
      </group>
      <MagicCircle radius={1.5} position={[d.x, 0.05, d.z]} color="#5fd0ff" color2="#ffe2a8" intensity={0.75} spin={0.5} />
      <Label3D text={vi ? "Bờ Sóng" : "Wave Coast"} position={[d.dx, 5.6, d.dz]} maxDist={70} />
    </group>
  );
}
