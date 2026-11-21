"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { isSoundOn, onSoundChange, setSoundOn } from "@/lib/sound";

/** Nút loa 🔊/🔇 — trạng thái đọc từ localStorage trong useEffect (lượt render đầu luôn "bật" để khớp HTML server) */
export function SoundToggle({ className, light }: { className?: string; light?: boolean }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(isSoundOn());
    return onSoundChange(setOn);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Tắt âm thanh" : "Bật âm thanh"}
      title={on ? "Tắt âm thanh" : "Bật âm thanh"}
      data-testid="sound-toggle"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors",
        light
          ? "border-white/30 bg-white/15 text-white hover:bg-white/25"
          : "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_3px_0_0_#bae6fd] hover:bg-sky-100",
        !on && "opacity-60",
        className,
      )}
    >
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  );
}
