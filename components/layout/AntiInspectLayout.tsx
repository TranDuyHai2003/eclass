"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AntiInspectLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Chỉ kích hoạt khi chạy production (sau khi run build)
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    // 1. Chặn các phím tắt mở DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "F12" || 
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i")) || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && (e.key === "J" || e.key === "j")) || // Ctrl+Shift+J
        (e.ctrlKey && e.shiftKey && (e.key === "C" || e.key === "c")) || // Ctrl+Shift+C
        (e.ctrlKey && (e.key === "U" || e.key === "u")) // Ctrl+U (View Source)
      ) {
        e.preventDefault();
        router.push("/404"); // Đẩy sang trang 404 khi cố gắng inspect
      }
    };

    // 2. Chặn click chuột phải
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 3. Chặn phím tắt in ấn (thường dùng để lấy text)
    const handlePrint = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handlePrint);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handlePrint);
    };
  }, [router]);

  return <>{children}</>;
}
