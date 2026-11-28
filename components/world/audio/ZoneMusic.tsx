"use client";
/**
 * <ZoneMusic/>: nhạc nền tạo sinh theo vùng (gắn một lần trong WorldClient sau khi vào thế giới).
 * Đọc cảnh hiện tại; ở Quảng trường đọc mức đêm (chu kỳ ngày đêm đang chạy → DAY.night, nếu không thì giờ thật VN)
 * mỗi 5 s. Không vẽ gì. Mê cung Hoạ âm và phòng Học không có nhạc nền (có âm thanh riêng).
 */
import { useEffect } from "react";
import { useWorld } from "../store";
import { DAY } from "../fx/dayState";
import { localHour } from "@/lib/world/dayCycle";
import { nightFromHour } from "@/lib/world/music";
import { setMusicZone, musicDebug } from "./musicDirector";
import { voiceStats } from "./engine";
import { combatLayerDebug } from "./combatLayer";

function nightNow(): number {
  return DAY.active ? DAY.night.value : nightFromHour(localHour(new Date()));
}

export function ZoneMusic() {
  const scene = useWorld((s) => s.scene);
  useEffect(() => {
    setMusicZone(scene, nightNow());
    if (scene !== "hub") return;
    const id = setInterval(() => setMusicZone(scene, nightNow()), 5000);
    return () => clearInterval(id);
  }, [scene]);
  useEffect(() => {
    // công cụ kiểm thử: window.__audio() → vùng, câu đang chơi, số giọng
    (window as unknown as { __audio?: () => unknown }).__audio = () => ({ ...musicDebug(), voices: voiceStats(), combat: combatLayerDebug() });
    return () => setMusicZone(null);
  }, []);
  return null;
}
