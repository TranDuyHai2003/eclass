"use client";
/**
 * Turn a Blender-exported GLB node into a cel-shaded game object:
 * - materials named "glow_*" → unlit HDR colour (picked up by bloom, ignored by lighting)
 * - everything else → MeshToonMaterial with the shared coloured gradient (2-band anime shading)
 * Meshes are shared between clones (cheap); materials are cloned per instance only when asked
 * (e.g. monsters that flash white when hit).
 */
import * as THREE from "three";
import { GRADIENT } from "./shaders";

export function toonize(src: THREE.Object3D): THREE.Object3D {
  const base = src.clone(true);
  base.position.set(0, 0, 0);
  base.rotation.set(0, 0, 0);
  base.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // Màu đỉnh (COLOR_0) = bóng / AO nướng sẵn trong Blender → nhân vào màu (đổ bóng không tốn gì khi chạy)
    const vc = !!(m.geometry as THREE.BufferGeometry).attributes.color;
    const conv = (mat: THREE.Material) => {
      const std = mat as THREE.MeshStandardMaterial;
      if (std.name.startsWith("glow_")) return new THREE.MeshBasicMaterial({ color: std.color.clone().multiplyScalar(2.2), toneMapped: false, vertexColors: vc });
      const t = new THREE.MeshToonMaterial({ color: std.color, gradientMap: GRADIENT, vertexColors: vc, map: std.map ?? null });
      t.name = std.name;
      return t;
    };
    m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
  });
  return base;
}

/** Bản sao có vật liệu riêng (để đổi emissive / màu từng con) */
export function cloneWithOwnMaterials(base: THREE.Object3D): { obj: THREE.Object3D; toon: THREE.MeshToonMaterial[]; glow: THREE.MeshBasicMaterial[] } {
  const obj = base.clone(true);
  const toon: THREE.MeshToonMaterial[] = [];
  const glow: THREE.MeshBasicMaterial[] = [];
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const c = (mat: THREE.Material) => {
      const k = mat.clone();
      if ((k as THREE.MeshToonMaterial).isMeshToonMaterial) {
        addDissolve(k as THREE.MeshToonMaterial);
        toon.push(k as THREE.MeshToonMaterial);
      }
      else if ((k as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
        k.userData.base = (k as THREE.MeshBasicMaterial).color.clone();
        glow.push(k as THREE.MeshBasicMaterial);
      }
      return k;
    };
    m.material = Array.isArray(m.material) ? m.material.map(c) : c(m.material);
  });
  return { obj, toon, glow };
}

/**
 * Tan biến khi chết (VFX_PIPELINE "Monster death dissolve"): bị ăn mòn từ dưới lên theo nhiễu khối,
 * với một dải mép cháy sáng HDR. Điều khiển qua material.userData.dissolve.value (0 → 1) và .edge (màu).
 */
export function addDissolve(mat: THREE.MeshToonMaterial) {
  const dissolve = { value: 0 };
  const edge = { value: new THREE.Color("#ffd27a") };
  mat.userData.dissolve = dissolve;
  mat.userData.edge = edge;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDissolve = dissolve;
    sh.uniforms.uEdge = edge;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
varying vec3 vDisP;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vDisP = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vDisP;
uniform float uDissolve;
uniform vec3 uEdge;`)
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        float dn = fract(sin(dot(floor(vDisP * 14.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float cut = vDisP.y + dn * 0.22 - (uDissolve * 1.9 - 0.25);
        if (uDissolve > 0.0 && cut < 0.0) discard;`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
        if (uDissolve > 0.0 && cut < 0.08) gl_FragColor.rgb = uEdge * 2.6;`,
      );
  };
  mat.needsUpdate = true;
}
