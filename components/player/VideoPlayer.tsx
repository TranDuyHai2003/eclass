"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  SeekButton,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useRef, CSSProperties } from "react";

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  subtitles?: {
    src: string;
    label: string;
    language: string;
    kind?: "subtitles" | "captions";
    default?: boolean;
  }[];
}

interface CustomCSSProperties extends CSSProperties {
  [key: `--${string}`]: string | number | undefined;
}

// Icon -5s
function RewindIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12.5 3C7.81 3 4 6.81 4 11.5H2l2.5 2.5 2.5-2.5H5c0-4.14 3.36-7.5 7.5-7.5S20 7.36 20 11.5 16.64 19 12.5 19c-2.09 0-3.99-.82-5.37-2.13l-1.42 1.42C7.62 19.91 9.96 21 12.5 21 17.19 21 21 17.19 21 12.5S17.19 3 12.5 3z"/>
      <text x="7" y="15" fontSize="6.5" fontFamily="sans-serif" fontWeight="bold" fill="currentColor">5</text>
    </svg>
  );
}

// Icon +5s
function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M11.5 3C6.81 3 3 6.81 3 11.5h2L2.5 14 0 11.5h2C2 6.81 5.81 3 10.5 3S19 7.36 19 11.5 15.64 19 11.5 19c-2.09 0-3.99-.82-5.37-2.13L4.71 18.29C6.12 19.91 8.71 21 11.5 21 16.19 21 20 17.19 20 12.5S16.19 3 11.5 3z" transform="scale(-1,1) translate(-24, 0)"/>
      <text x="9" y="15" fontSize="6.5" fontFamily="sans-serif" fontWeight="bold" fill="currentColor">5</text>
    </svg>
  );
}

export default function VideoPlayer({
  src,
  title,
  poster,
  subtitles,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);

  const skip = (seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, Math.min(player.currentTime + seconds, player.duration));
  };

  const skipBtnClass =
    "flex items-center justify-center w-8 h-8 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all duration-150 select-none cursor-pointer";

  return (
    <MediaPlayer
      ref={playerRef}
      title={title}
      src={src}
      viewType="video"
      streamType="on-demand"
      logLevel="warn"
      crossOrigin
      playsInline
      autoPlay
      className="w-full aspect-video bg-black text-white font-sans overflow-hidden rounded-md ring-media-focus data-[focus]:ring-4"
      style={
        {
          "--brand": "#f00",
          "--media-brand": "#f00",
          "--media-focus-ring-color": "#f00",
          "--media-slider-track-height": "4px",
          "--media-slider-thumb-size": "14px",
        } as CustomCSSProperties
      }
    >
      <MediaProvider>
        {poster && (
          <Poster
            className="absolute inset-0 block h-full w-full opacity-0 transition-opacity data-[visible]:opacity-100 object-cover"
            src={poster}
            alt={title}
          />
        )}

        {subtitles?.map((sub, index) => (
          <Track
            key={String(index)}
            src={sub.src}
            kind={sub.kind || "subtitles"}
            label={sub.label}
            lang={sub.language}
            default={sub.default}
          />
        ))}
      </MediaProvider>

      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        slots={{
          beforePlayButton: (
            <button
              className={skipBtnClass}
              title="Tua lùi 5 giây"
              onClick={() => skip(-5)}
              aria-label="Tua lùi 5 giây"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
              </svg>
            </button>
          ),
          afterPlayButton: (
            <button
              className={skipBtnClass}
              title="Tua tiếp 5 giây"
              onClick={() => skip(5)}
              aria-label="Tua tiếp 5 giây"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                <path d="M12.01 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
              </svg>
            </button>
          ),
        }}
      />
    </MediaPlayer>
  );
}
