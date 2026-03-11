/**
 * Parse a formula string in % only, e.g. "100", "100,10", "35,10".
 * Meaning: (1 + first/100) * (1 + (second||10)/100).
 * So "100" → 2.2, "35" → 1.485, "100,10" → 2.2.
 */
export function formulaPercentToMultiplier(formulaPercent: string): number {
  const trimmed = (formulaPercent ?? '').trim().replace(/\s+/g, '');
  const parts = trimmed.split(/[,+]/).map((p) => parseFloat(p)).filter((n) => !Number.isNaN(n));
  if (parts.length === 0) return 1;
  const first = parts[0] / 100;
  const second = (parts[1] ?? 10) / 100;
  return (1 + first) * (1 + second);
}
