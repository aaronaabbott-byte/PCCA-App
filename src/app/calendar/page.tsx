import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { EventGroup } from '@/components/EventGroup';
import { getMyChannels } from '@/lib/channels';
import {
  dayKey,
  getEvents,
  groupByDay,
  parseDayKey,
  startOfDay,
} from '@/lib/events';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const user = await requireUser();
  const { day, view } = await searchParams;

  // Two views. Agenda is the default because a school calendar has long
  // empty stretches, and paging through blank days to find the one concert
  // is the thing families complain about. Single-day is there for when
  // someone wants "what is happening Thursday".
  const singleDay = view === 'day' || Boolean(day);

  const anchor = (day ? parseDayKey(day) : null) ?? startOfDay(new Date());

  const [events, channels] = await Promise.all([
    singleDay
      ? getEvents(anchor, new Date(anchor.getTime() + DAY_MS))
      : getEvents(anchor, new Date(anchor.getTime() + 60 * DAY_MS)),
    getMyChannels(),
  ]);

  const days = groupByDay(events);
  const canCreate = channels.some((c) => c.canPost) || user.role === 'admin';

  const prev = dayKey(new Date(anchor.getTime() - DAY_MS));
  const next = dayKey(new Date(anchor.getTime() + DAY_MS));

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-navy">Calendar</h1>
        {canCreate && (
          <Link
            href="/calendar/new"
            className="rounded bg-red px-3 py-2 text-sm font-semibold text-white"
          >
            Add event
          </Link>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href="/calendar"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            singleDay
              ? 'bg-white text-navy ring-1 ring-gray-200'
              : 'bg-navy text-white'
          }`}
        >
          Upcoming
        </Link>
        <Link
          href={`/calendar?day=${dayKey(startOfDay(new Date()))}`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            singleDay
              ? 'bg-navy text-white'
              : 'bg-white text-navy ring-1 ring-gray-200'
          }`}
        >
          By day
        </Link>
      </div>

      {singleDay && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/calendar?day=${prev}`}
            aria-label="Previous day"
            className="rounded bg-white px-3 py-2 text-navy ring-1 ring-gray-200"
          >
            ‹
          </Link>
          <span className="flex-1 rounded bg-white py-2 text-center font-serif text-lg text-navy ring-1 ring-gray-200">
            {anchor.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <Link
            href={`/calendar?day=${next}`}
            aria-label="Next day"
            className="rounded bg-white px-3 py-2 text-navy ring-1 ring-gray-200"
          >
            ›
          </Link>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {days.map((d) => (
          <div key={d.key}>
            {!singleDay && (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {d.date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
            )}
            <EventGroup day={d} />
          </div>
        ))}
      </div>

      {days.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          {singleDay
            ? 'Nothing scheduled for this day.'
            : 'Nothing on the calendar for the next two months.'}
        </p>
      )}

      <section className="mt-9 rounded-lg border border-quil bg-white p-4">
        <h2 className="font-serif text-lg text-navy">
          Add these to your own calendar
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Subscribe once and your children&apos;s events appear in the calendar
          app on your phone, updating on their own.
        </p>
        <Link
          href="/settings#calendar"
          className="mt-3 inline-block rounded bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Get my calendar link
        </Link>
      </section>
    </AppShell>
  );
}
