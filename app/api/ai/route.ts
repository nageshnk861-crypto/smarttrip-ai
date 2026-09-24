import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  try {
    const response = await OpenAI.generateResponse(prompt);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate response';
    const status = message.includes('not configured') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}