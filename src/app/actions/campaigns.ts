'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { LanguageConfigEntry } from '@/lib/database.types';

const campaignSchema = z.object({
  calling_from: z.string().min(1, 'Brand / Calling From is required'),
  order_reference: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  default_language: z.string().min(1),
});

export type ActionState = { error?: string; ok?: boolean };

export async function createCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = campaignSchema.safeParse({
    calling_from: formData.get('calling_from'),
    order_reference: formData.get('order_reference') || undefined,
    start_date: formData.get('start_date') || undefined,
    end_date: formData.get('end_date') || undefined,
    default_language: formData.get('default_language') || 'hi',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      calling_from: parsed.data.calling_from,
      order_reference: parsed.data.order_reference ?? null,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      default_language: parsed.data.default_language,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/campaigns');
  redirect(`/campaigns/${data!.id}`);
}

const langConfigSchema = z.object({
  campaignId: z.string().uuid(),
  default_language: z.string().min(1),
  retry_limit: z.number().int().min(0).max(10),
  skip_menu_if_known: z.boolean(),
  language_config: z
    .array(z.object({ dtmf: z.string().min(1), lang: z.string().min(1) }))
    .min(1, 'At least one language is required'),
});

export async function updateLanguageConfig(input: {
  campaignId: string;
  default_language: string;
  retry_limit: number;
  skip_menu_if_known: boolean;
  language_config: LanguageConfigEntry[];
}): Promise<ActionState> {
  await requireAdmin();
  const parsed = langConfigSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  // The default language must be one of the mapped languages.
  if (!parsed.data.language_config.some((c) => c.lang === parsed.data.default_language)) {
    return { error: 'Default language must be one of the mapped languages.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('campaigns')
    .update({
      default_language: parsed.data.default_language,
      retry_limit: parsed.data.retry_limit,
      skip_menu_if_known: parsed.data.skip_menu_if_known,
      language_config: parsed.data.language_config,
    })
    .eq('id', parsed.data.campaignId);

  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${parsed.data.campaignId}/language`);
  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  return { ok: true };
}
