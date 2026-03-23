'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import InlineLoader from '@/components/ui/InlineLoader';
import { Upload, FileText, X, ChevronRight, CheckCircle2, Clock, AlertCircle, Package } from 'lucide-react';
import { useInvoices } from '@/hooks/use-invoices';
import { useTenantHref } from '@/hooks/useTenantHref';

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv';
const ACCEPTED_EXT = ['pdf', 'xlsx', 'xls', 'csv'];

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
        <CheckCircle2 className="w-3 h-3" />
        Completed
      </span>
    );
  }
  if (status === 'parsed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
        <FileText className="w-3 h-3" />
        Ready
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
        <AlertCircle className="w-3 h-3" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
      <Clock className="w-3 h-3" />
      {status}
    </span>
  );
}

export default function InvoicesPage() {
  const tenantHref = useTenantHref();
  const { user } = useAuth();
  const { invoices, invalidate } = useInvoices(user?.id);

  const [mode, setMode] = useState<'choose' | 'upload'>('choose');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid: File[] = [];
    const invalid: string[] = [];

    Array.from(newFiles).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ACCEPTED_EXT.includes(ext || '')) {
        valid.push(f);
      } else {
        invalid.push(f.name);
      }
    });

    if (invalid.length > 0) {
      setError(`Skipped (use PDF, Excel, or CSV): ${invalid.join(', ')}`);
    } else {
      setError('');
    }

    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (selected?.length) addFiles(Array.from(selected));
    e.target.value = '';
  };

  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter++;
        setIsDragging(true);
      }
    };

    const onDragLeave = () => {
      dragCounter--;
      if (dragCounter <= 0) setIsDragging(false);
    };

    const onDragOver = (e: DragEvent) => e.preventDefault();

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      const dropped = e.dataTransfer?.files;
      if (dropped?.length) addFiles(Array.from(dropped));
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [addFiles]);

  const handleUpload = async () => {
    if (!files.length || !user?.id) return;

    setUploading(true);
    setError('');

    try {
      let firstId: string | null = null;

      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        formData.append('userId', user.id);

        const res = await fetch('/api/invoices/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${files[i].name}`);
        }

        if (i === 0) firstId = data.invoice?.id;
      }

      setFiles([]);
      invalidate();

      if (firstId) {
        window.location.href = tenantHref(`/inventory/${firstId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      {isDragging && mode === 'upload' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-dashed border-primary-400 shadow-xl p-12 max-w-md mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
            <p className="text-xl font-semibold text-slate-800">Drop files here</p>
            <p className="text-sm text-slate-500 mt-1">PDF, Excel, or CSV</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 mt-1">Add new items manually or import from a supplier invoice</p>
        </header>

        {mode === 'choose' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href={tenantHref('/inventory/new')}
              className="group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-8 text-center hover:border-primary-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                <Package className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">Add manually</p>
                <p className="text-sm text-slate-500 mt-1">Create a new Square catalog item directly</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMode('upload')}
              className="group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-8 text-center hover:border-primary-400 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <FileText className="w-8 h-8 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">Upload invoice</p>
                <p className="text-sm text-slate-500 mt-1">Import products from a PDF, Excel, or CSV file</p>
              </div>
            </button>
          </div>
        )}

        {mode === 'upload' && (
          <Card title="Upload Invoice">
            <button
              type="button"
              onClick={() => { setMode('choose'); setFiles([]); setError(''); }}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-4 -mt-1"
            >
              ← Back
            </button>
            <p className="text-sm text-slate-500 mb-4">
              Supported formats: PDF, Excel (.xlsx, .xls), CSV. Add multiple files, then upload.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center min-h-[140px] flex flex-col items-center justify-center bg-slate-50/50">
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={handleFileChange}
                multiple
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <span className="font-medium text-slate-700">Choose files or drag and drop</span>
                <span className="text-sm text-slate-500">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Multiple files allowed'}
                </span>
              </label>
            </div>

            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-slate-800 truncate">{f.name}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">{formatSize(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

            <div className="mt-4">
              <Button onClick={handleUpload} disabled={!files.length || uploading}>
                {uploading ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineLoader size={24} />
                    Uploading...
                  </span>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {files.length > 0 ? `(${files.length})` : ''} & Parse
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        <Card title="Recent Uploads">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">Recent uploads</span>
            <Link
              href={tenantHref('/inventory/list')}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-slate-500 text-sm">No invoices yet.</p>
          ) : (
            <ul className="space-y-1">
              {invoices.slice(0, 8).map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={tenantHref(`/inventory/${inv.id}`)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition"
                  >
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm truncate flex-1 min-w-0">{inv.file_name}</span>
                    <StatusBadge status={inv.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
