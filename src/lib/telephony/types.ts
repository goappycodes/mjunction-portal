// The decoupling contract (TECH_SPEC §8). All calling goes through this
// interface. Today only the mock exists; Exotel/MyOperator implement the same
// contract later with no UI, schema, RLS or reporting changes.

import type { CallOutcome, CallType, LanguageConfigEntry } from '@/lib/database.types';

export interface PlaceCallInput {
  recipientId: string;
  campaignId: string;
  callType: CallType;
  languageConfig: LanguageConfigEntry[];
  defaultLanguage: string;
  retryLimit: number;
  skipMenuIfKnown: boolean;
  knownLanguage?: string | null;
  /** Context used to build a realistic mock recording / metadata. */
  productName?: string | null;
}

export interface PlaceCallResult {
  providerCallRef: string;
  language: string; // chosen or defaulted
  languageDefaulted: boolean;
  dtmfResponse: string | null;
  outcome: CallOutcome;
  recording?: { storagePath: string; durationSeconds: number };
  startedAt: string;
  endedAt: string;
}

export interface TelephonyProvider {
  readonly name: string;
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
}
