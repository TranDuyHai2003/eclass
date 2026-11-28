"use client";
/**
 * Đạo cụ Blender đặt trong phòng điều khiển Siêu khối (GI nướng vào màu đỉnh): đổi vật liệu sang bộ "nướng" chung của phòng
 * (ROOM_U — phơi sáng / nhuốm màu khi du hành) và "glow_*" sang màu HDR không chiếu sáng; tách lưới con để instancing.
 */
import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { bakedMaterial } from "../fx/baked";
import { PROP_U } from "./roomUniforms";

export type PropMesh = { geo: THREE.BufferGeometry; mat: THREE.Material };

export function useRoomProps(url: string) {
  const gltf = useGLTF(url);
  const api = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const conv = (src: THREE.Material) => {
      const std = src as THREE.MeshStandardMaterial;
      let m = cache.get(std.name);
      if (!m) {
        m = std.name.startsWith("glow_") ? new THREE.MeshBasicMaterial({ color: std.color.clone().multiplyScalar(2.2), toneMapped: false }) : bakedMaterial(std, PROP_U);
        m.name = std.name;
        cache.set(std.name, m);
      }
      return m;
    };
    /** các lưới con của node (hình học đã đưa về khung của node, dùng cho InstancedMesh) */
    const meshesOf = (name: string): PropMesh[] => {
      const root = gltf.scene.getObjectByName(name);
      const out: PropMesh[] = [];
      if (!root) return out;
      root.updateMatrixWorld(true);
      const inv = root.matrixWorld.clone().invert();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) out.push({ geo: m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)), mat: conv(m.material as THREE.Material) });
      });
      return out;
    };
    /** bản sao node (gốc về 0) với vật liệu phòng */
    const clone = (name: string): THREE.Object3D => {
      const o = gltf.scene.getObjectByName(name)?.clone(true) ?? new THREE.Group();
      o.position.set(0, 0, 0);
      o.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(conv) : conv(mesh.material);
      });
      return o;
    };
    return { meshesOf, clone, cache };
  }, [gltf]);
  useEffect(() => () => api.cache.forEach((m) => m.dispose()), [api]);
  return api;
}
