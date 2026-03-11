-- Create the invoices storage bucket (fixes "Bucket not found" on upload)
-- Run this in Supabase SQL Editor if the bucket doesn't exist yet.

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Allow uploads to the invoices bucket
DROP POLICY IF EXISTS "Allow invoices upload" ON storage.objects;
CREATE POLICY "Allow invoices upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'invoices');

-- Allow reads from the invoices bucket (for parsing)
DROP POLICY IF EXISTS "Allow invoices read" ON storage.objects;
CREATE POLICY "Allow invoices read" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices');
