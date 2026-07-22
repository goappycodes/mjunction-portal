'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';

const TEST_ACCOUNTS = `# Admin
admin@mjunction.test / Admin@12345
mjunction@appycodes.com / Admin@12345
ops@mjunction.test / Admin@12345

# Telecaller
agent@mjunction.test / Agent@12345
agent2@mjunction.test / Agent@12345
agent3@mjunction.test / Agent@12345`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  function fill(role: 'admin' | 'telecaller') {
    if (role === 'admin') {
      setEmail('admin@mjunction.test');
      setPassword('Admin@12345');
    } else {
      setEmail('agent@mjunction.test');
      setPassword('Agent@12345');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-lg font-semibold">Gifting Fulfilment &amp; VOC</h1>
            <p className="text-sm text-[var(--muted)]">Admin Panel — sign in</p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>

        {/* Testing-only credentials */}
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Test accounts (testing only)
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => fill('admin')}
                className="rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)] hover:opacity-90"
              >
                Use admin
              </button>
              <button
                type="button"
                onClick={() => fill('telecaller')}
                className="rounded-md bg-[var(--muted-surface)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:opacity-90"
              >
                Use telecaller
              </button>
            </div>
          </div>
          <textarea
            readOnly
            aria-label="Test credentials"
            value={TEST_ACCOUNTS}
            onFocus={(e) => e.currentTarget.select()}
            rows={9}
            className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--muted-surface)] p-2.5 font-mono text-xs leading-relaxed text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]/40"
          />
          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
            Seeded demo credentials — remove this panel before production.
          </p>
        </div>
      </div>
    </div>
  );
}
