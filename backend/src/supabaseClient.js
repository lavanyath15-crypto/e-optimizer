/**
 * The Supabase browser client.
 *
 * Both values are public by design and end up in the bundle. Row Level Security
 * in schema.sql is what protects the data, which is why the service_role key
 * must never appear here: it bypasses RLS entirely.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Shared so auth.js and recommend.js cannot drift on the wording. */
export const NOT_CONFIGURED_MESSAGE =
  'Authentication is not configured yet. See backend/README.md to connect a Supabase project.';

/**
 * True once backend/.env.local holds a real project URL and anon key.
 *
 * Checks the URL actually looks like one. A leftover placeholder from
 * .env.example is truthy, which would otherwise let the app believe it was
 * configured and fail later with a confusing network error instead of the
 * message above.
 */
export const isConfigured = Boolean(
  url && anonKey && /^https?:\/\//.test(url) && !url.includes('your-project-ref')
);

if (!isConfigured && import.meta.env.DEV) {
  console.warn(
    '[auth] Supabase is not configured. Copy backend/.env.example to ' +
      'backend/.env.local, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, ' +
      'then restart the dev server.'
  );
}

// Session is persisted in localStorage by the client and refreshed
// automatically, so a reload or a jump to /dashboard/ keeps the operator
// signed in.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'eoptimizer-auth',
      },
    })
  : null;
