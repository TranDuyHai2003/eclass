"use client";

import { usePathname } from "next/navigation";

/** Trang "đứng riêng" có thanh điều hướng của chính nó (Tiệm quà theo canvas ShopV2) → ẩn header chung của web */
const STANDALONE = ["/rewards"];

export function HideOnStandalone({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname && STANDALONE.includes(pathname)) return null;
  return <>{children}</>;
}
