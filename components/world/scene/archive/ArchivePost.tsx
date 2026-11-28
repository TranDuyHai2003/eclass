"use client";
/**
 * Hậu kỳ riêng của Thư khố (tả thực): AO màn hình (N8AO nửa độ phân giải, chỉ khi bật AO), bloom cho đèn huỳnh quang, tone map AgX,
 * hạt phim, viền tối, SMAA. KHÔNG có viền mực hoạt hình (Ink) — cảnh này thay cả chuỗi hậu kỳ chung trong WorldClient.
 */
import { EffectComposer, Bloom, BrightnessContrast, N8AO, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Lensing } from "../../fx/Lensing";
import { useGfx } from "../../gfx";
import type { Quality } from "../../store";

export function ArchivePost({ quality }: { quality: Quality }) {
  const gfx = useGfx();
  const low = quality === "low";
  return (
    <EffectComposer multisampling={0} stencilBuffer>
      {/* AO đã nướng trong lightmap; N8AO (≈ 8 lượt toàn màn hình) chỉ khi người dùng bật AO (mức Siêu) như các cảnh khác */}
      {!low && gfx.ao ? <N8AO aoRadius={0.7} intensity={2.0} distanceFalloff={0.5} quality="performance" halfRes depthAwareUpsampling /> : <></>}
      {/* thấu kính / nhoè khi qua lỗ sâu */}
      <Lensing />
      {!low && gfx.bloom ? <Bloom intensity={0.5} luminanceThreshold={1.15} luminanceSmoothing={0.25} mipmapBlur levels={4} /> : <></>}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <BrightnessContrast brightness={-0.01} contrast={0.14} />
      <Vignette eskil={false} offset={0.2} darkness={0.72} />
      {/* hạt phim sau tone map (như máy quay thật) */}
      {gfx.grain || low ? <Noise opacity={low ? 0.03 : 0.05} premultiply /> : <></>}
      {gfx.aa && !low ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
