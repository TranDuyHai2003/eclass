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
  // Chỉ đo phần bị chiếm phía trên (vd banner demo); chiều cao để CSS tính bằng 100dvh — trên điện thoại
  // 100dvh luôn khớp phần nhìn thấy khi thanh địa chỉ ẩn/hiện, còn window.innerHeight có thể lệch.
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={ref}
      className={top === null ? `${fallbackClassName ?? ""} ${className ?? ""}` : className}
      style={top === null ? undefined : { height: `max(320px, calc(100dvh - ${top}px))` }}
    >
      {children}
    </div>
  );
}
