/**
 * Detect supplier name from raw invoice text (header lines).
 * Looks for common patterns: company name before "Tax Invoice", "Invoice", "ABN", etc.
 */
export function detectSupplierFromText(rawText: string): string | null {
  const text = (rawText ?? '').trim();
  if (!text) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const firstBlock = lines.slice(0, 15).join('\n');
  const firstLower = firstBlock.toLowerCase();

  // Match against lowercase for keywords, but capture from original to preserve case
  const idx = firstLower.search(/(?:tax\s+invoice|invoice\s+(?:no|#|number)|a\.?b\.?n\.?|date\s*:)/i);
  if (idx > 0) {
    const before = firstBlock.slice(0, idx).trim();
    const lastLine = before.split('\n').pop()?.trim();
    if (lastLine && lastLine.length >= 3 && lastLine.length <= 120 && !/^\d+$/.test(lastLine)) {
      return lastLine.replace(/\s+/g, ' ');
    }
  }

  const fromMatch = firstBlock.match(/^(?:invoice\s+from|from)\s*:?\s*([^\n]+)/im);
  if (fromMatch?.[1]) {
    const name = fromMatch[1].trim().replace(/\s+/g, ' ');
    if (name.length >= 3 && name.length <= 120 && !/^\d+$/.test(name)) return name;
  }

  // Fallback: first non-empty line that looks like a company name
  for (const line of lines.slice(0, 5)) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 4 && cleaned.length <= 100 && /[a-zA-Z]/.test(cleaned)) {
      if (!/^(invoice|date|page|order|account|contact|ref)/i.test(cleaned)) {
        return cleaned;
      }
    }
  }

  return null;
}
