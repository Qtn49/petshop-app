'use client';

import type { ConfirmItem } from '@/lib/invoice-import/confirm-types';

type Props = {
  items: ConfirmItem[];
  vendor: string;
  vendorCode: string;
  totalCost: number;
};

export default function PurchaseOrderSummary({ items, vendor, vendorCode, totalCost }: Props) {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 space-y-3">
      <h3 className="font-semibold text-slate-800">Purchase Order Summary</h3>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Vendor</dt>
          <dd className="font-medium text-slate-800">{vendor || '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Vendor code</dt>
          <dd className="font-medium text-slate-800">{vendorCode || '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Total items</dt>
          <dd className="font-medium text-slate-800">{totalItems}</dd>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-200">
          <dt className="text-slate-700 font-medium">Total cost</dt>
          <dd className="font-semibold text-slate-900">
            ${totalCost.toFixed(2)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
