import type { NextConfig } from 'next';
import { codeInspectorPlugin } from 'code-inspector-plugin';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',

  turbopack: {
    rules: codeInspectorPlugin({
      bundler: 'turbopack',
    }),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;