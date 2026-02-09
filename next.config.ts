import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  /* config options here */
  reactStrictMode: false, // Fixes potential double-render issues in webviews
  output: 'standalone', // Optimized build for Vercel/Docker
};

export default nextConfig;
