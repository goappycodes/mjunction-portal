import { requireUser } from '@/lib/auth';
import { Nav } from '@/components/nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen">
      <Nav
        role={user.role}
        fullName={user.profile.full_name}
        email={user.email}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
