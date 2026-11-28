"use client";
/**
 * Cổng Mandelbrot (TESSERACT_BOOTH.md §13 H2) trên tầng lửng phía đông bắc phòng điều khiển Siêu khối.
 *  - Đĩa Ø3 m: tập Mandelbrot z → z² + c (thoát theo thời gian, tô mượt), tự lặn ×1 500 vào Thung lũng Cá ngựa rồi khép mống
 *    mắt và lặn lại (fp32 chỉ đủ tới ~10⁴ nên lặn vòng lặp — tự đồng dạng nên không thấy chỗ nối).
 *  - Bục trước cổng: đứng lên → chế độ Julia, c đi theo vị trí chân trên bục (c ở trong tập M ⇔ tập Julia liền một mảnh).
 *  - Khung đồng + biểu tượng cardioid / nụ chu kỳ 2 phát sáng: Blender (`props/mandel_portal.glb`, GI nướng vào màu đỉnh).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { TR, dirOf } from "@/lib/world/tessRoom";
import { mandelPadC } from "@/lib/world/mandel";
import { bakedMaterial } from "../fx/baked";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { PROP_U, ROOM_U } from "./roomUniforms";

const GLB = worldAsset("props/mandel_portal.glb");
useGLTF.preload(GLB);
/** phương vị (độ) trên vòng tường, giữa cột 40° và 72° */
export const MANDEL_B = 56;
const R_PORTAL = 13.55;
const R_PAD = 12.15;
const Y_C = TR.ZM + 1.95;

const FRAG = /* glsl */ `
precision highp float;
uniform float uT;
uniform float uJulia;
uniform vec2 uC;
uniform float uExposure;
varying vec2 vUv;
#ifndef ITER
#define ITER 160
#endif
vec3 pal(float t) {
  // chàm → lam ngọc → vàng → hồng (bảng cos kiểu anime)
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0, 1.0, 1.0) * t + vec3(0.62, 0.48, 0.30)));
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float rr = length(p);
  if (rr > 1.0) discard;
  // vòng lặn 36 s: lặn mũ (×1 500), 2 s cuối khép mống mắt
  float cyc = mod(uT, 36.0);
  float k = clamp(cyc / 34.0, 0.0, 1.0);
  float zoom = exp(mix(0.0, log(1500.0), k * k * (3.0 - 2.0 * k)));
  vec2 c0 = vec2(-0.743643887, 0.131825904);
  float ang = uT * 0.05;
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 pm = rot * p * (1.6 / zoom);
  vec2 z, c, dz;
  float span;
  if (uJulia > 0.5) { z = rot * p * 1.55; c = uC; dz = vec2(1.0, 0.0); span = 1.55; }
  else { z = vec2(0.0); c = c0 + pm; dz = vec2(0.0); span = 1.6 / zoom; }
  float jc = uJulia > 0.5 ? 0.0 : 1.0;
  float n = 0.0;
  float m2 = 0.0;
  for (int i = 0; i < ITER; i++) {
    // đạo hàm để ước lượng khoảng cách tới biên (dz' = 2·z·dz + 1 với M, + 0 với Julia)
    dz = 2.0 * vec2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + vec2(jc, 0.0);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    m2 = dot(z, z);
    if (m2 > 256.0) break;
    n += 1.0;
  }
  vec3 col;
  if (n >= float(ITER)) {
    // bên trong tập: chàm sâu, gợn nhẹ
    col = vec3(0.03, 0.02, 0.09) + vec3(0.05, 0.03, 0.12) * (0.5 + 0.5 * sin(uT * 0.8 + length(z) * 6.0));
  } else {
    float sn = n - log2(log2(m2)) + 4.0;
    // khoảng cách tới biên d = |z|·ln|z| / |dz| → sợi biên sáng, vùng trống tối (thấy chiều sâu khi lặn)
    float d = 0.5 * sqrt(m2) * log(m2) / max(length(dz), 1e-20);
    float glow = 1.0 - smoothstep(0.0, span * 0.06, d);
    col = pal(sn * 0.03 + uT * 0.02);
    col *= 0.1 + 1.15 * glow * glow + 0.1 * smoothstep(0.0, 40.0, sn);
  }
  // mống mắt khép cuối vòng (che chỗ nối) + viền sáng trong khung
  float iris = smoothstep(34.0, 35.0, cyc) * (1.0 - smoothstep(35.4, 36.0, cyc));
  col *= 1.0 - iris * 0.92;
  col += vec3(0.35, 0.95, 1.0) * smoothstep(0.9, 1.0, rr) * 0.6;
  gl_FragColor = vec4(col * uExposure * 1.15, 1.0);
}`;

