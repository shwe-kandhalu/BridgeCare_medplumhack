import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return { name: 'BridgeCare', short_name: 'BridgeCare', description: 'Synthetic autoimmune triage prototype', start_url: '/', display: 'standalone', background_color: '#f5faf5', theme_color: '#176b3a', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }] }; }
