"use client";
/**
 * Nhánh W — vùng "Dấu lặng": túi im lặng trên đảo góc Đông Bắc, dưới Lồng Escher (REST_ZONE, lib/world/sirenWorld.ts).
 * Ngữ nghĩa vênh: dấu lặng = một LỖ THỦNG trong bản nhạc. Bước vào là thế giới rút dần:
 *  - màu: lọc CSS trên canvas (xám + tương phản thấp, chỉ khi > 0 — ngoài vùng không tốn gì),
 *  - hoạ tiết: trời / cắt dán / thác chuyển thành giấy phẳng (SIREN_W.rest → uniform của shader),
 *  - âm thanh: hạ dần âm lượng chung của lõi âm thanh (setTargetAtTime, không giật), trả lại khi rời / gỡ cảnh.
 * Mức im lặng đi qua lò xo tới hạn (springStep, ζ = 1) → vào / ra mượt, không phụ thuộc FPS.
 */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { HARMONIC, springStep, type Spring } from "@/lib/world/harmonicState";
import { REST_ZONE, SIREN_W, restAmount } from "@/lib/world/sirenWorld";
import { useWorld } from "../../store";
import { audioCore } from "../../audio/engine";
import { Label3D } from "../../ui/Labels";

const QUIET = 0.88;

export function RestZone() {
  const gl = useThree((s) => s.gl);
  const spring = useRef<Spring>({ x: 0, v: 0 });
  const applied = useRef(-1);
  const audioApplied = useRef(-1);
  const audioTick = useRef(-2);
  useEffect(() => {
    const el = gl.domElement;
    return () => {
      SIREN_W.rest = 0;
      el.style.filter = "";
      const k = audioCore(false);
      if (k) k.master.gain.setTargetAtTime(1, k.ctx.currentTime, 0.2);
    };
  }, [gl]);
  useFrame((_, dt) => {
    const p = useWorld.getState().player;
    const target = restAmount(p.x, p.y, p.z);
    springStep(spring.current, target, 3.2, 1, dt);
    const r = Math.max(0, Math.min(1, spring.current.x));
    SIREN_W.rest = r < 0.002 ? 0 : r;
    // lọc màu: chỉ ghi style khi đổi đủ lớn (tránh tạo chuỗi mỗi khung)
    const q = Math.round(SIREN_W.rest * 50) / 50;
    if (q !== applied.current) {
      applied.current = q;
      gl.domElement.style.filter = q > 0 ? `grayscale(${q}) contrast(${(1 - 0.28 * q).toFixed(3)}) brightness(${(1 + 0.06 * q).toFixed(3)})` : "";
    }
    // âm thanh: lõi chỉ tồn tại sau thao tác người dùng; không tạo mới ở đây
    const k = audioCore(false);
    // (đặt lại mỗi ~0,5 s khi đang im lặng: lõi tự bật master = 1 lúc tab hiện lại)
    const tick = q > 0 ? Math.floor(HARMONIC.time * 2) : -2;
    if (k && (q !== audioApplied.current || tick !== audioTick.current)) {
      audioApplied.current = q;
      audioTick.current = tick;
      k.master.gain.setTargetAtTime(1 - QUIET * q, k.ctx.currentTime, 0.12);
    }
  });
  const vi = useWorld((s) => s.lang === "vi");
  return <Label3D text={vi ? "Dấu lặng — nơi bản nhạc thủng một lỗ" : "The Rest — a hole in the music"} position={[REST_ZONE.x, 7, REST_ZONE.z]} maxDist={40} />;
}
