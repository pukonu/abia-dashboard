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
    // Amplify runs the build from the configured app root. Avoid `__dirname`
    // here: Next bundles this config and can resolve it relative to `src/app`,
    // which makes Turbopack look for `next/package.json` in the wrong place.
    root: process.cwd(),
  },
};

export default nextConfig;
