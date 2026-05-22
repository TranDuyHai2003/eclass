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
import { useRef, CSSProperties, useEffect, useState } from "react";

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
  const [isMobile, setIsMobile] = useState(false);
  const isYoutube = isYoutubeUrl(src);
  const youtubeId = isYoutube ? getYoutubeId(src) : null;

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      const ua = navigator.userAgent;
      const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
      setIsMobile(mobile);
      console.log("[VideoPlayer] Device Check:", { mobile, ua });
    };
    checkMobile();
  }, []);

  // Force muted if autoplay on mobile
  const finalMuted = isMobile && autoPlay ? true : muted;

  if (isYoutube && !youtubeId) {
    return (
      <div className="aspect-video w-full bg-slate-950 flex items-center justify-center rounded-[12px] border border-white/10 shadow-2xl">
        <div className="text-center p-6">
          <p className="text-white font-medium mb-2">Không thể tải video</p>
          <p className="text-white/40 text-xs">Đường dẫn YouTube không hợp lệ hoặc đã bị gỡ bỏ.</p>
        </div>
      </div>
    );
  }

  const actualPoster =
    isYoutube && !poster && youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
      : poster;

  useEffect(() => {
    console.log("[VideoPlayer] Initializing", {
      src,
      title,
      isYoutube,
      autoPlay,
      muted: finalMuted,
      originalMuted: muted,
      isMobile,
    });
  }, [src, title, isYoutube, autoPlay, finalMuted, isMobile]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleProviderSetup = (provider: any) => {
    if (provider.type === "youtube") {
      provider.cookies = true;
      console.log("[VideoPlayer] YouTube provider setup");
    }
  };

  const handlePlayError = (detail: any) => {
    console.error("[VideoPlayer] Play Error:", detail);
  };

  return (
    <div
      className="relative w-full rounded-[12px] overflow-hidden bg-black shadow-2xl"
      onContextMenu={handleContextMenu}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
  :root {
    --video-brand: #3b82f6;
  }

  /* GỠ BỎ CÁC CSS CAN THIỆP SÂU GÂY LỖI TRÊN MOBILE NHƯ GỢI Ý */
  /* Vidstack tự quản lý z-index và pointer-events rất tốt, ta chỉ can thiệp tối thiểu */

  .vds-button[slot="centered-play"],
  .vds-play-button[data-center] {
    touch-action: manipulation !important; /* Giảm độ trễ tap trên mobile */
    cursor: pointer !important;
  }

  /* FIX LỖI 2 ICON SVG TRONG NÚT PLAY (vẫn giữ vì là lỗi hiển thị) */
  .vds-play-button[data-paused] [data-pause-icon] {
    display: none !important;
  }
  .vds-play-button:not([data-paused]) [data-play-icon] {
    display: none !important;
  }
  .vds-button svg {
    display: block; 
  }

  /* UI Tùy chỉnh nhẹ nhàng */
  vds-media-slider {
    --vds-slider-track-height: 4px;
    --vds-slider-thumb-size: 16px;
    --vds-slider-active-color: var(--video-brand);
  }

  @media (max-width: 768px) {
    .vds-controls { padding: 8px !important; }
  }

  .vds-title {
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    font-weight: 800 !important;
  }
`,
        }}
      />

      <MediaPlayer
        ref={playerRef}
        title={title}
        src={isYoutube && youtubeId ? `youtube/${youtubeId}` : src}
        logLevel="warn"
        playsInline
        autoPlay={autoPlay}
        muted={finalMuted}
        onProviderSetup={handleProviderSetup}
        onPlayFail={handlePlayError}
        {...(isYoutube ? {} : { crossOrigin: "anonymous" })}
        className="w-full aspect-video bg-black text-white font-sans overflow-hidden ring-media-focus data-[focus]:ring-4 group relative"
        style={
          {
            "--brand": "var(--video-brand)",
            "--media-brand": "var(--video-brand)",
            "--media-focus-ring-color": "var(--video-brand)",
            "--media-slider-track-height": "4px",
            "--media-slider-thumb-size": "14px",
            "--media-controls-gap": "12px",
          } as CustomCSSProperties
        }
      >
        <MediaProvider>
          {actualPoster && (
            <Poster
              className="absolute inset-0 block h-full w-full opacity-0 transition-opacity data-[visible]:opacity-100 object-cover z-10 pointer-events-none"
              src={actualPoster}
              alt={title}
            />
          )}

          {!isYoutube &&
            subtitles?.map((sub, index) => (
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

        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}
