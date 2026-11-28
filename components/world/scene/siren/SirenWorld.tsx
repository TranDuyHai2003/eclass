"use client";
/**
 * Nhánh W (thế giới / trời / kết giới) của Mê cung Hoạ âm — gom các phần để Siren.tsx chỉ cần MỘT dòng gắn.
 * Gắn SAU SirenDirector (đọc HARMONIC đã cập nhật trong khung). Phần cần tải (atlas, GLB) nằm trong Suspense riêng
 * → không chặn mê cung; kết giới nằm ngoài để hiện ngay khi vào màn.
 */
import { Suspense } from "react";
import { CollageSky, NotationFalls } from "./SirenCollage";
import { VinylSun } from "./SirenVinyl";
import { RestZone } from "./SirenRest";
import { Barrier } from "./SirenBarrier";
import { WitchDev } from "./witches/WitchDev";

export function SirenWorld() {
  return (
    <>
      <Barrier />
      <RestZone />
      <Suspense fallback={null}>
        <CollageSky />
        <NotationFalls />
        <VinylSun />
      </Suspense>
      {/* DEV: window.__witch("goixepim") — thử phù thuỷ hoạ âm trong mê cung (khu chính thức gắn <GoiXepIm/> riêng) */}
      <WitchDev />
    </>
  );
}
