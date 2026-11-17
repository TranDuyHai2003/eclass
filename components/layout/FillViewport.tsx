"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Chiếm đúng phần chiều cao còn lại của màn hình tính từ vị trí của nó
 * (không phụ thuộc chiều cao header/banner phía trên). `fallbackClassName` dùng cho lần render đầu.
 */
export function FillViewport({
  className,
  fallbackClassName,
  children,
}: {
  className?: string;
  fallbackClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(320, window.innerHeight - top));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div ref={ref} className={height === null ? `${fallbackClassName ?? ""} ${className ?? ""}` : className} style={height === null ? undefined : { height }}>
      {children}
    </div>
  );
}
