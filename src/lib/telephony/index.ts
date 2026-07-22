import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { TelephonyProvider } from './types';
import { MockTelephonyProvider } from './mock-provider';

export type { TelephonyProvider, PlaceCallInput, PlaceCallResult } from './types';

/**
 * Provider factory — reads TELEPHONY_PROVIDER. When Exotel/MyOperator is
 * chosen, add its module here implementing TelephonyProvider. No UI or schema
 * change required (TECH_SPEC §8, §14).
 *
 * The service-role client is required because the provider uploads recordings
 * into the private VOC bucket.
 */
export function getTelephonyProvider(
  serviceClient: SupabaseClient<Database>,
): TelephonyProvider {
  const provider = process.env.TELEPHONY_PROVIDER ?? 'mock';
  switch (provider) {
    case 'mock':
      return new MockTelephonyProvider(serviceClient);
    // case 'exotel':
    //   return new ExotelProvider(serviceClient);
    default:
      return new MockTelephonyProvider(serviceClient);
  }
}
