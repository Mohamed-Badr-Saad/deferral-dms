import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Previously: default output. Keep Vercel/dev behavior unless building Docker.
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
