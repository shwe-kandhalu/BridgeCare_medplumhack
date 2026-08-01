import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@bridgecare/shared'],
  serverExternalPackages: ['@moss-dev/moss', '@moss-dev/moss-core'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};
export default withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', register: true, cacheOnNavigation: true })(nextConfig);
