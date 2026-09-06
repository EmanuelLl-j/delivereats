import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: `${process.cwd()}/../..`,
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
