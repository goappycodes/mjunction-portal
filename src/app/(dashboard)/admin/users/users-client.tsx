'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, setUserRole, type UserActionState } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Badge } from '@/components/ui/primitives';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { FormSearchableSelect } from '@/components/ui/form-searchable-select';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import { formatDate } from '@/lib/utils';
import type { Profile, UserRole } from '@/lib/database.types';

export function NewUserForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<UserActionState, FormData>(createUser, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create user</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async (fd) => {
            await action(fd);
            router.refresh();
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="text" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <FormSearchableSelect
              id="role"
              name="role"
              defaultValue="telecaller"
              options={[
                { value: 'telecaller', label: 'Telecaller' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            {state.error && <p className="mb-2 text-sm text-[var(--danger)]">{state.error}</p>}
            {state.ok && <p className="mb-2 text-sm text-[var(--success)]">User created.</p>}
            <Button type="submit" loading={pending}>
              {pending ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function RoleControl({ user, selfId }: { user: Profile; selfId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [role, setRole] = useState<UserRole>(user.role);
  const isSelf = user.id === selfId;

  return (
    <div className="flex items-center gap-2">
      <SearchableSelect
        value={role}
        disabled={pending || isSelf}
        options={[
          { value: 'telecaller', label: 'Telecaller' },
          { value: 'admin', label: 'Admin' },
        ]}
        onChange={(v) => {
          const next = v as UserRole;
          setRole(next);
          start(async () => {
            await setUserRole(user.id, next);
            router.refresh();
          });
        }}
        className="h-8 w-32"
      />
      {pending && <Spinner size={14} className="text-[var(--muted)]" />}
    </div>
  );
}

export function UsersTable({ users, selfId }: { users: Profile[]; selfId: string }) {
  const columns = useMemo<Column<Profile>[]>(
    () => [
      {
        header: 'Name',
        cell: (u) => (
          <>
            <span className="font-medium">{u.full_name ?? '—'}</span>
            {u.id === selfId && (
              <Badge color="blue" className="ml-2">
                you
              </Badge>
            )}
          </>
        ),
      },
      { header: 'Role', cell: (u) => <RoleControl user={u} selfId={selfId} /> },
      {
        header: 'Created',
        className: 'text-xs text-[var(--muted)]',
        cell: (u) => formatDate(u.created_at),
      },
    ],
    [selfId],
  );

  return (
    <DataTable
      columns={columns}
      rows={users}
      rowKey={(u) => u.id}
      className="max-h-[calc(100vh-15rem)]"
      empty="No users match this filter."
    />
  );
}
