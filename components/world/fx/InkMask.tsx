"use client";
/**
 * Mặt nạ cho pass viền mực (Ink): vẽ scene riêng INK_MASK.scene (bản sao tán lá) vào RT nửa độ phân giải,
 * mỗi điểm ảnh lưu 1/z của tán. Ink so 1/z này với depth cảnh: trùng → điểm ảnh là tán (bỏ nét bên trong tán
 * và quanh các lỗ lá); nhân vật đứng TRƯỚC cây vẫn giữ viền vì depth cảnh gần hơn tán.
 * Chi phí: thêm 1 lượt vẽ chỉ các thẻ lá (2 draw instanced) ở ½ × ½ độ phân giải.
 */
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/** scene riêng chứa bản sao mặt nạ (tán lá) — lượt mặt nạ không phải duyệt cả cảnh chính */
export const INK_MASK = { tex: null as THREE.Texture | null, on: false, scene: new THREE.Scene() };

export function InkMask() {
  const { gl, camera, size } = useThree();
  const rt = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true,
      }),
    [],
  );
  useEffect(() => {
    INK_MASK.tex = rt.texture;
    INK_MASK.on = true;
    return () => {
      INK_MASK.on = false;
      INK_MASK.tex = null;
      rt.dispose();
    };
  }, [rt]);
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    rt.setSize(Math.max(1, Math.round((size.width * dpr) / 2)), Math.max(1, Math.round((size.height * dpr) / 2)));
  }, [gl, rt, size]);
  const clear = useMemo(() => new THREE.Color(0, 0, 0), []);
  const prevClear = useMemo(() => new THREE.Color(), []);
  // trước EffectComposer (ưu tiên 1): vẽ scene mặt nạ riêng (chỉ các bản sao tán lá)
  useFrame(() => {
    const ms = INK_MASK.scene;
    if (!ms.children.length) return;
    const prevTarget = gl.getRenderTarget();
    const prevMask = camera.layers.mask;
    gl.getClearColor(prevClear);
    const prevAlpha = gl.getClearAlpha();
    const prevAuto = gl.autoClear;
    camera.layers.set(0);
    gl.setRenderTarget(rt);
    gl.setClearColor(clear, 0);
    gl.autoClear = true;
    gl.clear(true, true, false);
    gl.render(ms, camera);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);
    gl.autoClear = prevAuto;
    camera.layers.mask = prevMask;
  }, 0.5);
  return null;
}
