import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Seafood photography is the heaviest asset on a slow Lagos connection, so
  // modern formats are not optional.
  images: { formats: ["image/avif", "image/webp"] },
};

export default nextConfig;
