import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eclass.b-cdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "vz-7449c6de-22c.b-cdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.teacherduc.me",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
