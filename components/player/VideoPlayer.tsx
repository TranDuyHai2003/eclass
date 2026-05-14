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
import { useRef, CSSProperties, useEffect } from "react";

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
      muted,
    });
  }, [src, title, isYoutube, autoPlay, muted]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleProviderSetup = (provider: any) => {
    if (provider.type === "youtube") {
      provider.cookies = true;
    }
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

  /* ĐÃ XÓA FIX 1 CỦA BẠN: 
     Vidstack tự động quản lý pointer-events của iframe để vượt rào Autoplay iOS/Android. 
     Việc tự ý set pointer-events sẽ làm hỏng luồng click nội bộ của Vidstack. */

  /* FIX 1 MỚI: Đưa lớp Gesture (chạm để hiện/ẩn UI) xuống dưới cùng để KHÔNG che mất nút Play */
  vds-media-player vds-gesture {
    z-index: 10 !important;
  }

  /* FIX 2: Nâng cụm Controls lên trên Gesture */
  vds-media-player .vds-controls {
    z-index: 40 !important;
  }

  /* FIX 3: Ép nút Play ở giữa luôn nổi lên trên cùng, 
     và thêm touch-action để fix lỗi đơ click / delay tap trên Mobile */
  .vds-button[slot="centered-play"],
  .vds-play-button[data-center] {
    z-index: 9999 !important;
    pointer-events: auto !important;
    touch-action: manipulation !important; /* <--- CỰC KỲ QUAN TRỌNG TRÊN MOBILE */
    cursor: pointer !important;
  }

  /* FIX LỖI 2 ICON SVG TRONG NÚT PLAY */
  .vds-play-button[data-paused] [data-pause-icon] {
    display: none !important;
  }
  .vds-play-button:not([data-paused]) [data-play-icon] {
    display: none !important;
  }
  .vds-button svg {
    display: block; 
  }

  /* UI Tùy chỉnh */
  vds-media-slider {
    --vds-slider-track-height: 4px;
    --vds-slider-thumb-size: 16px;
    --vds-slider-active-color: var(--video-brand);
  }

  vds-media-slider:hover {
    --vds-slider-track-height: 6px;
  }

  @media (max-width: 768px) {
    .vds-controls { padding: 8px !important; }
  }

  .vds-title {
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
    font-weight: 800 !important;
  }

  vds-media-player[data-paused] .vds-provider::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.2);
    pointer-events: none;
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
        muted={muted}
        onProviderSetup={handleProviderSetup}
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
              /* ĐÃ SỬA: Bổ sung pointer-events-none để lớp mờ này không hấp thụ sự kiện Touch */
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
