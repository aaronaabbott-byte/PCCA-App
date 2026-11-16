import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import type { Channel, Division } from '@/lib/types';

export interface MyChannel {
  id: string;
  slug: string;
  name: string;
  kind: Channel['kind'];
  division: Division;
  grade: string | null;
  description: string | null;
  sortOrder: number;
  canPost: boolean;
  notify: boolean;
}

export interface JoinableChannel {
  id: string;
  slug: string;
  name: string;
  division: Division;
  description: string | null;
  sortOrder: number;
}

type ChannelRow = Pick<
  Channel,
  | 'id'
  | 'slug'
  | 'name'
  | 'kind'
  | 'division'
  | 'grade'
  | 'description'
  | 'sort_order'
>;

/**
 * Every channel the signed-in user belongs to.
 *
 * Deliberately returns groups as well as feeds. An earlier version filtered
 * to kind === 'feed' in each page, which quietly hid the grade-level
 * channels: families were members and could post, but had no way to reach
 * them. Filtering belongs at the call site that actually wants one kind,
 * never in the shared loader.
 *
 * The user_id filter below is not redundant with row level security, which
 * is what an earlier version of this assumed. memberships_read is
 * `is_admin() or user_id = current_app_user_id()`, so a parent reads only
 * their own rows and the unfiltered query happened to look correct. An
 * administrator reads everyone's, so every channel came back once per
 * member: Logic appeared three times, Grade 7 Parents twice. The bug was
 * invisible while the database had a single user in it.
 *
 * Pass userId when the caller already has the user, to skip the lookup.
 */
export async function getMyChannels(userId?: string): Promise<MyChannel[]> {
  const supabase = await createClient();

  const id = userId ?? (await getCurrentUser())?.id;
  if (!id) return [];

  const { data } = await supabase
    .from('memberships')
    .select(
      'can_post, notify, channels(id, slug, name, kind, division, grade, description, sort_order)',
    )
    .eq('user_id', id);

  return (data ?? [])
    .map((m) => {
      const channel = (
        Array.isArray(m.channels) ? m.channels[0] : m.channels
      ) as unknown as ChannelRow | null;
      if (!channel) return null;

      return {
        id: channel.id,
        slug: channel.slug,
        name: channel.name,
        kind: channel.kind,
        division: channel.division,
        grade: channel.grade,
        description: channel.description,
        sortOrder: channel.sort_order,
        canPost: m.can_post,
        notify: m.notify,
      } satisfies MyChannel;
    })
    .filter((c): c is MyChannel => c !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Channels the user could join but has not: the ones that do not auto-join,
 * such as Fine Arts, which matters to families whose children are in a
 * production but whose grade does not imply it.
 */
export async function getJoinableChannels(
  myIds: string[],
): Promise<JoinableChannel[]> {
  const supabase = await createClient();

  let query = supabase
    .from('channels')
    .select('id, slug, name, division, description, sort_order')
    .eq('auto_join', false)
    .eq('archived', false);

  if (myIds.length > 0) query = query.not('id', 'in', `(${myIds.join(',')})`);

  const { data } = await query;

  return (data ?? [])
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      division: c.division as Division,
      description: c.description,
      sortOrder: c.sort_order,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Division feeds and All-Campus: the announcement channels. */
export function feedsOf(channels: MyChannel[]): MyChannel[] {
  return channels.filter((c) => c.kind === 'feed');
}

/** Grade-level and other conversational channels. */
export function groupsOf(channels: MyChannel[]): MyChannel[] {
  return channels.filter((c) => c.kind === 'group');
}
