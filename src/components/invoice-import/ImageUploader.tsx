'use client';

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  missing?: boolean;
  className?: string;
};

const ACCEPT = 'image/jpeg,image/pjpeg,image/png,image/gif';

export default function ImageUploader({ value, onChange, disabled, missing, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|gif|pjpeg)$/)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className={className}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition
          ${value ? 'border-slate-200 bg-slate-50' : 'border-slate-300 bg-slate-50/50 hover:border-primary-400 hover:bg-primary-50/30'}
          ${disabled ? 'opacity-60 pointer-events-none' : ''}
          ${missing ? 'ring-2 ring-amber-400 ring-offset-1 animate-missing-bg' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          className="hidden"
          aria-label="Upload image"
        />
        {value ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Product" className="max-h-24 max-w-full object-contain rounded" />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Drop image or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">JPEG, PNG, GIF</p>
          </>
        )}
      </div>
    </div>
  );
}
