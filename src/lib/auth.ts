/**
 * PIN-gate primitives, shared by the proxy, the auth routes, and their tests.
 * Deliberately dependency-free (no db, no server-only) so src/proxy.ts can
 * import it. The cookie value derivation is mirrored in e2e/helpers.mjs
 * (authCookieValue) — keep the two in sync.
 */

export const AUTH_COOKIE = "nt_auth";
export const TOUR_COOKIE = "nt_tour";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365;

export function appPin(): string {
  return process.env.APP_PIN ?? "1234";
}

/** SHA-256 hex of a domain-separated PIN string, via Web Crypto. */
export async function expectedAuthToken(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`natalietrainer:v1:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
