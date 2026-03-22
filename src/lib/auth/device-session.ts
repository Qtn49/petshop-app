/** Per-tenant device profile (UI / "remember this device" — not the security boundary; JWT cookie is). */

const PREFIX = 'petshop_session_';
export const DEVICE_SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

export type DeviceSessionPayload = {
  userId: string;
  userName: string;
  organizationId: string;
  slug: string;
  savedAt: string;
};

export function deviceSessionKey(slug: string): string {
  return `${PREFIX}${slug.trim().toLowerCase()}`;
}

export function readDeviceSession(slug: string): DeviceSessionPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(deviceSessionKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceSessionPayload;
    if (!parsed?.savedAt || !parsed.userId) return null;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (age > DEVICE_SESSION_MAX_MS) {
      localStorage.removeItem(deviceSessionKey(slug));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDeviceSession(slug: string, payload: Omit<DeviceSessionPayload, 'savedAt'> & { savedAt?: string }): void {
  if (typeof window === 'undefined') return;
  const full: DeviceSessionPayload = {
    ...payload,
    savedAt: payload.savedAt ?? new Date().toISOString(),
  };
  localStorage.setItem(deviceSessionKey(slug), JSON.stringify(full));
}

export function clearDeviceSession(slug: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(deviceSessionKey(slug));
  } catch {
    // ignore
  }
}
