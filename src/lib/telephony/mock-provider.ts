import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallOutcome, Database } from '@/lib/database.types';
import type { PlaceCallInput, PlaceCallResult, TelephonyProvider } from './types';
import { generateMockWav } from './mock-audio';

const VOC_BUCKET = 'voc';

function pickWeighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/**
 * MockTelephonyProvider — simulates the PRD IVR call flow without any live
 * telephony. It picks a language (respecting skipMenuIfKnown/knownLanguage,
 * else a weighted default), simulates a "no input" language default, assigns
 * a weighted outcome, and generates a mock recording placed in the private
 * VOC Storage bucket. Requires a service-role Supabase client for the upload.
 */
export class MockTelephonyProvider implements TelephonyProvider {
  readonly name = 'mock';

  constructor(private readonly db: SupabaseClient<Database>) {}

  async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    const startedAt = new Date();

    // ---- Language selection ----
    let language: string;
    let languageDefaulted = false;
    let dtmfLangKey: string | null = null;

    const configLangs = input.languageConfig.length
      ? input.languageConfig
      : [
          { dtmf: '1', lang: 'hi' },
          { dtmf: '2', lang: 'en' },
        ];

    if (input.skipMenuIfKnown && input.knownLanguage) {
      // Menu skipped — play directly in the stored language.
      language = input.knownLanguage;
    } else {
      // ~12% of callers give no input -> fall back to campaign default.
      const noInput = Math.random() < 0.12;
      if (noInput) {
        language = input.defaultLanguage;
        languageDefaulted = true;
      } else {
        // Weighted toward the first configured language (usually Hindi).
        const weights = configLangs.map(
          (c, i) => [c, i === 0 ? 6 : 3] as [typeof c, number],
        );
        const chosen = pickWeighted(weights);
        language = chosen.lang;
        dtmfLangKey = chosen.dtmf;
      }
    }

    // ---- Outcome (weighted, per call type) ----
    let outcome: CallOutcome;
    let dtmf: string | null = dtmfLangKey;

    if (input.callType === 'order_confirmation') {
      // ~70% confirm (press 1), ~15% correction/problem (press 2),
      // ~15% no-answer / unreachable.
      outcome = pickWeighted<CallOutcome>([
        ['confirmed', 70],
        ['transferred_to_agent', 15],
        ['no_answer', 10],
        ['wrong_number', 5],
      ]);
    } else {
      // delivery_confirmation: ~72% confirmed, ~13% issue, ~15% unreachable.
      outcome = pickWeighted<CallOutcome>([
        ['confirmed', 72],
        ['issue_raised', 13],
        ['no_answer', 10],
        ['not_reachable', 5],
      ]);
    }

    const answered = outcome !== 'no_answer' && outcome !== 'not_reachable';

    // DTMF response mirrors the outcome for answered calls.
    if (answered) {
      if (outcome === 'confirmed') dtmf = '1';
      else if (outcome === 'transferred_to_agent' || outcome === 'issue_raised')
        dtmf = '2';
    } else {
      dtmf = null;
    }

    // Simulated call duration.
    const durationSeconds = answered
      ? 18 + Math.floor(Math.random() * 40)
      : 5 + Math.floor(Math.random() * 8);
    const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const providerCallRef = `mock_${startedAt.getTime()}_${Math.floor(
      Math.random() * 1e6,
    )
      .toString(36)
      .padStart(4, '0')}`;

    // ---- Recording (answered calls only; covers whole call) ----
    let recording: PlaceCallResult['recording'];
    if (answered) {
      const storagePath = `${input.campaignId}/${input.recipientId}/${input.callType}-${providerCallRef}.wav`;
      const wav = generateMockWav(durationSeconds);
      const { error } = await this.db.storage
        .from(VOC_BUCKET)
        .upload(storagePath, wav, {
          contentType: 'audio/wav',
          upsert: true,
        });
      if (!error) {
        recording = { storagePath, durationSeconds };
      }
    }

    return {
      providerCallRef,
      language,
      languageDefaulted,
      dtmfResponse: dtmf,
      outcome,
      recording,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
    };
  }
}
