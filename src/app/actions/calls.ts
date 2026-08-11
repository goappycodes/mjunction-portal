'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { getTelephonyProvider } from '@/lib/telephony';
import { triggerOrderConfirmationCall } from '@/lib/telephony/ivr-engine-client';
import {
  recordOrderConfirmationCall,
  recordDeliveryConfirmationCall,
} from '@/lib/domain/call-flow';
import { ORDER_CALLABLE, DELIVERY_CALLABLE } from '@/lib/domain/status';
import type { CallType, Campaign, Recipient, RecipientStatus } from '@/lib/database.types';

const USE_REAL_EXOTEL = process.env.TELEPHONY_PROVIDER === 'exotel';

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
 * Trigger a real order-confirmation call via the IVR engine for a recipient
 * in an order-callable state (fresh import, still pending, or previously
 * unreachable). Unlike the mock path, this does not write call_attempts or
 * transition status itself — the IVR engine owns both once the call is
 * placed, since a real call is asynchronous (see ivr-engine-client.ts).
 */
export async function startOrderConfirmationCall(
  recipientId: string,
): Promise<{ error?: string; callSid?: string }> {
  await requireUser();
  const service = createServiceClient();

  const { data: r } = await service.from('recipients').select('*').eq('id', recipientId).single();
  if (!r) return { error: 'Recipient not found' };
  if (!ORDER_CALLABLE.includes(r.status)) {
    return { error: 'Recipient is not awaiting order confirmation' };
  }
  if (!r.contact_no_e164) return { error: 'Recipient has no phone number' };

  if (!USE_REAL_EXOTEL) {
    return { error: 'TELEPHONY_PROVIDER is not set to exotel — use Retry call (mock) instead' };
  }

  try {
    const result = await triggerOrderConfirmationCall(r as Recipient);
    revalidatePath(`/recipients/${recipientId}`);
    revalidatePath('/recipients');
    revalidatePath(`/campaigns/${r.campaign_id}`, 'layout');
    return { callSid: result.callSid };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Retry a single unreachable recipient (telecaller or admin). Re-runs the
 * appropriate IVR call based on current status.
 */
export async function retryCall(recipientId: string): Promise<BatchResult> {
  const user = await requireUser();
  const service = createServiceClient();

  const { data: r } = await service.from('recipients').select('*').eq('id', recipientId).single();
  if (!r) return { error: 'Recipient not found', placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };

  const callType: CallType =
    r.status === 'order_unreachable' || ORDER_CALLABLE.includes(r.status)
      ? 'order_confirmation'
      : 'delivery_confirmation';

  // A real order-confirmation call is triggered via the IVR engine and is
  // asynchronous — it does not return a BatchResult synchronously the way
  // the mock path below does, since the outcome isn't known yet.
  if (callType === 'order_confirmation' && USE_REAL_EXOTEL) {
    if (!r.contact_no_e164) {
      return { error: 'Recipient has no phone number', placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };
    }
    try {
      await triggerOrderConfirmationCall(r as Recipient);
    } catch (e) {
      return { error: (e as Error).message, placed: 0, confirmed: 0, escalated: 0, unreachable: 0 };
    }
    revalidatePath(`/recipients/${recipientId}`);
    revalidatePath('/recipients');
    revalidatePath('/queue/unreachable');
    revalidatePath(`/campaigns/${r.campaign_id}`, 'layout');
    return { placed: 1, confirmed: 0, escalated: 0, unreachable: 0 };
  }

  const provider = getTelephonyProvider(service);

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
