import { requireAdmin } from '@/lib/auth';
import { ImportWizard } from './import-wizard';

export const dynamic = 'force-dynamic';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireAdmin();
  return <ImportWizard campaignId={campaignId} />;
}
