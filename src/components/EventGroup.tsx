import Link from 'next/link';
import {
  CATEGORY_LABELS,
  eventTime,
  type CalendarEvent,
  type EventDay,
} from '@/lib/event-types';
import { DIVISION_COLORS } from '@/lib/types';

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * One day's events, grouped under a badge per channel.
 *
 * The badge names the channel rather than the category, because on a school
 * calendar "Grammar" tells a parent whether it concerns them and "Community"
 * does not.
 */
export function EventGroup({ day }: { day: EventDay }) {
  const byChannel = new Map<string, CalendarEvent[]>();
  for (const event of day.events) {
    const list = byChannel.get(event.channel.id) ?? [];
    list.push(event);
    byChannel.set(event.channel.id, list);
  }

  return (
    <section className="space-y-3">
      {[...byChannel.values()].map((events) => (
        <div
          key={events[0].channel.id}
          className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200"
        >
          <div className="px-4 pt-3">
            <span
              className="inline-block rounded px-2 py-1 text-xs font-semibold text-white"
              style={{ background: DIVISION_COLORS[events[0].channel.division] }}
            >
              {events[0].channel.name}
            </span>
          </div>

          <ul className="mt-2 divide-y divide-gray-100">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/calendar/${event.id}`}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <span className="flex w-14 shrink-0 flex-col items-center rounded bg-gray-50 py-1.5 ring-1 ring-gray-200">
                    <span className="text-[11px] font-semibold tracking-wide text-red">
                      {WEEKDAY[day.date.getDay()]}
                    </span>
                    <span className="font-serif text-xl leading-tight text-navy">
                      {day.date.getDate()}
                    </span>
                  </span>

                  <span className="min-w-0 pt-0.5">
                    <span
                      className={`block font-medium ${
                        event.cancelled
                          ? 'text-gray-400 line-through'
                          : 'text-navy'
                      }`}
                    >
                      {event.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-500">
                      {event.cancelled ? 'Cancelled' : eventTime(event)}
                      {event.location ? ` · ${event.location}` : ''}
                    </span>
                    {event.category !== 'other' && (
                      <span className="mt-1 inline-block text-xs text-gray-400">
                        {CATEGORY_LABELS[event.category]}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
