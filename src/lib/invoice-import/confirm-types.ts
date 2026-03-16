/** Item payload passed from Step 2 to Step 3 and edited in Step 3 */
export type ConfirmItem = {
  product_name: string;
  quantity: number;
  /** Purchase / cost price */
  purchase_price: number | null;
  /** Retail / sale price */
  retail_price: number | null;
  category: string;
  sku: string;
  description?: string;
  vendor: string;
  vendor_code: string;
  /** Data URL or Square image id after upload; first of images for multi-upload */
  image: string | null;
  /** Additional image URLs (multi-upload) */
  images?: string[];
  initial_stock: number;
  status: 'matched' | 'unmatched';
  catalogItemId?: string;
  catalogVariationId?: string;
  catalogName?: string;
  /** Include this item in the purchase order (default true). Only selected items are sent to the PO API. */
  includedInPO?: boolean;
  /** Invoice item id (invoice_items.id) for marking in_purchase_order when PO is created. */
  invoice_item_id?: string;
  /** Custom attribute keys from Square (e.g. item options, custom attribute definitions) */
  customAttributes?: Record<string, string>;
};

export const REQUIRED_FIELDS = [
  'product_name',
  'purchase_price',
  'retail_price',
  'category',
  'sku',
  'vendor',
  'vendor_code',
  'image',
  'initial_stock',
] as const;

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export function isRequiredField(key: string): key is RequiredField {
  return (REQUIRED_FIELDS as readonly string[]).includes(key);
}

/** Returns which required fields are missing. All fields in REQUIRED_FIELDS are always required. */
export function getMissingFields(item: ConfirmItem): RequiredField[] {
  const missing: RequiredField[] = [];
  if (!item.product_name?.trim()) missing.push('product_name');
  if (item.purchase_price == null || Number.isNaN(item.purchase_price) || item.purchase_price < 0) missing.push('purchase_price');
  if (!item.sku?.trim()) missing.push('sku');
  if (item.retail_price == null || Number.isNaN(item.retail_price) || item.retail_price < 0) missing.push('retail_price');
  if (!item.category?.trim()) missing.push('category');
  if (!item.vendor?.trim()) missing.push('vendor');
  if (!item.vendor_code?.trim()) missing.push('vendor_code');
  if (item.initial_stock == null || Number.isNaN(item.initial_stock) || item.initial_stock < 0) missing.push('initial_stock');
  if (item.status === 'unmatched') {
    const hasImage = item.image?.trim() || (item.images?.length ?? 0) > 0;
    if (!hasImage) missing.push('image');
  }
  return missing;
}
