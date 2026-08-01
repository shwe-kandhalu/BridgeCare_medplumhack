import { NextResponse } from 'next/server';
import { AppointmentRequestSchema, AppointmentResultSchema } from '@bridgecare/shared';
import { callAnalysisService } from '../../../lib/analysis-service';

export async function POST(request: Request) {
  try {
    const payload = AppointmentRequestSchema.parse(await request.json());
    const response = await callAnalysisService('/api/book', payload);
    const body = await response.json().catch(() => ({ error: 'Analysis service returned an invalid response.' }));

    if (!response.ok) {
      return NextResponse.json({ error: body.error ?? 'Analysis service could not complete the booking.' }, { status: response.status });
    }

    return NextResponse.json(AppointmentResultSchema.parse(body));
  } catch (error) {
    console.error('Booking service request failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Analysis service is unavailable. No appointment was booked.' }, { status: 503 });
  }
}
