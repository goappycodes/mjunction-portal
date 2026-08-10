'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getTelephonyProvider } from '@/lib/telephony';
import {
  recordOrderConfirmationCall,
  recordDeliveryConfirmationCall,
} from '@/lib/domain/call-flow';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import type { CallType, Campaign, Recipient, RecipientStatus } from '@/lib/database.types';

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

/**
 * Run the delivery-confirmation IVR call for a single recipient awaiting it
 * (`delivery_confirm_pending` / `delivery_unreachable`) and return the resulting
 * status so the caller can patch just that row. This is the factor that moves a
 * recipient out of "Delivery Confirm Pending": press 1 → confirmed (VOC sealed),
 * press 2 → issue raised, no answer → delivery unreachable. No revalidatePath so
 * the recipients list is not re-rendered — the row is updated client-side.
 */
export async function runDeliveryConfirmation(
  recipientId: string,
): Promise<{ status?: RecipientStatus; error?: string }> {
  const user = await requireUser();
  const service = createServiceClient();
  const provider = getTelephonyProvider(service);

  const { data: r } = await service.from('recipients').select('*').eq('id', recipientId).single();
  if (!r) return { error: 'Recipient not found' };
  if (!DELIVERY_CALLABLE.includes(r.status)) {
    return { error: 'Recipient is not awaiting delivery confirmation' };
  }

  const { data: campaign } = await service
    .from('campaigns')
    .select('*')
    .eq('id', r.campaign_id)
    .single();
  if (!campaign) return { error: 'Campaign not found' };

  const attemptNumber = await nextAttemptNumber(service, r.id, 'delivery_confirmation');
  const callResult = await provider.placeCall({
    recipientId: r.id,
    campaignId: campaign.id,
    callType: 'delivery_confirmation',
    languageConfig: (campaign as Campaign).language_config,
    defaultLanguage: campaign.default_language,
    retryLimit: campaign.retry_limit,
    skipMenuIfKnown: campaign.skip_menu_if_known,
    knownLanguage: r.preferred_language,
    productName: r.product_name,
  });

  const rec = await recordDeliveryConfirmationCall(
    service,
    r as Recipient,
    campaign as Campaign,
    callResult,
    attemptNumber,
    { actorType: user.role === 'telecaller' ? 'agent' : 'ivr', actorId: user.id },
  );

  return { status: rec.statusTo };
}
