'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenantHref } from '@/hooks/useTenantHref';

export default function InvoiceSquareRedirect() {
  const params = useParams();
  const router = useRouter();
  const tenantHref = useTenantHref();
  const invoiceId = params.id as string;

  useEffect(() => {
    router.replace(tenantHref(`/invoices/${invoiceId}`));
  }, [invoiceId, router, tenantHref]);

  return null;
}
