import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DeepgramClient } from '@deepgram/sdk';
const Input = z.object({ text: z.string().min(1).max(3_000) }).strict();
export async function POST(request: Request) { try { const { text } = Input.parse(await request.json()); if (!process.env.DEEPGRAM_API_KEY) return NextResponse.json({ error: 'Voice playback is not configured.' }, { status: 503 }); const client = new DeepgramClient(); const response = await client.speak.v1.audio.generate({ text, model: 'aura-2-thalia-en', encoding: 'mp3' }); return new Response(response.stream(), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } }); } catch (error) { console.error('Deepgram speech failed:', error instanceof Error ? error.message : error); return NextResponse.json({ error: 'Voice playback failed.' }, { status: 502 }); } }
