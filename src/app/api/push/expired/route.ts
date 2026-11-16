import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Called by the service worker when the browser expires a subscription.
 * Runs without a session, because the service worker may fire this when no
 * page is open, so it only ever deletes a row by its own endpoint.
 */
export async function POST(request: NextRequest) {
  const { endpoint } = await request.json().catch(() => ({ endpoint: null }));
  if (typeof endpoint !== 'string' || endpoint.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);

  return NextResponse.json({ ok: true });
}
