import type { NextConfig } from "next";
import { OPTIMIZED_IMAGE_HOSTS } from "./lib/image-hosts";

const nextConfig: NextConfig = {
  output: "standalone",
  // Dev: cho phép mở server dev từ điện thoại trong mạng LAN (chỉ ảnh hưởng `next dev`)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
  images: {
    // Ảnh trên CDN đặt tên theo mã ngẫu nhiên (đổi ảnh = đổi URL) → giữ bản đã tối ưu 7 ngày
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns: [
      ...OPTIMIZED_IMAGE_HOSTS.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
      { protocol: "https", hostname: "ui-avatars.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
