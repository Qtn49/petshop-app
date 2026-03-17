'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function InvoiceSquareRedirect() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  useEffect(() => {
    router.replace(`/invoices/${invoiceId}`);
  }, [invoiceId, router]);

  return null;
}
