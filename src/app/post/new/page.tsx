import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { PostComposer, type ComposerChannel } from '@/components/PostComposer';
import type { Channel } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from('memberships')
    .select('can_post, channels(id, name, slug, division, kind, sort_order)')
    // Own rows only: administrators can read everyone's memberships.
    .eq('user_id', user.id)
    .eq('can_post', true);

  type Row = Pick<
    Channel,
    'id' | 'name' | 'slug' | 'division' | 'kind' | 'sort_order'
  >;

  const rows = (memberships ?? [])
    .flatMap((m) => (m.channels ?? []) as unknown as Row[])
    .filter((c): c is Row => Boolean(c))
    .sort((a, b) => a.sort_order - b.sort_order);

  // Member counts tell an author how many phones this post will light up,
  // which is the number that makes people think twice before notifying.
  const admin = createAdminClient();
  const counts = await Promise.all(
    rows.map(async (c) => {
      const { count } = await admin
        .from('memberships')
        .select('user_id', { count: 'exact', head: true })
        .eq('channel_id', c.id);
      return count ?? 0;
    }),
  );

  const channels: ComposerChannel[] = rows.map((c, i) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    division: c.division,
    kind: c.kind,
    memberCount: counts[i],
  }));

  return (
    <AppShell user={user}>
      <Link href="/feed" className="text-sm text-gray-500">
        ← News
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">New post</h1>

      <div className="mt-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <PostComposer channels={channels} isAdmin={user.role === 'admin'} />
      </div>
    </AppShell>
  );
}
