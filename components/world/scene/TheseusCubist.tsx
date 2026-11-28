"use client";
/**
 * TÀU THESEUS LẬP THỂ — bức collage kiểu Picasso lơ lửng sau hai ụ tàu (Thế giới Bất Khả):
 * cùng một con tàu `props/theseus.glb` hiện CÙNG LÚC từ 6 góc nhìn (mạn / mũi / trên / dưới / ¾ trước – sau, vài mảnh cận cảnh) trong 7 ô Voronoi
 * (lib/world/theseusCubist.ts; mỗi ô = mặt phẳng cắt vuông góc với khung → các mảnh không chồng nhau, không cần camera phụ).
 * Mỗi tấm ván một màu riêng (bảng màu lập thể) → nhận ra CÙNG một tấm ở mọi góc nhìn. Thay ván ở ụ A (TheseusDocks):
 * tấm sắp thay nhấp nháy, tấm đã thay hoá vàng ở mọi mảnh → danh tính tấm ván bất biến khi đổi điểm nhìn.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { N_PLANKS, replaceOrder } from "@/lib/world/theseus";
import { CUBIST, cubistCells } from "@/lib/world/theseusCubist";
import { toonize } from "../fx/glbToon";
import { Label3D } from "../ui/Labels";
import { useTheseus } from "./TheseusDocks";

const GLB = worldAsset("props/theseus.glb");
/** tâm khung tranh (thế giới) — sau hai ụ, quay về chỗ đứng xem */
export const CUBIST_AT = new THREE.Vector3(-8.75, 4.2, -19.4);
const ORDER = replaceOrder();
/** bảng màu lập thể (Picasso / Braque giai đoạn phân tích + tổng hợp) */
const PAL = ["#c98b3c", "#7a4b2a", "#5d6f86", "#8f9a6a", "#e6d2a6", "#a8553a", "#3f4a5a", "#d6a05a"].map((c) => new THREE.Color(c));
const PARTS = new THREE.Color("#4a3a30");
const GOLD = new THREE.Color("#f2c58c");
const GLINT = new THREE.Color("#ffb347");
const isPlank = (n: string) => n.startsWith("th_plank_");
const isStatic = (n: string) => n.startsWith("th_dock") || n.startsWith("th_cradle");

/** xoay con tàu cho từng góc nhìn (tàu dài theo x, cao theo y; khung tranh nhìn từ +z) */
const VIEW_ROT: Record<string, THREE.Euler> = {
  side: new THREE.Euler(0, 0, 0),
  bow: new THREE.Euler(0, -Math.PI / 2, 0),
  top: new THREE.Euler(Math.PI / 2, 0, 0),
  three: new THREE.Euler(0.35, 0.75, 0),
  under: new THREE.Euler(-1.1, 0.4, 0),
  back: new THREE.Euler(0.25, Math.PI + 0.6, 0),
};

