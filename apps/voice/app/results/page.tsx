'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppointmentResultSchema, TriageOutcomeSchema, type AppointmentResult, type TriageOutcome } from '@bridgecare/shared';
import NavTabs from '../nav-tabs';

const PATIENT_ID = 'synthetic-maya-001';
const OUTCOME_KEY = 'attune:lastOutcome';
const BOOKING_KEY = 'attune:lastBooking';

export default function Results() {
  const [outcome, setOutcome] = useState<TriageOutcome>();
  const [booking, setBooking] = useState<AppointmentResult>();
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [resultTab, setResultTab] = useState<'overview' | 'sources' | 'coverage' | 'providers'>('overview');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(OUTCOME_KEY);
      if (!raw) { setNotFound(true); return; }
      setOutcome(TriageOutcomeSchema.parse(JSON.parse(raw)));
      const rawBooking = localStorage.getItem(BOOKING_KEY);
      if (rawBooking) setBooking(AppointmentResultSchema.parse(JSON.parse(rawBooking)));
    } catch (caught) {
      console.error('Could not load saved results:', caught);
      setNotFound(true);
    }
  }, []);

  async function speak(text: string): Promise<void> {
    try {
      const response = await fetch('/api/voice/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!response.ok) return;
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (caught) { console.error('Voice playback failed:', caught); }
  }

  async function confirm(slotId: string): Promise<void> {
    if (!outcome || busy) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientId: PATIENT_ID, slotId, specialty: outcome.triage.recommendedSpecialty, reason: outcome.triage.rationale }) });
      if (!response.ok) throw new Error(`Booking service returned ${response.status}.`);
      const parsed = AppointmentResultSchema.parse(await response.json());
      localStorage.setItem(BOOKING_KEY, JSON.stringify(parsed));
      setBooking(parsed);
    } catch (caught) {
      console.error('Booking seam unavailable:', caught);
      setError('We could not complete the booking. Please contact your provider’s office to schedule.');
    } finally { setBusy(false); }
  }

  if (notFound) {
    return <main>
      <header><Link className="back-link" href="/">← Attune</Link><NavTabs /><h1>No results yet</h1></header>
      <p className="disclaimer">Start a check-in to get a result here.</p>
      <Link className="cta" href="/check">Start check-in</Link>
    </main>;
  }
  if (!outcome) return null;

  return <main>
    <header><Link className="back-link" href="/">← Attune</Link><NavTabs /><h1>Your result</h1></header>
    <section className="outcome" aria-live="polite">
      <p className="disclaimer">{outcome.triage.disclaimer}</p>
      <button className="read" type="button" onClick={() => void speak(`${outcome.triage.disclaimer} ${outcome.triage.recommendedNextStep}`)}>Read this aloud</button>
      <h2>{outcome.triage.acuity.replaceAll('_', ' ')}</h2>
      <div className="tabs" role="tablist" aria-label="Result sections">
        {(['overview', 'sources', 'coverage', 'providers'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={resultTab === tab} className={`tab${resultTab === tab ? ' active' : ''}`} onClick={() => setResultTab(tab)}>{tab === 'providers' ? 'Providers' : tab[0].toUpperCase() + tab.slice(1)}</button>)}
      </div>
      {resultTab === 'overview' && <div role="tabpanel"><p><strong>Next step:</strong> {outcome.triage.recommendedNextStep}</p><p>{outcome.triage.rationale}</p></div>}
      {resultTab === 'sources' && <div role="tabpanel"><ul>{outcome.triage.citations.map((citation) => <li key={citation.source}>{citation.source}: {citation.snippet}</li>)}</ul></div>}
      {resultTab === 'coverage' && <div role="tabpanel"><p>{outcome.insurance.payer} · {outcome.insurance.planName} · {outcome.insurance.copays.map((copay) => `${copay.serviceType}: ${copay.inNetwork ?? 'not listed'}`).join(', ')}</p></div>}
      {resultTab === 'providers' && <div role="tabpanel">
        {outcome.providers.length > 0 ? <ul>{outcome.providers.map((provider) => <li key={provider.name}>{provider.name} — {provider.specialty}, {provider.distanceMiles} mi</li>)}</ul> : <p className="muted">No in-network providers to suggest yet.</p>}
        {outcome.appointmentOptions.length > 0 && <><h3>Appointment options</h3>{outcome.appointmentOptions.map((slot) => <button className="slot" key={slot.slotId} disabled={busy || Boolean(booking)} onClick={() => void confirm(slot.slotId)}>Confirm {new Date(slot.start).toLocaleString()} with {slot.practitionerDisplay}</button>)}</>}
        {booking && <p className="success">Booked (mock): {new Date(booking.start).toLocaleString()} with {booking.practitionerDisplay}.</p>}
      </div>}
    </section>
    {error && <p className="error" role="alert">{error}</p>}
  </main>;
}
