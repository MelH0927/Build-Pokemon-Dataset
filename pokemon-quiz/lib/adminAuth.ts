// Centralized admin key validation with support for multiple keys
// ADMIN_KEY env can contain a single key or comma-separated list.

export function getAdminKeys(): string[] {
  const raw = process.env.ADMIN_KEY || 'pokemon-admin-2024';
  return raw
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
}

export function isValidAdminKey(input?: string | null): boolean {
  if (!input) return false;
  const provided = input.trim();
  return getAdminKeys().includes(provided);
}

export function adminAuthError() {
  return { error: 'Unauthorized - invalid admin key' };
}
