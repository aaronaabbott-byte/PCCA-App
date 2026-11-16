import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { EventForm, type EventDraft } from '@/components/EventForm';
import { getEventChannels } from '@/lib/event-channels';
import { dayKey, getEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;

  const [event, channels] = await Promise.all([
    getEvent(id),
    getEventChannels(true),
  ]);

  if (!event) notFound();

  const start = new Date(event.starts_at);

  const initial: EventDraft = {
    id: event.id,
    channelId: event.channel.id,
    title: event.title,
    description: event.description,
    location: event.location ?? '',
    category: event.category,
    date: dayKey(start),
    startTime: timeOf(event.starts_at),
    endTime: event.ends_at ? timeOf(event.ends_at) : '',
    allDay: event.all_day,
    timeTbd: event.time_tbd,
    cancelled: event.cancelled,
  };

  return (
    <AppShell user={user}>
      <Link href={`/calendar/${event.id}`} className="text-sm text-gray-500">
        ← Back to event
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">Edit event</h1>

      <div className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <EventForm channels={channels} initial={initial} />
      </div>
    </AppShell>
  );
}
