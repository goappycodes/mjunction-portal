import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { VaultView } from './vault-view';

export const dynamic = 'force-dynamic';

export default async function VocReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    campaign?: string;
    q?: string;
    status?: string;
    telecaller?: string;
    recipientId?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="VOC & Reports"
        description="Sealed VOC recordings and the client report, in one place. All campaigns by default — filter to narrow down."
      />
      <VaultView campaignId={sp.campaign} sp={sp} />
    </div>
  );
}
