'use client';
import { useEffect, useRef, useState } from 'react';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'profile' | 'settings'>('profile');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return <div className="user-menu" ref={ref}>
    <button className="user-badge" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="true">
      <span className="avatar">AD</span>Apple A. Day
    </button>
    {open && <div className="user-panel">
      <div className="tabs" role="tablist" aria-label="Account sections">
        <button type="button" role="tab" aria-selected={tab === 'profile'} className={`tab${tab === 'profile' ? ' active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} className={`tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>Settings</button>
      </div>
      {tab === 'profile' && <div role="tabpanel" className="user-panel-body">
        <p><strong>Name</strong><br />Apple A. Day</p>
        <p><strong>Patient ID</strong><br />synthetic-maya-001</p>
        <p><strong>Condition</strong><br />Rheumatoid arthritis (demo)</p>
      </div>}
      {tab === 'settings' && <div role="tabpanel" className="user-panel-body">
        <label className="switch-row"><span>Voice replies (Deepgram)</span><input type="checkbox" defaultChecked /></label>
        <label className="switch-row"><span>Email reminders</span><input type="checkbox" defaultChecked /></label>
        <label className="switch-row"><span>SMS reminders</span><input type="checkbox" /></label>
      </div>}
    </div>}
  </div>;
}
