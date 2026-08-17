// Thin trigger for the real Exotel-backed IVR engine (separate Supabase
// Functions project). A real call is asynchronous — the engine itself owns
// writing call_attempts/recipients.status/recipient_events as the call
// progresses (see mjunction-ivr-engine's _shared/orders.ts) — so this only
// starts the call and returns; it does not wait for or synthesize an
// outcome the way MockTelephonyProvider does.
import type { CallType, Recipient } from '@/lib/database.types';

export interface IvrEngineCallResult {
  callSid: string;
  status: string;
}

/**
 * Trigger a real IVR call for this recipient.
 *
 * Both call types run through the same endpoint, the same Exotel app and the
 * same Exotel flow — `callType` only tells the engine which script to read
 * over that flow (see the IVR engine's `_shared/flow.ts`). The engine
 * re-validates the recipient's status against the call type and returns 409 if
 * it doesn't fit, so this is not the only guard.
 */
export async function triggerIvrCall(
  recipient: Pick<Recipient, 'unique_id' | 'contact_no_e164'>,
  callType: CallType,
): Promise<IvrEngineCallResult> {
  const baseUrl = process.env.IVR_ENGINE_URL;
  const secret = process.env.IVR_SHARED_SECRET;
  if (!baseUrl || !secret) {
    throw new Error('IVR_ENGINE_URL / IVR_SHARED_SECRET not configured');
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/ivr-engine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ivr-shared-secret': secret,
    },
    body: JSON.stringify({ orderId: recipient.unique_id, callType }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? `IVR engine returned ${res.status}`);
  }
  return { callSid: body.callSid, status: body.status };
}

/** Trigger a real order-confirmation call for this recipient via the IVR engine. */
export function triggerOrderConfirmationCall(
  recipient: Pick<Recipient, 'unique_id' | 'contact_no_e164'>,
): Promise<IvrEngineCallResult> {
  return triggerIvrCall(recipient, 'order_confirmation');
}

/** Trigger a real delivery-confirmation call for this recipient via the IVR engine. */
export function triggerDeliveryConfirmationCall(
  recipient: Pick<Recipient, 'unique_id' | 'contact_no_e164'>,
): Promise<IvrEngineCallResult> {
  return triggerIvrCall(recipient, 'delivery_confirmation');
}
