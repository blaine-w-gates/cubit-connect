import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // CRITICAL: Required for GitHub Pages
  images: {
    unoptimized: true, // CRITICAL: Next/Image doesn't work with 'export' without this
  },
};

export default nextConfig;
