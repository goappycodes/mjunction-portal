import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface NormalizedPhone {
  raw: string;
  e164: string | null;
  valid: boolean;
}

/** Normalise a raw contact number to E.164, defaulting to India (IN). */
export function normalizePhone(raw: string | null | undefined): NormalizedPhone {
  const trimmed = (raw ?? '').toString().trim();
  if (!trimmed) return { raw: '', e164: null, valid: false };

  const cleaned = trimmed.replace(/[^\d+]/g, '');
  const parsed = parsePhoneNumberFromString(cleaned, 'IN');
  if (parsed && parsed.isValid()) {
    return { raw: trimmed, e164: parsed.number, valid: true };
  }
  return { raw: trimmed, e164: null, valid: false };
}
