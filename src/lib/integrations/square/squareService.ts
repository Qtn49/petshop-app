import { getSupabaseClient } from '@/lib/supabase-server';
import type { SquareTokenResponse } from './types';
import { getSquareEnvironment } from './squareOAuth';
import { getFirstLocation } from './squareClient';

const OAUTH_STATE_TTL_MINUTES = 10;

/**
 * Store OAuth state linked to user (for CSRF protection). Call before redirecting to Square.
 */
export async function storeOAuthState(state: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000).toISOString();
  await supabase.from('square_oauth_states').insert({
    state,
    user_id: userId,
    expires_at: expiresAt,
  });
}

/**
 * Verify state and return linked userId if valid. Deletes the state row (one-time use).
 */
export async function verifyAndConsumeState(state: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('square_oauth_states')
    .select('user_id')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data?.user_id) return null;

  await supabase.from('square_oauth_states').delete().eq('state', state);
  return data.user_id;
}

export type ConnectionStatus = {
  connected: boolean;
  locationName: string | null;
  locationId: string | null;
  merchantId: string | null;
  connectedAt: string | null;
};

/**
 * Get Square connection status for a user (no tokens in response).
 */
export async function getConnectionStatus(userId: string): Promise<ConnectionStatus> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('square_connections')
    .select('location_name, location_id, merchant_id, connected_at')
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

  const hasTokens =
    data.location_name != null ||
    data.location_id != null ||
    data.merchant_id != null;

  return {
    connected: !!hasTokens,
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
 */
export async function saveConnection(
  userId: string,
  tokens: SquareTokenResponse
): Promise<{ locationName: string | null }> {
  const supabase = getSupabaseClient();

  const env = getSquareEnvironment();

  const location = await getFirstLocation(tokens.access_token, env);

  const expiresAt = tokens.expires_at
    ? new Date(Date.now() + Number(tokens.expires_at) * 1000).toISOString()
    : null;

  await supabase.from('square_connections').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      merchant_id: tokens.merchant_id ?? null,
      location_id: location?.location_id ?? null,
      location_name: location?.location_name ?? null,
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  return { locationName: location?.location_name ?? null };
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
