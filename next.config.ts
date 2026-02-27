import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false, // Security: Do not expose React component structure in production
  output: 'export',
  images: {
    unoptimized: true, // CRITICAL: Next/Image doesn't work with 'export' without this
  }
};

export default nextConfig;
