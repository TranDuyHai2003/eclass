"use client";
/**
 * Hư Không Nghịch Lý — phong cách lai "cosmic cyberpunk siêu thực" (kiểu Honkai: Star Rail):
 * nhân vật giữ cel shading anime, còn MÔI TRƯỜNG dùng vật liệu PBR phản chiếu bầu trời tinh vân thật
 * (bản đồ môi trường dựng từ chính shader bầu trời bằng CubeCamera + PMREM), sàn đảo tâm là gương ướt (planar reflection),
 * viền vàng kim loại, đá đáy đảo ánh xà cừ (iridescence), neon rực hơn. Có công tắc để so với kiểu hoạt hình (cel).
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { create } from "zustand";
import { nebulaSky } from "./ParadoxVoidFx";
import { useWorld } from "../store";

const KEY = "world.pdxReal";
function load(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
/** Phong cách Hư Không: true = lai siêu thực (mặc định), false = hoạt hình (cel) */
export const usePdxStyle = create<{ real: boolean }>(() => ({ real: typeof window === "undefined" ? true : load() }));
export function togglePdxStyle() {
  const real = !usePdxStyle.getState().real;
  usePdxStyle.setState({ real });
  try {
    localStorage.setItem(KEY, real ? "1" : "0");
  } catch {}
}

/** Nguồn tia sáng thể tích (god rays) — lưới phát sáng đặt ở hố đen, hậu kỳ đọc qua store */
export const useGodSun = create<{ sun: THREE.Mesh | null }>(() => ({ sun: null }));
export function GodSun({ position, radius }: { position: [number, number, number]; radius: number }) {
  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd2a0"), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    m.position.set(...position);
    return m;
  }, [position, radius]);
  useEffect(() => {
    useGodSun.setState({ sun: mesh });
    return () => {
      useGodSun.setState({ sun: null });
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [mesh]);
  return <primitive object={mesh} />;
}

/** Bản đồ môi trường từ bầu trời shader (chụp 1 lần) → scene.environment cho mọi vật liệu PBR. sky: dựng vật liệu bầu trời (mặc định tinh vân Hư Không) */
export function VoidEnvironment({ intensity = 1, sky: skyMat = nebulaSky }: { intensity?: number; sky?: () => THREE.ShaderMaterial }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const sky = new THREE.Scene();
    const mat = skyMat();
    mat.uniforms.uT.value = 40;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), mat);
    sky.add(mesh);
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(1, 500, rt);
    cam.update(gl, sky);
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromCubemap(rt.texture).texture;
    const prev = scene.environment;
    const prevI = scene.environmentIntensity;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = prev;
      scene.environmentIntensity = prevI;
      [env, rt, pm, mat, mesh.geometry].forEach((o) => o.dispose());
    };
  }, [gl, scene, intensity, skyMat]);
  return null;
}

