import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { RecipientCallsView } from './recipient-calls-view';

export const dynamic = 'force-dynamic';

export default async function RecipientsHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    campaign?: string;
    q?: string;
    status?: string;
    lang?: string;
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
      <RecipientCallsView campaignId={sp.campaign} isAdmin={user.role === 'admin'} sp={sp} />
    </div>
  );
}
