"use client";
/**
 * Cổng Chợ Xác Suất ở Quảng trường: hai cột gỗ + xà ngang treo dây đèn lồng (khối TẠM — chờ `hx_bazaar_gate` Blender);
 * mặt cổng là "cửa sổ" shader nhìn vào chợ đêm: hạt xúc xắc rơi chồng thành hình chuông, đom đóm bay, quầng đèn.
 * Bấm F → lỗ sâu tới vùng "bazaar". Gắn trong Hub.tsx (vị trí BAZAAR_DOOR ở lib/world/hubLayout.ts).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BAZAAR_DOOR } from "@/lib/world/hubLayout";
import { MagicCircle } from "../../fx/Effects";
import { useWorld } from "../../store";
import { Label3D } from "../../ui/Labels";
import { glow, toon } from "./bazaarProps";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../../fx/glbToon";

const HUB_GATES_GLB = worldAsset("props/hub_gates.glb");

const faceFrag = /* glsl */ `
uniform float uT; varying vec2 vUv;
float h(float n){ return fract(sin(n * 127.1) * 43758.5453); }
void main(){
  vec2 p = vUv;
  // nền: trời đêm chàm → cam ấm ở đáy (ánh chợ)
  vec3 c = mix(vec3(0.62, 0.30, 0.30), vec3(0.06, 0.05, 0.16), smoothstep(0.0, 0.9, p.y));
  // hình chuông dựng bằng cột: chiều cao cột k ~ C(10,k)/2^10, "mọc" theo thời gian rồi đổ lại
  float bins = 11.0;
  float k = floor(p.x * bins);
  float x = (k + 0.5) / bins - 0.5;
  float grow = 0.5 + 0.5 * sin(uT * 0.35);
  float hgt = 0.62 * exp(-x * x * 18.0) * (0.35 + 0.65 * grow);
  float inBar = step(p.y, hgt + 0.05) * step(0.06, fract(p.x * bins)) * step(fract(p.x * bins), 0.94);
  c = mix(c, vec3(1.0, 0.78, 0.35) * 1.25, inBar * smoothstep(0.0, 0.05, p.y));
  // xúc xắc rơi vào cột
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float t = fract(uT * 0.4 + h(fi));
    float bx = (floor(h(fi + 3.0 + floor(uT * 0.4 + h(fi))) * bins) + 0.5) / bins;
    vec2 q = vec2(bx, 1.0 - t);
    vec2 d = abs(p - q);
    float sq = step(max(d.x, d.y * 0.75), 0.022);
    c = mix(c, vec3(1.0), sq);
  }
  // đom đóm
  for (int i = 0; i < 6; i++) {
    float fi = float(i) + 20.0;
    vec2 q = vec2(fract(h(fi) + uT * 0.05 * (0.5 + h(fi + 1.0))), 0.55 + 0.35 * fract(h(fi + 2.0) + sin(uT * 0.7 + fi) * 0.1));
    c += vec3(0.4, 1.0, 0.9) * smoothstep(0.03, 0.0, length(p - q)) * 1.4;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export function BazaarDoor() {
  const vi = useWorld((s) => s.lang === "vi");
  const face = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 } },
        vertexShader:
          "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: faceFrag,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => face.dispose(), [face]);
  useFrame((_, dt) => {
    face.uniforms.uT.value += dt;
  });
  const d = BAZAAR_DOOR;
  // khung cổng Blender (props/hub_gates.glb — chung với cổng Xuyến, Bờ Sóng); thiếu node → hình tạm
  const gates = useGLTF(HUB_GATES_GLB);
  const frame = useMemo(() => {
    const src = gates.scene.getObjectByName("hx_bazaar_gate");
    return src ? toonize(src) : null;
  }, [gates]);
  const lamps = useMemo(
    () => Array.from({ length: 7 }, (_, i) => (i - 3) * 0.48),
    [],
  );
  return (
    <group>
      <group position={[d.dx, 0, d.dz]} rotation-y={d.yaw}>
        {frame ? (
          <primitive object={frame} />
        ) : (
          <>
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            material={toon("#6a3f2a")}
            position={[s * 1.75, 2.0, 0]}
          >
            <boxGeometry args={[0.28, 4.0, 0.28]} />
          </mesh>
        ))}
        <mesh material={toon("#a0412f")} position={[0, 4.1, 0]}>
          <boxGeometry args={[4.3, 0.3, 0.42]} />
        </mesh>
        <mesh material={toon("#ffd27a")} position={[0, 4.42, 0]}>
          <boxGeometry args={[3.2, 0.34, 0.12]} />
        </mesh>
        {lamps.map((x, i) => (
          <mesh
            key={x}
            material={glow(i % 2 ? "#ff8ad8" : "#ffb347", 2.2)}
            position={[x, 3.68 - Math.cos((x / 1.6) * 1.2) * 0.12, 0.05]}
          >
            <sphereGeometry args={[0.13, 10, 8]} />
          </mesh>
        ))}
          </>
        )}
        <mesh material={face} position={[0, 1.95, 0.02]}>
          <planeGeometry args={[3.2, 3.5]} />
        </mesh>
      </group>
      <MagicCircle
        radius={1.5}
        position={[d.x, 0.05, d.z]}
        color="#ffb347"
        color2="#ff8ad8"
        intensity={0.75}
        spin={0.5}
      />
      <Label3D
        text={vi ? "Chợ Xác Suất" : "Chance Bazaar"}
        position={[d.dx, 5.4, d.dz]}
        maxDist={70}
      />
    </group>
  );
}
