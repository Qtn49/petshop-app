import { randomBytes } from 'crypto';
import type { SquareTokenResponse } from './types';

const SQUARE_APP_ID = process.env.SQUARE_APPLICATION_ID;
const SQUARE_APP_SECRET = process.env.SQUARE_APPLICATION_SECRET;
const SQUARE_REDIRECT_URI = process.env.SQUARE_REDIRECT_URI;

/** Scopes required for the application (space-separated per Square OAuth) */
const SQUARE_SCOPES = 'MERCHANT_PROFILE_READ ITEMS_READ INVENTORY_READ ORDERS_READ CUSTOMERS_READ';

/**
 * Resolve Square environment from APP_ENV (or NODE_ENV).
 * Used for OAuth base URL and Square API client.
 */
export function getSquareEnvironment(): 'sandbox' | 'production' {
  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  return appEnv === 'production' || appEnv === 'prod' ? 'production' : 'sandbox';
}

/**
 * Get the Square OAuth base URL (authorize and token) from APP_ENV.
 * APP_ENV=production → https://connect.squareup.com
 * Otherwise (development, etc.) → https://connect.squareupsandbox.com
 */
function getSquareOAuthBaseUrl(): string {
  const env = getSquareEnvironment();
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

/**
 * Generate the Square OAuth authorization URL.
 * Uses SQUARE_APPLICATION_ID, SQUARE_REDIRECT_URI, and includes scope, state, session=false.
 * redirect_uri is encoded with encodeURIComponent.
 */
export function generateSquareOAuthUrl(state: string): string {
  if (!SQUARE_APP_ID || !SQUARE_REDIRECT_URI) {
    throw new Error(
      'Square OAuth not configured: missing SQUARE_APPLICATION_ID or SQUARE_REDIRECT_URI'
    );
  }

  const baseUrl = getSquareOAuthBaseUrl();
  const authorizeUrl = `${baseUrl}/oauth2/authorize`;

  const query = [
    `client_id=${encodeURIComponent(SQUARE_APP_ID)}`,
    'response_type=code',
    `scope=${encodeURIComponent(SQUARE_SCOPES)}`,
    `redirect_uri=${encodeURIComponent(SQUARE_REDIRECT_URI)}`,
    `state=${encodeURIComponent(state || '')}`,
    'session=false',
  ].join('&');

  const url = `${authorizeUrl}?${query}`;
  console.log('Square OAuth URL:', url);
  return url;
}

/**
 * Build the Square OAuth authorization URL (alias for generateSquareOAuthUrl).
 * State should be the userId so we can link the token to the user on callback.
 */
export function getSquareAuthUrl(state: string): string {
  return generateSquareOAuthUrl(state);
}

/**
 * Exchange authorization code for access and refresh tokens.
 */
export async function exchangeCodeForToken(code: string): Promise<SquareTokenResponse> {
  if (!SQUARE_APP_ID || !SQUARE_APP_SECRET || !SQUARE_REDIRECT_URI) {
    throw new Error('Square OAuth not configured');
  }

  const baseUrl = getSquareOAuthBaseUrl();
  const tokenUrl = `${baseUrl}/oauth2/token`;

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Client ${SQUARE_APP_SECRET}`,
    },
    body: JSON.stringify({
      client_id: SQUARE_APP_ID,
      code,
      grant_type: 'authorization_code',
      redirect_uri: SQUARE_REDIRECT_URI,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.message || data?.errors?.[0]?.detail || `Square OAuth error ${res.status}`;
    throw new Error(message);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    merchant_id: data.merchant_id,
    expires_at: data.expires_at,
  };
}

/**
 * Generate a cryptographically secure random state value for OAuth CSRF protection.
 */
export function generateSecureState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Check if Square OAuth env vars are set.
 */
export function isSquareOAuthConfigured(): boolean {
  return Boolean(SQUARE_APP_ID && SQUARE_APP_SECRET && SQUARE_REDIRECT_URI);
}
