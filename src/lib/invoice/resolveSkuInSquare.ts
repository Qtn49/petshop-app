/**
 * After Claude parses invoice lines, resolve manufacturer barcode / vendor code → Square SKU.
 */

import type { Client } from 'square';
import type { CatalogObject } from 'square';
import { createSquareClient } from '@/lib/integrations/square/squareClient';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import type { SquareEnvironment } from '@/lib/integrations/square/types';
import type { ParsedItem } from './parseWithClaude';

export type MatchMethod = 'barcode' | 'vendor_code_search' | 'name_search' | 'none';

export type ResolvedParsedItem = ParsedItem & {
  resolvedSku: string | null;
  potentialNewItem: boolean;
  matchMethod: MatchMethod;
  /** Maps to invoice_items.status CHECK: pending | unmatched */
  dbStatus: 'pending' | 'unmatched';
};

function envFromConfig(): SquareEnvironment {
  return getSquareEnvironment() === 'production' ? 'production' : 'sandbox';
}

function getVariationSku(obj: CatalogObject): string | null {
  if (obj.type !== 'ITEM_VARIATION') return null;
  const raw = obj.itemVariationData ?? (obj as { item_variation_data?: { sku?: string } }).item_variation_data;
  const sku = raw?.sku?.trim();
  return sku || null;
}

/** First variation SKU from search results (prefer ITEM_VARIATION objects). */
function firstSkuFromObjects(objects: CatalogObject[] | undefined): string | null {
  if (!objects?.length) return null;
  for (const obj of objects) {
    const s = getVariationSku(obj);
    if (s) return s;
  }
  return null;
}

async function searchVendorCodeOneCall(client: Client, vendorCode: string): Promise<string | null> {
  const trimmed = vendorCode.trim();
  if (!trimmed) return null;
  const alnum = trimmed.replace(/\W/g, '');

  try {
    if (alnum.length >= 3) {
      const { result } = await client.catalogApi.searchCatalogObjects({
        objectTypes: ['ITEM_VARIATION', 'ITEM'],
        query: {
          textQuery: {
            keywords: [trimmed],
          },
        },
        limit: 50,
        includeRelatedObjects: true,
      });
      let sku = firstSkuFromObjects(result.objects);
      if (sku) return sku;
      const related = result.relatedObjects ?? [];
      sku = firstSkuFromObjects(related);
      if (sku) return sku;
      return null;
    }

    const { result } = await client.catalogApi.searchCatalogObjects({
      objectTypes: ['ITEM_VARIATION'],
      query: {
        exactQuery: {
          attributeName: 'sku',
          attributeValue: trimmed,
        },
      },
      limit: 10,
      includeRelatedObjects: true,
    });
    return firstSkuFromObjects(result.objects) ?? firstSkuFromObjects(result.relatedObjects);
  } catch (e) {
    console.warn('[resolveSkuInSquare] vendor code search failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function searchByProductNameOneCall(client: Client, productName: string): Promise<string | null> {
  const name = productName.trim();
  if (!name) return null;
  try {
    const { result } = await client.catalogApi.searchCatalogItems({
      textFilter: name.slice(0, 255),
      limit: 10,
    });
    const items = result.items ?? [];
    const matchedVariationIds = result.matchedVariationIds ?? [];
    if (items.length === 0) return null;

    for (const obj of items) {
      const sku = extractSkuFromItemObject(obj);
      if (sku) return sku;
    }

    if (matchedVariationIds.length > 0) {
      const { result: batch } = await client.catalogApi.batchRetrieveCatalogObjects({
        objectIds: matchedVariationIds.slice(0, 10),
        includeRelatedObjects: false,
      });
      return firstSkuFromObjects(batch.objects);
    }

    return null;
  } catch (e) {
    console.warn('[resolveSkuInSquare] name search failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

function extractSkuFromItemObject(obj: CatalogObject): string | null {
  if (obj.type === 'ITEM_VARIATION') return getVariationSku(obj);
  if (obj.type !== 'ITEM') return null;
  const itemData = obj.itemData ?? (obj as { item_data?: { variations?: CatalogObject[] } }).item_data;
  const variations = (itemData?.variations ?? []) as CatalogObject[];
  for (const v of variations) {
    const sku = getVariationSku(v);
    if (sku) return sku;
  }
  return null;
}

function normalizeNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve SKUs for all parsed items. Short vendor codes and product names are deduped so each
 * distinct code/name triggers at most one Square API call.
 */
export async function resolveInvoiceItemsSku(
  items: ParsedItem[],
  accessToken: string | null
): Promise<ResolvedParsedItem[]> {
  const env = envFromConfig();
  const client = accessToken ? createSquareClient(accessToken, env) : null;

  const vendorCodeCache = new Map<string, string | null>();
  const nameCache = new Map<string, string | null>();

  const resolved: ResolvedParsedItem[] = [];

  for (const item of items) {
    const code = item.code?.trim() ?? '';
    const hasCode = code.length > 0;

    if (hasCode && code.length >= 10) {
      const barcode = code;
      resolved.push({
        ...item,
        code: item.code,
        resolvedSku: barcode,
        potentialNewItem: false,
        matchMethod: 'barcode',
        dbStatus: 'pending',
      });
      continue;
    }

    if (hasCode && code.length < 10) {
      if (!client) {
        resolved.push({
          ...item,
          resolvedSku: code,
          potentialNewItem: true,
          matchMethod: 'vendor_code_search',
          dbStatus: 'unmatched',
        });
        continue;
      }
      let squareSku: string | null;
      if (!vendorCodeCache.has(code)) {
        squareSku = await searchVendorCodeOneCall(client, code);
        vendorCodeCache.set(code, squareSku);
      } else {
        squareSku = vendorCodeCache.get(code) ?? null;
      }
      if (squareSku) {
        resolved.push({
          ...item,
          resolvedSku: squareSku,
          potentialNewItem: false,
          matchMethod: 'vendor_code_search',
          dbStatus: 'pending',
        });
      } else {
        resolved.push({
          ...item,
          resolvedSku: code,
          potentialNewItem: true,
          matchMethod: 'vendor_code_search',
          dbStatus: 'unmatched',
        });
      }
      continue;
    }

    if (!hasCode) {
      if (!client) {
        resolved.push({
          ...item,
          resolvedSku: null,
          potentialNewItem: true,
          matchMethod: 'name_search',
          dbStatus: 'unmatched',
        });
        continue;
      }
      const key = normalizeNameKey(item.name);
      let squareSku: string | null;
      if (!nameCache.has(key)) {
        squareSku = await searchByProductNameOneCall(client, item.name);
        nameCache.set(key, squareSku);
      } else {
        squareSku = nameCache.get(key) ?? null;
      }
      if (squareSku) {
        resolved.push({
          ...item,
          resolvedSku: squareSku,
          potentialNewItem: false,
          matchMethod: 'name_search',
          dbStatus: 'pending',
        });
      } else {
        resolved.push({
          ...item,
          resolvedSku: null,
          potentialNewItem: true,
          matchMethod: 'name_search',
          dbStatus: 'unmatched',
        });
      }
      continue;
    }
  }

  console.log(
    '🔍 SKU resolution:',
    resolved.map((i) => `${i.name}: ${i.matchMethod} → ${i.resolvedSku ?? 'NOT FOUND'}`)
  );

  return resolved;
}

/** Single-item helper (uses full batching pipeline with one-element array). */
export async function resolveSkuInSquare(
  item: ParsedItem,
  accessToken: string | null
): Promise<ResolvedParsedItem> {
  const [out] = await resolveInvoiceItemsSku([item], accessToken);
  return out;
}
