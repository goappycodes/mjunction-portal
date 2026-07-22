import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * User-scoped server client (RLS-enforced). Use in Server Components and
 * Server Actions for all reads/writes performed on the acting user's behalf.
 * Authorization is verified with getUser() — never trust getSession().
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, PUBLIC_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; session refresh
          // is handled by proxy.ts.
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS. Server-only. Use ONLY for privileged
 * operations that legitimately need it: creating users, generating signed
 * URLs for the private VOC bucket, and the mock provider writing recordings.
 * Never import this into client code.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
