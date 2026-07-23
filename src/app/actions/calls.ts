'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getTelephonyProvider } from '@/lib/telephony';
import {
  recordOrderConfirmationCall,
  recordDeliveryConfirmationCall,
} from '@/lib/domain/call-flow';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import type { CallType, Campaign, Recipient } from '@/lib/database.types';

export interface BatchResult {
  error?: string;
  placed: number;
  confirmed: number;
  escalated: number;
  unreachable: number;
}

async function nextAttemptNumber(
  service: ReturnType<typeof createServiceClient>,
  recipientId: string,
  callType: CallType,
): Promise<number> {
  const { count } = await service
    .from('call_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .eq('call_type', callType);
  return (count ?? 0) + 1;
}

/**
 * Run a (mock) call batch for a campaign. Admin-launched. Processes every
 * eligible recipient through the TelephonyProvider and records outcomes,
 * languages, VOC sealing and status transitions.
 */
export async function runCallBatch(input: {
  campaignId: string;
  callType: CallType;
  recipientIds?: string[];
}): Promise<BatchResult> {
  await requireAdmin();
  const service = createServiceClient();
  const provider = getTelephonyProvider(service);

  const { data: campaign } = await service
    .from('campaigns')
    .select('*')
    .eq('id', input.campaignId)
    .single();
  if (!campaign) return { error: 'Campaign not found', placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };

  const eligibleStatuses =
    input.callType === 'order_confirmation' ? ORDER_CALLABLE : DELIVERY_CALLABLE;

  let q = service
    .from('recipients')
    .select('*')
    .eq('campaign_id', input.campaignId)
    .in('status', eligibleStatuses);
  if (input.recipientIds?.length) q = q.in('id', input.recipientIds);

  const { data: recipients } = await q;
  const list = (recipients ?? []) as Recipient[];

  const result: BatchResult = { placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };

  for (const r of list) {
    const attemptNumber = await nextAttemptNumber(service, r.id, input.callType);
    const callResult = await provider.placeCall({
      recipientId: r.id,
      campaignId: campaign.id,
      callType: input.callType,
      languageConfig: (campaign as Campaign).language_config,
      defaultLanguage: campaign.default_language,
      retryLimit: campaign.retry_limit,
      skipMenuIfKnown: campaign.skip_menu_if_known,
      knownLanguage: r.preferred_language,
      productName: r.product_name,
    });

    if (input.callType === 'order_confirmation') {
      await recordOrderConfirmationCall(service, r, campaign as Campaign, callResult, attemptNumber, {
        actorType: 'ivr',
      });
      if (callResult.outcome === 'confirmed') result.confirmed++;
      else if (callResult.outcome === 'transferred_to_agent') result.escalated++;
      else result.unreachable++;
    } else {
      await recordDeliveryConfirmationCall(service, r, campaign as Campaign, callResult, attemptNumber, {
        actorType: 'ivr',
      });
      if (callResult.outcome === 'confirmed') result.confirmed++;
      else if (callResult.outcome === 'issue_raised') result.escalated++;
      else result.unreachable++;
    }
    result.placed++;
  }

  revalidatePath(`/campaigns/${input.campaignId}`, 'layout');
  revalidatePath('/recipients');
  revalidatePath('/queue/escalations');
  revalidatePath('/queue/unreachable');
  return result;
}

/**
 * Retry a single unreachable recipient (telecaller or admin). Re-runs the
 * appropriate IVR call based on current status.
 */
export async function retryCall(recipientId: string): Promise<BatchResult> {
  const user = await requireUser();
  const service = createServiceClient();
  const provider = getTelephonyProvider(service);

  const { data: r } = await service.from('recipients').select('*').eq('id', recipientId).single();
  if (!r) return { error: 'Recipient not found', placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };

  const callType: CallType =
    r.status === 'order_unreachable' || ORDER_CALLABLE.includes(r.status)
      ? 'order_confirmation'
      : 'delivery_confirmation';

  const { data: campaign } = await service.from('campaigns').select('*').eq('id', r.campaign_id).single();
  if (!campaign) return { error: 'Campaign not found', placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };

  const attemptNumber = await nextAttemptNumber(service, r.id, callType);
  const callResult = await provider.placeCall({
    recipientId: r.id,
    campaignId: campaign.id,
    callType,
    languageConfig: (campaign as Campaign).language_config,
    defaultLanguage: campaign.default_language,
    retryLimit: campaign.retry_limit,
    skipMenuIfKnown: campaign.skip_menu_if_known,
    knownLanguage: r.preferred_language,
    productName: r.product_name,
  });

  const ctx = {
    actorType: user.role === 'telecaller' ? ('agent' as const) : ('ivr' as const),
    actorId: user.id,
  };
  if (callType === 'order_confirmation') {
    await recordOrderConfirmationCall(service, r as Recipient, campaign as Campaign, callResult, attemptNumber, ctx);
  } else {
    await recordDeliveryConfirmationCall(service, r as Recipient, campaign as Campaign, callResult, attemptNumber, ctx);
  }

  revalidatePath(`/recipients/${recipientId}`);
  revalidatePath('/recipients');
  revalidatePath('/queue/unreachable');
  revalidatePath(`/campaigns/${r.campaign_id}`, 'layout');
  return { placed: 1, confirmed: 0, escalated: 0, unreachable: 0 };
}
