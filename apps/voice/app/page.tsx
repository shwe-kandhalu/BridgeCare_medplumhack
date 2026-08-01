import Link from 'next/link';

export default function Home() {
  return <main className="landing">
    <div className="brand-mark" aria-hidden="true" />
    <h1 className="wordmark">Attune</h1>
    <p className="tagline">Agentic autoimmune care, on demand — empowering you to manage your condition and your life.</p>
    <Link className="cta" href="/check">Start check-in</Link>
    <p className="landing-disclaimer">Synthetic demo, not medical advice.</p>
  </main>;
}
