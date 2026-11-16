import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { PostCard } from '@/components/PostCard';
import { getFeed, sortForDisplay } from '@/lib/feed';
import { getMyChannels } from '@/lib/channels';
import { DIVISION_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const user = await requireUser();

  const [posts, channels] = await Promise.all([getFeed(30), getMyChannels()]);

  // Every channel the reader belongs to appears here, feeds and grade groups
  // alike. Filtering to feeds is what previously made grade channels
  // unreachable.
  const canPost = channels.some((c) => c.canPost);
  const sorted = sortForDisplay(posts);

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-navy">News</h1>
        {canPost && (
          <Link
            href="/post/new"
            className="rounded bg-red px-3 py-2 text-sm font-semibold text-white"
          >
            New post
          </Link>
        )}
      </div>

      {channels.length > 0 && (
        <nav className="mt-4 -mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2 pb-1">
            <li>
              <span className="inline-block whitespace-nowrap rounded-full bg-navy px-3 py-1.5 text-sm font-medium text-white">
                All
              </span>
            </li>
            {channels.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/feed/${c.slug}`}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-gray-200"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: DIVISION_COLORS[c.division] }}
                    aria-hidden
                  />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-5 space-y-4">
        {sorted.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          Nothing posted yet. When the school posts news for your children&apos;s
          divisions, it appears here.
        </p>
      )}
    </AppShell>
  );
}
