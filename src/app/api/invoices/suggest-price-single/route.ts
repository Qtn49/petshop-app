import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(request: Request) {
  try {
    const { userId, product_name, purchase_price } = await request.json();

    if (!userId || !product_name || purchase_price == null) {
      return NextResponse.json({ error: 'userId, product_name, and purchase_price required' }, { status: 400 });
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system:
        'You are a retail pricing assistant for an Australian pet shop. Given a product name and purchase price, suggest a competitive retail price based on typical Australian pet retail margins (usually 2x-3x cost price). Return JSON only: { "suggested_price": number, "reasoning": string, "confidence": "low"|"medium"|"high" }',
      messages: [
        {
          role: 'user',
          content: `Product: ${product_name}. Purchase price: ${Number(purchase_price).toFixed(2)} AUD.`,
        },
      ],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    let result: { suggested_price?: number; reasoning?: string; confidence?: string } = {};
    try {
      // Strip markdown code fences if present
      const clean = text.replace(/^```[^\n]*\n?|```$/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json({
      suggested_price: typeof result.suggested_price === 'number' ? result.suggested_price : null,
      reasoning: result.reasoning ?? '',
      confidence: result.confidence ?? 'medium',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get price suggestion';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
