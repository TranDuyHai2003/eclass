"use client";
/** Hook dùng chung cho nội dung khu (tách riêng để các khu không import vòng SirenZones) */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import type { ZoneId } from "@/lib/world/zoneGraph";
import { ZONE_RT } from "./zoneRuntime";

export const CUT_TEX = worldAsset("siren/zones_cut.webp");
/** bộ hình dựng tay trong Blender (blender-src/siren-src/zone_kit_build.py → zone_kit.blend): phím sứ / phím đen / phím-đồi,
 * cồn cát lưỡi liềm, lan can + bậc + sàn đài + cần gạt bằng đồng, cột sảnh chờ — chỉ lấy HÌNH (vật liệu do khu tự đặt) */
export const ZONE_KIT = worldAsset("siren/zone_kit.glb");
export type KitPart = "zk_key_w" | "zk_key_b" | "zk_hill" | "zk_dune" | "zk_rail" | "zk_step" | "zk_disc" | "zk_lever_b" | "zk_lever_a" | "zk_column";
useGLTF.preload(ZONE_KIT);

/** hình (bản sao riêng — khu tự dispose) của các phần trong bộ hình */
export function useKit<K extends KitPart>(names: readonly K[]): Record<K, THREE.BufferGeometry> {
  const gltf = useGLTF(ZONE_KIT);
  const key = names.join(",");
  return useMemo(() => {
    const out = {} as Record<K, THREE.BufferGeometry>;
    for (const n of key.split(",") as K[]) {
      const o = gltf.scene.getObjectByName(n) as THREE.Mesh | undefined;
      if (!o?.geometry) throw new Error(`zone_kit thiếu ${n}`);
      out[n] = o.geometry.clone();
    }
    return out;
  }, [gltf, key]);
}

/** gộp nhiều bản đặt (ma trận) của các hình tĩnh thành MỘT hình (1 lệnh vẽ, không cần instancing) */
export function bakeParts(parts: { geo: THREE.BufferGeometry; at: THREE.Matrix4[] }[]): THREE.BufferGeometry {
  const list: THREE.BufferGeometry[] = [];
  for (const p of parts) for (const m of p.at) list.push(p.geo.clone().applyMatrix4(m));
  const g = mergeGeometries(list, false);
  list.forEach((x) => x.dispose());
  return g;
}
export const zoneTexUrl = (name: "terrazzo" | "bronze" | "sand" | "carbon" | "porcelain") => worldAsset(`siren/${name}.webp`);

/** atlas hình cắt giấy của các khu (sRGB) */
export function useCutTex() {
  const tex = useTexture(CUT_TEX);
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
  }, [tex]);
  return tex;
}

/** vân lặp (sRGB, lặp) — mỗi lần gọi trả về bản sao riêng với số lặp rx × ry (cùng ảnh, khác uv) */
export function useRepTex(name: "terrazzo" | "bronze" | "sand" | "carbon" | "porcelain", rx: number, ry: number) {
  const base = useTexture(zoneTexUrl(name));
  return useMemo(() => {
    const t = base.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [base, rx, ry]);
}

/** Nhóm chỉ hiện khi đang ở khu id (useFrame của nội dung khu tự trả về sớm khi không hiện) */
export function useZoneGroup(id: ZoneId) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = ZONE_RT.id === id;
  });
  return ref;
}
