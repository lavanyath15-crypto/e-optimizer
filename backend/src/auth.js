/**
 * Auth API for the E-Optimizer frontend.
 *
 * Every function returns { data, error } where error is a plain string ready to
 * show the operator, or null on success. Nothing here throws.
 */

import { supabase, isConfigured } from './supabaseClient.js';

const NOT_CONFIGURED =
  'Authentication is not configured yet. See backend/README.md to connect a Supabase project.';

/** Turn a Supabase error into something an operator can act on. */
function readableError(error) {
  const message = error?.message ?? 'Something went wrong. Try again.';

  if (/invalid login credentials/i.test(message)) {
    return 'That email and password combination is not recognised.';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Check your inbox and confirm your email address before signing in.';
  }
  if (/user already registered|already been registered/i.test(message)) {
    return 'An account with that email already exists. Sign in instead.';
  }
  if (/password should be at least/i.test(message)) {
    return 'Password must be at least 6 characters.';
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Cannot reach the authentication service. Check your connection.';
  }
  return message;
}

/** Create an account. The password is hashed by Supabase, never stored here. */
export async function signUp({ email, password, fullName }) {
  if (!isConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName ?? '' } },
  });

  if (error) return { data: null, error: readableError(error) };

  // With email confirmation enabled, signUp returns a user but no session.
  if (!data.session) {
    return {
      data,
      error: null,
      needsEmailConfirmation: true,
    };
  }
  return { data, error: null, needsEmailConfirmation: false };
}

/** Verify credentials against the stored hash and open a session. */
export async function signIn({ email, password }) {
  if (!isConfigured) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: readableError(error) };
  return { data, error: null };
}

/** End the session and clear the stored token. */
export async function signOut() {
  if (!isConfigured) return { error: null };

  const { error } = await supabase.auth.signOut();
  return { error: error ? readableError(error) : null };
}

/** Current session, or null when signed out. */
export async function getSession() {
  if (!isConfigured) return null;

  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** The signed-in operator's profile row, or null. */
export async function getProfile() {
  if (!isConfigured) return null;

  const session = await getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, plant_id')
    .eq('id', session.user.id)
    .single();

  if (error) return null;
  return data;
}

/**
 * Route guard. Call at the top of a protected page: if there is no session it
 * sends the browser to the login page and resolves false.
 *
 * When Supabase is not configured this returns true so the dashboard stays
 * reachable during local UI work.
 */
export async function requireSession(redirectTo = '/login.html') {
  if (!isConfigured) return true;

  const session = await getSession();
  if (!session) {
    window.location.replace(redirectTo);
    return false;
  }
  return true;
}
