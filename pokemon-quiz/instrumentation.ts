// Runs once when the Next.js server starts (not during `next build`).
// Refuse to start without an admin key so the dashboard is never protected
// by a guessable default.
export function register() {
  const keys = (process.env.ADMIN_KEY ?? '').split(',').map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error(
      'ADMIN_KEY environment variable is not set. Set it (comma-separated for multiple keys) before starting the server.'
    );
  }
}
