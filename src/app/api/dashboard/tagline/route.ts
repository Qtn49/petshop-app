import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

export async function POST(_request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured', tagline: 'Where every pet leaves happier.' },
      { status: 200 }
    );
  }

  const client = new Anthropic({ apiKey });
  const prompt = 'One funny pet shop tagline, max 8 words, no quotes, return only the tagline';

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0];
    const tagline =
      text.type === 'text'
        ? text.text.trim().replace(/^["']|["']$/g, '').slice(0, 200)
        : 'Paws, play, and repeat.';
    return NextResponse.json({ tagline: tagline || 'Paws, play, and repeat.' });
  } catch (e) {
    console.error('tagline', e);
    return NextResponse.json(
      { tagline: 'Where tails wag and customers brag.', error: 'fallback' },
      { status: 200 }
    );
  }
}
