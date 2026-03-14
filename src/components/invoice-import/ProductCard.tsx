'use client';

import SquareItemField from './SquareItemField';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';
import { OPTIONAL_NEW_ITEM_FIELDS } from '@/lib/invoice-import/confirm-types';

type Props = {
  item: ConfirmItem;
  index: number;
  missingFields: Set<RequiredField>;
  onChange: (index: number, updates: Partial<ConfirmItem>) => void;
  squareCategories?: string[];
  disabled?: boolean;
  itemRef?: (el: HTMLDivElement | null) => void;
  /** Optional field IDs to show (from settings). When null/empty, show all optional fields. */
  enabledFields?: string[] | null;
};

const CORE_FIELDS = ['product_name', 'purchase_price', 'sku'];

function getFieldsToRender(enabledFields?: string[] | null): string[] {
  const optional = Array.isArray(enabledFields) && enabledFields.length > 0 ? enabledFields : OPTIONAL_NEW_ITEM_FIELDS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of [...CORE_FIELDS, ...optional]) {
    const key = f === 'name' ? 'product_name' : f;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export default function ProductCard({ item, index, missingFields, onChange, squareCategories = [], disabled, itemRef, enabledFields }: Props) {
  const update = (updates: Partial<ConfirmItem>) => onChange(index, updates);
  const includedInPO = item.includedInPO !== false;

  const allImages = [item.image, ...(item.images ?? [])].filter(Boolean) as string[];
  const setAllImages = (urls: string[]) => {
    update({ image: urls[0] ?? null, images: urls.slice(1) });
  };

  const fieldsToRender = getFieldsToRender(enabledFields);

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
          />
        ))}
      </div>

      {fieldsToRender.includes('image') && (
        <div>
          <SquareItemField
            field="image"
            item={item}
            update={update}
            disabled={disabled}
            missing={missingFields.has('image')}
            allImages={allImages}
            setAllImages={setAllImages}
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
