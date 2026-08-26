import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Called by the IVR engine (a separate Supabase Functions project) after it
 * finalizes a call or attaches a recording. It writes directly to the
 * shared call_attempts/recipients tables itself — the VOC & Reports page
 * reads call_attempts live, no derived rollup to refresh — so this route's
 * only job is to invalidate cached pages so a Next.js server component
 * doesn't keep serving stale data from before the call landed.
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.IVR_SHARED_SECRET;
  const providedSecret = request.headers.get('x-ivr-shared-secret');
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const recipientId = typeof payload.recipientId === 'string' ? payload.recipientId : null;
  if (!recipientId) {
    return NextResponse.json({ ok: false, error: 'recipientId is required' }, { status: 400 });
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${recipientId}`);
  revalidatePath('/voc');

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'telephony-webhook' });
}
