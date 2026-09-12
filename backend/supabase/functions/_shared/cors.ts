/**
 * CORS, restricted to origins we actually serve from.
 *
 * This used to be `Access-Control-Allow-Origin: *`. Combined with an endpoint
 * that spends real LLM quota, that let any page on the internet call it from a
 * visitor's browser. The allowlist is configuration rather than a constant so a
 * new deploy preview does not need a code change.
 *
 * Set ALLOWED_ORIGINS as a comma-separated list:
 *   supabase secrets set ALLOWED_ORIGINS="https://e-optimizer-lava.netlify.app"
 */

const DEFAULT_ALLOWED_ORIGINS = [
  'https://e-optimizer-lava.netlify.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  // The response varies by request Origin, so shared caches must not reuse one
  // origin's response for another.
  Vary: 'Origin',
};

/**
 * Headers for a request from `origin`.
 *
 * An origin that is not on the list simply gets no Allow-Origin header, which
 * the browser then blocks. Requests without an Origin header at all (server to
 * server, curl) are unaffected, since CORS is a browser mechanism.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && allowedOrigins().includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin };
  }
  return { ...BASE_HEADERS };
}

export function isPreflight(req: Request): boolean {
  return req.method === 'OPTIONS';
}
