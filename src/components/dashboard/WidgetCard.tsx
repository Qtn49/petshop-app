'use client';

import { type ReactNode } from 'react';

export default function WidgetCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white border border-amber-100/70 shadow-warm overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
