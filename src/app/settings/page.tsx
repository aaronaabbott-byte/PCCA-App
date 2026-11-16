import { headers } from 'next/headers';
import { requireUser, displayName } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import {
  NotificationSettings,
  type PreferenceRow,
} from '@/components/NotificationSettings';
import { CalendarSubscribe } from '@/components/CalendarSubscribe';
import { ROLE_LABELS, type Channel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: memberships }, { data: me }] = await Promise.all([
    supabase
      .from('memberships')
      .select('channel_id, notify, channels(id, name, division, sort_order)'),
    supabase
      .from('users')
      .select('calendar_token')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  type Row = Pick<Channel, 'id' | 'name' | 'division' | 'sort_order'>;

  const rows: PreferenceRow[] = (memberships ?? [])
    .map((m) => {
      const channel = (
        Array.isArray(m.channels) ? m.channels[0] : m.channels
      ) as unknown as Row | null;
      if (!channel) return null;
      return {
        channelId: m.channel_id,
        name: channel.name,
        division: channel.division,
        notify: m.notify,
        sort: channel.sort_order,
      };
    })
    .filter((r): r is PreferenceRow & { sort: number } => r !== null)
    .sort((a, b) => a.sort - b.sort)
    .map(({ channelId, name, division, notify }) => ({
      channelId,
      name,
      division,
      notify,
    }));

  const host = (await headers()).get('host') ?? '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const base = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const calendarUrl = me?.calendar_token
    ? `${base}/api/calendar/${me.calendar_token}`
    : null;

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">Settings</h1>

      <section className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="font-serif text-lg text-navy">Your account</h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-500">Name</dt>
            <dd className="text-navy">{displayName(user)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500">Email</dt>
            <dd className="text-navy">{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-500">Role</dt>
            <dd className="text-navy">{ROLE_LABELS[user.role]}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          The school keeps this information. Contact the office to change it.
        </p>
      </section>

      {calendarUrl && (
        <div className="mt-6">
          <CalendarSubscribe url={calendarUrl} />
        </div>
      )}

      <div className="mt-6">
        <NotificationSettings rows={rows} />
      </div>
    </AppShell>
  );
}
