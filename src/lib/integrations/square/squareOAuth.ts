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
 * If redirectUri is provided (e.g. from request origin), it is used; otherwise SQUARE_REDIRECT_URI from env.
 * This allows using the current request URL (e.g. ngrok) so redirects stay on the same host.
 */
export function generateSquareOAuthUrl(state: string, redirectUri?: string): string {
  const redirect = redirectUri ?? SQUARE_REDIRECT_URI;
  if (!SQUARE_APP_ID || !redirect) {
    throw new Error(
      'Square OAuth not configured: missing SQUARE_APPLICATION_ID or redirect_uri (env or request)'
    );
  }

  const baseUrl = getSquareOAuthBaseUrl();
  const authorizeUrl = `${baseUrl}/oauth2/authorize`;

  const query = [
    `client_id=${encodeURIComponent(SQUARE_APP_ID)}`,
    'response_type=code',
    `scope=${encodeURIComponent(SQUARE_SCOPES)}`,
    `redirect_uri=${encodeURIComponent(redirect)}`,
    `state=${encodeURIComponent(state || '')}`,
    'session=false',
  ].join('&');

  const url = `${authorizeUrl}?${query}`;
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
 * redirectUri must match the redirect_uri used in the authorize request (e.g. from stored state).
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri?: string
): Promise<SquareTokenResponse> {
  const redirect = redirectUri ?? SQUARE_REDIRECT_URI;
  if (!SQUARE_APP_ID || !SQUARE_APP_SECRET || !redirect) {
    throw new Error('Square OAuth not configured (need client_id, client_secret, redirect_uri)');
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
      client_secret: SQUARE_APP_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    }),
  });

  const data = (await res.json()) as { message?: string; errors?: Array<{ code?: string; detail?: string }> };

  if (!res.ok) {
    const detail = data?.errors?.[0];
    const message =
      data?.message ||
      detail?.detail ||
      (detail?.code ? `Square: ${detail.code}` : null) ||
      `Square OAuth error ${res.status}`;
    const hint =
      message === 'Not Authorized' || res.status === 401
        ? ' Check: SQUARE_REDIRECT_URI must exactly match the callback URL (no trailing slash). Use sandbox credentials for sandbox.'
        : '';
    throw new Error(message + hint);
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
 * Check if Square OAuth env vars are set (redirect_uri can come from request when starting OAuth).
 */
export function isSquareOAuthConfigured(): boolean {
  return Boolean(SQUARE_APP_ID && SQUARE_APP_SECRET);
}
