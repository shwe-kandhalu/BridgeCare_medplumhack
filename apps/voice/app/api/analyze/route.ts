import { NextResponse } from 'next/server';
import { AnalyzeRequestSchema, TriageOutcomeSchema } from '@bridgecare/shared';
import { runPartBAnalysis } from '../../../lib/part-b';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = AnalyzeRequestSchema.parse(await request.json());
    return NextResponse.json(TriageOutcomeSchema.parse(await runPartBAnalysis(payload)));
  } catch (error) {
    console.error('Part B analysis failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'The triage workflow could not complete. No coverage or booking data was generated.' }, { status: 503 });
  }
}
