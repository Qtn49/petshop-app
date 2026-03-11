/**
 * Square integration types.
 * Kept in a shared file so other modules (Stripe, Shopify, etc.) can follow the same pattern.
 */

export type SquareEnvironment = 'sandbox' | 'production';

export type SquareTokenResponse = {
  access_token: string;
  refresh_token?: string;
  merchant_id: string;
  expires_at?: string;
};

export type SquareConnection = {
  id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  merchant_id: string | null;
  location_id: string | null;
  location_name: string | null;
  expires_at: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};
