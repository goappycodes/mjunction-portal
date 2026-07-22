import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguages } from '@/lib/domain/languages';
import { getCampaign } from '@/lib/domain/campaigns';
import { LanguageConfigForm } from './language-config-form';

export const dynamic = 'force-dynamic';

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireAdmin();
  const supabase = await createClient();

  const [campaign, languages] = await Promise.all([
    getCampaign(campaignId),
    getLanguages(supabase, true),
  ]);

  if (!campaign) notFound();

  return (
    <div className="max-w-2xl">
      <LanguageConfigForm campaign={campaign} languages={languages} />
    </div>
  );
}
