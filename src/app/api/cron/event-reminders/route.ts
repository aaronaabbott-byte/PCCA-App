import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { recipientsForChannel, sendToUsers } from '@/lib/push';
import { eventTime, type CalendarEvent } from '@/lib/event-types';
import type { Division } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Day-before event reminders.
 *
 * Runs on a schedule (see vercel.json). Vercel signs cron requests with
 * CRON_SECRET; the check below means a stranger cannot trigger a notification
 * wave by hitting the URL.
 *
 * Idempotent by design. `reminded_at` is stamped as each event is handled, so
 * a retry after a timeout resumes rather than notifying everyone twice. On a
 * school app, a duplicate notification to 400 families is the kind of mistake
 * people remember.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Events starting in the next 24 to 48 hours that have not been reminded.
  // The window is wider than a day so a missed run still catches them.
  const from = new Date(Date.now() + 12 * 3_600_000).toISOString();
  const to = new Date(Date.now() + 48 * 3_600_000).toISOString();

  const { data, error } = await admin
    .from('events')
    .select(
      'id, title, description, location, category, starts_at, ends_at, all_day, time_tbd, cancelled, channel_id, channel:channels!inner(id, name, slug, division)',
    )
    .is('reminded_at', null)
    .eq('cancelled', false)
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at')
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;
  let eventsHandled = 0;

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const channel = (
      Array.isArray(r.channel) ? r.channel[0] : r.channel
    ) as { id: string; name: string; slug: string; division: Division };

    const event = {
      id: String(r.id),
      title: String(r.title),
      description: String(r.description ?? ''),
      location: (r.location as string | null) ?? null,
      category: r.category as CalendarEvent['category'],
      starts_at: String(r.starts_at),
      ends_at: (r.ends_at as string | null) ?? null,
      all_day: Boolean(r.all_day),
      time_tbd: Boolean(r.time_tbd),
      cancelled: false,
      channel,
    } satisfies CalendarEvent;

    // Reminders respect per-channel preferences. Someone who muted Fine Arts
    // does not want a reminder about the recital either.
    const recipients = await recipientsForChannel(String(r.channel_id));

    const when = new Date(event.starts_at).toLocaleDateString(undefined, {
      weekday: 'long',
    });

    const result = await sendToUsers(recipients, {
      title: `Tomorrow: ${event.title}`,
      body: [when, eventTime(event), event.location]
        .filter(Boolean)
        .join(' · '),
      url: `/calendar/${event.id}`,
      tag: `event-${event.id}`,
      priority: 'normal',
    });

    // Stamped per event, not in one batch at the end, so a timeout halfway
    // through leaves the handled events marked.
    await admin
      .from('events')
      .update({ reminded_at: new Date().toISOString() })
      .eq('id', event.id);

    notified += result.sent;
    eventsHandled += 1;
  }

  return NextResponse.json({ eventsHandled, notified });
}
