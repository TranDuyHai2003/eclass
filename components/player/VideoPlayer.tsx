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
import { useRef, CSSProperties, useState, useEffect } from "react";
import { RotateCcw, RotateCw } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
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

const isYoutubeUrl = (url: string) => {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)/.test(url);
};

const getYoutubeId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

export default function VideoPlayer({
  src,
  title,
  poster,
  autoPlay = true,
  muted = false,
  subtitles,
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const isYoutube = isYoutubeUrl(src);
  const youtubeId = isYoutube ? getYoutubeId(src) : null;

  useEffect(() => {
    console.log("[VideoPlayer] Initializing", { src, title, isYoutube, youtubeId, autoPlay, muted });
  }, [src, title, isYoutube, youtubeId, autoPlay, muted]);

  // Disable right click handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // If it's YouTube, use the standard iframe to bypass CORS completely
  if (isYoutube && youtubeId) {
    return (
      <div className="w-full aspect-video bg-black overflow-hidden rounded-md relative group">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=${autoPlay ? 1 : 0}&mute=${muted ? 1 : 0}&modestbranding=1&rel=0`}
          title={title}
          className="w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <MediaPlayer
      ref={playerRef}
      title={title}
      src={src}
      logLevel="warn"
      playsInline
      autoPlay={autoPlay}
      muted={muted}
      crossOrigin={null}
      onContextMenu={handleContextMenu}
      onProviderChange={(detail) => console.log("[VideoPlayer] Provider changed:", detail)}
      onCanPlay={(detail) => console.log("[VideoPlayer] Can play:", detail)}
      onError={(detail) => console.error("[VideoPlayer] Error:", detail)}
      {...(isYoutube ? {
        youtube: {
          cookies: true, // Use youtube.com instead of youtube-nocookie.com to avoid certain CORS issues
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
        }
      } : {})}
      className="w-full aspect-video bg-black text-white font-sans overflow-hidden rounded-md ring-media-focus data-[focus]:ring-4 relative group"
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
        
        {/* Security Overlay for YouTube */}
        {isYoutube && (
           <div 
             className="absolute inset-0 z-10 select-none pointer-events-none"
             onContextMenu={handleContextMenu}
           >
              {/* This invisible div catches right clicks if pointer-events was auto, 
                  but we use pointer-events-none to allow Vidstack gestures to work.
                  Vidstack's custom UI is already at a higher z-index than the provider.
              */}
           </div>
        )}
      </MediaProvider>

      {/* Security: Prevent interaction with the underlying provider for YouTube */}
      {isYoutube && (
        <style dangerouslySetInnerHTML={{ __html: `
          [data-provider="youtube"] iframe {
            user-select: none !important;
          }
          /* Re-enable pointer events for the controls layer */
          .vds-media-ui {
            pointer-events: auto !important;
          }
        `}} />
      )}

      <DefaultVideoLayout
        icons={defaultLayoutIcons}
        slots={{
          beforePlayButton: (
            <div className="flex items-center justify-center">
              <SeekButton
                seconds={-10}
                className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none text-white hover:bg-white/20 transition-all active:scale-90 group focus:outline-none ring-primary/50 focus-visible:ring-2 relative z-[70] pointer-events-auto"
                aria-label="Tua lùi 10 giây"
                title="Tua lùi 10 giây"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
              </SeekButton>
            </div>
          ),

          afterPlayButton: (
            <div className="flex items-center justify-center">
              <SeekButton
                seconds={10}
                className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 md:bg-transparent backdrop-blur-md md:backdrop-blur-none text-white hover:bg-white/20 transition-all active:scale-90 group focus:outline-none ring-primary/50 focus-visible:ring-2 relative z-[70] pointer-events-auto"
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
