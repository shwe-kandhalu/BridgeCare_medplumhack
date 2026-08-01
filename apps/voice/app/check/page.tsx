'use client';
import { useRef, useState } from 'react';
import { AnalyzeRequestSchema, GroundingSchema, IntakeGuidanceSchema, TriageOutcomeSchema, type IntakeGuidance } from '@bridgecare/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createIntake, DISCLAIMER, extractStructuredSymptoms, processPatientTurn, type TurnResult } from '../../lib/intake';
import NavTabs from '../nav-tabs';

const PATIENT_ID = '154e90b3-3562-4b02-8e46-4e62df95ed8e';
const EMPTY_GROUNDING = GroundingSchema.parse({ citations: [], candidateMappings: [] });
const OUTCOME_KEY = 'attune:lastOutcome';
const BOOKING_KEY = 'attune:lastBooking';
const EMPTY_GUIDANCE = IntakeGuidanceSchema.parse({ matches: [] });

async function retrieveIntakeGuidance(query: string): Promise<IntakeGuidance> {
  try {
    const response = await fetch('/api/intake-guidance', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) });
    if (!response.ok) return EMPTY_GUIDANCE;
    return IntakeGuidanceSchema.parse(await response.json());
  } catch (caught) { console.error('Intake guidance unavailable; ending intake conservatively:', caught); return EMPTY_GUIDANCE; }
}

export default function CheckIn() {
  const router = useRouter();
  const [intake, setIntake] = useState(() => createIntake(PATIENT_ID));
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
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
      const parsed = TriageOutcomeSchema.parse(await response.json());
      localStorage.setItem(OUTCOME_KEY, JSON.stringify(parsed));
      localStorage.removeItem(BOOKING_KEY);
      setDone(true);
      router.push('/results');
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
    if (!message.trim() || busy || done) return;
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

  return <main>
    <header><Link className="back-link" href="/">← Attune</Link><NavTabs /><h1>Check your next step</h1><p className="disclaimer">{DISCLAIMER}</p></header>
    <section className="chat" aria-label="Triage conversation">
      {intake.turns.length === 0 && <p className="agent">Tell us what is going on. I’ll ask up to six focused questions.</p>}
      {intake.turns.map((turn, index) => <p className={turn.role} key={`${turn.role}-${index}`}>{turn.text}</p>)}
    </section>
    {!done && <section className="voice-hero">
      <button className={`mic${recording ? ' recording' : ''}`} type="button" onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy} aria-pressed={recording} aria-label={recording ? 'Stop recording and transcribe' : 'Start a voice conversation'} />
      <p className="mic-status">{recording ? 'Listening… tap to stop' : busy ? 'Working…' : 'Tap to speak'}</p>
    </section>}
    {!done && <form onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label htmlFor="message">Or type your message</label>
      <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="For example: My wrists have been more painful since yesterday." disabled={busy} />
      <button type="submit" disabled={busy || !message.trim()}>{busy ? 'Checking…' : 'Send message'}</button>
    </form>}
    {error && <p className="error" role="alert">{error}</p>}
    {done && <section className="outcome ready">
      <p>Taking you to your results…</p>
      <Link className="cta" href="/results">Open results</Link>
    </section>}
  </main>;
}
