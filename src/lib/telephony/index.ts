import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { PlaceCallInput, PlaceCallResult, TelephonyProvider } from './types';
import { MockTelephonyProvider } from './mock-provider';

export type { TelephonyProvider, PlaceCallInput, PlaceCallResult } from './types';

/**
 * A real Exotel call is asynchronous (dial, then Gather/StatusCallback over
 * the life of the call) and is placed via the separate IVR engine service,
 * not via this synchronous placeCall() contract — see
 * src/lib/telephony/ivr-engine-client.ts's triggerOrderConfirmationCall and
 * src/app/actions/calls.ts's startOrderConfirmationCall, which call it
 * directly. This class exists only so TELEPHONY_PROVIDER=exotel doesn't
 * silently fall back to the mock for call types the IVR engine doesn't
 * support yet (delivery confirmation).
 */
class ExotelProvider implements TelephonyProvider {
  readonly name = 'exotel';
  async placeCall(_input: PlaceCallInput): Promise<PlaceCallResult> {
    throw new Error(
      'ExotelProvider.placeCall is not implemented — real order-confirmation calls go through ' +
        'triggerOrderConfirmationCall()/startOrderConfirmationCall() instead, since a real call ' +
        "does not resolve synchronously. Delivery-confirmation calls aren't supported by the IVR " +
        'engine yet; set TELEPHONY_PROVIDER=mock to use those in the meantime.',
    );
  }
}

/**
 * Provider factory — reads TELEPHONY_PROVIDER. The service-role client is
 * required because the mock provider uploads recordings into the private
 * VOC bucket.
 */
export function getTelephonyProvider(
  serviceClient: SupabaseClient<Database>,
): TelephonyProvider {
  const provider = process.env.TELEPHONY_PROVIDER ?? 'mock';
  switch (provider) {
    case 'mock':
      return new MockTelephonyProvider(serviceClient);
    case 'exotel':
      return new ExotelProvider();
    default:
      return new MockTelephonyProvider(serviceClient);
  }
}
