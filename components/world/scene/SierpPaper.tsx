"use client";
/**
 * Tấm Sierpiński bằng GIẤY CẮT DÁN ở mép đảo Sierpiński (lib/world/sierpPaper.ts):
 *  bấm F → bóc các tam giác giữa (giấy cuộn lên, bay ra, tan trong 1,4 s), lộ ba bản sao nhỏ; lỗ thủng nhìn ra vũ trụ phía sau.
 *  Bảng: cấp n · 3ⁿ tam giác · diện tích (3/4)ⁿ · chu vi (3/2)ⁿ — đoán trước rồi bóc để kiểm chứng. Cấp 5 → F dán lại từ đầu.
 *  Mảnh giấy: giấy ngà / giấy kẻ ô / giấy báo / giấy chấm, mép xé theo nhiễu, viền mực mảnh (collage hậu hiện đại).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ISLES } from "@/lib/world/impCosmos";
import { keptAt, peeledAt, stats, type Tri } from "@/lib/world/sierpPaper";
import { registerAction } from "../actions";
import { Label3D } from "../ui/Labels";
import { sfx } from "@/lib/world/sfx";

const ISLE = ISLES.find((i) => i.id === "sierp")!;
/** hướng đặt tấm giấy: lệch ~70° khỏi hướng về sân (phía đó đã có điểm thí nghiệm Sierpiński) */
const DIR = new THREE.Vector2(-ISLE.x, -ISLE.z).normalize().rotateAround(new THREE.Vector2(), 1.2);
export const SIERP_WALL = { x: ISLE.x + DIR.x * 6.6, y: ISLE.h, z: ISLE.z + DIR.y * 6.6 };
const S = 6;
const MAXLV = 5;
const MAXK = 3 ** MAXLV;
const MAXP = 3 ** (MAXLV - 1);

const PAPER_VS = /* glsl */ `
  attribute vec3 aBary; attribute vec2 aPaper; // (kiểu giấy 0–3, hạt giống)
  varying vec3 vBary; varying vec2 vPaper; varying vec2 vLocal; varying float vFade;
  uniform float uT;
  void main(){
    vBary = aBary; vPaper = aPaper; vLocal = position.xy;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vFade = 1.0;
    #ifdef USE_INSTANCING_COLOR
      vFade = instanceColor.r;
    #endif
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const PAPER_FS = /* glsl */ `
  varying vec3 vBary; varying vec2 vPaper; varying vec2 vLocal; varying float vFade;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
  void main(){
    float e = min(vBary.x, min(vBary.y, vBary.z));
    // mép xé: cắt theo nhiễu gần cạnh
    float tear = n2(vLocal * 22.0 + vPaper.y * 13.0) * 0.06;
    if (e < tear * 0.7) discard;
    float k = vPaper.x;
    vec3 col;
    if (k < 0.5) col = vec3(0.95, 0.9, 0.79);
    else if (k < 1.5) {
      vec2 g = abs(fract(vLocal * 9.0) - 0.5);
      col = mix(vec3(0.9, 0.95, 0.97), vec3(0.45, 0.65, 0.85), (1.0 - smoothstep(0.0, 0.04, min(g.x, g.y))) * 0.6);
    } else if (k < 2.5) {
      float line = 1.0 - smoothstep(0.0, 0.08, abs(fract(vLocal.y * 26.0) - 0.5));
      float word = step(0.35, n2(vec2(vLocal.x * 18.0, floor(vLocal.y * 26.0)) + vPaper.y * 7.0));
      col = mix(vec3(0.93, 0.91, 0.86), vec3(0.25, 0.24, 0.26), line * word * 0.55);
    } else {
      vec2 c = fract(vLocal * 7.0) - 0.5;
      col = mix(vec3(0.98, 0.78, 0.74), vec3(0.85, 0.35, 0.42), 1.0 - smoothstep(0.18, 0.22, length(c)));
    }
    // vân sợi giấy + viền mực mảnh + bóng mép (giấy nổi khỏi nền)
    col *= 0.92 + 0.12 * n2(vLocal * 60.0 + vPaper.y);
    col = mix(vec3(0.16, 0.12, 0.14), col, smoothstep(tear * 0.7, tear * 0.7 + 0.03, e));
    col *= mix(0.78, 1.0, smoothstep(0.0, 0.12, e));
    gl_FragColor = vec4(col * vFade, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const BACK_FS = /* glsl */ `varying vec2 vUv; uniform float uT;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    vec2 p = vUv * 60.0; vec2 c = floor(p); float s = step(0.985, h(c)) * smoothstep(0.4, 0.0, length(fract(p) - 0.5));
    vec3 col = mix(vec3(0.05, 0.03, 0.12), vec3(0.25, 0.1, 0.35), vUv.y) + vec3(0.9, 0.95, 1.0) * s * (0.6 + 0.4 * sin(uT * 2.0 + h(c) * 40.0));
    gl_FragColor = vec4(col, 1.0);
  }`;

function triGeometry() {
  // tam giác đều cạnh 1, trọng tâm ở gốc, đỉnh lên
  const h = Math.sqrt(3) / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -h / 3, 0, 0.5, -h / 3, 0, 0, (2 * h) / 3, 0], 3));
  g.setAttribute("aBary", new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  return g;
}

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const V = new THREE.Vector3();
const SC = new THREE.Vector3();
const C1 = new THREE.Color(1, 1, 1);

