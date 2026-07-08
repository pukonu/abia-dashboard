import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.antly.co",
        pathname: "/icons/page-icons/**",
      },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
