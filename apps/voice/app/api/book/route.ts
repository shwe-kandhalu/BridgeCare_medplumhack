import { NextResponse } from 'next/server';
import { AppointmentRequestSchema, AppointmentResultSchema } from '@bridgecare/shared';
import { runPartBBooking } from '../../../lib/part-b';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = AppointmentRequestSchema.parse(await request.json());
    return NextResponse.json(AppointmentResultSchema.parse(await runPartBBooking(payload)));
  } catch (error) {
    console.error('Part B booking failed:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'The Medplum appointment workflow could not complete.' }, { status: 503 });
  }
}
