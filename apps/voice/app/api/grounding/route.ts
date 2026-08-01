import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveGrounding } from '../../../lib/grounding';
const Input = z.object({ query: z.string().min(1).max(10_000) }).strict();
export async function POST(request: Request) { try { const { query } = Input.parse(await request.json()); return NextResponse.json(await retrieveGrounding(query)); } catch (error) { console.error('Moss retrieval failed:', error instanceof Error ? error.message : error); return NextResponse.json({ error: 'Grounding retrieval is unavailable.' }, { status: 503 }); } }
