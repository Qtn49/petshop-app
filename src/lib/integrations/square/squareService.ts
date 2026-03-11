import { getSupabaseClient } from '@/lib/supabase-server';
import type { SquareTokenResponse } from './types';
import { getSquareEnvironment } from './squareOAuth';
import { getFirstLocation } from './squareClient';

const OAUTH_STATE_TTL_MINUTES = 15;

/**
 * Store OAuth state linked to user and redirect_uri (for CSRF and correct callback host). Call before redirecting to Square.
 * Throws if insert fails (e.g. missing redirect_uri column → run migration 006).
 */
export async function storeOAuthState(
  state: string,
  userId: string,
  redirectUri: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from('square_oauth_states').insert({
    state,
    user_id: userId,
    redirect_uri: redirectUri,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[Square OAuth] storeOAuthState insert failed:', error.message, error.code, error.details);
    throw new Error(`Failed to save OAuth state: ${error.message}. Run migration 006 if redirect_uri column is missing.`);
  }
}

export type VerifyStateResult = { userId: string; redirectUri: string | null };

/**
 * Verify state and return linked userId and redirect_uri if valid. Deletes the state row (one-time use).
 * If redirect_uri column is missing (migration 006 not run), falls back to user_id only.
 */
export async function verifyAndConsumeState(state: string): Promise<VerifyStateResult | null> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  let data: { user_id: string; redirect_uri?: string | null } | null = null;
  let error: { message: string; code?: string } | null = null;

  const { data: fullData, error: fullError } = await supabase
    .from('square_oauth_states')
    .select('user_id, redirect_uri')
    .eq('state', state)
    .gt('expires_at', now)
    .single();

  if (fullError) {
    const msg = fullError.message ?? '';
    if (msg.includes('column') || msg.includes('redirect_uri')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('square_oauth_states')
        .select('user_id')
        .eq('state', state)
        .gt('expires_at', now)
        .single();
      if (!fallbackError && fallbackData?.user_id) {
        data = { user_id: fallbackData.user_id, redirect_uri: null };
      } else {
        error = fallbackError ?? fullError;
      }
    } else {
      error = fullError;
    }
  } else if (fullData?.user_id) {
    data = { user_id: fullData.user_id, redirect_uri: fullData.redirect_uri ?? null };
  }

  if (error) {
    console.error('[Square OAuth] verifyAndConsumeState failed:', error.message, error.code, 'state length:', state?.length);
    return null;
  }
  if (!data?.user_id) return null;

  await supabase.from('square_oauth_states').delete().eq('state', state);
  return {
    userId: data.user_id,
    redirectUri: data.redirect_uri ?? null,
  };
}

export type ConnectionStatus = {
  connected: boolean;
  locationName: string | null;
  locationId: string | null;
  merchantId: string | null;
  connectedAt: string | null;
};

/**
 * Get Square connection status for a user (no token values in response).
 * Connected = row exists and has access_token set (we only check existence, never return the token).
 */
export async function getConnectionStatus(userId: string): Promise<ConnectionStatus> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('square_connections')
    .select('access_token, location_name, location_id, merchant_id, connected_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      connected: false,
      locationName: null,
      locationId: null,
      merchantId: null,
      connectedAt: null,
    };
  }

  const connected = data.access_token != null && data.access_token !== '';

  return {
    connected,
    locationName: data.location_name ?? null,
    locationId: data.location_id ?? null,
    merchantId: data.merchant_id ?? null,
    connectedAt: data.connected_at ?? null,
  };
}

/**
 * Get access token for a user (for API routes that need to call Square).
 */
export async function getAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('square_connections')
    .select('access_token')
    .eq('user_id', userId)
    .single();

  return data?.access_token ?? null;
}

/**
 * Save OAuth tokens and optionally fetch/store first location.
 * Persists tokens first so the connection stays even if location fetch fails.
 */
export async function saveConnection(
  userId: string,
  tokens: SquareTokenResponse
): Promise<{ locationName: string | null }> {
  const supabase = getSupabaseClient();
  const env = getSquareEnvironment();
  const now = new Date().toISOString();

  let expiresAt: string | null = null;
  if (tokens.expires_at != null && tokens.expires_at !== '') {
    const raw = tokens.expires_at;
    const num = Number(raw);
    if (Number.isFinite(num)) {
      const ms = num < 1e12 ? num * 1000 : num;
      expiresAt = new Date(ms).toISOString();
    } else if (typeof raw === 'string') {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
    }
  }

  // Persist tokens immediately so connection is saved even if location fetch fails
  const { error: upsertError } = await supabase.from('square_connections').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      merchant_id: tokens.merchant_id ?? null,
      location_id: null,
      location_name: null,
      expires_at: expiresAt,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  if (upsertError) {
    console.error('[Square OAuth] saveConnection upsert failed:', upsertError.message, upsertError.code, upsertError.details);
    throw new Error(`Failed to save Square connection: ${upsertError.message}. Ensure SUPABASE_SERVICE_ROLE_KEY is set and square_connections exists.`);
  }

  // Then try to fetch location and update (non-blocking for persistence)
  let locationName: string | null = null;
  try {
    const location = await getFirstLocation(tokens.access_token, env);
    if (location?.location_id != null) {
      const { error: updateError } = await supabase
        .from('square_connections')
        .update({
          location_id: location.location_id,
          location_name: location.location_name ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      if (!updateError) locationName = location.location_name ?? null;
    }
  } catch (e) {
    console.warn('[Square OAuth] getFirstLocation failed (connection already saved):', e);
  }

  return { locationName };
}

/**
 * Disconnect Square: remove tokens and clear location for the user.
 */
export async function disconnect(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.from('square_connections').update({
    access_token: null,
    refresh_token: null,
    merchant_id: null,
    location_id: null,
    location_name: null,
    expires_at: null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
}
