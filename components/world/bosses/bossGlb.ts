"use client";
/**
 * Nạp nền GLB của boss / quái Vùng Kỳ quan (Blender — docs/ai-reviews/voxel-world/BOSSES.md): mỗi node là MỘT lưới, màu từng phần
 * nằm ở màu đỉnh (albedo × AO nướng) → trả về hình học theo tên node để thay hình tạm (InstancedMesh / mesh) khi nạp xong.
 * Không treo (Suspense): trong lúc chờ, component vẫn vẽ hình tạm. Bộ đệm theo URL dùng chung cả phiên (không huỷ).
 */
import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type GeoMap = Record<string, THREE.BufferGeometry>;
const CACHE = new Map<string, Promise<GeoMap | null>>();

function load(url: string): Promise<GeoMap | null> {
  let p = CACHE.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          const out: GeoMap = {};
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh && o.name) out[o.name] = m.geometry;
          });
          resolve(out);
        },
        undefined,
        () => resolve(null),
      );
    });
    CACHE.set(url, p);
  }
  return p;
}

/** Hình học theo tên node (null khi chưa nạp / lỗi → giữ hình tạm) */
export function useBossGlb(url: string): GeoMap | null {
  const [geo, setGeo] = useState<GeoMap | null>(null);
  useEffect(() => {
    let alive = true;
    load(url).then((g) => alive && setGeo(g));
    return () => {
      alive = false;
    };
  }, [url]);
  return geo;
}

/** Bật màu đỉnh cho vật liệu đang dùng (màu nền về trắng vì màu đã nằm ở đỉnh; vật liệu đã biên dịch → needsUpdate) */
export function enableVertexColors(...mats: THREE.Material[]) {
  for (const m of mats) {
    const mm = m as THREE.MeshBasicMaterial;
    if (!mm.vertexColors) {
      mm.vertexColors = true;
      mm.color.set(1, 1, 1);
      mm.needsUpdate = true;
    }
  }
}
