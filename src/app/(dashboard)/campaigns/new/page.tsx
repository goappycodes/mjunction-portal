import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getLanguages } from '@/lib/domain/languages';
import { NewCampaignForm } from './new-campaign-form';

export const dynamic = 'force-dynamic';

export default async function NewCampaignPage() {
  await requireAdmin();
  const supabase = await createClient();
  const languages = await getLanguages(supabase, true);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New campaign</h1>
        <p className="text-sm text-[var(--muted)]">
          Language config can be tuned in detail after creation.
        </p>
      </div>
      <NewCampaignForm languages={languages} />
    </div>
  );
}
