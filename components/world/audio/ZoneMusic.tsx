"use client";
/**
 * <ZoneMusic/>: nhạc nền theo vùng (gắn một lần trong WorldClient sau khi vào thế giới). Không vẽ gì.
 * Mỗi giây gửi cho bộ điều phối: cảnh, mức đêm (Quảng trường / Vùng Mở rộng: DAY.night khi chu kỳ ngày đêm chạy, không thì giờ
 * thật VN), đang đấu boss Vùng Kỳ quan (→ bản boss), Mê cung Hoạ âm: đang trong đấu trường (→ lớp boss dọc).
 * Bản render sẵn (stemPlayer) cho hub / expanse / impossible / siren / archive / study / boss; vùng khác: nhạc tạo sinh cũ.
 * Kèm âm sự kiện thế giới (worldEvents: bước chân, nước, giao diện, stinger).
 */
import { useEffect } from "react";
import { useWorld } from "../store";
import { DAY } from "../fx/dayState";
import { localHour } from "@/lib/world/dayCycle";
import { nightFromHour } from "@/lib/world/music";
import { ARENA_R } from "@/lib/world/boss";
import { setMusicZone, musicDebug } from "./musicDirector";
import { voiceStats } from "./engine";
import { combatLayerDebug } from "./combatLayer";
import { useBossUi as useExpBoss } from "../bosses/bossStore";
import { useBossUi as useSirenBoss } from "../scene/Siren";
import { sirenFightStarted, startWorldAudioEvents } from "./worldEvents";

function nightNow(): number {
  return DAY.active ? DAY.night.value : nightFromHour(localHour(new Date()));
}

let fightWas = false;
function update(scene: string) {
  const eb = useExpBoss.getState();
  const boss = eb.on && eb.mode !== "dead";
  let fight = false;
  if (scene === "siren") {
    const sb = useSirenBoss.getState();
    const p = useWorld.getState().player;
    fight = sb.on && !sb.dead && Math.hypot(p.x, p.z) < ARENA_R + 3;
    if (fight && !fightWas) sirenFightStarted();
  }
  fightWas = fight;
  setMusicZone(scene, nightNow(), { boss, fight });
}

export function ZoneMusic() {
  const scene = useWorld((s) => s.scene);
  useEffect(() => {
    update(scene);
    const id = setInterval(() => update(scene), 1000);
    return () => clearInterval(id);
  }, [scene]);
  useEffect(() => {
    // công cụ kiểm thử: window.__audio() → vùng, bản render, câu đang chơi, số giọng
    (window as unknown as { __audio?: () => unknown }).__audio = () => ({ ...musicDebug(), voices: voiceStats(), combat: combatLayerDebug() });
    const stop = startWorldAudioEvents();
    return () => {
      stop();
      setMusicZone(null);
    };
  }, []);
  return null;
}
