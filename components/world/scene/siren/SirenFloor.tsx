"use client";
/**
 * Sàn "sống" của Mê cung Hoạ âm — phần HÌNH (va chạm: lib/world/sirenMaze.ts đọc CÙNG hàm trong lib/world/sirenFloor.ts):
 *  - HarmonicPlatforms: 4 đài nổi trong đấu trường nhấp nhô / quay theo tỉ số 2 : 3 : 5 (: 4), khoá theo beat HARMONIC.
 *  - StaffBridge: cầu Nam dệt từ 5 dòng kẻ khuông nhạc + vạch nhịp, uốn theo chuỗi Fourier sóng chạy ở vertex shader
 *    (STAFF_GLSL = staffHeight trên CPU), số hoạ âm = HARMONIC.harmonics (boss yếu dần → cầu chỉ còn sóng sin thuần). 1 lệnh vẽ.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { HARMONIC } from "@/lib/world/harmonicState";
import { STAFF, STAFF_GLSL, platBob, platYaw } from "@/lib/world/sirenFloor";
import { ARENA_PLATFORMS, SURF_BY_ID } from "@/lib/world/sirenMaze";
import { MagicCircle } from "../../fx/Effects";

/** Đài nổi: nhấp nhô + quay theo beat (va chạm theo cùng platBob — đài tròn nên quay không đổi va chạm) */
export function HarmonicPlatforms() {
  const tex = useTexture(worldAsset("dungeon/lab_floor.webp"));
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const b = HARMONIC.beat;
    ARENA_PLATFORMS.forEach((p, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.position.y = p.top + platBob(i, b);
      g.rotation.y = platYaw(i, b);
    });
  });
  return (
    <>
      {ARENA_PLATFORMS.map((p, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} position={[p.x, p.top, p.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[p.r, 40]} />
            <meshToonMaterial map={tex} />
          </mesh>
          <mesh position-y={-0.45}>
            <cylinderGeometry args={[p.r, p.r * 0.35, 0.9, 32, 1, true]} />
            <meshToonMaterial color="#3a2a66" side={THREE.DoubleSide} />
          </mesh>
          <MagicCircle radius={p.r * 0.9} position={[0, 0.03, 0]} color="#ffd27a" color2="#ff9ecb" intensity={0.5} spin={0.3} />
        </group>
      ))}
    </>
  );
}

