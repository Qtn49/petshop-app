'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export type VendorOption = { id: string; name: string };

type Props = {
  value: string;
  onChange: (name: string) => void;
  /** When user selects a vendor from the list, call with id and name (store vendor_id locally) */
  onVendorSelect?: (vendor: VendorOption) => void;
  userId: string | undefined;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  missing?: boolean;
};

export default function VendorAutocomplete({
  value,
  onChange,
  onVendorSelect,
  userId,
  disabled,
  placeholder = 'Search vendor...',
  className = '',
  missing,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState(value);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchVendors = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.vendors)) {
        setVendors(data.vendors);
        if (typeof console !== 'undefined' && console.log) {
          console.log('Vendors (Step 3):', data.vendors);
        }
      } else {
        setVendors([]);
      }
    } catch {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load vendors when page opens (userId available), not only on input focus
  useEffect(() => {
    if (userId && !disabled) {
      fetchVendors();
    }
  }, [userId, disabled, fetchVendors]);

  useEffect(() => {
    setFilter(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = filter.trim()
    ? vendors.filter((v) => v.name.toLowerCase().includes(filter.toLowerCase()))
    : vendors;

  const handleFocus = () => {
    if (!disabled) {
      setOpen(true);
      setHighlightIndex(-1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setFilter(v);
    onChange(v);
    setOpen(true);
    setHighlightIndex(-1);
  };

  const handleSelect = (vendor: VendorOption) => {
    onChange(vendor.name);
    setFilter(vendor.name);
    onVendorSelect?.(vendor);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < filtered.length - 1 ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={filter}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none ${missing ? 'ring-1 ring-amber-400' : ''}`}
      />
      {open && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-slate-500">Loading vendors...</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              {vendors.length === 0 ? 'No Square vendors. Type a name.' : 'No match. Type a name.'}
            </li>
          ) : (
            filtered.map((vendor, idx) => (
              <li
                key={vendor.id}
                role="option"
                aria-selected={vendor.name === value}
                tabIndex={0}
                onMouseEnter={() => setHighlightIndex(idx)}
                onClick={() => handleSelect(vendor)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(vendor);
                  }
                }}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  idx === highlightIndex ? 'bg-primary-50 text-slate-900' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                {vendor.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
