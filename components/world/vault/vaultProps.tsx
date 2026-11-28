"use client";
/**
 * Mô hình Blender của Hầm Bổ đề (public/world/vault/vault_props.glb, nướng GI vào màu đỉnh, toon 2 tông):
 *  vp_island (đảo nổi đơn vị: mặt cỏ bán kính 1 ở y = 0), vp_plank (ván cầu 1,62 × 0,12 × 0,38 + dây buộc),
 *  vp_door (khung cửa hầm tròn), vp_fulcrum (điểm tựa + cột, gốc = trục đòn), vp_beam (đòn cân, mặt trên y = 0),
 *  vp_lemma (Tảng Bổ đề, bán kính 1), vp_pipe (pipe_foot cố định / pipe_body cao 1 co giãn / pipe_top đặt ở đỉnh).
 */
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "../fx/glbToon";

export const VAULT_PROPS_GLB = worldAsset("vault/vault_props.glb");
useGLTF.preload(VAULT_PROPS_GLB);

const cache = new Map<string, THREE.Object3D>();

/** Bản toon dùng chung của một node (gọi trong component; mesh + vật liệu dùng chung giữa các bản sao) */
export function useVaultProp(name: string): THREE.Object3D | null {
  const gltf = useGLTF(VAULT_PROPS_GLB);
  return useMemo(() => {
    const hit = cache.get(name);
    if (hit) return hit;
    const src = gltf.scene.getObjectByName(name);
    if (!src) return null;
    const base = toonize(src);
    cache.set(name, base);
    return base;
  }, [gltf, name]);
}

/** Một bản sao để gắn vào cảnh (<primitive object={...}/>) */
export function useVaultPropClone(name: string): THREE.Object3D | null {
  const base = useVaultProp(name);
  return useMemo(() => (base ? base.clone(true) : null), [base]);
}

/**
 * InstancedMesh cho từng mesh con của node (đảo, ván cầu…): cùng ma trận, hình học + vật liệu dùng chung với bản toon.
 * `tint` = mesh con nhận màu từng bản (setColorAt) + màu khởi đầu.
 */
export function useVaultInstanced(name: string, matrices: THREE.Matrix4[], tint?: { mesh: string; color: THREE.Color }): THREE.InstancedMesh[] {
  const base = useVaultProp(name);
  const list = useMemo(() => {
    if (!base) return [];
    const out: THREE.InstancedMesh[] = [];
    base.updateMatrixWorld(true);
    base.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // hình học đã bake vị trí con so với gốc node
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      const im = new THREE.InstancedMesh(geo, m.material, Math.max(1, matrices.length));
      im.count = matrices.length;
      matrices.forEach((x, i) => im.setMatrixAt(i, x));
      im.name = m.name;
      // màu từng bản phải có TRƯỚC lần biên dịch shader đầu (USE_INSTANCING_COLOR)
      if (tint && m.name === tint.mesh) for (let i = 0; i < matrices.length; i++) im.setColorAt(i, tint.color);
      im.computeBoundingSphere();
      out.push(im);
    });
    return out;
  }, [base, matrices, tint]);
  useEffect(() => () => list.forEach((im) => { im.geometry.dispose(); im.dispose(); }), [list]);
  return list;
}
