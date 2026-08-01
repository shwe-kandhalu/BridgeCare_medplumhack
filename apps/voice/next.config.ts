import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
const nextConfig: NextConfig = { transpilePackages: ['@bridgecare/shared'], serverExternalPackages: ['@moss-dev/moss', '@moss-dev/moss-core'] };
export default withSerwistInit({ swSrc: 'app/sw.ts', swDest: 'public/sw.js', register: true, cacheOnNavigation: true })(nextConfig);
