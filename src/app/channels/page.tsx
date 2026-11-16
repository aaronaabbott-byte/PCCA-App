import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { JoinButton } from '@/components/JoinButton';
import { getMyChannels, getJoinableChannels } from '@/lib/channels';
import { DIVISION_COLORS, DIVISION_LABELS, type Division } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DIVISION_ORDER: Division[] = [
  'all_campus',
  'grammar',
  'logic',
  'rhetoric',
  'fine_arts',
  'staff',
];

export default async function ChannelsPage() {
  const user = await requireUser();

  const mine = await getMyChannels();
  const joinable = await getJoinableChannels(mine.map((c) => c.id));

  const byDivision = DIVISION_ORDER.map((division) => ({
    division,
    channels: mine.filter((c) => c.division === division),
  })).filter((group) => group.channels.length > 0);

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">Channels</h1>
      <p className="mt-1 text-sm text-gray-600">
        You are added to your children&apos;s divisions and grades
        automatically. Turn individual channels quiet in{' '}
        <Link href="/settings" className="text-red underline underline-offset-2">
          Settings
        </Link>
        .
      </p>

      {byDivision.map(({ division, channels }) => (
        <section key={division} className="mt-7">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: DIVISION_COLORS[division] }}
              aria-hidden
            />
            {DIVISION_LABELS[division]}
          </h2>

          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {channels.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/feed/${c.slug}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">
                      {c.name}
                    </span>
                    {c.description && (
                      <span className="block truncate text-xs text-gray-500">
                        {c.description}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-gray-400">
                    {c.kind === 'feed'
                      ? 'Announcements'
                      : c.canPost
                        ? 'You can post'
                        : 'Read only'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {joinable.length > 0 && (
        <section className="mt-9">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Channels you can join
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Optional channels that are not tied to your children&apos;s grades.
          </p>

          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {joinable.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: DIVISION_COLORS[c.division] }}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy">
                    {c.name}
                  </span>
                  {c.description && (
                    <span className="block text-xs text-gray-500">
                      {c.description}
                    </span>
                  )}
                </span>
                <span className="ml-auto">
                  <JoinButton channelId={c.id} joined={false} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          You are not in any channels yet. Contact the office so they can check
          your family on the roster.
        </p>
      )}
    </AppShell>
  );
}
