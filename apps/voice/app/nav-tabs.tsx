'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/check', label: 'Check-in' },
  { href: '/results', label: 'Results' }
] as const;

export default function NavTabs() {
  const pathname = usePathname();
  return <div className="tabs top-tabs" role="tablist" aria-label="Attune sections">
    {TABS.map((tab) => <Link key={tab.href} href={tab.href} role="tab" aria-selected={pathname === tab.href} className={`tab${pathname === tab.href ? ' active' : ''}`}>{tab.label}</Link>)}
  </div>;
}
