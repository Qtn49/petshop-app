import { getSupabaseClient } from '@/lib/supabase-server';

export async function getSlugForUserId(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: u } = await supabase.from('users').select('organization_id').eq('id', userId).maybeSingle();
  const oid = (u as { organization_id?: string } | null)?.organization_id;
  if (!oid) return null;
  const { data: org } = await supabase.from('organization').select('slug').eq('id', oid).maybeSingle();
  return (org as { slug?: string } | null)?.slug ?? null;
}
