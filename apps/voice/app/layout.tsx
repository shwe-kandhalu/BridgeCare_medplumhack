import type { Metadata, Viewport } from 'next';
import './styles.css';
export const metadata: Metadata = { title: 'BridgeCare', description: 'Synthetic autoimmune triage prototype', applicationName: 'BridgeCare', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'BridgeCare' } };
export const viewport: Viewport = { themeColor: '#176b3a' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
