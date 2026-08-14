"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useState, useEffect, useMemo } from "react";

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
    const match = src.match(
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
    );
    return match && match[2].length === 11 ? match[2] : null;
  }, [src]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted)
    return (
      <div className="aspect-video w-full bg-slate-900 rounded-xl animate-pulse" />
    );

  if (youtubeId) {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      ...(autoPlay ? { autoplay: "1" } : {}),
      ...(muted ? { mute: "1" } : {}),
    });

    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black">
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

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
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
