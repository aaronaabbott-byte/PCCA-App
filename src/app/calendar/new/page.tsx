import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { EventForm, type EventDraft } from '@/components/EventForm';
import { getEventChannels } from '@/lib/event-channels';
import { dayKey, startOfDay } from '@/lib/event-types';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const user = await requireUser();
  const channels = await getEventChannels(user.role === 'admin');

  const initial: EventDraft = {
    channelId: channels[0]?.id ?? '',
    title: '',
    description: '',
    location: '',
    category: 'other',
    date: dayKey(startOfDay(new Date())),
    startTime: '08:00',
    endTime: '',
    allDay: false,
    timeTbd: false,
    cancelled: false,
  };

  return (
    <AppShell user={user}>
      <Link href="/calendar" className="text-sm text-gray-500">
        ← Calendar
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">Add an event</h1>

      <div className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <EventForm channels={channels} initial={initial} />
      </div>
    </AppShell>
  );
}
