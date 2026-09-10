/** Type declarations for auth.js, consumed by the TypeScript dashboard. */

export interface AuthProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  plant_id: string | null;
}

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
}

export function signUp(credentials: {
  email: string;
  password: string;
  fullName?: string;
}): Promise<{ data: unknown; error: string | null; needsEmailConfirmation?: boolean }>;

export function signIn(credentials: {
  email: string;
  password: string;
}): Promise<{ data: unknown; error: string | null }>;

export function signOut(): Promise<{ error: string | null }>;

export function getSession(): Promise<AuthSession | null>;

export function getProfile(): Promise<AuthProfile | null>;

export function requireSession(redirectTo?: string): Promise<boolean>;
