"use client";
/**
 * Texture thủ tục của Math World — NƯỚNG SẴN thành PNG (scripts/world-gen-textures.ts, bộ sinh lib/world/texgen.ts), lúc chạy chỉ tải:
 *  • waterNormalTex  256² — gợn nước mềm, cong, thưa (tổng sóng sin vectơ sóng nguyên → lặp liền ô) → độ dốc RG
 *  • causticTex      512² — ánh sóng THẬT: bắn lưới tia qua mặt sóng tuần hoàn, khúc xạ, cộng dồn chỗ tia hội tụ
 *  • streakTex       256² — vệt nước chảy dọc (R) + chi tiết (G) cho tia phun / màn tràn / thác
 *  • noiseTex        512² — RGBA: R vân đá uốn miền · G vân phụ · B sắc độ · A nhiễu mịn
 * (Sinh lúc chạy mất ~12 s trên luồng chính → nướng sẵn.)  waterLUT sinh tại chỗ (3 ms).
 */
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";

const cache = new Map<string, THREE.Texture>();
function load(name: string): THREE.Texture {
  let t = cache.get(name);
  if (t) return t;
  t = new THREE.TextureLoader().load(worldAsset(`fx/tex/${name}.png`));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  cache.set(name, t);
  return t;
}
export const waterNormalTex = () => load("water_normal");
export const causticTex = () => load("caustic");
export const streakTex = () => load("streak");
export const noiseTex = () => load("noise");

/** bảng màu theo độ sâu (sRGB → tuyến tính) 256×1 */
let _lut: THREE.DataTexture | null = null;
export function waterLUT(): THREE.DataTexture {
  if (_lut) return _lut;
  const stops: [number, string][] = [
    [0, "#D5F8EF"],
    [0.08, "#A1EBDD"],
    [0.25, "#65D5D5"],
    [0.5, "#37B4CC"],
    [0.8, "#218BAE"],
    [1.6, "#17698f"],
  ];
  const N = 256;
  const d = new Uint8Array(N * 4);
  // nội suy ngay trên giá trị sRGB 8 bit (texture đánh dấu sRGB → GPU tự đổi sang tuyến tính)
  const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1)) * 1.6;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, a] = stops[k];
    const [t1, b] = stops[k + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const A = hex(a);
    const B = hex(b);
    d.set([0, 1, 2].map((c) => Math.round(A[c] + (B[c] - A[c]) * u)).concat(255), i * 4);
  }
  _lut = new THREE.DataTexture(d, N, 1);
  _lut.colorSpace = THREE.SRGBColorSpace;
  _lut.magFilter = THREE.LinearFilter;
  _lut.needsUpdate = true;
  return _lut;
}
