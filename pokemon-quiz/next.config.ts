import type { NextConfig } from 'next';

// Enable standalone output so the build can be shipped as a portable artifact (Docker, bare metal)
const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Turbopack already enabled via build script; keep future defaults safe
  },
  eslint: {
    // Allow production builds even if there are lint warnings (we still fix errors)
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Fail the build on type errors in CI (can be relaxed if desired)
    ignoreBuildErrors: false,
  }
};

export default nextConfig;
