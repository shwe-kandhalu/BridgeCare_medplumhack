import { NextResponse } from 'next/server';
import { AppointmentRequestSchema, AppointmentResultSchema } from '@bridgecare/shared';
export async function POST(request: Request) {
  try {
    const booking = AppointmentRequestSchema.parse(await request.json());
    return NextResponse.json(AppointmentResultSchema.parse({ appointmentId: `mock-appt-${booking.slotId}`, start: '2026-08-03T16:00:00.000Z', end: '2026-08-03T16:30:00.000Z', practitionerDisplay: 'Dr. Avery Chen (mock)', packetRef: 'mock-context-packet-phase-1' }));
  } catch (error) {
    console.error('Booking request rejected:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 });
  }
}