// ───────────── Cầu khuông nhạc ─────────────
/** loại mặt (aKind): 0 mặt cầu dệt · 1 hông · 2 dòng kẻ · 3 vạch nhịp · 4 mặt dưới */
function buildStaffBridge(): THREE.BufferGeometry {
  const pos: number[] = [];
  const kind: number[] = [];
  const HW = 2; // nửa bề ngang cầu
  const DEPTH = 0.35;
  const sA = STAFF.s0 - 0.7;
  const sB = STAFF.s1 + 0.7;
  const NS = 120; // đoạn 0,17 m: hoạ âm bậc 8 (bước sóng 2,3 m) vẫn ≥ 13 đoạn / bước sóng
  const ds = (sB - sA) / NS;
  const quad = (a: number[], b: number[], c: number[], d: number[], k: number) => {
    for (const v of [a, b, c, a, c, d]) {
      pos.push(v[0], v[1], v[2]);
      kind.push(k);
    }
  };
  // mặt cầu + mặt dưới: độ cao chỉ phụ thuộc s → mỗi đoạn dọc một dải ngang (hoa văn dệt vẽ ở shader)
  for (let i = 0; i < NS; i++) {
    const s0 = sA + i * ds;
    const s1 = s0 + ds;
    quad([-HW, 0, s0], [-HW, 0, s1], [HW, 0, s1], [HW, 0, s0], 0);
    quad([-HW, -DEPTH, s0], [HW, -DEPTH, s0], [HW, -DEPTH, s1], [-HW, -DEPTH, s1], 4);
    // hai hông
    quad([HW, 0, s0], [HW, 0, s1], [HW, -DEPTH, s1], [HW, -DEPTH, s0], 1);
    quad([-HW, 0, s0], [-HW, -DEPTH, s0], [-HW, -DEPTH, s1], [-HW, 0, s1], 1);
    // 5 dòng kẻ: ống vuông nổi trên mặt cầu
    for (const x of STAFF.lines) {
      const r = 0.065;
      const top = 0.1;
      quad([x - r, top, s0], [x - r, top, s1], [x + r, top, s1], [x + r, top, s0], 2);
      quad([x + r, top, s0], [x + r, top, s1], [x + r, 0, s1], [x + r, 0, s0], 2);
      quad([x - r, 0, s0], [x - r, 0, s1], [x - r, top, s1], [x - r, top, s0], 2);
    }
  }
  // vạch nhịp: ngang cầu, cách đều trên đoạn tự do (mỗi ô nhịp ≈ 4,6 m), mỏng theo s nên dùng chính s của nó để uốn
  const bars = 5;
  for (let k = 0; k < bars; k++) {
    const s = STAFF.s0 + ((k + 0.5) * (STAFF.s1 - STAFF.s0)) / bars;
    const w = k === bars - 1 ? 0.2 : 0.09;
    const top = 0.14;
    quad([-HW, top, s - w], [-HW, top, s + w], [HW, top, s + w], [HW, top, s - w], 3);
    quad([-HW, 0, s + w], [HW, 0, s + w], [HW, top, s + w], [-HW, top, s + w], 3);
    quad([-HW, top, s - w], [HW, top, s - w], [HW, 0, s - w], [-HW, 0, s - w], 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  g.computeBoundingSphere();
  return g;
}

const STAFF_VERT = /* glsl */ `
attribute float aKind;
uniform float uT;
uniform float uH;
varying float vKind;
varying vec3 vL;
varying vec3 vN;
varying float vFogDepth;
${STAFF_GLSL}
void main(){
  vec3 p = position;
  float h = staffH(p.z, uT, uH);
  // cạnh dưới hơi chìm dưới đấu trường / sân ở hai đầu (chống z-fighting với mặt tĩnh)
  p.y += h - 0.03;
  float dh = (staffH(p.z + 0.05, uT, uH) - staffH(p.z - 0.05, uT, uH)) / 0.1;
  vN = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, -dh));
  vKind = aKind;
  vL = vec3(position.x, position.y, position.z);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const STAFF_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform float uT;
varying float vKind;
varying vec3 vL;
varying vec3 vN;
varying float vFogDepth;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aa(float x, float e){ float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(e - w, e + w, x); }
void main(){
  int k = int(vKind + 0.5);
  vec3 ink = vec3(0.125, 0.09, 0.17);
  vec3 c;
  if (k == 0) {
    // dải giấy nhạc dệt luồn dưới / trên 5 dòng kẻ: ô so le như mặt chiếu đan
    float u = vL.z * 1.25;
    float v = (vL.x + 2.0) * 1.25;
    float over = mod(floor(u) + floor(v), 2.0);
    c = mix(vec3(0.98, 0.93, 0.83), vec3(0.93, 0.86, 0.74), over);
    // khe đan + nét khắc gạch chéo trong dải nằm dưới
    vec2 f = fract(vec2(u, v));
    float gap = 1.0 - aa(min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)), 0.04);
    float hatch = (1.0 - aa(abs(fract((vL.x + vL.z) * 9.0) - 0.5), 0.18)) * over;
    c = mix(c, ink, gap * 0.55 + hatch * 0.18);
    // đốm "nốt" trôi theo sóng
    vec2 q = fract(vec2(vL.z * 0.5 - uT * 0.5, vL.x * 0.4 + 0.5)) - 0.5;
    c = mix(c, vec3(0.78, 0.24, 0.39), (1.0 - aa(length(q * vec2(1.0, 1.6)), 0.08)) * 0.55);
  } else if (k == 1) {
    float d = -vL.y;
    c = d < 0.06 ? vec3(1.0, 0.97, 0.9) : d < 0.11 ? ink : vec3(0.78, 0.24, 0.39) * (0.9 + 0.1 * step(0.5, fract(vL.z * 2.0)));
  } else if (k == 2) {
    c = vL.y > 0.09 ? vec3(0.36, 0.3, 0.5) : ink;
  } else if (k == 3) {
    c = vL.y > 0.13 ? vec3(0.3, 0.22, 0.42) : ink;
  } else {
    vec2 cc = fract(vL.xz / 0.9) - 0.5;
    c = mix(vec3(0.2, 0.12, 0.3), vec3(0.6, 0.2, 0.4), (1.0 - aa(length(cc), 0.2)) * 0.5);
  }
  c *= 0.975 + 0.05 * hash(floor(vL.xz * 18.0));
  vec3 N = normalize(vN);
  float ndl = k == 4 ? -1.0 : dot(N, uSun);
  float band = ndl > 0.35 ? 1.0 : ndl > -0.05 ? 0.82 : 0.66;
  c *= mix(vec3(0.5, 0.44, 0.78), vec3(1.0), band) * 1.08;
  c = mix(c, fogColor, smoothstep(fogNear, fogFar, vFogDepth));
  // màu chọn sẵn theo giá trị hiển thị (như vật liệu giấy của mê cung) — không đổi không gian màu
  gl_FragColor = vec4(c, 1.0);
}`;

/** Cầu khuông nhạc (cầu Nam): cùng hàm chiều cao với va chạm CPU */
export function StaffBridge() {
  const br = SURF_BY_ID[STAFF.id];
  const geo = useMemo(() => buildStaffBridge(), []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: STAFF_VERT,
        fragmentShader: STAFF_FRAG,
        fog: true,
        side: THREE.DoubleSide,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uH: { value: 8 }, uSun: { value: new THREE.Vector3(12, 20, 8).normalize() } }]),
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    const b = HARMONIC.beat;
    mat.uniforms.uT.value = b - Math.floor(b / STAFF.cycle) * STAFF.cycle;
    mat.uniforms.uH.value = HARMONIC.harmonics;
  });
  return <mesh name="perf:staffBridge" geometry={geo} material={mat} position={[br.x, br.y, br.z]} rotation-y={br.yaw ?? 0} frustumCulled={false} />;
}
