'use client';

/** Clear working session only — device stays registered. */
export async function switchUserSession(slug: string): Promise<void> {
  const s = slug.trim().toLowerCase();
  await fetch('/api/auth/session', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ slug: s, sessionOnly: true }),
  });
  window.location.href = `/${s}/select-user`;
}

/** Full device sign-out: clears device + session + legacy cookies and ps_last_slug. */
export async function signOutFromDevice(slug: string): Promise<void> {
  const s = slug.trim().toLowerCase();
  await fetch('/api/auth/session', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ slug: s }),
  });
  try {
    localStorage.removeItem('ps_last_slug');
  } catch {
    // ignore
  }
  window.location.href = '/';
}
