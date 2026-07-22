import { NextResponse, type NextRequest } from 'next/server';

/**
 * Provider status-callback webhook — STUB for Phase 1 (mock provider).
 *
 * When a real provider (Exotel/MyOperator/Ozonetel) is configured, this route
 * will consume StatusCallback events (queued, in-progress, completed, failed,
 * busy, no-answer), map them to call_attempts/status transitions, and pull the
 * RecordingUrl into the private VOC bucket. See TECH_SPEC §14. No auth cookie
 * is used here; secure with a provider signature/shared secret when wired up.
 */
export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  // Phase 1: acknowledge only. Real mapping added with the provider impl.
  console.log('[telephony webhook] received (stub):', payload);
  return NextResponse.json({ ok: true, note: 'mock stub — no provider configured' });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'telephony-webhook', mode: 'stub' });
}