export function SierpPaper() {
  const [level, setLevel] = useState(0);
  const mats = useMemo(() => {
    const paper = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: PAPER_VS, fragmentShader: PAPER_FS, side: THREE.DoubleSide });
    const back = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }", fragmentShader: BACK_FS });
    return { paper, back };
  }, []);
  const ims = useMemo(() => {
    const mk = (n: number) => {
      const g = triGeometry();
      g.setAttribute("aPaper", new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
      const im = new THREE.InstancedMesh(g, mats.paper, n);
      im.count = 0;
      im.frustumCulled = false;
      im.setColorAt(0, C1);
      return im;
    };
    return { kept: mk(MAXK), peel: mk(MAXP) };
  }, [mats]);
  useEffect(
    () => () => {
      ims.kept.geometry.dispose();
      ims.peel.geometry.dispose();
      mats.paper.dispose();
      mats.back.dispose();
    },
    [ims, mats],
  );
  // mảnh đang bóc: thời điểm + hướng bay ngẫu nhiên
  const peel = useRef<{ t0: number; tris: Tri[]; dir: number[] }>({ t0: -1e9, tris: [], dir: [] });
  const setKept = (tris: Tri[]) => {
    const pa = ims.kept.geometry.attributes.aPaper as THREE.InstancedBufferAttribute;
    tris.forEach((t, i) => {
      ims.kept.setMatrixAt(i, M4.compose(V.set(t.x, t.y, 0.02), Q.identity(), SC.set(t.s * 0.985, t.s * 0.985, 1)));
      ims.kept.setColorAt(i, C1);
      // kiểu giấy theo vị trí (ổn định qua các cấp)
      const seed = Math.abs(Math.sin(t.x * 12.9898 + t.y * 78.233)) % 1;
      pa.setXY(i, Math.floor(seed * 4), seed * 10);
    });
    ims.kept.count = tris.length;
    ims.kept.instanceMatrix.needsUpdate = true;
    if (ims.kept.instanceColor) ims.kept.instanceColor.needsUpdate = true;
    pa.needsUpdate = true;
  };
  useEffect(() => {
    setKept(keptAt(S, level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, ims]);
  useEffect(
    () =>
      registerAction("sierp-peel", () => {
        setLevel((lv) => {
          if (lv >= MAXLV) {
            sfx.circle();
            return 0;
          }
          const n = lv + 1;
          const tris = peeledAt(S, n);
          peel.current = { t0: performance.now(), tris, dir: tris.map(() => Math.random() * 2 - 1) };
          const pa = ims.peel.geometry.attributes.aPaper as THREE.InstancedBufferAttribute;
          tris.forEach((t, i) => pa.setXY(i, i % 4, i * 0.37));
          pa.needsUpdate = true;
          ims.peel.count = tris.length;
          sfx.step();
          return n;
        });
      }),
    [ims],
  );
  useFrame((state) => {
    mats.back.uniforms.uT.value = state.clock.elapsedTime;
    const P = peel.current;
    const k = (performance.now() - P.t0) / 1400;
    if (k > 1) {
      ims.peel.count = 0;
      return;
    }
    // giấy bóc: cuộn quanh cạnh trên (xoay quanh trục x) + bay ra trước + trôi ngang + thu nhỏ, mờ dần
    P.tris.forEach((t, i) => {
      const e = k * k * (3 - 2 * k);
      E.set(-e * 2.2, P.dir[i] * e * 1.5, P.dir[i] * e * 0.8);
      Q.setFromEuler(E);
      V.set(t.x + P.dir[i] * e * 2.5, t.y + e * 1.8 + Math.sin(k * 6 + i) * 0.1, 0.05 + e * 3.5);
      const s = t.s * (1 - e * 0.35);
      ims.peel.setMatrixAt(i, M4.compose(V, Q, SC.set(s, -s, 1)));
      ims.peel.setColorAt(i, C1.setScalar(1 - e * 0.85));
    });
    C1.setScalar(1);
    ims.peel.instanceMatrix.needsUpdate = true;
    if (ims.peel.instanceColor) ims.peel.instanceColor.needsUpdate = true;
  });
  const st = stats(level);
  const label = `Tam giác Sierpiński bằng giấy · cấp ${level} · ${st.count} tam giác · diện tích (3/4)ⁿ = ${(st.area * 100).toFixed(1).replace(".", ",")}% · chu vi (3/2)ⁿ = ${st.perimeter.toFixed(2).replace(".", ",")}× · F: ${level < MAXLV ? `bóc tiếp (đoán: còn bao nhiêu tam giác?)` : "dán lại từ đầu"}`;
  const yaw = Math.atan2(DIR.x, DIR.y);
  const h = (S * Math.sqrt(3)) / 2;
  return (
    <group position={[SIERP_WALL.x, SIERP_WALL.y + 0.2, SIERP_WALL.z]} rotation-y={yaw} name="sierp-paper">
      {/* nền vũ trụ sau tấm giấy (lỗ thủng nhìn ra sao) */}
      <mesh position={[0, 0, -0.03]} material={mats.back}>
        <shapeGeometry args={[new THREE.Shape([new THREE.Vector2(-S / 2 - 0.15, -0.1), new THREE.Vector2(S / 2 + 0.15, -0.1), new THREE.Vector2(0, h + 0.2)])]} />
      </mesh>
      <primitive object={ims.kept} />
      <primitive object={ims.peel} />
      {/* chân đế gỗ */}
      <mesh position={[0, -0.1, -0.1]}>
        <boxGeometry args={[S + 0.6, 0.25, 0.5]} />
        <meshStandardMaterial color="#5a3c2a" roughness={0.8} />
      </mesh>
      <Label3D text={label} position={[0, h + 1.2, 0]} />
    </group>
  );
}
