import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export type InvoiceFormulaPreset = {
  id: string;
  label: string;
  formula_percent: string;
  sort_order: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('invoice_formula_presets')
    .select('id, label, formula_percent, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    formulas: (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      formula_percent: r.formula_percent,
      sort_order: r.sort_order ?? 0,
    })),
  });
}

export async function PUT(request: Request) {
  let body: { userId?: string; formulas?: Array<{ label: string; formula_percent: string }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = body.userId ?? new URL(request.url).searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const formulas = Array.isArray(body.formulas) ? body.formulas : [];
  const supabase = getSupabaseClient();

  await supabase.from('invoice_formula_presets').delete().eq('user_id', userId);

  if (formulas.length > 0) {
    const rows = formulas.map((f, i) => ({
      user_id: userId,
      label: (f.label ?? '').trim() || 'Formula',
      formula_percent: (f.formula_percent ?? '').trim() || '0',
      sort_order: i,
    }));
    const { error: insertError } = await supabase.from('invoice_formula_presets').insert(rows);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
