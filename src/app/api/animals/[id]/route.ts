import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { id } = params;
  const body = await request.json();

  const {
    name, species, breed,
    age_months,
    sex, price, status,
    hand_raised, microchipped, vaccinated,
    notes, photos,
  } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('animals')
    .update({
      name,
      species: species || 'other',
      breed: breed || null,
      age_months: age_months ?? null,
      sex: sex || 'unknown',
      price: price != null && price !== '' ? parseFloat(price) : null,
      status: status || 'available',
      hand_raised: species === 'bird' ? (hand_raised ?? false) : null,
      microchipped: microchipped ?? false,
      vaccinated: vaccinated ?? false,
      notes: notes || null,
      photos: photos || [],
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = getSupabaseClient();
  const { id } = params;

  const { error } = await supabase.from('animals').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
