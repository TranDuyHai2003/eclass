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
    ],
  },
};

export default nextConfig;
