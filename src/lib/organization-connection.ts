/**
 * Organization connection state: whether the app is "connected" to an organization.
 * When false, the app shows the initial screen (create new or connect to existing).
 * When true, normal flow (login or dashboard). Not persisted in DB—local to this device.
 */
const STORAGE_KEY = 'petshop_organization_connected';

export function getOrganizationConnected(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return true; // default: connected (backward compat)
    return v === 'true';
  } catch {
    return true;
  }
}

export function setOrganizationConnected(connected: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(connected));
  } catch {
    // ignore
  }
}

export function clearOrganizationConnection(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, 'false');
  } catch {
    // ignore
  }
}
