'use client';
import { useRef, useState } from 'react';
import { AnalyzeRequestSchema, AppointmentResultSchema, GroundingSchema, IntakeGuidanceSchema, TriageOutcomeSchema, type AppointmentResult, type IntakeGuidance, type TriageOutcome } from '@bridgecare/shared';
import { createIntake, DISCLAIMER, extractStructuredSymptoms, processPatientTurn, type TurnResult } from '../../lib/intake';

const PATIENT_ID = '154e90b3-3562-4b02-8e46-4e62df95ed8e';
const EMPTY_GROUNDING = GroundingSchema.parse({ citations: [], candidateMappings: [] });
const EMPTY_GUIDANCE = IntakeGuidanceSchema.parse({ matches: [] });

async function retrieveIntakeGuidance(query: string): Promise<IntakeGuidance> {
  try {
    const response = await fetch('/api/intake-guidance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    if (!response.ok) return EMPTY_GUIDANCE;
    return IntakeGuidanceSchema.parse(await response.json());
  } catch (caught) { console.error('Intake guidance unavailable; ending intake conservatively:', caught); return EMPTY_GUIDANCE; }
}

export default function CheckIn() {
  const [intake, setIntake] = useState(() => createIntake(PATIENT_ID));
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<TriageOutcome>();
  const [booking, setBooking] = useState<AppointmentResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function analyze(result: TurnResult): Promise<void> {
    let grounding = EMPTY_GROUNDING;
    try {
      const groundingResponse = await fetch('/api/grounding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: result.state.turns.filter((turn) => turn.role === 'patient').map((turn) => turn.text).join(' ') }) });
      if (groundingResponse.ok) grounding = GroundingSchema.parse(await groundingResponse.json());
    } catch (caught) { console.error('Grounding unavailable; conservative default will apply:', caught); }
    const payload = AnalyzeRequestSchema.parse({ patientId: PATIENT_ID, structuredSymptoms: extractStructuredSymptoms(result.state), grounding, transcript: result.state.turns, redFlagSignals: result.redFlags });
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Analyze service returned ${response.status}.`);
      setOutcome(TriageOutcomeSchema.parse(await response.json()));
    } catch (caught) {
      console.error('Analyze seam unavailable:', caught);
      setError('We could not reach the triage service. Please contact your provider for guidance. If this may be an emergency, call 911 or go to the nearest ER.');
    }
  }

  async function startRecording(): Promise<void> {
    setError(undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunks.current = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => { stream.getTracks().forEach((track) => track.stop()); void transcribe(); };
      recorder.current = mediaRecorder; mediaRecorder.start(); setRecording(true);
    } catch (caught) { console.error('Microphone permission denied or unavailable:', caught); setError('Microphone access is unavailable. You can continue using the text box below.'); }
  }
  function stopRecording(): void { recorder.current?.stop(); setRecording(false); }
  async function transcribe(): Promise<void> {
    try { setBusy(true); const audio = new Blob(chunks.current, { type: recorder.current?.mimeType || 'audio/webm' }); const form = new FormData(); form.append('audio', audio, 'message.webm'); const response = await fetch('/api/voice/transcribe', { method: 'POST', body: form }); if (!response.ok) throw new Error(`Transcription service returned ${response.status}.`); const data = await response.json() as { transcript: string }; setMessage(data.transcript); } catch (caught) { console.error('Voice transcription failed:', caught); setError('We could not transcribe that recording. Please use the text box.'); } finally { setBusy(false); } }
  async function speak(text: string): Promise<void> { try { const response = await fetch('/api/voice/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) }); if (!response.ok) return; const url = URL.createObjectURL(await response.blob()); const audio = new Audio(url); audio.onended = () => URL.revokeObjectURL(url); await audio.play(); } catch (caught) { console.error('Voice playback failed:', caught); } }

  async function send(): Promise<void> {
    if (!message.trim() || busy || outcome) return;
    setBusy(true); setError(undefined);
    try {
      const result = await processPatientTurn(intake, message, retrieveIntakeGuidance);
      setIntake(result.state); setMessage('');
      const lastTurn = result.state.turns[result.state.turns.length - 1];
      if (lastTurn?.role === 'agent') void speak(lastTurn.text);
      if (result.decision.done) await analyze(result);
    } catch (caught) {
      console.error('Intake processing failed:', caught);
      setError('We could not process that message. Please try again or contact your provider.');
    } finally { setBusy(false); }
  }

  async function confirm(slotId: string): Promise<void> {
    if (!outcome || busy) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patientId: PATIENT_ID, slotId, specialty: outcome.triage.recommendedSpecialty, reason: outcome.triage.rationale }) });
      if (!response.ok) throw new Error(`Booking service returned ${response.status}.`);
      setBooking(AppointmentResultSchema.parse(await response.json()));
    } catch (caught) {
      console.error('Booking seam unavailable:', caught);
      setError('We could not complete the booking. Please contact your provider’s office to schedule.');
    } finally { setBusy(false); }
  }

  return <main>
    <header><p className="eyebrow">Attune · synthetic demo</p><h1>Check your next step</h1><p className="disclaimer">{DISCLAIMER}</p></header>
    <section className="chat" aria-label="Triage conversation">
      {intake.turns.length === 0 && <p className="agent">Tell us what is going on. I’ll ask up to six focused questions.</p>}
      {intake.turns.map((turn, index) => <p className={turn.role} key={`${turn.role}-${index}`}>{turn.text}</p>)}
    </section>
    {!outcome && <section className="voice-hero">
      <button className={`mic${recording ? ' recording' : ''}`} type="button" onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy} aria-pressed={recording} aria-label={recording ? 'Stop recording and transcribe' : 'Start a voice conversation'} />
      <p className="mic-status">{recording ? 'Listening… tap to stop' : busy ? 'Working…' : 'Tap to speak'}</p>
    </section>}
    {!outcome && <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label htmlFor="message">Or type your message</label>
      <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="For example: My wrists have been more painful since yesterday." disabled={busy} />
      <button type="submit" disabled={busy || !message.trim()}>{busy ? 'Checking…' : 'Send message'}</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}
    {outcome && <section className="outcome" aria-live="polite">
      <p className="disclaimer">{outcome.triage.disclaimer}</p><button className="read" type="button" onClick={() => void speak(`${outcome.triage.disclaimer} ${outcome.triage.recommendedNextStep}`)}>Read this aloud</button><h2>{outcome.triage.acuity.replaceAll('_', ' ')}</h2>
      <p><strong>Next step:</strong> {outcome.triage.recommendedNextStep}</p><p>{outcome.triage.rationale}</p>
      <h3>Sources</h3><ul>{outcome.triage.citations.map((citation) => <li key={citation.source}>{citation.source}: {citation.snippet}</li>)}</ul>
      <h3>Coverage (mock)</h3><p>{outcome.insurance.payer} · {outcome.insurance.planName} · {outcome.insurance.copays.map((copay) => `${copay.serviceType}: ${copay.inNetwork ?? 'not listed'}`).join(', ')}</p>
      {outcome.providers.length > 0 && <><h3>In-network suggestions (mock)</h3><ul>{outcome.providers.map((provider) => <li key={provider.name}>{provider.name} — {provider.specialty}, {provider.distanceMiles} mi</li>)}</ul></>}
      {outcome.appointmentOptions.length > 0 && <><h3>Appointment options</h3>{outcome.appointmentOptions.map((slot) => <button className="slot" key={slot.slotId} disabled={busy || Boolean(booking)} onClick={() => void confirm(slot.slotId)}>Confirm {new Date(slot.start).toLocaleString()} with {slot.practitionerDisplay}</button>)}</>}
      {booking && <p className="success">Booked (mock): {new Date(booking.start).toLocaleString()} with {booking.practitionerDisplay}.</p>}
    </section>}
  </main>;
}
