"use client";
/**
 * Móc DEV để thử phù thuỷ hoạ âm ngay trong mê cung hiện có (khu "Sa Mạc Tấm Đồng" sẽ gắn chính thức):
 *   window.__witch("goixepim")            → gắn Gối Xếp Im ở sân khu Tây (−44, 0, 0), r 10, mặt hướng cầu Đông
 *   window.__witch("goixepim", "here")    → gắn ngay trước mặt người chơi
 *   window.__witch(null)                  → gỡ
 *   window.__gxi.force("fight" | "predict" | "hush" | "reveal" | "dormant", "slam" | "whip") → nhảy giai đoạn để xem / chụp
 * Chỉ bản dev (production: component trả null, không đăng ký window).
 */
import { create } from "zustand";
import { useWorld } from "../../../store";
import { GXI } from "@/lib/world/witchGoiXepIm";
import { GoiXepIm } from "./GoiXepIm";

type Spot = { x: number; y: number; z: number; r: number; yaw: number };
const useWitchDev = create<{ id: string | null; spot: Spot; key: number }>(() => ({ id: null, spot: { x: -44, y: 0, z: 0, r: 10, yaw: Math.PI / 2 }, key: 0 }));

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __witch: unknown }).__witch = (id: string | null = "goixepim", where?: string) => {
    if (!id) {
      useWitchDev.setState({ id: null });
      return 0;
    }
    let spot: Spot = { x: -44, y: 0, z: 0, r: 10, yaw: Math.PI / 2 };
    if (where === "here") {
      const w = useWorld.getState();
      const fx = Math.sin(w.playerYaw);
      const fz = Math.cos(w.playerYaw);
      const d = GXI.D / 2 + 2.5;
      spot = { x: w.player.x + fx * d, y: w.player.y, z: w.player.z + fz * d, r: 10, yaw: w.playerYaw + Math.PI };
    }
    useWitchDev.setState((s) => ({ id, spot, key: s.key + 1 }));
    return 1;
  };
}

export function WitchDev() {
  const s = useWitchDev();
  if (process.env.NODE_ENV === "production" || s.id !== "goixepim") return null;
  return <GoiXepIm key={s.key} origin={s.spot} radius={s.spot.r} yaw={s.spot.yaw} seed={s.key} />;
}
