import { createClient } from '@/lib/supabase/server';
import type { Channel, Division, PostPriority } from '@/lib/types';

export interface FeedPost {
  id: string;
  title: string;
  body: string;
  hero_image_url: string | null;
  priority: PostPriority;
  published_at: string;
  pinned_until: string | null;
  channel: Pick<Channel, 'id' | 'name' | 'slug' | 'division'>;
  author: { first_name: string; last_name: string; title: string | null };
}

const SELECT = `
  id, title, body, hero_image_url, priority, published_at, pinned_until,
  channel:channels!inner ( id, name, slug, division ),
  author:users!posts_author_id_fkey ( first_name, last_name, title )
`;

/**
 * The personalized feed.
 *
 * Note there is no division filter in this query. Row-level security already
 * restricts posts to channels the reader belongs to, and membership is
 * derived from their children's grades. Filtering again in the application
 * would be a second source of truth that can drift from the first.
 */
export async function getFeed(limit = 30, before?: string): Promise<FeedPost[]> {
  const supabase = await createClient();

  let query = supabase
    .from('posts')
    .select(SELECT)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('published_at', before);

  const { data } = await query;
  return normalize(data);
}

export async function getChannelFeed(
  slug: string,
  limit = 30,
): Promise<{ channel: Channel | null; posts: FeedPost[] }> {
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from('channels')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (!channel) return { channel: null, posts: [] };

  const { data } = await supabase
    .from('posts')
    .select(SELECT)
    .eq('channel_id', channel.id)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  return { channel: channel as Channel, posts: normalize(data) };
}

/** Pinned posts float to the top until their pin expires. */
export function sortForDisplay(posts: FeedPost[]): FeedPost[] {
  const now = Date.now();
  const isPinned = (p: FeedPost) =>
    p.pinned_until !== null && new Date(p.pinned_until).getTime() > now;

  return [...posts].sort((a, b) => {
    const pa = isPinned(a);
    const pb = isPinned(b);
    if (pa !== pb) return pa ? -1 : 1;
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });
}

/** Supabase returns joined relations as arrays when it cannot prove cardinality. */
function normalize(rows: unknown): FeedPost[] {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const channel = Array.isArray(r.channel) ? r.channel[0] : r.channel;
    const author = Array.isArray(r.author) ? r.author[0] : r.author;

    return {
      id: String(r.id),
      title: String(r.title ?? ''),
      body: String(r.body ?? ''),
      hero_image_url: (r.hero_image_url as string | null) ?? null,
      priority: (r.priority as PostPriority) ?? 'normal',
      published_at: String(r.published_at),
      pinned_until: (r.pinned_until as string | null) ?? null,
      channel: (channel ?? {
        id: '',
        name: '',
        slug: '',
        division: 'all_campus' as Division,
      }) as FeedPost['channel'],
      author: (author ?? {
        first_name: '',
        last_name: '',
        title: null,
      }) as FeedPost['author'],
    };
  });
}
