/**
 * AI verification: reads raw invoice text and verifies parsed items against it.
 * Non-blocking - if verification fails, parsing result is still returned.
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.1-8b-instant';

export type VerifyResult = {
  valid: boolean;
  issues: string[];
  missingItems?: string[];
  suggestedCorrections?: Array<{ index: number; field: string; suggested: string }>;
};

export async function verifyParsedItemsWithAI(
  rawText: string,
  parsedItems: Array<{ code?: string | null; name: string; quantity: number; price: number }>
): Promise<VerifyResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const itemsJson = JSON.stringify(
    parsedItems.map((i) => ({ code: i.code ?? null, name: i.name, quantity: i.quantity, price: i.price })),
    null,
    2
  );

  const prompt = `You are verifying invoice parsing results. Compare the RAW INVOICE TEXT below with the PARSED ITEMS and identify any discrepancies.

RAW INVOICE TEXT:
"""
${(rawText ?? '').slice(0, 6000)}
"""

PARSED ITEMS (from regex/deterministic parser):
${itemsJson}

Return JSON only:
{
  "valid": true/false,
  "issues": ["list of issues found"],
  "missingItems": ["product names that appear in raw text but not in parsed items"],
  "suggestedCorrections": [{"index": 0, "field": "name", "suggested": "corrected value"}]
}
If valid, issues and missingItems can be empty arrays. Be concise.`;

  try {
    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as VerifyResult;
    return {
      valid: parsed.valid ?? false,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      missingItems: Array.isArray(parsed.missingItems) ? parsed.missingItems : undefined,
      suggestedCorrections: Array.isArray(parsed.suggestedCorrections) ? parsed.suggestedCorrections : undefined,
    };
  } catch {
    return null;
  }
}
