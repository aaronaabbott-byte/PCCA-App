import Link from 'next/link';
import { requireUser, displayName } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { PushPrompt } from '@/components/PushPrompt';
import { ChannelList } from '@/components/ChannelList';
import { getMyChannels, feedsOf, groupsOf } from '@/lib/channels';
import { DIVISION_COLORS, type Student } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: students }, channels] = await Promise.all([
    supabase.from('students').select('*').order('grade'),
    getMyChannels(),
  ]);

  const feeds = feedsOf(channels);
  const groups = groupsOf(channels);

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">
        Good to see you, {user.first_name || displayName(user)}
      </h1>

      {students && students.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            My Students
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {(students as Student[]).map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-gray-200"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: DIVISION_COLORS[s.division] }}
                  aria-hidden
                />
                <span className="font-medium text-navy">{s.first_name}</span>
                <span className="text-gray-500">
                  {s.grade === 'K' ? 'Kindergarten' : `Grade ${s.grade}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          News feeds
        </h2>
        <ChannelList channels={feeds} className="mt-2" />
      </section>

      {groups.length > 0 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Your groups
            </h2>
            <Link href="/channels" className="text-xs text-red">
              All channels
            </Link>
          </div>
          <ChannelList channels={groups} className="mt-2" />
        </section>
      )}

      {feeds.length === 0 && groups.length === 0 && (
        <p className="mt-2 rounded-lg bg-white p-4 text-sm text-gray-500 ring-1 ring-gray-200">
          No channels yet. If your children are enrolled, contact the office so
          they can check the roster.
        </p>
      )}

      <div className="mt-8">
        <PushPrompt />
      </div>
    </AppShell>
  );
}
