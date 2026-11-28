"use client";
/**
 * VFX-AAA — 2 texture thủ tục dùng chung cho hiệu ứng, nướng MỘT lần (lib/world/vfxAtlas.ts) lúc trình duyệt rảnh
 * (requestIdleCallback — đo trên i5-1135G7: ~25 ms + ~40 ms, không chặn khung hình lúc vào cảnh). Ngân sách skill: ≤ 4 texture
 * ≤ 256² trên điện thoại — ở đây 2 tấm, tổng ~80 KB + mipmap:
 *  • noiseFlow (lặp): R fBm · GB trường xoáy (flowmap đẩy UV 2 pha) · A gân Voronoi;
 *  • puff (kẹp mép): R tô sáng cel · G cuộn khói · B xói mịn · A dáng cụm khói.
 * (Tia lấp lánh 4 cánh vẽ giải tích trong Sparks — không cần texture.)
 */
import * as THREE from "three";
import { bakeNoiseFlow, bakePuff } from "@/lib/world/vfxAtlas";

/** trường xoáy / nhiễu: tần số thấp, lặp → 64² đủ; dáng cụm khói cần mép mịn → 128² */
const NOISE_SIZE = 64;
const PUFF_SIZE = 128;
let cache: { noiseFlow: THREE.DataTexture; puff: THREE.DataTexture } | null = null;

function make(data: Uint8Array, size: number, repeat: boolean): THREE.DataTexture {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export function vfxTextures() {
  if (!cache) cache = { noiseFlow: make(bakeNoiseFlow(NOISE_SIZE), NOISE_SIZE, true), puff: make(bakePuff(PUFF_SIZE), PUFF_SIZE, false) };
  return cache;
}

/** nướng lúc trình duyệt rảnh rồi gọi cb (đã có sẵn → gọi ngay); trả hàm huỷ */
export function whenVfxTextures(cb: (t: NonNullable<typeof cache>) => void): () => void {
  if (cache) {
    cb(cache);
    return () => {};
  }
  let alive = true;
  const run = () => alive && cb(vfxTextures());
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => {
      alive = false;
      w.cancelIdleCallback?.(id);
    };
  }
  const id = window.setTimeout(run, 300);
  return () => {
    alive = false;
    window.clearTimeout(id);
  };
}

/** texture 1×1 trong suốt — giữ chỗ tới khi nướng xong (cụm khói phát sớm chỉ không hiện, không lỗi) */
let blank: THREE.DataTexture | null = null;
export function blankTexture(): THREE.DataTexture {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
    blank.needsUpdate = true;
  }
  return blank;
}
