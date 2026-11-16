import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const BodySchema = z.object({
  channelId: z.string().uuid(),
  join: z.boolean(),
});

/**
 * Join or leave an optional channel.
 *
 * Only channels with auto_join = false can be joined or left this way. A
 * family cannot leave their own grade channel or the All-Campus feed, because
 * those memberships are derived from enrollment: leaving would mean missing
 * the announcements the school is obliged to deliver. Muting is the right
 * tool for that, and it lives in Settings.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const { channelId, join } = parsed.data;
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from('channels')
    .select('id, auto_join, restricted_posting, archived')
    .eq('id', channelId)
    .maybeSingle();

  if (!channel || channel.archived) {
    return NextResponse.json({ error: 'No such channel' }, { status: 404 });
  }

  if (channel.auto_join) {
    return NextResponse.json(
      {
        error:
          'This channel follows your enrollment. Turn off its notifications in Settings instead.',
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (join) {
    const { error } = await admin.from('memberships').upsert(
      {
        channel_id: channelId,
        user_id: user.id,
        can_post: !channel.restricted_posting,
      },
      { onConflict: 'channel_id,user_id' },
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    await admin
      .from('memberships')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', user.id);
  }

  return NextResponse.json({ ok: true, joined: join });
}
