import type { Division } from '@/lib/types';

/**
 * Types and pure helpers for events.
 *
 * Kept separate from `events.ts` on purpose: that module imports the
 * Supabase server client, which reaches for `next/headers`, and a client
 * component importing any of it pulls server-only code into the browser
 * bundle. Anything a client component needs lives here.
 */

export type EventCategory =
  | 'academic'
  | 'arts'
  | 'community'
  | 'schedule'
  | 'spiritual'
  | 'other';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: 'Academics',
  arts: 'Fine Arts',
  community: 'Community',
  schedule: 'Schedule Change',
  spiritual: 'Chapel',
  other: 'Event',
};

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  location: string | null;
  category: EventCategory;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  time_tbd: boolean;
  cancelled: boolean;
  channel: { id: string; name: string; slug: string; division: Division };
}

export interface EventDay {
  key: string; // YYYY-MM-DD
  date: Date;
  events: CalendarEvent[];
}

/**
 * Groups events by calendar day. Days with nothing on them are left out,
 * which is the difference between a school calendar and an athletics one:
 * a school has long empty stretches, so an agenda beats a day-by-day grid.
 */
export function groupByDay(events: CalendarEvent[]): EventDay[] {
  const map = new Map<string, EventDay>();

  for (const event of events) {
    const date = new Date(event.starts_at);
    const key = dayKey(date);

    let day = map.get(key);
    if (!day) {
      day = { key, date: startOfDay(date), events: [] };
      map.set(key, day);
    }
    day.events.push(event);
  }

  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "3:30 PM", "All day", or "TBD". */
export function eventTime(event: CalendarEvent): string {
  if (event.time_tbd) return 'TBD';
  if (event.all_day) return 'All day';

  const start = new Date(event.starts_at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!event.ends_at) return start;

  const end = new Date(event.ends_at).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

/** Shapes a raw database row into a CalendarEvent. */
export function normalizeEvents(rows: unknown): CalendarEvent[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const channel = Array.isArray(r.channel) ? r.channel[0] : r.channel;

    return {
      id: String(r.id),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      location: (r.location as string | null) ?? null,
      category: (r.category as EventCategory) ?? 'other',
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
}
