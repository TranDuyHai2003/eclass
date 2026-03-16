"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useRef, CSSProperties } from "react"; // Import CSSProperties

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

// FIX 1: Định nghĩa lại kiểu style để chấp nhận biến CSS (--variable)
interface CustomCSSProperties extends CSSProperties {
  [key: `--${string}`]: string | number | undefined;
}

export default function VideoPlayer({
  src,
  title,
  poster,
  subtitles,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);

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
      className="w-full aspect-video bg-black text-white font-sans overflow-hidden rounded-md ring-media-focus data-[focus]:ring-4"
      // FIX 1: Cast style sang CustomCSSProperties
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
            // FIX 2: Chuyển index (number) thành string
            key={String(index)}
            src={sub.src}
            kind={sub.kind || "subtitles"}
            label={sub.label}
            lang={sub.language}
            default={sub.default}
          />
        ))}
      </MediaProvider>

      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
