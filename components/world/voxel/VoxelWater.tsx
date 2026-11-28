"use client";
/**
 * Biển của Vùng Kỳ quan (mặt phẳng ở WATER_LEVEL, đi theo người chơi) — nước anime rẻ, một lệnh vẽ:
 *  - màu nông (ngọc) → sâu (lam) theo bản đồ độ sâu THẬT do worker địa hình xa tính (FarTerrain.depth, 128² × 2 m);
 *  - bọt ven bờ: viền sát bờ + các dải sóng chạy vào bờ (fract theo độ sâu − thời gian), méo nhẹ bằng gợn;
 *  - gợn: 2 lớp độ dốc (waterNormalTex) trôi chéo; lấp lánh nắng kiểu toon (ngưỡng cứng); fresnel ra màu chân trời;
 *  - sáng / tối theo cùng uniform với địa hình voxel (VOXEL_U: uDay, ánh trăng) + sương của cảnh.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WATER_LEVEL } from "@/lib/world/terrain";
import { WATER_DEPTH_MAX } from "@/lib/world/voxel/farTile";
import { waterNormalTex } from "../fx/proceduralTex";
import { DAY } from "../fx/dayState";
import { useWorld } from "../store";
import { VOXEL_U } from "./voxelMaterial";
import type { FarTerrain } from "./farTerrain";

const SIZE = 900;
/** uniform cấp module (worker cập nhật độ sâu, useFrame cộng thời gian — không sửa giá trị trả về từ hook) */
const WATER_U = {
  uDepth: { value: null as THREE.Texture | null },
  uArea: { value: new THREE.Vector3(0, 0, -1) },
  uT: { value: 0 },
};

export function VoxelWater({ far }: { far: FarTerrain | null }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uDepth: WATER_U.uDepth,
        uArea: WATER_U.uArea,
        uNormal: { value: waterNormalTex() },
        uT: WATER_U.uT,
        uSun: DAY.sun,
        uSunK: DAY.sunK,
        uHor: DAY.hor,
        uDay: VOXEL_U.uDay,
        uSkyTint: VOXEL_U.uSkyTint,
      },
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uDepth; uniform vec3 uArea; uniform sampler2D uNormal; uniform float uT;
        uniform vec3 uSun; uniform float uSunK; uniform vec3 uHor; uniform float uDay; uniform vec3 uSkyTint;
        varying vec3 vW;
        void main() {
          vec2 w = vW.xz;
          // độ sâu (m); ngoài vùng bản đồ = sâu
          vec2 duv = (w - uArea.xy) / max(uArea.z, 1.0);
          float inA = step(0.0, uArea.z) * step(0.0, duv.x) * step(duv.x, 1.0) * step(0.0, duv.y) * step(duv.y, 1.0);
          float d = mix(${WATER_DEPTH_MAX.toFixed(1)}, texture2D(uDepth, duv).r * ${WATER_DEPTH_MAX.toFixed(1)}, inA);
          // gợn: 2 lớp độ dốc trôi chéo
          vec2 s1 = texture2D(uNormal, w * 0.045 + vec2(uT * 0.013, uT * 0.008)).rg * 2.0 - 1.0;
          vec2 s2 = texture2D(uNormal, w * 0.12 + vec2(-uT * 0.019, uT * 0.012)).rg * 2.0 - 1.0;
          vec2 sl = s1 + s2 * 0.6;
          vec3 N = normalize(vec3(-sl.x * 0.6, 1.0, -sl.y * 0.6));
          vec3 V = normalize(cameraPosition - vW);
          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
          float k = smoothstep(0.0, 5.0, d);
          vec3 col = mix(vec3(0.46, 0.9, 0.84), vec3(0.13, 0.44, 0.8), k);
          col = mix(col, uHor, fres * 0.55);
          // lấp lánh nắng: ngưỡng cứng (toon)
          vec3 H = normalize(normalize(uSun) + V);
          float sp = pow(max(dot(N, H), 0.0), 220.0);
          col += step(0.45, sp) * uSunK * vec3(1.0, 0.97, 0.88) * 1.3;
          // bọt: viền sát bờ + dải sóng chạy vào bờ
          float wob = sl.x * 0.12;
          float band = step(0.84, fract(d * 1.4 - uT * 0.22 + wob)) * (1.0 - smoothstep(0.2, 1.5, d));
          float edge = 1.0 - smoothstep(0.06, 0.32 + wob, d);
          float foam = max(band * 0.8, edge) * inA;
          col = mix(col, vec3(0.97, 1.0, 1.0), foam);
          // sáng theo giờ: cùng đường cong với địa hình voxel (ánh trời × uDay, trăng lam)
          col *= mix(0.07, 1.0, pow(uDay, 1.35)) * uSkyTint;
          gl_FragColor = vec4(col, max(mix(0.58, 0.9, k), foam));
          #include <fog_fragment>
        }`,
    });
    return m;
  }, []);
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    if (!far) return;
    WATER_U.uDepth.value = far.depth.tex;
    WATER_U.uArea.value = far.depth.area.value; // dùng chung Vector3 — worker cập nhật là shader thấy
  }, [far]);
  useFrame((_, dt) => {
    const p = useWorld.getState().player;
    // bám lưới 16 m (gợn theo toạ độ thế giới nên không trượt khi mặt phẳng dời)
    ref.current?.position.set(Math.round(p.x / 16) * 16, WATER_LEVEL, Math.round(p.z / 16) * 16);
    WATER_U.uT.value += Math.min(dt, 0.1);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={2}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
