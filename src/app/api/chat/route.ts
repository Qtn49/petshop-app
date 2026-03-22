import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseClient } from '@/lib/supabase-server';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const TITLE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOOL_CALLS = 5;

const SYSTEM_PROMPT = `You are Max, expert AI assistant for an Australian pet shop.
You have real-time access to Square POS data via tools.
Use tools proactively — never ask the user to provide data you can fetch.
If Square not connected: say so briefly, then give general advice.
Respond in markdown. Be specific with numbers. Max 3 paragraphs unless detail requested.
Context: Queensland, Australia. Pet shop with aquariums, dogs, cats, birds, reptile supplies.`;

const SQUARE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_catalog',
    description:
      'Fetch the pet shop Square product catalog. Use when user asks about products, inventory, items or stock.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max items, default 100' },
        search_term: { type: 'string', description: 'Optional product name filter' },
      },
    },
  },
  {
    name: 'get_recent_sales',
    description:
      'Fetch recent Square sales. Use when asked about revenue, performance, best sellers or trends.',
    input_schema: {
      type: 'object' as const,
      properties: { days: { type: 'number', description: 'Days back, default 30' } },
    },
  },
  {
    name: 'search_product',
    description: 'Search Square catalog by name or SKU.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'Product name or SKU' } },
      required: ['query'],
    },
  },
  {
    name: 'get_inventory_levels',
    description: 'Get current stock levels. Use when asked about restocking or inventory health.',
    input_schema: {
      type: 'object' as const,
      properties: {
        low_stock_only: { type: 'boolean', description: 'Only low/zero stock' },
      },
    },
  },
];