type Phys = Partial<THREE.MeshPhysicalMaterialParameters>;
/** Thông số PBR theo tên vật liệu Blender (đảo, cầu, kỳ quan) */
const PBR: Record<string, Phys> = {
  v_floor_a: { color: "#2b2f5c", metalness: 0.25, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.06 },
  v_floor_b: { color: "#4a3b8e", metalness: 0.2, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 },
  v_floor_c: { color: "#0b0c1d", metalness: 0.5, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 },
  v_gold: { color: "#ffcf78", metalness: 1, roughness: 0.2 },
  v_earth: { color: "#33285f", metalness: 0.2, roughness: 0.62, iridescence: 0.5, iridescenceIOR: 1.5, envMapIntensity: 0.55 },
  v_rock: { color: "#15112b", metalness: 0.25, roughness: 0.55, iridescence: 0.7, iridescenceIOR: 1.7, envMapIntensity: 0.5 },
  /** mặt trên mảnh đá trôi: tối, nhám — trên trời đầy mảnh vụn, bóng loáng sẽ loá trắng */
  debris_top: { color: "#241e48", metalness: 0.2, roughness: 0.7, envMapIntensity: 0.4 },
  v_rock2: { color: "#1f1844", metalness: 0.25, roughness: 0.55, iridescence: 0.7, iridescenceIOR: 1.6, envMapIntensity: 0.5 },
  v_ped: { color: "#13122a", metalness: 0.6, roughness: 0.15, clearcoat: 1 },
  v_tile: { color: "#2c2a60", metalness: 0.4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 },
  v_tile_d: { color: "#3c3384", metalness: 0.4, roughness: 0.15, clearcoat: 1 },
  t_beam_a: { color: "#f4ecff", metalness: 0.1, roughness: 0.18, clearcoat: 1 },
  t_beam_b: { color: "#cdbaff", metalness: 0.2, roughness: 0.2, clearcoat: 1 },
  t_beam_c: { color: "#9d84e8", metalness: 0.3, roughness: 0.22, clearcoat: 1 },
  h_body: { color: "#9c7ae6", metalness: 0.8, roughness: 0.18, iridescence: 1, iridescenceIOR: 1.8 },
  m_pearl: { color: "#f2ecff", metalness: 0.05, roughness: 0.15, clearcoat: 1, sheen: 0.5, sheenColor: new THREE.Color("#c8b8ff") },
  m_gold: { color: "#ffcf78", metalness: 1, roughness: 0.18 },
  s_stone: { color: "#e8e2ff", metalness: 0.1, roughness: 0.12, clearcoat: 1 },
  // Thế giới Bất Khả mở rộng (props/imp_cosmos.glb)
  k_knot: { color: "#b9a2ff", metalness: 0.85, roughness: 0.16, iridescence: 1, iridescenceIOR: 1.7, clearcoat: 1 },
  s_pearl: { color: "#f3ecff", metalness: 0.05, roughness: 0.12, clearcoat: 1, sheen: 0.4, sheenColor: new THREE.Color("#d8c8ff") },
  f_seed: { color: "#4a2a12", metalness: 0, roughness: 0.75 },
  f_seed2: { color: "#9a5a22", metalness: 0, roughness: 0.6 },
  f_petal: { color: "#ffc93a", metalness: 0, roughness: 0.45, sheen: 0.8, sheenColor: new THREE.Color("#fff0a0"), side: THREE.DoubleSide },
  f_stem: { color: "#4f8a4a", metalness: 0, roughness: 0.55, side: THREE.DoubleSide },
  f_shell: { color: "#f6e7d0", metalness: 0.1, roughness: 0.18, clearcoat: 1, iridescence: 0.6, iridescenceIOR: 1.4 },
  f_shell2: { color: "#c9784a", metalness: 0.1, roughness: 0.22, clearcoat: 1 },
  k_skin: { color: "#8fe3ff", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.45, iridescence: 1, side: THREE.DoubleSide, depthWrite: false },
};

/**
 * Vật liệu PBR thay cho vật liệu nướng sẵn. Màu đỉnh (ánh sáng nướng trong Blender) giữ lại làm AO mềm:
 * nhân một nửa độ sáng nướng vào màu nền (không nhuốm màu) — vẫn có khe tối, nhưng ánh sáng chính là đèn + bản đồ môi trường thật.
 */
export function hybridMaterial(src: THREE.MeshStandardMaterial, baked: boolean, as?: string): THREE.Material {
  const name = as ?? src.name;
  const st = /^v_st(\d)$/.exec(name);
  const p: Phys = st
    ? { color: src.color.clone().multiplyScalar(0.55), metalness: 0.15, roughness: 0.2, clearcoat: 1, emissive: src.color.clone(), emissiveIntensity: 0.12 }
    : (PBR[name] ?? { color: src.color.clone(), metalness: 0.2, roughness: 0.35 });
  // đá / đất: mặt phẳng từng mảnh (pháp tuyến từ đạo hàm màn hình) — vẻ tinh thể góc cạnh, không cần pháp tuyến trong GLB
  const facet = /^v_(rock|rock2|earth)$/.test(name);
  const m = new THREE.MeshPhysicalMaterial({ envMapIntensity: 1.15, ...p, vertexColors: baked, flatShading: facet });
  m.name = name;
  if (baked) {
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          float bakedL = dot(pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)), vec3(0.3, 0.59, 0.11));
          diffuseColor.rgb *= mix(1.0, clamp(bakedL * 1.4, 0.25, 1.15), 0.55);
        #endif`,
      );
    };
    m.customProgramCacheKey = () => "pdx-hybrid-ao";
  }
  return m;
}

