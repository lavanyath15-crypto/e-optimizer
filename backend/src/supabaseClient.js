import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True once backend/.env.local holds a real project URL and anon key. */
export const isConfigured = Boolean(url && anonKey);

if (!isConfigured) {
  console.warn(
    '[auth] Supabase is not configured. Copy backend/.env.example to ' +
      'backend/.env.local, fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, ' +
      'then restart the dev server.'
  );
}

// Session is persisted in localStorage by the client and refreshed automatically,
// so a reload or a jump to /dashboard/ keeps the operator signed in.
export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'eoptimizer-auth',
      },
    })
  : null;
