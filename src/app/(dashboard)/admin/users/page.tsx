import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { NewUserForm, UsersTable } from './users-client';
import { Input, Select } from '@/components/ui/primitives';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { Pagination } from '@/components/ui/pagination';
import { PageHeader } from '@/components/page-header';
import { buildQuery } from '@/lib/utils';
import type { UserRole } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 15;
const BASE = '/admin/users';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase.from('profiles').select('*', { count: 'exact' });
  if (sp.role === 'admin' || sp.role === 'telecaller') {
    query = query.eq('role', sp.role as UserRole);
  }
  if (sp.q) query = query.ilike('full_name', `%${sp.q}%`);
  const { data: users, count } = await query
    .order('created_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <span className="self-center text-sm text-[var(--muted)]">{total} user(s)</span>
      </FilterBar>
      <UsersTable users={users ?? []} selfId={admin.id} />
      <Pagination
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => buildQuery(BASE, { role: sp.role, q: sp.q, page: p })}
      />
    </div>
  );
}
