"use client";
import { GAME_CREDIT, GAME_VERSION } from "@/lib/world/version";
import { useWorld } from "../store";

/** Dòng credit + phiên bản (màn vào game, cuối menu) */
export function Credit({ className = "" }: { className?: string }) {
  const lang = useWorld((s) => s.lang);
  return (
    <p className={`w-credit ${className}`}>
      <span>
        {lang === "vi" ? "Phát triển bởi" : "Created by"} <b>{GAME_CREDIT}</b>
      </span>
      <span className="w-credit__ver">{GAME_VERSION}</span>
    </p>
  );
}
