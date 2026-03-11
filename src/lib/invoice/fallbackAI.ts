import type { ParsedInvoiceItem, ParsedInvoiceResult } from './types';

type ChatMessage = { role: 'system' | 'user'; content: string };

/**
 * OpenAI-compatible chat completion request (works with OpenAI and Groq).
 */
async function chatCompletion(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  text: string
): Promise<ParsedInvoiceResult> {
  const body = {
    model,
    messages: [
      ...messages,
      {
        role: 'user' as const,
        content: text.slice(0, 8000),
      },
    ],
    response_format: { type: 'json_object' as const },
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in AI response');

  const parsed = JSON.parse(content) as { items?: unknown[]; [k: string]: unknown };
  const rawItems: unknown[] = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];

  const items: ParsedInvoiceItem[] = rawItems.map((i) => {
    const item = i as Record<string, unknown>;
    return {
      name: String(item.name ?? item.product_name ?? 'Unknown').trim() || 'Unknown',
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: Number(item.price) || 0,
    };
  });

  return { items };
}

const SYSTEM_PROMPT = `Extract product/line items from this invoice text. Return a JSON object with a single key "items" whose value is an array of objects. Each object must have: "name" (string), "quantity" (number), "price" (number). Example: {"items":[{"name":"Fish Food 5kg","quantity":2,"price":29.99}]}`;

/**
 * Fallback AI parser. Uses OpenAI or Groq based on env.
 * Set GROQ_API_KEY to use Groq, otherwise OPENAI_API_KEY for OpenAI.
 * Modular: add more providers by checking other env vars and base URLs.
 */
export async function fallbackAI(text: string): Promise<ParsedInvoiceResult> {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (groqKey) {
    return chatCompletion(
      groqKey,
      'https://api.groq.com/openai/v1',
      'llama-3.1-8b-instant',
      [{ role: 'system', content: SYSTEM_PROMPT }],
      text
    );
  }

  if (openaiKey) {
    return chatCompletion(
      openaiKey,
      'https://api.openai.com/v1',
      'gpt-4o-mini',
      [{ role: 'system', content: SYSTEM_PROMPT }],
      text
    );
  }

  throw new Error(
    'No AI provider configured. Set GROQ_API_KEY or OPENAI_API_KEY in environment.'
  );
}
