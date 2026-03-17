'use client';

import MissingFieldHighlight from './MissingFieldHighlight';
import ImageUploader from './ImageUploader';
import CategoryCombobox from './CategoryCombobox';
import VendorAutocomplete from './VendorAutocomplete';
import { X } from 'lucide-react';
import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';

const FIELD_LABELS: Record<string, string> = {
  product_name: 'Product name',
  purchase_price: 'Purchase price',
  retail_price: 'Retail price',
  category: 'Category',
  sku: 'SKU',
  description: 'Description',
  vendor: 'Vendor',
  vendor_code: 'Vendor code',
  image: 'Images',
  initial_stock: 'Initial stock level',
};

function labelForKey(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export type SquareFieldMetadata = { id: string; name: string; optionValues?: { id: string; name: string }[] };

type Props = {
  field: string;
  item: ConfirmItem;
  update: (updates: Partial<ConfirmItem>) => void;
  disabled?: boolean;
  missing?: boolean;
  squareCategories?: string[];
  /** True while category list is being fetched (shows loading in category combobox) */
  categoryLoading?: boolean;
  /** True while product name options are being fetched (shows loading in product name combobox) */
  productNameOptionsLoading?: boolean;
  allImages?: string[];
  setAllImages?: (urls: string[]) => void;
  /** Optional field metadata from Square (for label name and select/dropdown when optionValues present) */
  fieldMetadata?: SquareFieldMetadata;
  /** Per-field autocomplete values from Square catalog (e.g. product names, SKUs) */
  squareAutocomplete?: { product_name?: string[]; sku?: string[]; [key: string]: string[] | undefined };
  /** User id for Square Vendors API (vendor autocomplete) */
  userId?: string;
};

export default function SquareItemField({
  field,
  item,
  update,
  disabled,
  missing,
  squareCategories = [],
  categoryLoading = false,
  productNameOptionsLoading = false,
  allImages = [],
  setAllImages,
  fieldMetadata,
  squareAutocomplete,
  userId,
}: Props) {
  const label = fieldMetadata?.name ?? labelForKey(field);

  if (field === 'category') {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <CategoryCombobox
          value={item.category}
          onChange={(category) => update({ category })}
          categories={squareCategories}
          disabled={disabled}
          placeholder="Type or pick a Square category"
          missing={!!missing}
          loading={categoryLoading}
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'image') {
    return (
      <MissingFieldHighlight missing={!!missing && allImages.length === 0}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
          <p className="text-xs text-slate-500 mb-1">Upload as many images as you want.</p>
          {allImages.length > 0 && setAllImages && (
            <div className="flex flex-wrap gap-2">
              {allImages.map((url, idx) => (
                <div key={idx} className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-20 w-20 object-cover rounded border border-slate-200" />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => setAllImages(allImages.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 text-xs"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!disabled && setAllImages && (
            <ImageUploader
              value={null}
              onChange={(dataUrl) => {
                if (dataUrl) setAllImages([...allImages, dataUrl]);
              }}
              disabled={disabled}
              missing={!!missing && allImages.length === 0}
            />
          )}
        </div>
      </MissingFieldHighlight>
    );
  }

  if (field === 'retail_price' || field === 'purchase_price') {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={field === 'retail_price' ? (item.retail_price ?? '') : (item.purchase_price ?? '')}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            update(field === 'retail_price' ? { retail_price: v } : { purchase_price: v });
          }}
          disabled={disabled}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          autoComplete="on"
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'initial_stock') {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type="number"
          min={0}
          step={1}
          value={item.initial_stock ?? ''}
          onChange={(e) => update({ initial_stock: Number(e.target.value) || 0 })}
          disabled={disabled}
          placeholder="0"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
          autoComplete="on"
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'product_name') {
    const options = squareAutocomplete?.product_name ?? [];
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <CategoryCombobox
          value={item.product_name}
          onChange={(v) => update({ product_name: v })}
          categories={options}
          disabled={disabled}
          placeholder="Product name"
          missing={!!missing}
          loading={productNameOptionsLoading}
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'sku') {
    const options = squareAutocomplete?.sku ?? [];
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <CategoryCombobox
          value={item.sku}
          onChange={(v) => update({ sku: v })}
          categories={options}
          disabled={disabled}
          placeholder="SKU"
          missing={!!missing}
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'vendor') {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <VendorAutocomplete
          value={item.vendor ?? ''}
          onChange={(name) => update({ vendor: name })}
          onVendorSelect={(v) => update({ vendor_id: v.id, vendor: v.name })}
          userId={userId}
          disabled={disabled}
          placeholder="Search vendor..."
          missing={!!missing}
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'vendor_code') {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <input
          type="text"
          value={item.vendor_code ?? ''}
          onChange={(e) => update({ vendor_code: e.target.value })}
          disabled={disabled}
          placeholder={label}
          autoComplete="off"
          className={`w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none ${missing ? 'ring-1 ring-amber-400' : ''}`}
        />
      </MissingFieldHighlight>
    );
  }

  if (field === 'description') {
    const options = squareAutocomplete?.description ?? [];
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <CategoryCombobox
          value={item.description ?? ''}
          onChange={(v) => update({ description: v })}
          categories={options}
          disabled={disabled}
          placeholder={label}
          missing={!!missing}
        />
      </MissingFieldHighlight>
    );
  }

  // Dynamic optional field: Square custom attribute or item option
  const customValue = item.customAttributes?.[field] ?? '';
  const options = fieldMetadata?.optionValues ?? [];

  if (options.length > 0) {
    return (
      <MissingFieldHighlight missing={!!missing}>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <select
          value={customValue}
          onChange={(e) =>
            update({
              customAttributes: { ...(item.customAttributes ?? {}), [field]: e.target.value },
            })
          }
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </MissingFieldHighlight>
    );
  }

  const customOptions = options.length > 0 ? options.map((o) => o.name) : (squareAutocomplete?.[field] ?? []);
  return (
    <MissingFieldHighlight missing={!!missing}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <CategoryCombobox
        value={customValue}
        onChange={(v) =>
          update({
            customAttributes: { ...(item.customAttributes ?? {}), [field]: v },
          })
        }
        categories={customOptions}
        disabled={disabled}
        placeholder={label}
        missing={!!missing}
      />
    </MissingFieldHighlight>
  );
}
