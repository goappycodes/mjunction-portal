import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NewUserForm, UsersTable } from './users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users &amp; roles</h1>
        <p className="text-sm text-[var(--muted)]">
          Admins manage everything; telecallers handle escalations, retries and manual calls.
        </p>
      </div>
      <NewUserForm />
      <UsersTable users={users ?? []} selfId={admin.id} />
    </div>
  );
}
