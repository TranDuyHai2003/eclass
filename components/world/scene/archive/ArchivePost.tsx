"use client";
/**
 * Hậu kỳ riêng của Thư khố (tả thực): AO màn hình (N8AO nửa độ phân giải), bloom cho đèn huỳnh quang, tone map AgX,
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
      {/* AO tiếp xúc (góc tường, chân kệ, khe sách) — bổ sung cho AO đã nướng trong lightmap */}
      {!low ? <N8AO aoRadius={0.7} intensity={2.0} distanceFalloff={0.5} quality="performance" halfRes depthAwareUpsampling /> : <></>}
      {/* thấu kính / nhoè khi qua lỗ sâu */}
      <Lensing />
      {!low && gfx.bloom ? <Bloom intensity={0.5} luminanceThreshold={1.15} luminanceSmoothing={0.25} mipmapBlur /> : <></>}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <BrightnessContrast brightness={0.0} contrast={0.08} />
      <Vignette eskil={false} offset={0.22} darkness={0.6} />
      {/* hạt phim sau tone map (như máy quay thật) */}
      <Noise opacity={low ? 0.03 : 0.05} premultiply />
      {gfx.aa && !low ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
