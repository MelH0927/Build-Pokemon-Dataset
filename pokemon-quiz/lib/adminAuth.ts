// Centralized admin key validation with support for multiple keys
// ADMIN_KEY env can contain a single key or comma-separated list.

// There is deliberately no fallback key: a missing ADMIN_KEY is a startup error
// (see instrumentation.ts), and admin endpoints fail closed if it is ever empty.

export function getAdminKeys(): string[] {
  const keys = (process.env.ADMIN_KEY ?? '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  if (keys.length === 0) {
    throw new Error('ADMIN_KEY environment variable is not set');
  }
  return keys;
}

export function isValidAdminKey(input?: string | null): boolean {
  if (!input) return false;
  const provided = input.trim();
  return getAdminKeys().includes(provided);
}

export function adminAuthError() {
  return { error: 'Unauthorized - invalid admin key' };
}
