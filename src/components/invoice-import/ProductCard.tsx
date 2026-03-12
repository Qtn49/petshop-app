'use client';

import MissingFieldHighlight from './MissingFieldHighlight';
import ImageUploader from './ImageUploader';
import CategoryCombobox from './CategoryCombobox';
import type { ConfirmItem, RequiredField } from '@/lib/invoice-import/confirm-types';

type Props = {
  item: ConfirmItem;
  index: number;
  missingFields: Set<RequiredField>;
  onChange: (index: number, updates: Partial<ConfirmItem>) => void;
  /** Category names from Square catalog (for dropdown). */
  squareCategories?: string[];
  disabled?: boolean;
  itemRef?: (el: HTMLDivElement | null) => void;
};

const FIELD_LABELS: Record<RequiredField, string> = {
  product_name: 'Product name',
  purchase_price: 'Purchase price',
  retail_price: 'Retail price',
  category: 'Category',
  sku: 'SKU',
  vendor: 'Vendor',
  vendor_code: 'Vendor code',
  image: 'Image',
  initial_stock: 'Initial stock level',
};

export default function ProductCard({ item, index, missingFields, onChange, squareCategories = [], disabled, itemRef }: Props) {
  const update = (updates: Partial<ConfirmItem>) => onChange(index, updates);

  const includedInPO = item.includedInPO !== false;

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
        <MissingFieldHighlight missing={missingFields.has('product_name')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.product_name}</label>
          <input
            type="text"
            value={item.product_name}
            onChange={(e) => update({ product_name: e.target.value })}
            disabled={disabled}
            placeholder="Product name"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('purchase_price')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.purchase_price}</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={item.purchase_price ?? ''}
            onChange={(e) => update({ purchase_price: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={disabled}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('retail_price')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.retail_price}</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={item.retail_price ?? ''}
            onChange={(e) => update({ retail_price: e.target.value === '' ? null : Number(e.target.value) })}
            disabled={disabled}
            placeholder="0.00"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('category')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.category}</label>
          <CategoryCombobox
            value={item.category}
            onChange={(category) => update({ category })}
            categories={squareCategories}
            disabled={disabled}
            placeholder="Type or pick a Square category"
            missing={missingFields.has('category')}
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('sku')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.sku}</label>
          <input
            type="text"
            value={item.sku}
            onChange={(e) => update({ sku: e.target.value })}
            disabled={disabled}
            placeholder="SKU"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('vendor')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.vendor}</label>
          <input
            type="text"
            value={item.vendor}
            onChange={(e) => update({ vendor: e.target.value })}
            disabled={disabled}
            placeholder="Vendor"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('vendor_code')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.vendor_code}</label>
          <input
            type="text"
            value={item.vendor_code}
            onChange={(e) => update({ vendor_code: e.target.value })}
            disabled={disabled}
            placeholder="Vendor code"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>

        <MissingFieldHighlight missing={missingFields.has('initial_stock')}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.initial_stock}</label>
          <input
            type="number"
            min={0}
            step={1}
            value={item.initial_stock}
            onChange={(e) => update({ initial_stock: Number(e.target.value) || 0 })}
            disabled={disabled}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </MissingFieldHighlight>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{FIELD_LABELS.image}</label>
        <ImageUploader
          value={item.image}
          onChange={(image) => update({ image })}
          disabled={disabled}
          missing={missingFields.has('image')}
        />
      </div>

      <p className="text-xs text-slate-500">
        Qty: {item.quantity}
        {item.status === 'matched' && item.catalogName && ` · Matched: ${item.catalogName}`}
      </p>
    </div>
  );
}
