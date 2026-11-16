import Link from 'next/link';
import Image from 'next/image';
import { DIVISION_COLORS } from '@/lib/types';
import type { FeedPost } from '@/lib/feed';

function relativeDate(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);

  if (days === 0) {
    return then.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PostCard({ post }: { post: FeedPost }) {
  const color = DIVISION_COLORS[post.channel.division];
  const isEmergency = post.priority === 'emergency';
  const isAnnouncement = post.priority === 'announcement';
  const pinned =
    post.pinned_until !== null &&
    new Date(post.pinned_until).getTime() > Date.now();

  const authorName =
    `${post.author.first_name} ${post.author.last_name}`.trim();

  return (
    <article
      className={`overflow-hidden rounded-lg bg-white shadow-sm ring-1 ${
        isEmergency ? 'ring-2 ring-red' : 'ring-gray-200'
      }`}
    >
      {post.hero_image_url && (
        <div className="relative aspect-[16/9] bg-gray-100">
          <Image
            src={post.hero_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href={`/feed/${post.channel.slug}`}
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{ color }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            {post.channel.name}
          </Link>

          {isEmergency && (
            <span className="rounded bg-red px-1.5 py-0.5 font-semibold uppercase tracking-wide text-white">
              Urgent
            </span>
          )}
          {isAnnouncement && !isEmergency && (
            <span className="rounded bg-navy/10 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-navy">
              Announcement
            </span>
          )}
          {pinned && (
            <span className="text-gray-400" title="Pinned">
              Pinned
            </span>
          )}

          <span className="ml-auto text-gray-400">
            {relativeDate(post.published_at)}
          </span>
        </div>

        <h2 className="mt-2 font-serif text-xl leading-snug text-navy">
          {post.title}
        </h2>

        {post.body && (
          <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">
            {post.body}
          </div>
        )}

        {authorName && (
          <p className="mt-3 text-xs text-gray-500">
            {authorName}
            {post.author.title ? `, ${post.author.title}` : ''}
          </p>
        )}
      </div>
    </article>
  );
}
