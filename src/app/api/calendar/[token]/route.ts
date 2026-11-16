import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { buildIcs } from '@/lib/ics';
import type { CalendarEvent } from '@/lib/event-types';
import type { Division } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Per-family calendar feed.
 *
 * Calendar apps fetch this without cookies, so the token in the URL is the
 * whole credential. Two consequences the code has to respect:
 *
 *  1. The token identifies a user, and the query is then scoped to exactly
 *     that user's channel memberships by hand. The service-role client
 *     bypasses row-level security, so this is the one place where the
 *     membership filter is written out rather than inherited.
 *  2. A leaked link exposes that family's event list and nothing else. It is
 *     revocable from Settings, which issues a new token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();

  const { data: user } = await admin
    .from('users')
    .select('id, first_name')
    .eq('calendar_token', token)
    .maybeSingle();

  if (!user) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: memberships } = await admin
    .from('memberships')
    .select('channel_id')
    .eq('user_id', user.id);

  const channelIds = (memberships ?? []).map((m) => m.channel_id);

  if (channelIds.length === 0) {
    return icsResponse(
      buildIcs([], {
        calendarName: 'Providence Academy',
        domain: hostOf(request),
      }),
    );
  }

  // A year back and a year forward. Calendar apps re-fetch the whole file,
  // so an unbounded range would grow without limit.
  const from = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 365 * 86_400_000).toISOString();

  const { data } = await admin
    .from('events')
    .select(
      'id, title, description, location, category, starts_at, ends_at, all_day, time_tbd, cancelled, channel:channels!inner(id, name, slug, division)',
    )
    .in('channel_id', channelIds)
    .gte('starts_at', from)
    .lt('starts_at', to)
    .order('starts_at');

  const events: CalendarEvent[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const channel = Array.isArray(r.channel) ? r.channel[0] : r.channel;
    return {
      id: String(r.id),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      location: (r.location as string | null) ?? null,
      category: r.category as CalendarEvent['category'],
      starts_at: String(r.starts_at),
      ends_at: (r.ends_at as string | null) ?? null,
      all_day: Boolean(r.all_day),
      time_tbd: Boolean(r.time_tbd),
      cancelled: Boolean(r.cancelled),
      channel: (channel ?? {
        id: '',
        name: '',
        slug: '',
        division: 'all_campus' as Division,
      }) as CalendarEvent['channel'],
    };
  });

  return icsResponse(
    buildIcs(events, {
      calendarName: 'Providence Academy',
      domain: hostOf(request),
    }),
  );
}

function hostOf(request: NextRequest): string {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? request.url,
    ).hostname;
  } catch {
    return 'providence.app';
  }
}

function icsResponse(body: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="providence.ics"',
      // Calendar apps poll on their own schedule; a short cache keeps a
      // burst of subscribers from hammering the database.
      'Cache-Control': 'public, max-age=900',
    },
  });
}
