'use client';

import { useState, useRef, useEffect } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Category names from Square catalog. Only these appear in the dropdown; user can still type any value. */
  categories: string[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  missing?: boolean;
};

export default function CategoryCombobox({
  value,
  onChange,
  categories,
  disabled,
  placeholder = 'Category',
  className = '',
  missing,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = filter.trim()
    ? categories.filter((c) =>
        c.toLowerCase().includes(filter.toLowerCase())
      )
    : categories;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (category: string) => {
    onChange(category);
    setFilter('');
    setOpen(false);
  };

  const handleFocus = () => {
    if (!disabled) setOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setFilter(v);
    setOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none ${missing ? 'ring-1 ring-amber-400' : ''}`}
      />
      {open && !disabled && (
        <ul
          className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              {categories.length === 0 ? 'No Square categories yet. Type your own.' : 'No match. Type your own category.'}
            </li>
          ) : (
            filtered.map((cat) => (
              <li
                key={cat}
                role="option"
                aria-selected={cat === value}
                tabIndex={0}
                onClick={() => handleSelect(cat)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(cat);
                  }
                }}
                className="px-3 py-2 text-sm text-slate-800 hover:bg-primary-50 cursor-pointer"
              >
                {cat}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