function useFrameScene() {
  const gltf = useGLTF(GLB);
  return useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const conv = (src: THREE.Material) => {
      const std = src as THREE.MeshStandardMaterial;
      let m = cache.get(std.name);
      if (!m) {
        m = std.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: std.color.clone().multiplyScalar(2.2), toneMapped: false }) : bakedMaterial(std, PROP_U);
        cache.set(std.name, m);
      }
      return m;
    };
    const take = (n: string) => {
      const o = gltf.scene.getObjectByName(n)?.clone(true) ?? new THREE.Group();
      o.position.set(0, 0, 0);
      o.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
      });
      return o;
    };
    return { frame: take("mp_frame"), pad: take("mp_pad"), mats: cache };
  }, [gltf]);
}

/** Vẽ trong khung cục bộ của phòng (gắn bên trong nhóm TessRoom); cx, cz = gốc phòng trong thế giới (để dò bục) */
export function MandelPortal({ cx, cz }: { cx: number; cz: number }) {
  const { frame, pad, mats } = useFrameScene();
  const quality = useWorld((s) => s.quality);
  const vi = useWorld((s) => s.lang === "vi");
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uJulia: { value: 0 }, uC: { value: new THREE.Vector2() }, uExposure: { value: 1 } },
        defines: { ITER: quality === "low" ? 96 : 160 },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: FRAG,
        toneMapped: false,
      }),
    [quality],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const [dx, dz] = dirOf(MANDEL_B);
  const padAt = useMemo(() => new THREE.Vector2(cx + dx * R_PAD, cz + dz * R_PAD), [cx, cz, dx, dz]);
  const onPad = useRef(false);
  useFrame(() => {
    const u = mat.uniforms;
    u.uT.value = performance.now() / 1000;
    u.uExposure.value = ROOM_U.uExposure.value;
    const p = useWorld.getState().player;
    const c = mandelPadC(p.x - padAt.x, p.z - padAt.y, p.y - TR.ZM, MANDEL_B);
    onPad.current = !!c;
    u.uJulia.value = c ? 1 : 0;
    if (c) (u.uC.value as THREE.Vector2).set(c[0], c[1]);
  });
  return (
    <group>
      <group position={[dx * R_PORTAL, Y_C, dz * R_PORTAL]} rotation-y={(-MANDEL_B * Math.PI) / 180}>
        <primitive object={frame} />
        <mesh material={mat}>
          <circleGeometry args={[1.5, 64]} />
        </mesh>
        <Label3D text={vi ? "Cổng Mandelbrot · z → z² + c" : "Mandelbrot Portal · z → z² + c"} position={[0, 3.0, 0.3]} variant="small" maxDist={22} />
      </group>
      <group position={[dx * R_PAD, TR.ZM, dz * R_PAD]} rotation-y={(-MANDEL_B * Math.PI) / 180}>
        <primitive object={pad} />
        <Label3D text={vi ? "Đứng lên bục: tập Julia — c đi theo bước chân" : "Step on: Julia set — c follows your feet"} position={[0, 1.2, 0]} variant="small" maxDist={9} />
      </group>
    </group>
  );
}
