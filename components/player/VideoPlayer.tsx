"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const youtubeId = useMemo(() => {
    const match = src.match(
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
    );
    return match && match[2].length === 11 ? match[2] : null;
  }, [src]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theo dõi trạng thái fullscreen thực tế của browser
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Một số trình duyệt không hỗ trợ
    }
  }, []);

  if (!isMounted)
    return (
      <div className="aspect-video w-full bg-slate-900 rounded-xl animate-pulse" />
    );

  if (youtubeId) {
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      // Tắt fullscreen button của YouTube (dùng fullscreen của mình thay thế)
      fs: "0",
      ...(autoPlay ? { autoplay: "1" } : {}),
      ...(muted ? { mute: "1" } : {}),
    });

    return (
      <div
        ref={containerRef}
        className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black group"
      >
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?${params.toString()}`}
          title={title}
          // Bỏ allowFullScreen — dùng fullscreen của container thay thế
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          className="absolute inset-0 w-full h-full border-0"
        />

        {/* Chặn toàn bộ thanh controls dưới: share, watch later, Video khác, YouTube logo, progress bar */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10"
          style={{ height: "62px" }}
        />
        {/* Chặn vùng title / Watch on YouTube phía trên (bỏ trống ~140px bên phải để 3 nút settings vẫn bấm được) */}
        <div
          className="absolute top-0 left-0 z-10"
          style={{ width: "calc(100% - 140px)", height: "48px" }}
        />

        {/* Nút fullscreen của mình — overlay trên iframe, luôn hoạt động */}
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-16 right-3 z-20 p-3 rounded-lg bg-black/60 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/90"
          aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        >
          {isFullscreen ? (
            // Icon thu nhỏ
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z" />
            </svg>
          ) : (
            // Icon phóng to
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" />
            </svg>
          )}
        </button>
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
