import { createClient } from '@/lib/supabase/server';
import type { Division } from '@/lib/types';

export type SearchKind =
  | 'event'
  | 'post'
  | 'resource'
  | 'person'
  | 'channel';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  division: Division;
}

/**
 * Universal search across posts, resources, staff and channels.
 *
 * Every query runs as the signed-in user, so row-level security does the
 * access control. A Logic post simply is not in the result set for a Grammar
 * family; there is no "filter the results afterwards" step that could be
 * forgotten.
 */
export async function search(rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  // Escape the PostgREST pattern wildcards so a search for "100%" behaves.
  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const [events, posts, resources, people, channels] = await Promise.all([
    // Upcoming events first: on a school calendar, "when is the Christmas
    // program" is the most common search, and last year's is not the answer.
    supabase
      .from('events')
      .select(
        'id, title, description, location, starts_at, all_day, time_tbd, cancelled, channels(name, slug, division)',
      )
      .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
      .or(
        `title.ilike.${pattern},description.ilike.${pattern},location.ilike.${pattern}`,
      )
      .order('starts_at')
      .limit(20),

    supabase
      .from('posts')
      .select('id, title, body, published_at, channels(name, slug, division)')
      .not('published_at', 'is', null)
      .or(`title.ilike.${pattern},body.ilike.${pattern}`)
      .order('published_at', { ascending: false })
      .limit(20),

    supabase
      .from('resources')
      .select('id, title, description, url, category, division')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(15),

    supabase
      .from('users')
      .select('id, first_name, last_name, title, department, staff_division')
      .in('role', ['teacher', 'division_lead', 'admin'])
      .or(
        `first_name.ilike.${pattern},last_name.ilike.${pattern},title.ilike.${pattern},department.ilike.${pattern}`,
      )
      .limit(15),

    supabase
      .from('channels')
      .select('id, name, slug, description, division')
      .eq('archived', false)
      .or(`name.ilike.${pattern},description.ilike.${pattern}`)
      .limit(10),
  ]);

  const hits: SearchHit[] = [];

  for (const e of events.data ?? []) {
    const channel = (
      Array.isArray(e.channels) ? e.channels[0] : e.channels
    ) as unknown as { name: string; division: Division } | null;

    const when = new Date(e.starts_at as string).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const time = e.time_tbd
      ? 'TBD'
      : e.all_day
        ? 'All day'
        : new Date(e.starts_at as string).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          });

    hits.push({
      kind: 'event',
      id: e.id,
      title: e.cancelled ? `${e.title} (cancelled)` : e.title,
      subtitle: [when, time, e.location].filter(Boolean).join(' · '),
      href: `/calendar/${e.id}`,
      division: channel?.division ?? 'all_campus',
    });
  }

  for (const p of posts.data ?? []) {
    const channel = (
      Array.isArray(p.channels) ? p.channels[0] : p.channels
    ) as unknown as { name: string; slug: string; division: Division } | null;

    hits.push({
      kind: 'post',
      id: p.id,
      title: p.title,
      subtitle: `${channel?.name ?? 'News'} · ${new Date(
        p.published_at as string,
      ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      href: `/feed/${channel?.slug ?? ''}`,
      division: channel?.division ?? 'all_campus',
    });
  }

  for (const r of resources.data ?? []) {
    if (!r.url) continue; // resources with no link go nowhere
    hits.push({
      kind: 'resource',
      id: r.id,
      title: r.title,
      subtitle: r.description || r.category,
      href: r.url,
      division: r.division as Division,
    });
  }

  for (const u of people.data ?? []) {
    hits.push({
      kind: 'person',
      id: u.id,
      title: `${u.first_name} ${u.last_name}`.trim(),
      subtitle: [u.title, u.department].filter(Boolean).join(' · ') || 'Staff',
      href: '/directory',
      division: (u.staff_division as Division) ?? 'staff',
    });
  }

  for (const c of channels.data ?? []) {
    hits.push({
      kind: 'channel',
      id: c.id,
      title: c.name,
      subtitle: c.description || 'Channel',
      href: `/feed/${c.slug}`,
      division: c.division as Division,
    });
  }

  return hits;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  event: 'Calendar',
  post: 'News',
  resource: 'Resource',
  person: 'Staff',
  channel: 'Channel',
};
