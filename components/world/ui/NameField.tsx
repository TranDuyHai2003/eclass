"use client";
/**
 * Tên học sinh tự đặt: ô nhập (màn hình vào game) + nhãn tên trên đầu nhân vật của chính mình.
 * Lưu localStorage "world.name"; gửi cho người khác qua net (join mang theo tên, đổi giữa chừng → netName).
 */
import { useEffect, useRef, useState } from "react";
import { useWorld, useT } from "../store";
import { Label3D } from "./Labels";
import { netName } from "../net";
import { NAME_MAX, cleanName } from "@/lib/world/playerName";

export function NameField({ onEnter }: { onEnter?: () => void }) {
  const t = useT();
  const stored = useWorld((s) => s.playerName);
  const [draft, setDraft] = useState(stored);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // tên nạp từ localStorage sau lần render đầu → đồng bộ ô nhập khi người chơi chưa gõ gì
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setDraft(stored);
  }, [stored]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const change = (v: string) => {
    touched.current = true;
    setDraft(v);
    const name = cleanName(v);
    useWorld.setState({ playerName: name });
    try {
      localStorage.setItem("world.name", name);
    } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => netName(name), 600);
  };

  return (
    <label className="flex w-full max-w-xs flex-col items-center gap-1.5">
      <span className="text-xs font-bold text-white/80">{t("yourName")}</span>
      <input
        value={draft}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") onEnter?.();
        }}
        onKeyUp={(e) => e.stopPropagation()}
        maxLength={NAME_MAX + 8}
        placeholder={t("namePh")}
        autoComplete="nickname"
        spellCheck={false}
        className="w-full rounded-full bg-[#12162b]/70 px-4 py-2 text-center text-base font-black italic text-[#ecd7a9] ring-1 ring-[#ecd7a9]/60 outline-none backdrop-blur placeholder:font-semibold placeholder:not-italic placeholder:text-white/45 focus:ring-2 focus:ring-[#ecd7a9]"
      />
    </label>
  );
}

/** Nhãn tên trên đầu nhân vật của mình (gắn trong nhóm nhân vật → đi theo cả khi lộn ngược trọng lực) */
export function SelfName() {
  const name = useWorld((s) => s.playerName);
  if (!name) return null;
  // camera mình đứng sát (≈3 m) → đặt thấp hơn nhãn người khác (2.05) để không lơ lửng xa đầu
  return <Label3D text={name} position={[0, 1.9, 0]} variant="name" />;
}
