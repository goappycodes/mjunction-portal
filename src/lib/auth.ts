import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, UserRole } from '@/lib/database.types';

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile;
  role: UserRole;
}

/**
 * Verified session user. Uses getUser() (revalidates with the auth server) —
 * never getSession(). Returns null when unauthenticated.
 *
 * Wrapped in React cache() so the layout and the page in a single request
 * share ONE getUser() + profile lookup instead of repeating them (this removes
 * 2+ redundant Supabase round-trips per navigation).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    profile,
    role: profile.role,
  };
});

/** Require any authenticated user; redirect to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Require an admin; redirect telecallers to the dashboard home. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}
