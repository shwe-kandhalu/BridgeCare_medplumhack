import type { Metadata, Viewport } from 'next';
import './styles.css';
import UserMenu from './user-menu';
export const metadata: Metadata = { title: 'Attune', description: 'Agentic autoimmune care, on demand — empowering you to manage your condition and your life.', applicationName: 'Attune', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Attune' } };
export const viewport: Viewport = { themeColor: '#3f7d8c' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <UserMenu />
    {children}
  </body></html>;
}
