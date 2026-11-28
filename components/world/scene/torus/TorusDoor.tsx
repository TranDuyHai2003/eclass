"use client";
/**
 * Cổng Quần đảo Xuyến ở Quảng trường: khung đá hai trụ, trên đỉnh là chiếc xuyến vàng nằm ngang; mặt cổng là "cửa sổ" nhìn vào
 * một thế giới lặp: các ô vuông giống hệt nhau trôi chéo, mỗi ô có đảo và một chấm sáng (người chơi) — viền san hô / ngọc lam
 * là hai cặp mép dán. Bấm F → lỗ sâu tới vùng "torus". Gắn trong Hub.tsx (vị trí TORUS_DOOR ở lib/world/hubLayout.ts).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TORUS_DOOR } from "@/lib/world/hubLayout";
import { SEAM_X_COLOR, SEAM_Z_COLOR } from "@/lib/world/torusWorld";
import { MagicCircle } from "../../fx/Effects";
import { toonize } from "../../fx/glbToon";
import { useGLTF } from "@react-three/drei";
import { worldAsset } from "@/lib/world/avatars";
import { useWorld } from "../../store";
import { Label3D } from "../../ui/Labels";

/** hai cổng ở Quảng trường gom vào một GLB nhỏ (khỏi tải cả đạo cụ vùng khi chỉ đứng ở Quảng trường) */
const PROPS_GLB = worldAsset("props/hub_gates.glb");

const faceFrag = /* glsl */ `
uniform float uT; uniform vec3 uSX; uniform vec3 uSZ; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  // nhìn "xuyên" vào thế giới lặp: phóng to dần về giữa (phối cảnh giả), trôi chéo
  vec2 q = p * (1.0 + 0.18 * r * r) * 1.35 + vec2(uT * 0.12, uT * 0.07);
  vec2 cell = fract(q) - 0.5;
  vec3 c = mix(vec3(0.97, 0.84, 0.9), vec3(0.62, 0.78, 1.0), 0.5 + 0.5 * p.y);
  // đảo (giống nhau ở mọi ô) + đảo vắt mép
  float isl = smoothstep(0.2, 0.17, length(cell - vec2(0.05, 0.02)));
  isl = max(isl, smoothstep(0.13, 0.1, length(cell - vec2(0.5, 0.18))));
  isl = max(isl, smoothstep(0.13, 0.1, length(cell - vec2(-0.5, 0.18))));
  c = mix(c, vec3(0.49, 0.81, 0.48), isl * 0.9);
  // bạn — ở cùng một chỗ trong MỌI ô
  float me = smoothstep(0.05, 0.02, length(cell - vec2(-0.12, 0.2)));
  c += vec3(1.0, 0.85, 0.4) * me * (1.6 + 0.6 * sin(uT * 4.0));
  // hai cặp mép
  vec2 e = 0.5 - abs(cell);
  c = mix(c, uSX * 1.8, smoothstep(0.025, 0.0, e.x));
  c = mix(c, uSZ * 1.8, smoothstep(0.025, 0.0, e.y));
  c *= 0.75 + 0.25 * smoothstep(1.0, 0.3, r);
  gl_FragColor = vec4(c, 1.0);
}`;

export function TorusDoor() {
  const vi = useWorld((s) => s.lang === "vi");
  const mats = useMemo(
    () => ({
      face: new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSX: { value: new THREE.Color(SEAM_X_COLOR) }, uSZ: { value: new THREE.Color(SEAM_Z_COLOR) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: faceFrag,
        toneMapped: false,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame((_, dt) => {
    mats.face.uniforms.uT.value += dt;
  });
  const gltf = useGLTF(PROPS_GLB);
  const frame = useMemo(() => {
    const src = gltf.scene.getObjectByName("hx_torus_gate");
    return src ? toonize(src) : new THREE.Group();
  }, [gltf]);
  const d = TORUS_DOOR;
  return (
    <group>
      <group position={[d.dx, 0, d.dz]} rotation-y={d.yaw}>
        {/* khung Blender: hai trụ (dải sáng màu hai cặp mép), vòng vàng, xuyến vàng trên đỉnh có kinh tuyến san hô + vĩ tuyến ngọc lam */}
        <primitive object={frame} />
        <mesh material={mats.face} position={[0, 1.75, 0.02]}>
          <circleGeometry args={[1.55, 48]} />
        </mesh>
      </group>
      <MagicCircle radius={1.5} position={[d.x, 0.05, d.z]} color={SEAM_X_COLOR} color2={SEAM_Z_COLOR} intensity={0.75} spin={0.5} />
      <Label3D text={vi ? "Quần đảo Xuyến" : "Torus Archipelago"} position={[d.dx, 5.6, d.dz]} maxDist={70} />
    </group>
  );
}
