"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useState, useEffect, useMemo } from "react";
import { ExternalLink, HardDrive } from "lucide-react";

export default function VideoPlayer({
  src,
  title,
  poster,
  autoPlay = false,
  muted = false,
}: {
  src: string;
  title: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);

  const youtubeId = useMemo(() => {
    if (!src) return null;
    const match = src.match(
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
    );
    return match && match[2].length === 11 ? match[2] : null;
  }, [src]);

  const driveId = useMemo(() => {
    if (!src) return null;
    const match = src.match(
      /(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]+)/,
    );
    if (match && match[1]) return match[1];
    if (src.includes("drive.google.com") || src.includes("docs.google.com")) {
      return "UNKNOWN";
    }
    return null;
  }, [src]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted)
    return (
      <div className="aspect-video w-full bg-slate-900 rounded-2xl animate-pulse" />
    );

  if (youtubeId) {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      ...(autoPlay ? { autoplay: "1" } : {}),
      ...(muted ? { mute: "1" } : {}),
    });

    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg bg-black border border-slate-200">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?${params.toString()}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    );
  }

  if (driveId) {
    return (
      <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all hover:border-emerald-500/40">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
            <HardDrive className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate">
              {title || "Video lời giải trên Google Drive"}
            </h4>
            <p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Lưu trữ trên Google Drive
            </p>
          </div>
        </div>

        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100 active:scale-95 shrink-0 w-full sm:w-auto"
        >
          <span>Mở trên Google Drive</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-lg border border-slate-200">
      <MediaPlayer
        key={src}
        title={title}
        src={src}
        poster={poster}
        viewType="video"
        load="visible"
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        className="w-full h-full text-white"
      >
        <MediaProvider />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          smallLayoutWhen={({ width }) => width < 576}
        />
      </MediaPlayer>
    </div>
  );
}
