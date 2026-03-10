'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Upload, FileText, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv';

export default function InvoicesPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError('Please upload PDF, Excel, or CSV files only.');
      setFile(null);
      return;
    }

    setFile(f);
    setError('');
    setInvoiceId(null);
  };

  const handleUpload = async () => {
    if (!file || !user?.id) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setInvoiceId(data.invoice?.id);
      setFile(null);

      if (data.invoice?.id) {
        window.location.href = `/invoices/${data.invoice.id}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800">Invoice Upload</h1>
        <p className="text-slate-500 mt-1">Upload supplier invoices for parsing</p>
      </header>

      <Card title="Upload Invoice">
        <p className="text-sm text-slate-500 mb-4">
          Supported formats: PDF, Excel (.xlsx, .xls), CSV
        </p>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
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
              {file ? file.name : 'Choose a file'}
            </span>
            <span className="text-sm text-slate-500">or drag and drop</span>
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4">
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Parse
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card title="Recent Invoices">
        <a href="/invoices/list" className="text-primary-600 hover:underline">
          View all invoices →
        </a>
      </Card>
    </div>
  );
}
