/**
 * Psychological pricing: round down to price points that consumers perceive as cheaper
 * (left-digit bias). Used when settings.pricing.psychologicalPricing is enabled.
 *
 * Rules (retail research):
 * - Prices end in .99 or .95 (perceived as cheaper than the next dollar).
 * - Always round DOWN to the closest psychological price point; never round up.
 */

/**
 * Rounds a price down to the nearest psychological price point.
 * - Below $10: round down to X.99 (e.g. 4.12 → 3.99, 8.60 → 7.99).
 * - $10–$100: round down to X.99 (e.g. 17.42 → 16.99, 48.20 → 47.99).
 * - $100+: round down to X.95 (e.g. 129.40 → 128.95, 249.10 → 248.95).
 *
 * Always reduces the price, keeps two decimals, never returns a negative value.
 */
export function applyPsychologicalPricing(price: number): number {
  if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
    return 0;
  }
  const p = price;
  const floor = Math.floor(p);
  const decimal = p - floor;

  let result: number;
  if (p < 10 || (p >= 10 && p < 100)) {
    // Round down to X.99: largest X.99 <= price
    result = decimal >= 0.99 ? floor + 0.99 : floor - 0.01;
  } else {
    // p >= 100: round down to X.95
    result = decimal >= 0.95 ? floor + 0.95 : floor - 0.05;
  }

  result = Math.round(result * 100) / 100;
  return Math.max(0, result);
}

const SETTINGS_KEY = 'petshop_app_settings';

/** Read pricing.psychologicalPricing from application settings (localStorage). Default false. */
export function getPsychologicalPricingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { pricing?: { psychologicalPricing?: boolean } };
    return !!s?.pricing?.psychologicalPricing;
  } catch {
    return false;
  }
}

/** Persist pricing.psychologicalPricing in application settings (localStorage). */
export function setPsychologicalPricingEnabled(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    s.pricing = { ...((s.pricing as object) || {}), psychologicalPricing: value };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