/** Đổi vật liệu một cây đối tượng GLB (giữ nguyên vật liệu glow_*) sang PBR — dùng cho kỳ quan */
export function physicalize(src: THREE.Object3D): THREE.Object3D {
  const base = src.clone(true);
  base.position.set(0, 0, 0);
  base.rotation.set(0, 0, 0);
  base.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const conv = (mat: THREE.Material) => {
      const s = mat as THREE.MeshStandardMaterial;
      if (s.name.startsWith("glow_")) return new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(3), toneMapped: false });
      return hybridMaterial(s, false);
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
  return base;
}

/** Sàn gương ướt của đảo tâm (phản chiếu thật: nhân vật, dải Möbius, neon, bầu trời) — trong mờ để lộ hoa văn khảm bên dưới */
export function HubMirror({ radius = 8.35, resolution = 512 }: { radius?: number; resolution?: number }) {
  const geo = useMemo(() => new THREE.RingGeometry(2.25, radius, 96, 1), [radius]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[0, 0.006, 0]} renderOrder={1}>
      <MeshReflectorMaterial
        resolution={resolution}
        blur={[260, 80]}
        mixBlur={0.9}
        mixStrength={1.7}
        mixContrast={1.1}
        mirror={0.85}
        depthScale={0}
        color="#0a0b1e"
        metalness={0.55}
        roughness={0.35}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Bóng đổ thời gian thực (mức Siêu): một đèn hướng bám theo người chơi, khung bóng trực giao 28 × 28 m, shadow map 2048² PCF mềm.
 * Nhân vật / đạo cụ đổ bóng, mặt đảo nhận bóng. Lưới tải muộn (VRM) được gắn cờ lại mỗi 1,5 s.
 */
export function ShadowRig({ dir: sun }: { dir?: [number, number, number] } = {}) {
  const { gl, scene } = useThree();
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffe2c4", 1.6);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera;
    c.left = -14;
    c.right = 14;
    c.top = 14;
    c.bottom = -14;
    c.near = 1;
    c.far = 90;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.03;
    l.shadow.radius = 4;
    return l;
  }, []);
  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    const flag = () =>
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // nhân vật (VRM / MToon, có khung xương) đổ bóng; bề mặt PBR / toon nhận bóng
        if ((m as THREE.SkinnedMesh).isSkinnedMesh) m.castShadow = true;
        const first = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
        const lit = !!first && !(first as THREE.MeshBasicMaterial).isMeshBasicMaterial && !(first as THREE.ShaderMaterial).isShaderMaterial;
        if (lit) m.receiveShadow = true;
      });
    flag();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
    });
    const id = window.setInterval(flag, 1500);
    scene.add(light, light.target);
    return () => {
      window.clearInterval(id);
      scene.remove(light, light.target);
      light.dispose();
      gl.shadowMap.enabled = false;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.needsUpdate = true));
      });
    };
  }, [gl, scene, light]);
  const dir = useMemo(() => new THREE.Vector3(...(sun ?? [95, 60, -170])).normalize(), [sun]);
  useFrame(() => {
    const p = useWorld.getState().player;
    // bám theo người chơi, nắn theo ô 0,5 m để bóng không "bơi" khi di chuyển
    const sx = Math.round(p.x * 2) / 2;
    const sz = Math.round(p.z * 2) / 2;
    light.target.position.set(sx, p.y, sz);
    light.position.set(sx + dir.x * 40, p.y + dir.y * 40, sz + dir.z * 40);
    light.target.updateMatrixWorld();
  });
  return null;
}
