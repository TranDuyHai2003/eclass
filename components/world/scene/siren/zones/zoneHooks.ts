"use client";
/** Hook dùng chung cho nội dung khu (tách riêng để các khu không import vòng SirenZones) */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import type { ZoneId } from "@/lib/world/zoneGraph";
import { ZONE_RT } from "./zoneRuntime";

export const CUT_TEX = worldAsset("siren/zones_cut.webp");
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
