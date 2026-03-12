'use client';

import { forwardRef } from 'react';

type Props = {
  missing: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Wraps content and applies a blinking background when the field is missing (validation). */
const MissingFieldHighlight = forwardRef<HTMLDivElement, Props>(function MissingFieldHighlight(
  { missing, children, className = '' },
  ref
) {
  return (
    <div
      ref={ref}
      className={`rounded transition-colors ${missing ? 'animate-missing-bg bg-amber-200/60' : ''} ${className}`}
    >
      {children}
    </div>
  );
});

export default MissingFieldHighlight;
