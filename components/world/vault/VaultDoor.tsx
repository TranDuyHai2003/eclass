"use client";
/**
 * Cửa Hầm Bổ đề ở Quảng trường: cửa đá tròn đứng trong khung vòm, bốn lỗ khoá ● ▲ ■ ◆ phát sáng lần lượt (màu ghế),
 * vòng phép dưới chân, mặt cửa là shader sóng ấn ký chậm (không vẽ chi tiết bằng code). Bấm F → bảng chọn (VaultUi).
 * Gắn trong Hub.tsx (vị trí VAULT_DOOR ở lib/world/hubLayout.ts).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { VAULT_DOOR } from "@/lib/world/hubLayout";
import { MagicCircle } from "../fx/Effects";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { GLYPHS, SEAT_COLORS } from "@/lib/world/vault/run";
import { useVault } from "./vaultClient";
import { useVaultPropClone } from "./vaultProps";

const faceFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uC0, uC1, uC2, uC3;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // vòng đồng tâm khắc chữ + xoáy chậm
  float rings = smoothstep(0.04, 0.0, abs(fract(r * 5.0 - uTime * 0.05) - 0.5) - 0.44);
  float spokes = smoothstep(0.03, 0.0, abs(fract(a / 6.2831 * 16.0 + uTime * 0.01) - 0.5) - 0.47) * step(0.35, r);
  vec3 stone = mix(vec3(0.22, 0.2, 0.33), vec3(0.32, 0.29, 0.45), smoothstep(1.0, 0.2, r));
  // bốn lỗ khoá: trên, phải, dưới, trái
  vec3 glow = vec3(0.0);
  vec2 holes[4];
  holes[0] = vec2(0.0, 0.55); holes[1] = vec2(0.55, 0.0); holes[2] = vec2(0.0, -0.55); holes[3] = vec2(-0.55, 0.0);
  vec3 cols[4];
  cols[0] = uC0; cols[1] = uC1; cols[2] = uC2; cols[3] = uC3;
  for (int i = 0; i < 4; i++) {
    float d = length(p - holes[i]);
    float pulse = 0.55 + 0.45 * sin(uTime * 1.6 - float(i) * 1.57);
    glow += cols[i] * (smoothstep(0.13, 0.08, d) * 1.6 + smoothstep(0.32, 0.1, d) * 0.35) * pulse;
  }
  vec3 col = stone + vec3(0.95, 0.82, 0.55) * (rings * 0.22 + spokes * 0.12) + glow;
  gl_FragColor = vec4(col, 1.0);
}`;

export function VaultDoor() {
  const vi = useWorld((s) => s.lang === "vi");
  const mats = useMemo(
    () => ({
      face: new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uC0: { value: new THREE.Color(SEAT_COLORS[0]) }, uC1: { value: new THREE.Color(SEAT_COLORS[1]) }, uC2: { value: new THREE.Color(SEAT_COLORS[2]) }, uC3: { value: new THREE.Color(SEAT_COLORS[3]) } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: faceFrag,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __vault: useVault });
    return registerAction("vault:door", () => useVault.setState({ door: true, err: null }));
  }, []);
  useFrame((_, dt) => (mats.face.uniforms.uTime.value += dt));
  // khung cửa Blender (trụ, vòng răng vàng, đá đỉnh vòm, vành 4 lỗ khoá, tấm lưng) — mặt cửa vẫn là shader
  const frame = useVaultPropClone("vp_door");
  return (
    <group>
      <group position={[VAULT_DOOR.dx, 0, VAULT_DOOR.dz]} rotation-y={VAULT_DOOR.yaw}>
        {frame && <primitive object={frame} />}
        <mesh material={mats.face} position={[0, 2.25, 0.02]}>
          <circleGeometry args={[1.62, 48]} />
        </mesh>
        <Label3D text={`${GLYPHS.join(" ")}  ${vi ? "Hầm Bổ đề" : "The Lemma Vaults"}`} position={[0, 4.6, 0]} variant="default" maxDist={30} />
      </group>
      <MagicCircle radius={1.6} position={[VAULT_DOOR.x, 0.05, VAULT_DOOR.z]} color="#ffd27a" color2="#9d8cff" intensity={0.8} spin={0.5} />
    </group>
  );
}
