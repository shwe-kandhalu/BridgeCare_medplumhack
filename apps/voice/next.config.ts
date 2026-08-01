import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
const nextConfig: NextConfig = { transpilePackages: ['@bridgecare/shared'] };
export default withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', register: true, cacheOnNavigation: true })(nextConfig);
