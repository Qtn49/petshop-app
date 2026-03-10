import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseClient();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: 'File and userId required' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json(
        { error: 'Only PDF, Excel, and CSV files are supported' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `invoices/${userId}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message || 'Storage upload failed' },
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabase.storage
      .from('invoices')
      .getPublicUrl(filePath);

    const { data: invoice, error } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        file_name: file.name,
        file_path: uploadData.path,
        file_type: file.type,
        file_size: file.size,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      invoice,
      message: 'Upload successful. Parse the invoice to extract items.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
