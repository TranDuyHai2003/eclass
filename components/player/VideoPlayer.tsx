"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Gesture,
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
  autoPlay?: boolean;
  muted?: boolean;
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
  autoPlay = false,
  muted = false 
}: VideoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const isYoutube = isYoutubeUrl(src);
  const youtubeId = isYoutube ? getYoutubeId(src) : null;

  if (isYoutube && !youtubeId) {
    return (
      <div className="aspect-video w-full bg-slate-950 flex items-center justify-center rounded-[12px] border border-white/10 shadow-2xl">
        <div className="text-center p-6">
          <p className="text-white font-medium mb-2">Không thể tải video</p>
          <p className="text-white/40 text-xs">
            Đường dẫn YouTube không hợp lệ hoặc đã bị gỡ bỏ.
          </p>
        </div>
      </div>
    );
  }

  const actualPoster =
    isYoutube && !poster && youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : poster;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  const handleProviderSetup = (provider: any) => {
    if (provider.type === "youtube") {
      provider.cookies = true;
      // Ép Youtube tắt TẤT CẢ giao diện mặc định của nó để nhường sân khấu cho Vidstack
      provider.options = {
        ...provider.options,
        controls: 0, // Tắt thanh điều khiển gốc của Youtube
        disablekb: 1, // Tắt phím tắt Youtube (dùng của Vidstack)
        modestbranding: 1, // Ẩn logo Youtube
        rel: 0, // Không hiện video liên quan
        iv_load_policy: 3, // Tắt chú thích popup
      };
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

      /* Chặn ngón tay/chuột bấm xuyên qua lớp bảo vệ trúng iframe Youtube */
      .vds-youtube iframe {
        pointer-events: none !important;
      }

      .vds-title {
        text-shadow: 0 2px 4px rgba(0,0,0,0.8);
        font-weight: 800 !important;
      }

      /* Ẩn hoàn toàn iframe YouTube trước khi video bắt đầu để giấu nút Play gốc của YouTube */
      media-player:not([data-started]) iframe,
      .group:not([data-started]) iframe {
        opacity: 0 !important;
        visibility: hidden !important;
      }

      /* ẨN HIỆU ỨNG CHỚP TO (Gesture Indicator) đè lên nút Play chính */
      .vds-gesture-action {
        display: none !important;
      }

      /* --- FIX KÍCH THƯỚC FULLSCREEN KHÔNG BỊ CROP/XÉN --- */
      
      /* 1. Ép root player bung full màn hình và tạo nền đen */
      media-player[data-fullscreen],
      media-player:fullscreen {
        width: 100vw !important;
        height: 100dvh !important; 
        background: black !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        --media-aspect-ratio: auto !important;
      }

      /* 2. ĐẶC BIỆT QUAN TRỌNG: Công thức toán học ép cục Video & Layout UI giữ chuẩn 16:9
         - Chiều rộng không bao giờ vượt qua tỷ lệ của chiều cao.
         - Chiều cao không bao giờ vượt qua tỷ lệ của chiều rộng.
         -> Video luôn giữ chuẩn 16:9 và lọt thỏm nguyên vẹn trong màn hình. */
      media-player[data-fullscreen] > media-provider,
      media-player:fullscreen > media-provider,
      media-player[data-fullscreen] > .vds-video-layout,
      media-player:fullscreen > .vds-video-layout {
        width: 100% !important;
        height: 100% !important;
        max-width: calc(100dvh * (16 / 9)) !important;
        max-height: calc(100vw * (9 / 16)) !important;
        aspect-ratio: 16 / 9 !important;
        margin: auto !important;
        inset: 0 !important; /* Bắt buộc để center layout absolute */
      }

      /* 3. Ngăn chặn Vidstack tự động thêm transform scale() (zoom video) */
      media-player[data-fullscreen] iframe,
      media-player:fullscreen iframe,
      media-player[data-fullscreen] video,
      media-player:fullscreen video {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        transform: none !important; /* Chặn zoom mất gốc dọc của video */
      }

      /* --- TỐI ƯU GIAO DIỆN MOBILE --- */
      @media (max-width: 768px) {
        .vds-controls { 
          padding: 12px 10px !important; 
        }
        
        /* Chỉ phóng to các nút ở dưới, KHÔNG áp dụng margin cho nút to ở giữa màn hình */
        .vds-controls .vds-button {
          transform: scale(1.15);
        }

        /* Bổ sung margin cho các nút bên dưới thanh control, loại trừ nút play ở giữa */
        .vds-controls-group .vds-button {
          margin: 0 4px;
        }

        /* Tăng độ dày thanh tua video để ngón tay dễ kéo */
        vds-media-slider {
          --vds-slider-track-height: 6px;
          --vds-slider-thumb-size: 20px;
        }

        .vds-title {
          font-size: 14px !important;
        }
      }
    `,
  }}
/>

      <MediaPlayer
        ref={playerRef}
        title={title}
        src={isYoutube && youtubeId ? `youtube/${youtubeId}` : src}
        viewType="video"
        load="visible" // FIX: Ép player load giao diện (bao gồm nút Play to) ngay khi cuộn tới
        logLevel="warn"
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        onProviderSetup={handleProviderSetup}
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
              className="vds-poster absolute inset-0 block h-full w-full opacity-0 transition-opacity data-[visible]:opacity-100 object-cover pointer-events-none"
              src={actualPoster}
              alt={title}
            />
          )}
        </MediaProvider>

        {/* --- LOGIC TUA VIDEO CHO MOBILE (YouTube-style) --- */}
        {/* Vùng 1: 40% bên trái -> Tua lùi 10 giây */}
        <Gesture
          className="absolute inset-y-0 left-0 z-50 w-[40%] block"
          event="dblpointerup"
          action="seek:-10"
        />

        {/* Vùng 2: 40% bên phải -> Tua tới 10 giây */}
        <Gesture
          className="absolute inset-y-0 right-0 z-50 w-[40%] block"
          event="dblpointerup"
          action="seek:10"
        />

        {/* Vùng 3: 20% ở giữa -> Đổi thành Play/Pause để đè sự kiện thoát Fullscreen */}
        <Gesture
          className="absolute inset-y-0 left-[40%] z-50 w-[20%] block"
          event="dblpointerup"
          action="toggle:paused"
        />
        {/* ---------------------------------- */}

        {/* Layout chuẩn mặc định của Vidstack, chứa sẵn nút Play to ở giữa */}
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  );
}