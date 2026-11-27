"use client";
/**
 * Lối vào phòng "Học cùng nhau" đặt ở Quảng trường: một khung cửa gỗ đứng một mình bên lan can (kiểu "cửa thần kỳ"),
 * hé mở, bên trong toả ánh đèn vàng ấm của thư viện + bụi sáng bay ra; mái nhỏ, đèn lồng, biển gỗ hai thứ tiếng.
 * Gắn vào HubPlaza.tsx: `<StudyDoor />` (vị trí lấy từ STUDY_DOOR trong lib/world/hubLayout.ts).
 * Khoảng 7 lệnh vẽ, không đèn thật (chỉ phát sáng + vệt sáng cộng màu trên đất).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { STUDY_DOOR } from "@/lib/world/hubLayout";
import { useWorld } from "../../store";

const W = 1.5;
const HH = 2.6;

const glowShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 p = vUv;
      // lòng cửa: ánh vàng ấm đậm ở giữa, nhạt dần ra mép; giá sách mờ (sọc dọc) phía xa
      float c = 1.0 - smoothstep(0.1, 0.75, length((p - vec2(0.5, 0.42)) * vec2(1.4, 1.0)));
      float shelves = step(0.5, fract(p.x * 22.0 + h2(vec2(floor(p.y * 6.0), 1.0)))) * step(0.12, fract(p.y * 6.0));
      vec3 col = mix(vec3(0.55, 0.26, 0.12), vec3(1.0, 0.82, 0.52), c);
      col *= 0.82 + shelves * 0.18 * (1.0 - c);
      // bụi sáng bay lên
      vec2 g = vec2(p.x * 10.0, p.y * 8.0 - uTime * 0.25);
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5 - (vec2(h2(id), h2(id + 2.3)) - 0.5) * 0.6;
      col += vec3(1.0, 0.9, 0.6) * smoothstep(0.08, 0.0, length(f)) * step(0.7, h2(id + 5.1)) * 0.9;
      gl_FragColor = vec4(col * 1.35, 1.0);
    }`,
};

function signTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d")!;
  const el = document.querySelector(".w-root") ?? document.body;
  const fam = getComputedStyle(el).getPropertyValue("--font-bvp").trim() || "sans-serif";
  const draw = () => {
    g.fillStyle = "#5a3a24";
    g.fillRect(0, 0, 512, 192);
    g.strokeStyle = "#e9ad62";
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 176);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffe7b8";
    g.font = `800 50px ${fam}`;
    g.fillText("Học cùng nhau", 256, 76);
    g.fillStyle = "#e9c48a";
    g.font = `600 32px ${fam}`;
    g.fillText("Study with me", 256, 134);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  draw();
  document.fonts?.load(`800 50px ${fam}`, "Học").then(draw, () => {});
  return tex;
}

export function StudyDoor() {
  const d = STUDY_DOOR;
  const parts = useMemo(() => {
    const wood: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const box = (arr: THREE.BufferGeometry[], w: number, h: number, dd: number, x: number, y: number, z: number, ry = 0, rz = 0) => {
      const g = new THREE.BoxGeometry(w, h, dd);
      if (ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, ry, rz)));
      arr.push(g.translate(x, y, z));
    };
    // bậc đá + khung + mái nhỏ hai mái dốc
    box(dark, W + 1.1, 0.16, 1.2, 0, 0.08, 0);
    for (const s of [-1, 1]) box(wood, 0.18, HH + 0.2, 0.22, s * (W / 2 + 0.09), (HH + 0.2) / 2 + 0.16, 0);
    box(wood, W + 0.6, 0.2, 0.3, 0, HH + 0.36, 0);
    for (const s of [-1, 1]) box(dark, W / 2 + 0.55, 0.07, 0.75, s * 0.43, HH + 0.62, 0, 0, -s * 0.42);
    // cánh cửa hé mở (quay vào trong ~65°)
    const leaf = new THREE.BoxGeometry(W - 0.04, HH - 0.04, 0.07).translate((W - 0.04) / 2, 0, 0);
    leaf.applyMatrix4(new THREE.Matrix4().makeRotationY(1.1)).translate(-W / 2, HH / 2 + 0.16, -0.05);
    wood.push(leaf);
    // cột treo đèn lồng
    box(dark, 0.06, 0.06, 0.5, W / 2 + 0.1, HH - 0.1, 0.3);
    return { wood: mergeGeometries(wood.map((g) => g.toNonIndexed()), false), dark: mergeGeometries(dark.map((g) => g.toNonIndexed()), false) };
  }, []);
  const mats = useMemo(
    () => ({
      wood: new THREE.MeshToonMaterial({ color: "#8a5d3b" }),
      dark: new THREE.MeshToonMaterial({ color: "#4a3020" }),
      lantern: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc46e").multiplyScalar(2.2), toneMapped: false }),
      glow: new THREE.ShaderMaterial({ ...glowShader, uniforms: THREE.UniformsUtils.clone(glowShader.uniforms), toneMapped: false }),
      pool: new THREE.MeshBasicMaterial({ color: "#ffb86a", transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  );
  const sign = useMemo(() => signTexture(), []);
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: sign }), [sign]);
  const t = useRef(0);
  const ref = useRef<THREE.Group>(null);
  useEffect(
    () => () => {
      parts.wood.dispose();
      parts.dark.dispose();
      Object.values(mats).forEach((m) => m.dispose());
      sign.dispose();
      signMat.dispose();
    },
    [parts, mats, sign, signMat],
  );
  useFrame((_, dt) => {
    // chỉ chạy khi gần (≤ 45 m) — tiết kiệm ở Quảng trường
    const p = useWorld.getState().player;
    if (Math.hypot(p.x - d.dx, p.z - d.dz) > 45) return;
    t.current += Math.min(0.05, dt);
    mats.glow.uniforms.uTime.value = t.current;
  });
  return (
    <group ref={ref} position={[d.dx, 0, d.dz]} rotation-y={d.yaw}>
      <mesh geometry={parts.wood} material={mats.wood} />
      <mesh geometry={parts.dark} material={mats.dark} />
      {/* lòng cửa sáng (lùi nhẹ ra sau khung) */}
      <mesh position={[0, HH / 2 + 0.16, -0.08]} material={mats.glow}>
        <planeGeometry args={[W, HH]} />
      </mesh>
      {/* đèn lồng */}
      <mesh position={[W / 2 + 0.1, HH - 0.32, 0.5]} material={mats.lantern}>
        <boxGeometry args={[0.16, 0.24, 0.16]} />
      </mesh>
      {/* biển gỗ trên khung */}
      <mesh position={[0, HH + 0.36, 0.16]} material={signMat}>
        <planeGeometry args={[1.5, 0.56]} />
      </mesh>
      {/* vệt sáng hắt ra đất trước cửa */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.17, 1.2]} material={mats.pool}>
        <circleGeometry args={[1.3, 24]} />
      </mesh>
    </group>
  );
}
