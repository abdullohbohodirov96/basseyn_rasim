import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "sharp"],
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
