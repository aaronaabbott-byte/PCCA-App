import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { CATEGORY_LABELS, eventTime, getEvent } from '@/lib/events';
import { DIVISION_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // A UUID that exists but belongs to a channel the reader is not in comes
  // back null through row-level security, and lands here as a 404. That is
  // the right answer: it does not confirm the event exists.
  const event = await getEvent(id);
  if (!event) notFound();

  const start = new Date(event.starts_at);
  const canEdit = user.role === 'admin';

  return (
    <AppShell user={user}>
      <Link href="/calendar" className="text-sm text-gray-500">
        ← Calendar
      </Link>

      <div className="mt-3">
        <span
          className="inline-block rounded px-2 py-1 text-xs font-semibold text-white"
          style={{ background: DIVISION_COLORS[event.channel.division] }}
        >
          {event.channel.name}
        </span>
      </div>

      <h1 className="mt-3 font-serif text-2xl text-navy">{event.title}</h1>

      {event.cancelled && (
        <p className="mt-3 rounded border border-red/40 bg-red/5 px-4 py-3 text-sm font-semibold text-red">
          This event has been cancelled.
        </p>
      )}

      <dl className="mt-5 space-y-3 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <Row
          label="When"
          value={`${start.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })} · ${eventTime(event)}`}
        />
        {event.location && <Row label="Where" value={event.location} />}
        <Row label="Type" value={CATEGORY_LABELS[event.category]} />
      </dl>

      {event.description && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg bg-white p-5 text-[15px] leading-relaxed text-gray-700 shadow-sm ring-1 ring-gray-200">
          {event.description}
        </div>
      )}

      {canEdit && (
        <Link
          href={`/calendar/${event.id}/edit`}
          className="mt-6 inline-block rounded border border-navy px-4 py-2 text-sm font-semibold text-navy"
        >
          Edit event
        </Link>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-16 shrink-0 text-gray-500">{label}</dt>
      <dd className="text-navy">{value}</dd>
    </div>
  );
}
