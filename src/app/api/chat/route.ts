import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseClient } from '@/lib/supabase-server';
import { fetchSquareCatalogForUser } from '@/lib/integrations/square/fetchCatalog';
import { fetchSquareOrdersForUser } from '@/lib/integrations/square/fetchOrders';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const TITLE_MODEL = 'claude-haiku-4-5-20251001';

const SALES_KEYWORDS = [
  'sales',
  'revenue',
  'transactions',
  'sold',
  'selling',
  'best seller',
  'top product',
  'performance',
  'ventes',
  'chiffre',
];
const INVENTORY_KEYWORDS = [
  'stock',
  'inventory',
  'product',
  'catalogue',
  'catalog',
  'item',
  'produit',
];
const TREND_KEYWORDS = ['trend', 'slow', 'popular', 'demand', 'tendance'];

function needsSquareData(message: string): {
  catalog: boolean;
  orders: boolean;
} {
  const lower = message.toLowerCase();
  const hasSales = SALES_KEYWORDS.some((k) => lower.includes(k));
  const hasInventory = INVENTORY_KEYWORDS.some((k) => lower.includes(k));
  const hasTrend = TREND_KEYWORDS.some((k) => lower.includes(k));
  return {
    catalog: hasInventory || hasTrend,
    orders: hasSales || hasTrend,
  };
}

function sseData(payload: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${payload}\n\n`);
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { message?: string; conversationId?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message, conversationId, userId } = body;
  if (!message || typeof message !== 'string' || !userId) {
    return NextResponse.json(
      { error: 'message and userId are required' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseClient();

  let convId = conversationId;
  if (!convId) {
    const { data: newConv, error: createErr } = await supabase
      .from('chat_conversations')
      .insert({ user_id: userId, title: 'New conversation' })
      .select('id')
      .single();
    if (createErr || !newConv?.id) {
      return NextResponse.json(
        { error: createErr?.message ?? 'Failed to create conversation' },
        { status: 500 }
      );
    }
    convId = newConv.id;
  }

  const { data: conv } = await supabase
    .from('chat_conversations')
    .select('id, user_id')
    .eq('id', convId)
    .eq('user_id', userId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found or access denied' }, { status: 404 });
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  messages.push({ role: 'user' as const, content: message });

  const currentDate = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let systemPrompt = `You are Max, the AI assistant for this pet shop. You are helpful, friendly, and an expert
in pet care, inventory management, and shop operations.
You have access to the shop's data. When the user asks about inventory, sales, or Square
data, you will be told to fetch it. Otherwise answer from context.
Always respond in the same language as the user.
Current date: ${currentDate}`;

  const squareNeeds = needsSquareData(message);
  if (squareNeeds.catalog || squareNeeds.orders) {
    let squareContext = '\n\n=== SQUARE DATA (fetched live) ===\n';
    squareContext += `Date: ${currentDate}\n`;

    if (squareNeeds.orders) {
      try {
        const ordersResult = await fetchSquareOrdersForUser(userId);
        if (!('error' in ordersResult)) {
          const rev = (ordersResult.totalRevenueCents / 100).toFixed(2);
          squareContext += `Last 30 days revenue: $${rev}\n`;
          squareContext += `Orders in period: ${ordersResult.orderCount}\n`;
          if (ordersResult.topByQuantity.length > 0) {
            squareContext += `Top products by quantity sold:\n`;
            ordersResult.topByQuantity.forEach(
              (p, i) => (squareContext += `  ${i + 1}. ${p.name}: ${p.quantity} sold\n`)
            );
          }
          if (ordersResult.topByRevenue.length > 0) {
            squareContext += `Top products by revenue:\n`;
            ordersResult.topByRevenue.forEach(
              (p, i) =>
                (squareContext += `  ${i + 1}. ${p.name}: $${(p.revenueCents / 100).toFixed(2)}\n`)
            );
          }
          console.log('📊 Square data fetched:', ordersResult.orderCount, 'orders');
        } else {
          squareContext += `Orders: ${ordersResult.error}\n`;
        }
      } catch (e) {
        console.log('📊 Square orders fetch failed:', e instanceof Error ? e.message : e);
      }
    }

    if (squareNeeds.catalog) {
      try {
        const catalogResult = await fetchSquareCatalogForUser(userId);
        if ('items' in catalogResult && catalogResult.items.length > 0) {
          squareContext += `Total catalog items: ${catalogResult.items.length}\n`;
          const sample = catalogResult.items.slice(0, 100);
          squareContext += `Catalog sample (first 100):\n`;
          sample.forEach(
            (i) =>
              (squareContext += `- ${i.name ?? 'Unnamed'} (SKU: ${i.sku ?? 'n/a'}) | Category: ${i.category ?? 'n/a'} | Variants: ${i.variations?.map((v) => `${v.name ?? 'n/a'} @ $${v.price ?? 0}`).join(', ') ?? 'n/a'}\n`)
          );
        } else if ('error' in catalogResult) {
          squareContext += `Catalog: ${catalogResult.error}\n`;
        }
      } catch (e) {
        console.log('📊 Square catalog fetch failed:', e instanceof Error ? e.message : e);
      }
    }

    squareContext += '=== END SQUARE DATA ===\n';
    systemPrompt += squareContext;
  }

  const { error: userErr } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    })
    .select('id')
    .single();

  if (userErr) {
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }

  const messageHistory = history ?? [];
  const isFirstMessage = messageHistory.length === 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        const client = new Anthropic({ apiKey });

        if (isFirstMessage) {
          const titleResponse = await client.messages.create({
            model: TITLE_MODEL,
            max_tokens: 20,
            system:
              "Generate a very short conversation title (max 5 words) based on the user's message. Return ONLY the title, no quotes, no punctuation at the end.",
            messages: [{ role: 'user' as const, content: message }],
          });
          let generatedTitle = 'New conversation';
          const titleContent = titleResponse.content;
          if (Array.isArray(titleContent)) {
            const textBlock = titleContent.find((b) => b.type === 'text');
            if (textBlock && 'text' in textBlock) {
              generatedTitle =
                String((textBlock as { text?: string }).text ?? '')
                  .trim()
                  .slice(0, 60) || 'New conversation';
            }
          }
          controller.enqueue(encoder.encode(`data: __TITLE__:${generatedTitle}\n\n`));
          await supabase
            .from('chat_conversations')
            .update({ title: generatedTitle })
            .eq('id', convId);
        }

        const msgStream = client.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        msgStream.on('text', (delta: string) => {
          fullText += delta;
          controller.enqueue(sseData(JSON.stringify(delta)));
        });

        await msgStream.finalMessage();

        await supabase.from('chat_messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: fullText,
        });

        await supabase
          .from('chat_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error';
        controller.enqueue(sseData(JSON.stringify({ error: msg })));
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
