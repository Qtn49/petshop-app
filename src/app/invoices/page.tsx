'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Upload, FileText, Loader2, X } from 'lucide-react';

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv';
const ACCEPTED_EXT = ['pdf', 'xlsx', 'xls', 'csv'];

export default function InvoicesPage() {
  const { user } = useAuth();

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
      if (dragCounter <= 0) {
        setIsDragging(false);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

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

      if (firstId) {
        window.location.href = `/invoices/${firstId}`;
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
      {/* Drag overlay – app colors */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border-2 border-dashed border-primary-400 shadow-xl p-12 max-w-md mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-primary-600" />
            </div>
            <p className="text-xl font-semibold text-slate-800">
              Drop files here
            </p>
            <p className="text-sm text-slate-500 mt-1">
              PDF, Excel, or CSV
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-800">
            Invoice Upload
          </h1>
          <p className="text-slate-500 mt-1">
            Upload supplier invoices for parsing
          </p>
        </header>

        <Card title="Upload Invoice">
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

            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <span className="font-medium text-slate-700">
                Choose files or drag and drop
              </span>
              <span className="text-sm text-slate-500">
                {files.length > 0 ? `${files.length} file(s) selected` : 'Multiple files allowed'}
              </span>
            </label>
          </div>

          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                    {f.name}
                  </span>
                  <span className="text-xs text-slate-500 flex-shrink-0">
                    {formatSize(f.size)}
                  </span>
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

          {error && (
            <p className="mt-2 text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="mt-4">
            <Button
              onClick={handleUpload}
              disabled={!files.length || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {files.length > 0 ? `(${files.length})` : ''} & Parse
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card title="Recent Invoices">
          <a
            href="/invoices/list"
            className="text-primary-600 hover:underline"
          >
            View all invoices →
          </a>
        </Card>
      </div>
    </>
  );
}
