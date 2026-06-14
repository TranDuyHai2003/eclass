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
  muted = false
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
  const [viewport, setViewport] = useState({ width: '100vw', height: '100vh' });

  const youtubeId = useMemo(() => {
    const match = src.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2].length === 11 ? match[2] : null;
  }, [src]);

  useEffect(() => {
    setIsMounted(true);
    const checkIOS = 
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
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
          height: `${window.innerHeight}px` // Đây là chiều cao chính xác đến từng pixel
        });
      }, 100);
    };

    updateSize(); // Đo ngay lần đầu
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
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
    player.addEventListener('fullscreen-request', handleFullscreenRequest);
    // @ts-ignore - Vidstack events
    player.addEventListener('fullscreen-exit-request', handleFullscreenExitRequest);

    return () => {
      // @ts-ignore
      player.removeEventListener('fullscreen-request', handleFullscreenRequest);
      // @ts-ignore
      player.removeEventListener('fullscreen-exit-request', handleFullscreenExitRequest);
    };
  }, [isIOS, isMounted]);

  const thumbnailSrc = useMemo(() => {
    if (poster) return poster;
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
    return '';
  }, [poster, youtubeId]);

  const [thumbnailSrcFinal, setThumbnailSrcFinal] = useState(thumbnailSrc);

  useEffect(() => {
    setThumbnailSrcFinal(thumbnailSrc);
  }, [thumbnailSrc]);

  if (!isMounted) return <div className="aspect-video w-full bg-slate-900 rounded-xl animate-pulse" />;

  return (
    <div 
      className={
        isFakeFullscreen 
          ? "fixed top-0 left-0 z-[9999] bg-black flex flex-col justify-center items-center overflow-hidden"
          : "relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl group transition-all duration-300 max-md:landscape:max-h-[80vh] max-md:landscape:w-auto max-md:landscape:mx-auto"
      }
      style={isFakeFullscreen ? {
        // Áp dụng số pixel đo được bằng JS (Loại bỏ hoàn toàn CSS vh/svh)
        width: viewport.width,
        height: viewport.height,
        boxSizing: 'border-box',
        // Né tai thỏ
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      } : {}}
    >
      {thumbnailSrcFinal && !isFakeFullscreen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailSrcFinal}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          onError={() => {
            if (poster || !youtubeId) return;
            setThumbnailSrcFinal(`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`);
          }}
        />
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
        style={isFakeFullscreen ? { maxWidth: '100%', maxHeight: '100%', width: '100%', height: '100%' } : {}}
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
            ${isFakeFullscreen ? 'p-3' : 'p-2'}
          `}
          style={{ zIndex: 999999 }}
          aria-label="Toggle Fullscreen"
        >
          {isFakeFullscreen ? (
             <svg className="pointer-events-none" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
             </svg>
          ) : (
             <svg className="pointer-events-none" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
             </svg>
          )}
        </button>
      )}
    </div>
  );
}