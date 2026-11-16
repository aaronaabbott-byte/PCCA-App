import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { EventFormChannel } from '@/components/EventForm';
import type { Channel } from '@/lib/types';

/** Channels the signed-in user may add events to, with audience sizes. */
export async function getEventChannels(
  isAdmin: boolean,
): Promise<EventFormChannel[]> {
  const supabase = await createClient();

  // Admins may schedule on any channel; everyone else only where they post.
  const query = isAdmin
    ? supabase
        .from('channels')
        .select('id, name, division, sort_order')
        .eq('archived', false)
        .order('sort_order')
    : supabase
        .from('memberships')
        .select('can_post, channels(id, name, division, sort_order)')
        .eq('can_post', true);

  const { data } = await query;
  type Row = Pick<Channel, 'id' | 'name' | 'division' | 'sort_order'>;

  const rows: Row[] = isAdmin
    ? ((data ?? []) as unknown as Row[])
    : (data ?? [])
        .flatMap((m) => {
          const rec = m as { channels?: unknown };
          return (Array.isArray(rec.channels)
            ? rec.channels
            : rec.channels
              ? [rec.channels]
              : []) as Row[];
        })
        .filter(Boolean);

  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);

  const admin = createAdminClient();
  const counts = await Promise.all(
    sorted.map(async (c) => {
      const { count } = await admin
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('channel_id', c.id);
      return count ?? 0;
    }),
  );

  return sorted.map((c, i) => ({
    id: c.id,
    name: c.name,
    division: c.division,
    memberCount: counts[i],
  }));
}
