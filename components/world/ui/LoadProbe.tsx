"use client";
/**
 * Đầu dò tải trong Canvas (đặt cùng Suspense với nội dung cảnh, key theo cảnh):
 *  • gắn được = mọi tài nguyên Suspense của cảnh đã xong → LOAD_SIG.mounted = cảnh;
 *  • sau khi PrewarmShaders báo xong: đếm khung mượt liên tiếp (dt < 100 ms) → giai đoạn "ổn định" của màn chờ.
 */
import { useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { LOAD_SIG } from "@/lib/world/loadSignals";

export function LoadProbe({ scene }: { scene: string }) {
  useLayoutEffect(() => {
    LOAD_SIG.mounted = scene;
    LOAD_SIG.stable = 0;
  }, [scene]);
  useFrame((_, dt) => {
    if (!LOAD_SIG.prewarm.done || LOAD_SIG.prewarm.scene !== scene) {
      LOAD_SIG.stable = 0;
      return;
    }
    LOAD_SIG.stable = dt < 0.1 ? Math.min(LOAD_SIG.stable + 1, 1e6) : 0;
  });
  return null;
}
