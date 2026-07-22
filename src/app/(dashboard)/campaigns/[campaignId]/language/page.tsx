import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguages } from '@/lib/domain/languages';
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

  const [{ data: campaign }, languages] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    getLanguages(supabase, true),
  ]);

  if (!campaign) notFound();

  return (
    <div className="max-w-2xl">
      <LanguageConfigForm campaign={campaign} languages={languages} />
    </div>
  );
}
