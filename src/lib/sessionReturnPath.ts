/**
 * When user disconnects (Square or organization) or logs out, we save the path they should return to after reconnecting/logging in.
 */

const KEY_LAST_PATH = 'petshop_last_path';
const KEY_RETURN_AFTER_SQUARE = 'petshop_return_after_square';
const KEY_RETURN_AFTER_ORG = 'petshop_return_after_org';

export function saveLastPath(path: string): void {
  if (typeof window === 'undefined' || !path || path === '/') return;
  try {
    localStorage.setItem(KEY_LAST_PATH, path);
  } catch {
    // ignore
  }
}

export function getLastPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(KEY_LAST_PATH);
  } catch {
    return null;
  }
}

/** Call when user disconnects Square; they will be redirected here after reconnecting. */
export function setReturnPathAfterSquareConnect(): void {
  try {
    const path = getLastPath();
    if (path) localStorage.setItem(KEY_RETURN_AFTER_SQUARE, path);
  } catch {
    // ignore
  }
}

/** Call when user disconnects organization; they will be redirected here after logging in again. */
export function setReturnPathAfterOrgReconnect(): void {
  try {
    const path = getLastPath();
    if (path) localStorage.setItem(KEY_RETURN_AFTER_ORG, path);
  } catch {
    // ignore
  }
}

/** Save current page for redirect after next login (e.g. on logout). */
export function setReturnPathAfterLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    const path = window.location.pathname + window.location.search;
    if (path && path !== '/' && !path.startsWith('/login')) {
      localStorage.setItem(KEY_RETURN_AFTER_ORG, path);
    }
  } catch {
    // ignore
  }
}

export function getAndClearReturnPathAfterSquare(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = localStorage.getItem(KEY_RETURN_AFTER_SQUARE);
    if (path) localStorage.removeItem(KEY_RETURN_AFTER_SQUARE);
    return path;
  } catch {
    return null;
  }
}

export function getAndClearReturnPathAfterOrg(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = localStorage.getItem(KEY_RETURN_AFTER_ORG);
    if (path) localStorage.removeItem(KEY_RETURN_AFTER_ORG);
    return path;
  } catch {
    return null;
  }
}
