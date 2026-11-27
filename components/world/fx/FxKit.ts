"use client";
/**
 * FX kit modelled in Blender (public/world/fx/fxkit.glb): anime sparkle star, crystal shard, cyber hex chip,
 * light arrow, brilliant gem, quantum orbital, crescent slash ribbon (UV), zigzag bolt ribbon (UV),
 * crystal meteor, accretion disk, photon ring. Geometries are shared by every pool / instanced mesh.
 */
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { toonize } from "./glbToon";

const FX_GLB = worldAsset("fx/fxkit.glb");
useGLTF.preload(FX_GLB);

export type FxGeoName = "fx_star" | "fx_shard" | "fx_hex" | "fx_arrow" | "fx_gem" | "fx_orbital" | "fx_slash" | "fx_bolt" | "fx_disk" | "fx_photon";

export function useFxKit() {
  const gltf = useGLTF(FX_GLB);
  return useMemo(() => {
    const geo = {} as Record<FxGeoName, THREE.BufferGeometry>;
    const names: FxGeoName[] = ["fx_star", "fx_shard", "fx_hex", "fx_arrow", "fx_gem", "fx_orbital", "fx_slash", "fx_bolt", "fx_disk", "fx_photon"];
    for (const n of names) {
      const node = gltf.scene.getObjectByName(n);
      let mesh: THREE.Mesh | null = null;
      node?.traverse((o) => {
        if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
      });
      const g = (mesh as THREE.Mesh | null)?.geometry.clone() ?? new THREE.IcosahedronGeometry(0.5, 0);
      geo[n] = g;
    }
    // Vệt chém xuất trong mặt phẳng đứng → xoay về mặt phẳng ngang, cung hướng +Z như cũ
    geo.fx_slash.rotateX(Math.PI / 2);
    const meteorSrc = gltf.scene.getObjectByName("fx_meteor");
    const meteor = meteorSrc ? toonize(meteorSrc) : null;
    return { geo, meteor };
  }, [gltf]);
}
