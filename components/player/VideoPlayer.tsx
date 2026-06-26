"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";
import {
  MediaPlayer,
  MediaProvider,
  Gesture,
  type MediaPlayerInstance,
} from "@vidstack/react";
import {
  defaultLayoutIcons,
  DefaultVideoLayout,
} from "@vidstack/react/player/layouts/default";
import { useState, useEffect, useMemo, useRef } from "react";

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
  const [isIOS, setIsIOS] = useState(false);

  const [isFakeFullscreen, setIsFakeFullscreen] = useState(false);
  const playerRef = useRef<MediaPlayerInstance>(null);

  // State lưu trữ kích thước pixel thực tế của màn hình
  const [viewport, setViewport] = useState({ width: "100vw", height: "100vh" });

  const youtubeId = useMemo(() => {
    const match = src.match(
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
    );
    return match && match[2].length === 11 ? match[2] : null;
  }, [src]);

  useEffect(() => {
    setIsMounted(true);
    const checkIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(checkIOS);
  }, []);

  // HIỆU ỨNG ĐO PIXEL THỰC TẾ: Chạy mỗi khi xoay máy hoặc bật Fullscreen
  useEffect(() => {
    if (!isFakeFullscreen) return;

    const updateSize = () => {
      // Dùng setTimeout 100ms để chờ Safari tính toán xong thanh địa chỉ sau khi xoay ngang
      setTimeout(() => {
        setViewport({
          width: `${window.innerWidth}px`,
          height: `${window.innerHeight}px`, // Đây là chiều cao chính xác đến từng pixel
        });
      }, 100);
    };

    updateSize(); // Đo ngay lần đầu
    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, [isFakeFullscreen]);

  // Xử lý chặn Fullscreen gốc trên iOS
  useEffect(() => {
    if (!isIOS || !playerRef.current) return;

    const player = playerRef.current;

    const handleFullscreenRequest = (e: Event) => {
      e.preventDefault();
      setIsFakeFullscreen(true);
    };

    const handleFullscreenExitRequest = (e: Event) => {
      e.preventDefault();
      setIsFakeFullscreen(false);
    };

    // @ts-ignore - Vidstack events
    player.addEventListener("fullscreen-request", handleFullscreenRequest);
    // @ts-ignore - Vidstack events
    player.addEventListener(
      "fullscreen-exit-request",
      handleFullscreenExitRequest,
    );

    return () => {
      // @ts-ignore
      player.removeEventListener("fullscreen-request", handleFullscreenRequest);
      // @ts-ignore
      player.removeEventListener(
        "fullscreen-exit-request",
        handleFullscreenExitRequest,
      );
    };
  }, [isIOS, isMounted]);

  const thumbnailSrc = useMemo(() => {
    if (youtubeId)
      return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    if (poster) return poster;
    return "";
  }, [poster, youtubeId]);

  const [thumbnailSrcFinal, setThumbnailSrcFinal] = useState(thumbnailSrc);
  const [hasStarted, setHasStarted] = useState(autoPlay || false);

  useEffect(() => {
    setThumbnailSrcFinal(thumbnailSrc);
  }, [thumbnailSrc]);

  useEffect(() => {
    setHasStarted(autoPlay || false);
  }, [src, autoPlay]);

  if (!isMounted)
    return (
      <div className="aspect-video w-full bg-slate-900 rounded-xl animate-pulse" />
    );

  return (
    <div
      className={
        isFakeFullscreen
          ? "fixed top-0 left-0 z-[9999] bg-black flex flex-col justify-center items-center overflow-hidden"
          : "relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group transition-all duration-300 max-md:landscape:max-h-[80vh] max-md:landscape:w-auto max-md:landscape:mx-auto"
      }
      style={
        isFakeFullscreen
          ? {
              // Áp dụng số pixel đo được bằng JS (Loại bỏ hoàn toàn CSS vh/svh)
              width: viewport.width,
              height: viewport.height,
              boxSizing: "border-box",
              // Né tai thỏ
              paddingLeft: "env(safe-area-inset-left)",
              paddingRight: "env(safe-area-inset-right)",
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }
          : {}
      }
    >
      {!hasStarted && (
        <div
          className="absolute inset-0 z-40 bg-black flex flex-col justify-center items-center cursor-pointer group"
          onClick={() => {
            setHasStarted(true);
            if (playerRef.current) {
              playerRef.current.play();
            }
          }}
        >
          {thumbnailSrcFinal && (
            <img
              src={thumbnailSrcFinal}
              alt={title}
              className="absolute inset-0 w-full h-full object-contain"
              onError={() => {
                if (poster || !youtubeId) return;
                setThumbnailSrcFinal(
                  `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
                );
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {youtubeId ? (
              <svg
                style={{ width: "68px", height: "48px", color: "#FF0000" }}
                className="drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-200"
                viewBox="0 0 68 48"
                fill="currentColor"
              >
                <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"></path>
                <path fill="white" d="M27,36l18-12L27,12V36z"></path>
              </svg>
            ) : (
              <div className="w-16 h-16 bg-black/50 border border-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-black/70 transition-colors">
                <svg
                  className="w-8 h-8 text-white translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>
      )}

      <MediaPlayer
        key={src}
        ref={playerRef}
        title={title}
        src={youtubeId ? `youtube/${youtubeId}` : src}
        viewType="video"
        load="visible"
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        // Bắt buộc Vidstack không được phình to hơn container
        style={
          isFakeFullscreen
            ? {
                maxWidth: "100%",
                maxHeight: "100%",
                width: "100%",
                height: "100%",
              }
            : {}
        }
        className={isFakeFullscreen ? "text-white" : "w-full h-full text-white"}
      >
        <MediaProvider />

        <Gesture
          className="absolute inset-0 z-0"
          event="pointerup"
          action="toggle:paused"
        />

        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          smallLayoutWhen={({ width }) => width < 576}
        />
      </MediaPlayer>

      {/* NÚT ZOOM OUT/IN TÙY CHỈNH */}
      {isIOS && (
        <button
          onClickCapture={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsFakeFullscreen(!isFakeFullscreen);
          }}
          onPointerDownCapture={(e) => {
            e.stopPropagation();
          }}
          className={`
            absolute transition-all duration-300 flex items-center justify-center
            border border-white/10 shadow-lg text-white rounded-full backdrop-blur-md 
            bg-black/50 hover:bg-black/80
            right-4 top-1/2 -translate-y-1/2
            pointer-events-auto cursor-pointer
            ${isFakeFullscreen ? "p-3" : "p-2"}
          `}
          style={{ zIndex: 999999 }}
          aria-label="Toggle Fullscreen"
        >
          {isFakeFullscreen ? (
            <svg
              className="pointer-events-none"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              className="pointer-events-none"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
