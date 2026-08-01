import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveIntakeGuidance } from '../../../lib/grounding';
const Input = z.object({ query: z.string().min(1).max(10_000) }).strict();
export async function POST(request: Request) { try { const { query } = Input.parse(await request.json()); return NextResponse.json(await retrieveIntakeGuidance(query)); } catch (error) { console.error('Moss intake guidance retrieval failed:', error instanceof Error ? error.message : error); return NextResponse.json({ error: 'Intake guidance is unavailable.' }, { status: 503 }); } }
