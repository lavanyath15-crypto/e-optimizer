import { useEffect, useState } from 'react';
import { getSession, getProfile } from '@backend/auth.js';

export interface Operator {
  name: string;
  email: string;
  initials: string;
}

/** "Test Operator" -> "TO", "Priya" -> "P", falls back to the email's first letter. */
function deriveInitials(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1) {
    return words[0][0].toUpperCase();
  }
  return email ? email[0].toUpperCase() : '';
}

/**
 * The signed-in operator, or null while loading and when Supabase is not
 * configured. Reads the session first because it is always present once signed
 * in; the profiles row only adds the name if schema.sql has been run.
 */
export function useOperator(): Operator | null {
  const [operator, setOperator] = useState<Operator | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const session = await getSession();
      if (!session || cancelled) return;

      const email = session.user.email ?? '';
      const profile = await getProfile();
      if (cancelled) return;

      const name =
        profile?.full_name?.trim() ||
        session.user.user_metadata?.full_name?.trim() ||
        '';

      setOperator({
        name: name || email.split('@')[0],
        email,
        initials: deriveInitials(name, email),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return operator;
}
