"use client";

import { useState, useEffect, useRef } from "react";

export function LazyLoadWrapper({
  children,
  placeholderHeight = "500px",
}: {
  children: React.ReactNode;
  placeholderHeight?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ minHeight: isVisible ? "auto" : placeholderHeight }}
    >
      {isVisible ? (
        children
      ) : (
        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-100 rounded-2xl border border-slate-200">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Đang chờ tải PDF...
          </span>
        </div>
      )}
    </div>
  );
}
