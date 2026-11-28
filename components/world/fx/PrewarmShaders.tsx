"use client";
/**
 * Biên dịch trước MỌI shader của cảnh khi vừa vào (gl.compileAsync → KHR_parallel_shader_compile, không chặn luồng chính)
 * → bớt khựng lần đầu nhìn thấy một vật / hiệu ứng (shader biên dịch giữa lúc chơi là nguyên nhân "giật" hay gặp).
 * Vật đang ẩn cũng được bật tạm để biên dịch (compileAsync thu thập đối tượng đồng bộ ngay trong lời gọi), rồi trả lại.
 * Đặt trong cùng Suspense với nội dung cảnh, key theo cảnh → chạy lại mỗi lần đổi cảnh, sau khi GLB đã tải xong.
 * T24: sau khi biên dịch xong, tải sẵn lên GPU (gl.initTexture) các texture của vật đang ẩn — hiệu ứng phép / va chạm chỉ hiện
 * khi niệm lần đầu, nên trước đây texture (mặt nạ, ramp, nhiễu) được tải lên đúng khung đó → khựng; rải 3 texture / khung.
 */
import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";
import { LOAD_SIG } from "@/lib/world/loadSignals";
import { useWorld } from "../store";

function texturesOf(m: THREE.Material, out: Set<THREE.Texture>) {
  for (const v of Object.values(m)) if ((v as THREE.Texture | null)?.isTexture) out.add(v as THREE.Texture);
  const u = (m as THREE.ShaderMaterial).uniforms;
  if (u) for (const k in u) if ((u[k]?.value as THREE.Texture | null)?.isTexture) out.add(u[k].value as THREE.Texture);
}

export function PrewarmShaders() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    // màn chờ: báo "đang biên dịch" cho cảnh này, xong (biên dịch + texture) thì báo xong
    const sig = { scene: useWorld.getState().scene, done: false };
    LOAD_SIG.prewarm = sig;
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    // texture của nhánh đang ẩn (thu thập lúc mọi thứ còn đang bật tạm)
    const tex = new Set<THREE.Texture>();
    for (const h of hidden)
      h.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => texturesOf(m, tex));
        else if (mat) texturesOf(mat, tex);
      });
    let p: Promise<unknown> | null = null;
    try {
      p = gl.compileAsync(scene, camera);
    } finally {
      hidden.forEach((o) => (o.visible = false));
    }
    let raf = 0;
    let dead = false;
    const queue = [...tex];
    const pump = () => {
      if (dead) return;
      for (let k = 0; k < 3 && queue.length; k++) {
        const t = queue.shift()!;
        // texture tải từ URL: chờ có ảnh rồi mới đẩy lên (chưa có thì để lần sau tự tải như cũ)
        const img = t.image as { width?: number } | undefined;
        if (img && (img.width ?? 1) > 0) gl.initTexture(t);
      }
      if (queue.length) raf = requestAnimationFrame(pump);
      else sig.done = true;
    };
    if (p) p.then(() => (raf = requestAnimationFrame(pump))).catch(() => (sig.done = true));
    else sig.done = true;
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera]);
  return null;
}
