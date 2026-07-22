'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUser, setUserRole, type UserActionState } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Badge } from '@/components/ui/primitives';
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
            <Select id="role" name="role" defaultValue="telecaller">
              <option value="telecaller">Telecaller</option>
              <option value="admin">Admin</option>
            </Select>
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
    <Select
      value={role}
      disabled={pending || isSelf}
      onChange={(e) => {
        const next = e.target.value as UserRole;
        setRole(next);
        start(async () => {
          await setUserRole(user.id, next);
          router.refresh();
        });
      }}
      className="h-8 w-32"
    >
      <option value="telecaller">Telecaller</option>
      <option value="admin">Admin</option>
    </Select>
  );
}

export function UsersTable({ users, selfId }: { users: Profile[]; selfId: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--muted-surface)] text-left text-[var(--muted)]">
          <tr>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-2.5">
                <span className="font-medium">{u.full_name ?? '—'}</span>
                {u.id === selfId && <Badge color="blue" className="ml-2">you</Badge>}
              </td>
              <td className="px-4 py-2.5">
                <RoleControl user={u} selfId={selfId} />
              </td>
              <td className="px-4 py-2.5 text-xs text-[var(--muted)]">{formatDate(u.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