function sseData(payload: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${payload}\n\n`);
}

const SQUARE_BASE = 'https://connect.squareup.com';

async function executeSquareTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  accessToken: string | null,
  locationId: string | null
): Promise<string> {
  if (!accessToken) return 'Square is not connected.';

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Square-Version': '2024-01-17',
    'Content-Type': 'application/json',
  };

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 5000);

  try {
    switch (toolName) {
      case 'get_catalog': {
        const limit = Math.min((toolInput.limit as number) ?? 100, 50);
        const searchTerm = toolInput.search_term as string | undefined;

        const resp = await fetch(`${SQUARE_BASE}/v2/catalog/list?types=ITEM`, {
          headers,
          signal: abort.signal,
        });
        const data = (await resp.json()) as {
          objects?: Array<{
            id: string;
            item_data?: {
              name?: string;
              variations?: Array<{
                item_variation_data?: { sku?: string; price_money?: { amount?: number } };
              }>;
            };
          }>;
          errors?: Array<{ detail?: string }>;
        };

        if (!resp.ok)
          return `Error fetching catalog: ${data.errors?.[0]?.detail ?? resp.statusText}`;

        let items = data.objects ?? [];
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          items = items.filter((o) => o.item_data?.name?.toLowerCase().includes(term));
        }
        items = items.slice(0, limit);

        const lines = items.map((o) => {
          const name = o.item_data?.name ?? 'Unknown';
          const variation = o.item_data?.variations?.[0]?.item_variation_data;
          const sku = variation?.sku ?? 'n/a';
          const price = variation?.price_money?.amount
            ? `$${(variation.price_money.amount / 100).toFixed(2)}`
            : 'no price';
          return `- ${name}: ${price} (SKU: ${sku})`;
        });

        return `Found ${items.length} products:\n${lines.join('\n')}`;
      }

      case 'get_recent_sales': {
        const days = (toolInput.days as number) ?? 30;
        const startAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        const endAt = new Date().toISOString();

        const resp = await fetch(`${SQUARE_BASE}/v2/orders/search`, {
          method: 'POST',
          headers,
          signal: abort.signal,
          body: JSON.stringify({
            location_ids: locationId ? [locationId] : undefined,
            query: {
              filter: {
                date_time_filter: { created_at: { start_at: startAt, end_at: endAt } },
                state_filter: { states: ['COMPLETED'] },
              },
              sort: { sort_field: 'CREATED_AT', sort_order: 'DESC' },
            },
            limit: 500,
          }),
        });
        const data = (await resp.json()) as {
          orders?: Array<{
            net_amounts?: { total_money?: { amount?: number } };
            line_items?: Array<{
              name?: string;
              quantity?: string;
              base_price_money?: { amount?: number };
            }>;
          }>;
          errors?: Array<{ detail?: string }>;
        };

        if (!resp.ok)
          return `Error fetching sales: ${data.errors?.[0]?.detail ?? resp.statusText}`;

        const orders = data.orders ?? [];
        let totalRevenueCents = 0;
        const productMap = new Map<string, { quantity: number; revenue: number }>();

        for (const order of orders) {
          totalRevenueCents += order.net_amounts?.total_money?.amount ?? 0;
          for (const item of order.line_items ?? []) {
            const name = item.name ?? 'Unknown';
            const qty = parseFloat(item.quantity ?? '0');
            const rev = (item.base_price_money?.amount ?? 0) * qty;
            const existing = productMap.get(name) ?? { quantity: 0, revenue: 0 };
            productMap.set(name, { quantity: existing.quantity + qty, revenue: existing.revenue + rev });
          }
        }

        const top10 = Array.from(productMap.entries())
          .sort((a, b) => b[1].quantity - a[1].quantity)
          .slice(0, 10)
          .map(([name, d], i) => `  ${i + 1}. ${name}: ${d.quantity} sold`)
          .join('\n');

        return `Sales summary (last ${days} days):\n- Total revenue: $${(totalRevenueCents / 100).toFixed(2)}\n- Orders: ${orders.length}\n- Top products by quantity:\n${top10}`;
      }

      case 'search_product': {
        const query = toolInput.query as string;

        const resp = await fetch(`${SQUARE_BASE}/v2/catalog/search`, {
          method: 'POST',
          headers,
          signal: abort.signal,
          body: JSON.stringify({
            object_types: ['ITEM'],
            text_query: { keywords: [query] },
            limit: 5,
          }),
        });
        const data = (await resp.json()) as {
          objects?: Array<{
            item_data?: {
              name?: string;
              variations?: Array<{
                item_variation_data?: { sku?: string; price_money?: { amount?: number } };
              }>;
            };
          }>;
          errors?: Array<{ detail?: string }>;
        };

        if (!resp.ok)
          return `Error searching products: ${data.errors?.[0]?.detail ?? resp.statusText}`;

        const objects = data.objects ?? [];
        if (objects.length === 0) return `No products found for "${query}".`;

        const lines = objects.map((o) => {
          const name = o.item_data?.name ?? 'Unknown';
          const variation = o.item_data?.variations?.[0]?.item_variation_data;
          const sku = variation?.sku ?? 'n/a';
          const price = variation?.price_money?.amount
            ? `$${(variation.price_money.amount / 100).toFixed(2)}`
            : 'no price';
          return `- ${name}: ${price} (SKU: ${sku})`;
        });

        return `Found ${objects.length} products matching "${query}":\n${lines.join('\n')}`;
      }

      case 'get_inventory_levels': {
        const lowStockOnly = toolInput.low_stock_only as boolean | undefined;
        const url = locationId
          ? `${SQUARE_BASE}/v2/inventory/counts?location_ids=${locationId}`
          : `${SQUARE_BASE}/v2/inventory/counts`;

        const resp = await fetch(url, { headers, signal: abort.signal });
        const data = (await resp.json()) as {
          counts?: Array<{ catalog_object_id?: string; quantity?: string; state?: string }>;
          errors?: Array<{ detail?: string }>;
        };

        if (!resp.ok)
          return `Error fetching inventory: ${data.errors?.[0]?.detail ?? resp.statusText}`;

        let counts = (data.counts ?? []).filter((c) => c.state === 'IN_STOCK');
        if (lowStockOnly) {
          counts = counts.filter((c) => parseFloat(c.quantity ?? '0') <= 5);
        }

        if (counts.length === 0)
          return lowStockOnly ? 'No low stock items found.' : 'No inventory data available.';

        const lines = counts.slice(0, 50).map((c) => {
          const qty = parseFloat(c.quantity ?? '0');
          const label = qty === 0 ? 'OUT OF STOCK' : qty <= 5 ? 'LOW' : 'OK';
          return `- Item ${c.catalog_object_id}: ${qty} units [${label}]`;
        });

        return `Inventory levels (${lowStockOnly ? 'low stock only' : 'all items'}):\n${lines.join('\n')}`;
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return err instanceof Error ? err.message : 'Tool execution error';
  } finally {
    clearTimeout(timer);
  }
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

  // Step 1 — Fetch Square credentials
  const { data: squareConn } = await supabase
    .from('square_connections')
    .select('access_token, location_id')
    .eq('user_id', userId)
    .single();
  const accessToken = squareConn?.access_token ?? null;
  const locationId = squareConn?.location_id ?? null;

  const conversationMessages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  conversationMessages.push({ role: 'user' as const, content: message });

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
      const sendSSEEvent = (payload: string) => {
        controller.enqueue(sseData(payload));
      };

      let fullText = '';
      try {
        const client = new Anthropic({ apiKey });

        // Title generation on first message
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

        // Step 2 — Agentic loop
        const loopMessages: Anthropic.MessageParam[] = [...conversationMessages];
        let toolCallCount = 0;

        while (toolCallCount < MAX_TOOL_CALLS) {
          const response = await client.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 1500,
            system: SYSTEM_PROMPT,
            tools: SQUARE_TOOLS,
            messages: loopMessages,
          });

          if (response.stop_reason === 'end_turn') {
            fullText = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('');
            sendSSEEvent(JSON.stringify(fullText));
            break;
          }

          if (response.stop_reason === 'tool_use') {
            loopMessages.push({
              role: 'assistant' as const,
              content: response.content as unknown as Anthropic.ContentBlockParam[],
            });

            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
              if (block.type !== 'tool_use') continue;
              toolCallCount++;

              const statusMessages: Record<string, string> = {
                get_catalog: '🔍 Browsing your Square catalog...',
                get_recent_sales: '📊 Fetching your sales data...',
                search_product: '🔎 Searching for that product...',
                get_inventory_levels: '📦 Checking stock levels...',
              };
              sendSSEEvent(`__STATUS__:${statusMessages[block.name] ?? '⏳ Fetching data...'}`);

              const result = await executeSquareTool(
                block.name,
                block.input as Record<string, unknown>,
                accessToken,
                locationId
              );
              sendSSEEvent('__STATUS__:✅ Done');

              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: result,
              });
            }

            loopMessages.push({ role: 'user' as const, content: toolResults });
          } else {
            break;
          }
        }

        // Save assistant response
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
        sendSSEEvent(JSON.stringify({ error: msg }));
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
