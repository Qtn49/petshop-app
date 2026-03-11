import { Client, Environment } from 'square';
import type { SquareEnvironment } from './types';

/**
 * Create an authenticated Square API client for server-side use.
 */
export function createSquareClient(
  accessToken: string,
  env: SquareEnvironment = 'sandbox'
): Client {
  const environment =
    env === 'production' ? Environment.Production : Environment.Sandbox;

  return new Client({
    accessToken,
    environment,
  });
}

/**
 * Fetch the first location's id and name for display (e.g. in Settings).
 * Requires MERCHANT_PROFILE_READ.
 */
export async function getFirstLocation(
  accessToken: string,
  env: SquareEnvironment = 'sandbox'
): Promise<{ location_id: string; location_name: string } | null> {
  const client = createSquareClient(accessToken, env);

  try {
    const { result } = await client.locationsApi.listLocations();

    const location = result.locations?.[0];
    if (!location?.id) return null;

    return {
      location_id: location.id,
      location_name: location.name ?? 'Primary',
    };
  } catch {
    return null;
  }
}
