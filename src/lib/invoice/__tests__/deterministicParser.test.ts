/**
 * Unit tests for generic deterministic invoice parser.
 */

import { describe, it, expect } from 'vitest';
import {
  deterministicParse,
  preprocessInvoiceText,
  groupItemBlocks,
  parseItemBlock,
  isLikelyItemStart,
  findLikelyBarcode,
} from '../deterministicParser';

describe('preprocessInvoiceText', () => {
  it('splits into lines and trims', () => {
    const lines = preprocessInvoiceText('line1\n  line2  \n\nline3');
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });

  it('normalizes repeated spaces', () => {
    const lines = preprocessInvoiceText('a  b   c');
    expect(lines).toEqual(['a b c']);
  });
});

describe('isLikelyItemStart', () => {
  it('detects numeric code + text', () => {
    expect(isLikelyItemStart('10321Scraper 4 In 1')).toBe(true);
    expect(isLikelyItemStart('57403Cat Toy')).toBe(true);
  });

  it('detects alphanumeric code + text', () => {
    expect(isLikelyItemStart('DC24Cage Cover')).toBe(true);
    expect(isLikelyItemStart('KIT2516Assorted')).toBe(true);
  });

  it('rejects rep codes', () => {
    expect(isLikelyItemStart('ZP251')).toBe(false);
    expect(isLikelyItemStart('DM25')).toBe(false);
  });

  it('rejects header lines', () => {
    expect(isLikelyItemStart('Tax Invoice 918685')).toBe(false);
    expect(isLikelyItemStart('Order No.')).toBe(false);
  });
});

describe('findLikelyBarcode', () => {
  it('finds 12-14 digit barcodes', () => {
    expect(findLikelyBarcode('9325136000511')).toBe('9325136000511');
    expect(findLikelyBarcode('text 123456789012 more')).toBe('123456789012');
  });

  it('prefers longer barcodes', () => {
    expect(findLikelyBarcode('9325136000511 12345678')).toBe('9325136000511');
  });
});

describe('deterministicParse', () => {
  it('parses single-line item with numeric code', () => {
    const text = `
Tax Invoice
10321Scraper 4 In 1 24in 60cm93251360005113
2.86Each2.861031.46
`;
    const { items } = deterministicParse(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const scraper = items.find((i) => i.name.includes('Scraper'));
    expect(scraper).toBeDefined();
    expect(scraper?.price).toBe(2.86);
  });

  it('parses multiline description', () => {
    const text = `
56170
Horizon 130 Glass Starter Kit W Stand 130L
93251360824252202
273.90Each273.9010602.58
`;
    const { items } = deterministicParse(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const h = items.find((i) => i.name.includes('Horizon') || i.name.includes('Glass'));
    expect(h).toBeDefined();
  });

  it('parses alphanumeric codes', () => {
    const text = `
DC24Cage Cover Suits D24 Cages93251361914481
14.35Each14.351015.79
`;
    const { items } = deterministicParse(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    const dc = items.find((i) => i.name.includes('Cage') || i.code === '9325136191448');
    expect(dc).toBeDefined();
  });

  it('never returns Product as name', () => {
    const text = `
10321Some Product Name 9325136000511
3
2.86Each2.86
`;
    const { items } = deterministicParse(text);
    const productItems = items.filter((i) => i.name === 'Product');
    expect(productItems).toHaveLength(0);
  });

  it('returns legacy format', () => {
    const text = `10321Scraper 9325136000511 3 2.86Each2.86`;
    const { items } = deterministicParse(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const item of items) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.quantity).toBe('number');
      expect(typeof item.price).toBe('number');
    }
  });

  it('skips footer', () => {
    const text = `
10321Item One 9325136000511 2.86Each2.86
ALL GOODS SHOULD BE CHECKED UPON ARRIVAL.
Price (ex GST)
$100.00
`;
    const { items } = deterministicParse(text);
    expect(items.some((i) => i.name.toLowerCase().includes('all goods'))).toBe(false);
  });

  it('Kong regression: extracts multiple items', () => {
    const text = `
Item Barcode Qty
10321Scraper 4 In 1 24in 60cm9325136000511
ZP251
3
2.86Each2.861031.46
11754Vege Wafer Food 1kg9325136171105
ZP251
3
10.45Each10.451068.97
23210Multi Purpose Tongs9325136177381
3
9.32Each9.321020.50
ALL GOODS SHOULD BE CHECKED.
`;
    const { items } = deterministicParse(text);
    expect(items.length).toBeGreaterThanOrEqual(2);
    const scraper = items.find((i) => i.name.includes('Scraper'));
    const vege = items.find((i) => i.name.includes('Vege') || i.name.includes('Wafer'));
    const tongs = items.find((i) => i.name.includes('Tongs'));
    expect(scraper?.price).toBe(2.86);
    expect(vege?.price).toBe(10.45);
    expect(tongs?.price).toBe(9.32);
  });
});
