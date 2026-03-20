#!/usr/bin/env node
/**
 * One-off: get vendor for a SKU via Square (uses existing vendor-by-sku API).
 * Usage: node scripts/get-vendor-by-sku.mjs [SKU]
 * Requires: .env.local with Supabase + dev server running on localhost:3000
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  const raw = readFileSync(path, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

const env = loadEnv('.env.local');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sku = process.argv[2] || '035585111605';

const { data: row } = await supabase.from('square_connections').select('user_id').limit(1).maybeSingle();
const userId = row?.user_id;
if (!userId) {
  console.error('No Square connection found in square_connections.');
  process.exit(1);
}

const url = `http://localhost:3000/api/square/catalog/vendor-by-sku?userId=${encodeURIComponent(userId)}&sku=${encodeURIComponent(sku)}`;
const res = await fetch(url);
const out = await res.json();
console.log(JSON.stringify(out, null, 2));
