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
import { RotateCcw, RotateCw } from "lucide-react";

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
      autoPlay
      className="w-full aspect-video bg-black text-white font-sans overflow-hidden rounded-md ring-media-focus data-[focus]:ring-4"
      style={
        {
          "--brand": "#f00",
          "--media-brand": "#f00",
          "--media-focus-ring-color": "#f00",
          "--media-slider-track-height": "4px",
          "--media-slider-thumb-size": "14px",
          "--media-controls-gap": "8px",
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
            <div className="flex items-center justify-center h-full">
              <SeekButton
                seconds={-10}
                className="flex items-center justify-center mt-4 lg:mt-0 w-10 h-10 sm:w-12 sm:h-12 mx-8 md:mx-4 rounded-full bg-black/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none text-white hover:bg-black/60 md:hover:bg-white/20 transition-all active:scale-90 group focus:outline-none ring-primary/50 focus-visible:ring-2 relative z-[70] pointer-events-auto"
                aria-label="Tua lùi 10 giây"
                title="Tua lùi 10 giây"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
              </SeekButton>
            </div>
          ),

          afterPlayButton: (
            <div className="flex items-center justify-center h-full">
              <SeekButton
                seconds={10}
                className="flex items-center justify-center mt-4 lg:mt-0 w-10 h-10 sm:w-12 sm:h-12 mx-8 md:mx-4 rounded-full bg-black/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none text-white hover:bg-black/60 md:hover:bg-white/20 transition-all active:scale-90 group focus:outline-none ring-primary/50 focus-visible:ring-2 relative z-[70] pointer-events-auto"
                aria-label="Tua tiếp 10 giây"
                title="Tua tiếp 10 giây"
              >
                <RotateCw className="w-5 h-5 sm:w-6 sm:h-6" />
              </SeekButton>
            </div>
          ),
        }}
      />
    </MediaPlayer>
  );
}
