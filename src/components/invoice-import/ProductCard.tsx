'use client';

import SquareItemField, { type SquareFieldMetadata } from './SquareItemField';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';

type Props = {
  item: ConfirmItem;
  index: number;
  missingFields: Set<RequiredField>;
  onChange: (index: number, updates: Partial<ConfirmItem>) => void;
  squareCategories?: string[];
  /** True while category list is being fetched */
  categoryLoading?: boolean;
  /** True while product name autocomplete options are being fetched */
  productNameOptionsLoading?: boolean;
  disabled?: boolean;
  itemRef?: (el: HTMLDivElement | null) => void;
  /** Square item fields metadata (for labels, optionValues for selects) */
  squareItemFields?: SquareFieldMetadata[];
  /** Per-field autocomplete values from Square catalog */
  squareAutocomplete?: { product_name?: string[]; sku?: string[]; [key: string]: string[] | undefined };
  /** User id for Square Vendors API (vendor autocomplete) */
  userId?: string;
};

const FIELDS_TO_RENDER = [
  'product_name',
  'purchase_price',
  'retail_price',
  'category',
  'sku',
  'description',
  'vendor_code',
  'initial_stock',
  'image',
] as const;

export default function ProductCard({ item, index, missingFields, onChange, squareCategories = [], categoryLoading = false, productNameOptionsLoading = false, disabled, itemRef, squareItemFields = [], squareAutocomplete, userId }: Props) {
  const update = (updates: Partial<ConfirmItem>) => onChange(index, updates);
  const includedInPO = item.includedInPO !== false;

  const allImages = [item.image, ...(item.images ?? [])].filter(Boolean) as string[];
  const setAllImages = (urls: string[]) => {
    update({ image: urls[0] ?? null, images: urls.slice(1) });
  };

  const fieldsToRender = FIELDS_TO_RENDER;
  const fieldMetaMap = Object.fromEntries((squareItemFields ?? []).map((f) => [f.id, f]));

  return (
    <div
      ref={itemRef}
      className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-4"
    >
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={includedInPO}
          onChange={(e) => update({ includedInPO: e.target.checked })}
          disabled={disabled}
          className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        Include in purchase order
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {fieldsToRender.filter((f) => f !== 'image').map((fieldKey) => (
          <SquareItemField
            key={fieldKey}
            field={fieldKey}
            item={item}
            update={update}
            disabled={disabled}
            missing={missingFields.has(fieldKey as RequiredField)}
            squareCategories={squareCategories}
            categoryLoading={categoryLoading}
            productNameOptionsLoading={productNameOptionsLoading}
            fieldMetadata={fieldMetaMap[fieldKey]}
            squareAutocomplete={squareAutocomplete}
            userId={userId}
          />
        ))}
      </div>

      {fieldsToRender.includes('image') && (
        <div>
          <SquareItemField
            field="image"
            item={item}
            fieldMetadata={fieldMetaMap.image}
            squareAutocomplete={squareAutocomplete}
            update={update}
            disabled={disabled}
            missing={missingFields.has('image')}
            allImages={allImages}
            setAllImages={setAllImages}
            userId={userId}
          />
        </div>
      )}

      <p className="text-xs text-slate-500">
        Qty: {item.quantity}
        {item.status === 'matched' && item.catalogName && ` · Matched: ${item.catalogName}`}
      </p>
    </div>
  );
}
