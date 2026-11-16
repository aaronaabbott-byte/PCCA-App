import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { PostCard } from '@/components/PostCard';
import { getChannelFeed, sortForDisplay } from '@/lib/feed';
import { DIVISION_COLORS, DIVISION_LABELS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ChannelFeedPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const { channel, posts } = await getChannelFeed(slug);

  if (!channel) notFound();

  const sorted = sortForDisplay(posts);
  const color = DIVISION_COLORS[channel.division];

  return (
    <AppShell user={user}>
      <Link href="/feed" className="text-sm text-gray-500">
        ← All news
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <span
          className="h-9 w-1.5 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <div>
          <h1 className="font-serif text-2xl text-navy">{channel.name}</h1>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            {DIVISION_LABELS[channel.division]}
          </p>
        </div>
      </div>

      {channel.description && (
        <p className="mt-3 text-sm text-gray-600">{channel.description}</p>
      )}

      <div className="mt-5 space-y-4">
        {sorted.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          Nothing posted in {channel.name} yet.
        </p>
      )}
    </AppShell>
  );
}
