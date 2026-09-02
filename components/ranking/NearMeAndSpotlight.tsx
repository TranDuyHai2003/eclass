"use client";

import { RankingUser } from "@/actions/ranking";
import { getSafeAvatarUrl } from "@/lib/game-rank";
import Image from "next/image";

interface NearMeAndSpotlightProps {
  nearMeList?: RankingUser[];
  currentUserId?: string;
  mostImprovedStudent?: {
    name: string;
    rankIncreased?: number;
    scoreBoost?: number;
    avatarUrl?: string;
  } | null;
}

export function NearMeAndSpotlight({
  nearMeList = [],
  currentUserId,
  mostImprovedStudent,
}: NearMeAndSpotlightProps) {
  const improvedHero = mostImprovedStudent || {
    name: "Học sinh xuất sắc",
    avatarUrl: "",
  };

  const heroAvatar = getSafeAvatarUrl(improvedHero.name, improvedHero.avatarUrl);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Block 1: HUNTERS AROUND YOU (Cyber Radar Graphic) */}
      <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-5 shadow-2xl relative overflow-hidden h-44 sm:h-48 flex flex-col justify-between group">
        {/* Radar Graphic Background Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
          {/* Outer Concentric Circle */}
          <div className="w-56 h-56 rounded-full border border-cyan-500/20 flex items-center justify-center relative">
            {/* Middle Circle */}
            <div className="w-40 h-40 rounded-full border border-cyan-500/30 flex items-center justify-center">
              {/* Inner Circle */}
              <div className="w-24 h-24 rounded-full border border-cyan-500/40 flex items-center justify-center" />
            </div>

            {/* Crosshair Axes */}
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/30" />
            <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/30" />

            {/* Radar Rotating Sweep Beam */}
            <div className="absolute inset-0 rounded-full animate-radar-sweep bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(6,182,212,0.3)_360deg)] pointer-events-none" />

            {/* Radar Dot Blips */}
            <div className="absolute top-10 right-14 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse" />
            <div className="absolute bottom-12 left-16 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
            <div className="absolute top-20 left-12 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.9)] animate-ping" />
          </div>
        </div>

        {/* Header Title */}
        <div className="relative z-10">
          <h3 className="font-black text-xs sm:text-sm tracking-widest text-slate-200 uppercase">
            HUNTERS AROUND YOU
          </h3>
        </div>

        {/* Subtle Bottom Radar Info */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono font-extrabold text-cyan-400/80">
          <span>RADAR SCANNING</span>
          <span>RANGE: ACTIVE CLASS</span>
        </div>
      </div>

      {/* Block 2: AWAKENING OF THE WEEK (Golden Spotlight Backdrop) */}
      <div className="rounded-2xl bg-[#0D121D] border border-slate-800/80 p-5 shadow-2xl relative overflow-hidden h-44 sm:h-48 flex flex-col justify-between golden-spotlight group">
        {/* Golden Spotlight Sunburst Rays backdrop */}
        <div className="absolute inset-x-0 bottom-0 top-1/3 bg-[radial-gradient(ellipse_at_bottom,rgba(245,158,11,0.25)_0%,rgba(217,119,6,0.1)_45%,transparent_75%)] pointer-events-none" />

        {/* Header Title */}
        <div className="relative z-10">
          <h3 className="font-black text-xs sm:text-sm tracking-widest text-slate-200 uppercase">
            AWAKENING OF THE WEEK
          </h3>
        </div>

        {/* Golden Spotlight User Avatar Ring at Center Bottom */}
        <div className="relative z-10 flex justify-center items-end pb-1">
          <div className="relative">
            {/* Glowing Golden Circle Aura */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] p-0.5 bg-slate-900 overflow-hidden ring-2 ring-amber-500/40">
              <Image
                src={heroAvatar}
                alt={improvedHero.name || "Awakening Student"}
                width={80}
                height={80}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

