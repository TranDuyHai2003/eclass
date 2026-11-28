"use client";
/** Menu ☰: thanh âm lượng Nhạc nền + Hiệu ứng (localStorage); mờ đi khi công tắc âm thanh chung đang tắt */
import { useEffect, useState } from "react";
import { Music2, AudioLines } from "lucide-react";
import { useWorld } from "../store";
import { getVol, onAudioChange, setVol, soundOn } from "./engine";

export function AudioSettings() {
  const lang = useWorld((s) => s.lang);
  const [music, setMusic] = useState(0.55);
  const [fx, setFx] = useState(0.85);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const read = () => {
      setMusic(getVol("music"));
      setFx(getVol("sfx"));
      setOn(soundOn());
    };
    read();
    return onAudioChange(read);
  }, []);
  const rows = [
    { k: "music" as const, v: music, set: setMusic, Icon: Music2, label: lang === "vi" ? "Nhạc nền" : "Music" },
    { k: "sfx" as const, v: fx, set: setFx, Icon: AudioLines, label: lang === "vi" ? "Hiệu ứng" : "Effects" },
  ];
  return (
    <>
      {rows.map(({ k, v, set, Icon, label }) => (
        <label key={k} className="w-row" style={on ? undefined : { opacity: 0.45 }}>
          <Icon />
          <span>{label}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={v}
            disabled={!on}
            onChange={(e) => {
              const x = Number(e.target.value);
              set(x);
              setVol(k, x);
            }}
            className="ml-auto w-28 accent-[#ecd7a9]"
            aria-label={label}
            data-audio={k}
          />
        </label>
      ))}
    </>
  );
}