/** nền tranh: ô màu phẳng + gạch chéo than chì + đường viền mảnh đậm (cùng hạt Voronoi với các mảnh) */
const BG_FS = /* glsl */ `
  uniform vec2 uSeeds[7]; uniform vec3 uCol[7]; uniform vec2 uHalf;
  varying vec2 vP;
  void main(){
    float d1 = 1e9, d2 = 1e9; int k = 0;
    for (int i = 0; i < 7; i++) { float d = distance(vP, uSeeds[i]); if (d < d1) { d2 = d1; d1 = d; k = i; } else if (d < d2) d2 = d; }
    vec3 col = uCol[0];
    for (int i = 0; i < 7; i++) if (i == k) col = uCol[i];
    float hatch = step(0.82, fract((vP.x + vP.y * (k == 1 || k == 3 || k == 5 ? -1.0 : 1.0)) * 7.0)) * 0.12;
    col *= 1.0 - hatch;
    float edge = 1.0 - smoothstep(0.03, 0.06, d2 - d1);
    float frame = 1.0 - smoothstep(0.04, 0.09, min(uHalf.x - abs(vP.x), uHalf.y - abs(vP.y)));
    col = mix(col, vec3(0.08, 0.07, 0.08), max(edge, frame));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function TheseusCubist() {
  const gltf = useGLTF(GLB);
  const gl = useThree((s) => s.gl);
  const shards = useMemo(() => {
    const cells = cubistCells(CUBIST.seeds, CUBIST.hw, CUBIST.hh);
    const U = new THREE.Vector3(1, 0, 0);
    const V = new THREE.Vector3(0, 1, 0);
    return CUBIST.seeds.map((seed, i) => {
      const root = toonize(gltf.scene);
      const planks: THREE.MeshToonMaterial[] = [];
      const drop: THREE.Object3D[] = [];
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (isStatic(m.name)) return void drop.push(m);
        const mat = m.material as THREE.MeshToonMaterial;
        if (isPlank(m.name)) {
          const idx = parseInt(m.name.slice(9), 10);
          mat.color.copy(PAL[idx % PAL.length]);
          planks[idx] = mat;
        } else if (mat.color) mat.color.copy(PARTS);
      });
      drop.forEach((o) => o.parent?.remove(o));
      // mặt phẳng cắt (thế giới) của ô i: n·p + c ≥ 0 trong hệ (U, V) của khung → mặt phẳng vuông góc khung
      const planes = cells[i].map((h) => {
        const n = U.clone().multiplyScalar(h.nx).add(V.clone().multiplyScalar(h.ny));
        return new THREE.Plane(n, h.c - n.dot(CUBIST_AT));
      });
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => (mt.clippingPlanes = planes));
        // tranh lập thể giữ chất toon (phẳng, nét mực) cả ở chế độ Siêu thực
        m.userData.noReal = true;
      });
      // đặt tàu: tâm thân tàu (≈ y 3,2 trước khi thu) vào hạt giống, lớp sâu so le
      // PHÙ ĐIÊU: ép dẹt theo pháp tuyến khung (z thế giới) còn 12% và áp sát mặt tranh — nếu để tàu dày 2–4 m nhô ra trước,
      // phối cảnh từ dưới nhìn lên đẩy phần gần camera ra NGOÀI khung (lăng trụ cắt vuông góc khung không chặn được thị sai)
      const pivot = new THREE.Group();
      pivot.position.set(CUBIST_AT.x + seed.x, CUBIST_AT.y + seed.y, CUBIST_AT.z + 0.12 + i * 0.03);
      pivot.scale.set(1, 1, 0.12);
      root.scale.setScalar(seed.scale);
      root.position.set(0, -3.2 * seed.scale, 0);
      const spin = new THREE.Group();
      spin.rotation.copy(VIEW_ROT[seed.view]);
      spin.add(root);
      pivot.add(spin);
      return { pivot, spin, planks, base: VIEW_ROT[seed.view].clone() };
    });
  }, [gltf]);
  const bg = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uSeeds: { value: CUBIST.seeds.map((s) => new THREE.Vector2(s.x, s.y)) },
          uCol: { value: ["#e7d8b8", "#b9c3c9", "#d9b48a", "#c7c9a8", "#a9b4bd", "#e2c89c", "#bfae8e"].map((c) => new THREE.Color(c)) },
          uHalf: { value: new THREE.Vector2(CUBIST.hw, CUBIST.hh) },
        },
        vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: BG_FS,
      }),
    [],
  );
  useEffect(() => {
    const prev = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    return () => {
      gl.localClippingEnabled = prev;
      bg.dispose();
      shards.forEach((s) => s.pivot.traverse((o) => ((o as THREE.Mesh).material as THREE.Material | undefined)?.dispose?.()));
    };
  }, [gl, bg, shards]);
  useFrame((st) => {
    // cờ cắt cục bộ của renderer có thể bị chỗ khác đặt lại (đổi chất lượng, hot reload) → giữ bật mỗi khung (rẻ)
    st.gl.localClippingEnabled = true;
    const t = st.clock.elapsedTime;
    const s = useTheseus.getState();
    const now = performance.now();
    const next = s.k < N_PLANKS ? ORDER[s.k] : -1;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    shards.forEach((sh, i) => {
      // mỗi mảnh khẽ xoay quanh trục đứng của nó — nhắc rằng đây là CÙNG một vật nhìn từ nhiều phía
      sh.spin.rotation.set(sh.base.x, sh.base.y + Math.sin(t * 0.35 + i * 1.7) * 0.09, sh.base.z);
      for (let k = 0; k < N_PLANKS; k++) {
        const m = sh.planks[k];
        if (!m) continue;
        const t0 = s.t0[k];
        if (t0 >= 0) {
          m.color.copy(GOLD);
          m.emissive.copy(GLINT).multiplyScalar(Math.max(0.08, 0.9 - (now - t0) / 1800));
        } else {
          m.color.copy(PAL[k % PAL.length]);
          m.emissive.copy(GLINT).multiplyScalar(k === next ? 0.35 * pulse : 0);
        }
      }
    });
  });
  return (
    <group name="theseus-cubist">
      <mesh position={CUBIST_AT} material={bg}>
        <planeGeometry args={[CUBIST.hw * 2, CUBIST.hh * 2]} />
      </mesh>
      {shards.map((s, i) => (
        <primitive key={i} object={s.pivot} />
      ))}
      <Label3D text="Tàu Theseus lập thể · một tấm ván, nhiều góc nhìn" position={[CUBIST_AT.x, CUBIST_AT.y + CUBIST.hh + 0.5, CUBIST_AT.z]} maxDist={40} />
    </group>
  );
}
