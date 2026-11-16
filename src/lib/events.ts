import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  normalizeEvents,
  startOfDay,
  type CalendarEvent,
} from '@/lib/event-types';

/**
 * Server-side event queries.
 *
 * `server-only` makes an accidental import from a client component a build
 * error naming this file, rather than a confusing trace through Supabase to
 * `next/headers`. Pure helpers and types live in `event-types.ts`, which
 * either side may import.
 */

export * from '@/lib/event-types';

const SELECT = `
  id, title, description, location, category,
  starts_at, ends_at, all_day, time_tbd, cancelled,
  channel:channels!inner ( id, name, slug, division )
`;

/**
 * Events between two instants, oldest first.
 *
 * No division filter here on purpose: row-level security already restricts
 * events to channels the reader belongs to, exactly as it does for posts.
 */
export async function getEvents(
  from: Date,
  to: Date,
  limit = 200,
): Promise<CalendarEvent[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('events')
    .select(SELECT)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
    .limit(limit);

  return normalizeEvents(data);
}

export async function getUpcoming(days = 60): Promise<CalendarEvent[]> {
  const from = startOfDay(new Date());
  const to = new Date(from.getTime() + days * 86_400_000);
  return getEvents(from, to);
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('events')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle();

  return normalizeEvents(data ? [data] : [])[0] ?? null;
}
