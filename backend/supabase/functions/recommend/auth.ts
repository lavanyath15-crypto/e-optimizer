/**
 * Proves the caller is a signed-in operator, not just someone holding the
 * publishable key.
 *
 * Supabase's own gateway checks that the Authorization header carries a valid
 * JWT, but the anon key IS a valid JWT. It ships in the browser bundle and is
 * public by design, so that check alone lets anyone on the internet call this
 * endpoint and spend the project's LLM quota. Exchanging the token for a user is
 * what actually distinguishes an operator from a stranger with the key.
 *
 * Verified against Supabase's auth API rather than by decoding the JWT locally:
 * it costs one request but respects revocation, which signature checking alone
 * does not.
 */

import { ApiError } from '../_shared/http.ts';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

export async function requireUser(req: Request): Promise<AuthenticatedUser> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    throw new ApiError(401, 'Sign in to use the assistant.', { code: 'no_token' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    // Both are injected into every Edge Function by the platform, so this only
    // fires on a broken local setup. Failing closed is the right call either
    // way: never let a config gap turn into an open endpoint.
    throw new ApiError(500, 'Authentication is not configured.', {
      code: 'auth_misconfigured',
      internal: 'SUPABASE_URL or SUPABASE_ANON_KEY missing from the function environment',
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      signal: controller.signal,
    });

    if (!res.ok) {
      // Covers the anon key, an expired session and a signed-out user alike.
      throw new ApiError(401, 'Your session has expired. Sign in again.', {
        code: 'invalid_token',
        internal: `auth/v1/user returned ${res.status}`,
      });
    }

    const user = await res.json();
    if (!user?.id) {
      throw new ApiError(401, 'Sign in to use the assistant.', { code: 'no_user' });
    }

    return { id: user.id, email: user.email ?? null };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, 'Could not verify your session. Try again.', {
      code: 'auth_unreachable',
      internal: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
  }
}
