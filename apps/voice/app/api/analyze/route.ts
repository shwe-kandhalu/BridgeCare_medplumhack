import { NextResponse } from 'next/server';
import { AnalyzeRequestSchema, TriageOutcomeSchema } from '@bridgecare/shared';
import { callAnalysisService } from '../../../lib/analysis-service';

export async function POST(request: Request) {
  try {
    const payload = AnalyzeRequestSchema.parse(await request.json());
    const response = await callAnalysisService('/api/analyze', payload);
    const body = await response.json().catch(() => ({ error: 'Analysis service returned an invalid response.' }));

    if (!response.ok) {
      return NextResponse.json({ error: body.error ?? 'Analysis service could not complete the triage.' }, { status: response.status });
    }

    return NextResponse.json(TriageOutcomeSchema.parse(body));
  } catch (error) {
    console.error('Analysis service request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Analysis service is unavailable. No triage, coverage, or booking data was generated.' }, { status: 503 });
  }
}
