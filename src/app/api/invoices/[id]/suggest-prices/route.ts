import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import Anthropic from '@anthropic-ai/sdk';

type ItemInput = {
  product_name: string;
  purchase_price: number | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // invoice id not needed beyond auth check

  const supabase = getSupabaseClient();

  let body: { userId?: string; items?: ItemInput[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, items } = body;
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 });
  }

  const { data: user } = await supabase.from('users').select('organization_id').eq('id', userId).single();
  if (!user?.organization_id) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const { data: org } = await supabase
    .from('organization')
    .select('ai_price_suggestions')
    .eq('id', user.organization_id)
    .single();

  if (!org?.ai_price_suggestions) {
    return NextResponse.json({ error: 'AI price suggestions not enabled for this organization' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });

  const client = new Anthropic({ apiKey });

  const itemList = items
    .map((i) => `- ${i.product_name}${i.purchase_price != null ? ` (our cost: $${i.purchase_price})` : ''}`)
    .join('\n');

  const prompt = `You are a pet shop pricing expert in Australia. Find the typical retail price in AUD for each of the following products. Use web search to find current market prices.

${itemList}

Return ONLY a JSON array with no markdown formatting, no code blocks, no extra text — just the raw JSON array:
[{"name": "product name", "suggested_price": 24.99, "confidence": "high|medium|low", "source": "brief source description"}]`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from the response content blocks
    let rawText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        rawText += block.text;
      }
    }

    // Strip markdown code blocks if present
    rawText = rawText.trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    // Parse JSON
    const suggestions = JSON.parse(rawText);
    if (!Array.isArray(suggestions)) throw new Error('Expected JSON array');

    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to get AI suggestions' },
      { status: 500 }
    );
  }
}
