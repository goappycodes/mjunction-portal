import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NewUserForm, UsersTable } from './users-client';
import { Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { PageHeader } from '@/components/page-header';
import type { UserRole } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  let query = supabase.from('profiles').select('*');
  if (sp.role === 'admin' || sp.role === 'telecaller') {
    query = query.eq('role', sp.role as UserRole);
  }
  if (sp.q) query = query.ilike('full_name', `%${sp.q}%`);
  const { data: users } = await query.order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & roles"
        description="Admins manage everything; telecallers handle escalations, retries and manual calls."
      />
      <NewUserForm />
      <FilterBar action="/admin/users" resetHref="/admin/users">
        <FilterField label="Search">
          <Input name="q" defaultValue={sp.q ?? ''} placeholder="Name" className="w-56" />
        </FilterField>
        <FilterField label="Role">
          <Select name="role" defaultValue={sp.role ?? ''} className="w-40">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="telecaller">Telecaller</option>
          </Select>
        </FilterField>
        <span className="self-center text-sm text-[var(--muted)]">{users?.length ?? 0} user(s)</span>
      </FilterBar>
      <UsersTable users={users ?? []} selfId={admin.id} />
    </div>
  );
}
