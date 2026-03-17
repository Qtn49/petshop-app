'use client';

import { type ReactNode } from 'react';

export default function WidgetCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
