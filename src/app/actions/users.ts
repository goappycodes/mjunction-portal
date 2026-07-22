'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/database.types';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'telecaller']),
});

export type UserActionState = { error?: string; ok?: boolean };

/** Admin creates a new user with a role. Uses the service-role admin API. */
export async function createUser(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name, role: parsed.data.role },
  });
  if (error) return { error: error.message };

  // Ensure the profile row reflects the chosen role (trigger also sets it).
  if (data.user) {
    await service
      .from('profiles')
      .upsert({ id: data.user.id, full_name: parsed.data.full_name, role: parsed.data.role });
  }

  revalidatePath('/admin/users');
  return { ok: true };
}

/** Admin changes a user's role. */
export async function setUserRole(userId: string, role: UserRole): Promise<UserActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) return { error: error.message };
  revalidatePath('/admin/users');
  return { ok: true };
}
