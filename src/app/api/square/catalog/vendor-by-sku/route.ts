import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';
import { getSquareEnvironment } from '@/lib/integrations/square/squareOAuth';
import { Client, Environment } from 'square';

/**
 * GET /api/square/catalog/vendor-by-sku?userId=...&sku=...
 *
 * Finds a catalog item variation with the given SKU (exact match, case-insensitive)
 * by listing ITEM_VARIATION (vendor can live on the variation, not the item).
 * Returns vendor_name and vendor_code from:
 * 1) Our item_vendors table (variation_id → vendor_name, vendor_code)
 * 2) Square ITEM_VARIATION_VENDOR_INFO (variation → vendor_id) + Vendors API for name
 * 3) Square variation-level custom attributes (vendor, vendor_name, vendor_code, supplier_code, etc.)
 *
 * Used to autofill vendor fields when user enters or selects an SKU in the PO flow.
 */
export async function GET(request: Request) {
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const skuParam = searchParams.get('sku');

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const sku = typeof skuParam === 'string' ? skuParam.trim() : '';
  if (!sku) {
    return NextResponse.json(
      { vendorName: null, vendorCode: null, message: 'SKU is empty' },
      { status: 200 }
    );
  }

  const skuLower = sku.toLowerCase();

  const { data: conn } = await supabase
    .from('square_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json(
      { error: 'Square not connected' },
      { status: 401 }
    );
  }

  const squareEnv = getSquareEnvironment();
  const env = squareEnv === 'production' ? Environment.Production : Environment.Sandbox;
  const client = new Client({
    accessToken: conn.access_token,
    environment: env,
  });

  type CatalogObjLike = {
    id?: string;
    customAttributeValues?: Record<string, { stringValue?: string; numberValue?: string; number_value?: string; string_value?: string; key?: string }>;
    custom_attribute_values?: Record<string, { stringValue?: string; numberValue?: string; number_value?: string; string_value?: string; key?: string }>;
    itemVariationData?: { sku?: string; itemId?: string };
    item_data?: { sku?: string };
    item_variation_data?: { sku?: string; item_id?: string };
  };

  /** Extract string value from a custom attribute value (camelCase or snake_case). */
  const attrStr = (v: { stringValue?: string; numberValue?: string; string_value?: string; number_value?: string } | null | undefined): string => {
    if (!v) return '';
    const s = v.stringValue ?? v.string_value ?? (v.numberValue != null || v.number_value != null ? String(v.numberValue ?? v.number_value) : '');
    return (s ?? '').trim();
  };

  /** Get attribute key for matching (map key or value.key), normalized. */
  const normKey = (mapKey: string, valueKey?: string | null): string => {
    const raw = (valueKey ?? mapKey).toLowerCase().replace(/[- ]/g, '_');
    return raw.includes(':') ? raw.split(':').pop()! : raw;
  };

  /** Get first custom attribute value whose key normalizes to one of the given keys. */
  const getCustomAny = (obj: CatalogObjLike, keys: string[]): string => {
    const vals = obj.customAttributeValues ?? obj.custom_attribute_values;
    if (!vals) return '';
    for (const [mapK, v] of Object.entries(vals)) {
      const normalized = normKey(mapK, (v as { key?: string })?.key);
      if (keys.some((key) => normalized === key)) {
        return attrStr(v);
      }
    }
    return '';
  };
  const vendorNameKeys = ['vendor', 'vendors', 'vendor_name', 'supplier', 'supplier_name'];
  const vendorCodeKeys = ['vendor_code', 'supplier_code'];
  /** Fallback: any attribute whose key contains "vendor" or "supplier" (for name). */
  const getCustomVendorNameFallback = (obj: CatalogObjLike): string => {
    const vals = obj.customAttributeValues ?? obj.custom_attribute_values;
    if (!vals) return '';
    for (const [mapK, v] of Object.entries(vals)) {
      const n = normKey(mapK, (v as { key?: string })?.key);
      if (n.includes('vendor') || n.includes('supplier')) {
        const trimmed = attrStr(v);
        if (trimmed && !/^\d+$/.test(trimmed)) return trimmed;
      }
    }
    return '';
  };

  /** Last resort: first custom attribute with a string value that looks like a name (e.g. "Eastern Distributors"). */
  const getFirstNameLikeAttr = (obj: CatalogObjLike): string => {
    const vals = obj.customAttributeValues ?? obj.custom_attribute_values;
    if (!vals) return '';
    for (const [, v] of Object.entries(vals)) {
      const s = attrStr(v);
      if (s.length > 2 && !/^\d+$/.test(s) && /[a-zA-Z]/.test(s)) return s;
    }
    return '';
  };

  /** Read vendor from a catalog object (variation or item). Uses customAttributeValues. */
  const getVendorFromObj = (obj: CatalogObjLike): { vendorName: string; vendorCode: string } => {
    let vendorName = getCustomAny(obj, vendorNameKeys);
    if (!vendorName) vendorName = getCustomVendorNameFallback(obj);
    if (!vendorName) vendorName = getFirstNameLikeAttr(obj);
    const vendorCode = getCustomAny(obj, vendorCodeKeys);
    return { vendorName, vendorCode };
  };

  try {
    let cursor: string | undefined;
    let variationId: string | undefined;
    let variationItemId: string | undefined;

    do {
      const { result } = await client.catalogApi.listCatalog(cursor, 'ITEM_VARIATION');
      const objects = (result.objects ?? []) as CatalogObjLike[];

      for (const obj of objects) {
        const vdata = obj.itemVariationData ?? obj.item_variation_data;
        const variationSku = (vdata?.sku ?? '').trim().toLowerCase();
        if (variationSku !== skuLower) continue;
        variationId = obj.id;
        // `itemVariationData` can be snake_case or camelCase depending on SDK response mapping.
        variationItemId = (vdata as any)?.itemId ?? (vdata as any)?.item_id;
        break;
      }
      if (variationId) break;
      cursor = result.cursor ?? undefined;
    } while (cursor);

    if (!variationId) {
      return NextResponse.json({
        vendorName: null,
        vendorCode: null,
        message: 'No catalog variation found for this SKU',
      });
    }

    // Prefer our stored mapping (item_vendors) for vendor info
    const { data: row } = await supabase
      .from('item_vendors')
      .select('vendor_name, vendor_code')
      .eq('variation_id', variationId)
      .maybeSingle();

    if (row?.vendor_name != null || row?.vendor_code != null) {
      return NextResponse.json({
        vendorName: row.vendor_name ?? '',
        vendorCode: row.vendor_code ?? '',
        source: 'item_vendors',
      });
    }

    // Try ITEM_VARIATION_VENDOR_INFO (variation linked to Square vendor) + Vendors API
    try {
      let viCursor: string | undefined;
      do {
        const { result: viResult } = await client.catalogApi.listCatalog(
          viCursor,
          'ITEM_VARIATION_VENDOR_INFO'
        );
        const viObjects = (viResult.objects ?? []) as Array<{
          id?: string;
          itemVariationVendorInfoData?: { itemVariationId?: string; vendorId?: string; sku?: string };
          item_variation_vendor_info_data?: { item_variation_id?: string; vendor_id?: string; sku?: string };
        }>;
        for (const vi of viObjects) {
          const data = vi.itemVariationVendorInfoData ?? vi.item_variation_vendor_info_data;
          const itemVarId = (data as any)?.itemVariationId ?? (data as any)?.item_variation_id;
          if (itemVarId !== variationId) continue;
          const vendorId = ((data as any)?.vendorId ?? (data as any)?.vendor_id ?? '').trim();
          const vendorCodeFromVi = ((data as any)?.sku ?? (data as any)?.SKU ?? '').trim();
          if (vendorId) {
            const { result: vResult } = await client.vendorsApi.retrieveVendor(vendorId);
            const name = (vResult.vendor?.name ?? '').trim();
            return NextResponse.json({
              vendorName: name,
              vendorCode: vendorCodeFromVi,
              source: 'item_variation_vendor_info',
            });
          }
        }
        viCursor = viResult.cursor ?? undefined;
      } while (viCursor);
    } catch {
      // List or retrieve may fail; continue to custom attrs
    }

    // Retrieve full variation object (list may omit custom_attribute_values)
    let variationObj: CatalogObjLike | null = null;
    try {
      const { result: retrieveResult } = await client.catalogApi.retrieveCatalogObject(variationId, false);
      variationObj = retrieveResult.object as CatalogObjLike | undefined ?? null;
    } catch {
      // ignore
    }

    if (variationObj) {
      const fromVariation = getVendorFromObj(variationObj);
      if (fromVariation.vendorName || fromVariation.vendorCode) {
        return NextResponse.json({
          vendorName: fromVariation.vendorName,
          vendorCode: fromVariation.vendorCode,
          source: 'catalog_attributes',
        });
      }
    }

    // Fallback: parent ITEM custom attributes (vendor may be on item, not variation)
    if (variationItemId) {
      try {
        const { result: itemResult } = await client.catalogApi.retrieveCatalogObject(variationItemId, false);
        const itemObj = itemResult.object as CatalogObjLike | undefined;
        if (itemObj) {
          const fromItem = getVendorFromObj(itemObj);
          if (fromItem.vendorName || fromItem.vendorCode) {
            return NextResponse.json({
              vendorName: fromItem.vendorName,
              vendorCode: fromItem.vendorCode,
              source: 'catalog_attributes_item',
            });
          }
        }
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      vendorName: '',
      vendorCode: '',
      source: 'catalog_attributes',
      message: 'No vendor found on variation or parent item',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Vendor lookup failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
