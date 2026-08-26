import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { RecipientCallsView } from './recipient-calls-view';

export const dynamic = 'force-dynamic';

export default async function RecipientsHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    telecaller?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipients"
        description="Recipient pipeline, calls and dispatch — all in one place."
      />
      <RecipientCallsView isAdmin={user.role === 'admin'} sp={sp} />
    </div>
  );
}
