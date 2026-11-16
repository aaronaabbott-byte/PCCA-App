import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import {
  emergencyRecipients,
  recipientsForChannel,
  sendToUsers,
} from '@/lib/push';

export const maxDuration = 300;

const BodySchema = z.object({
  channelId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().max(20_000).default(''),
  heroImageUrl: z.string().url().nullable().optional(),
  priority: z.enum(['normal', 'announcement', 'emergency']).default('normal'),
  notify: z.boolean().default(true),
  pinDays: z.number().int().min(0).max(30).default(0),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad request' },
      { status: 400 },
    );
  }

  const { channelId, title, body, heroImageUrl, priority, notify, pinDays } =
    parsed.data;

  // Emergency priority is an administrator power. A teacher with posting
  // rights on their class channel should not be able to bypass everyone's
  // notification preferences.
  if (priority === 'emergency' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only administrators can send urgent notices.' },
      { status: 403 },
    );
  }

  const supabase = await createClient();

  // Posting rights are checked here and again by row-level security on the
  // insert below, so a forged channel id fails either way.
  const { data: membership } = await supabase
    .from('memberships')
    .select('can_post')
    .eq('channel_id', channelId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership?.can_post && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'You cannot post to that channel.' },
      { status: 403 },
    );
  }

  const now = new Date();
  const pinnedUntil =
    pinDays > 0
      ? new Date(now.getTime() + pinDays * 86_400_000).toISOString()
      : null;

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      channel_id: channelId,
      author_id: user.id,
      title,
      body,
      hero_image_url: heroImageUrl ?? null,
      priority,
      published_at: now.toISOString(),
      pinned_until: pinnedUntil,
    })
    .select('id')
    .single();

  if (error || !post) {
    return NextResponse.json(
      { error: error?.message ?? 'Could not save the post.' },
      { status: 500 },
    );
  }

  let pushResult = { sent: 0, failed: 0, pruned: 0 };

  if (notify) {
    const admin = createAdminClient();
    const { data: channel } = await admin
      .from('channels')
      .select('name, slug')
      .eq('id', channelId)
      .single();

    // Emergency notices reach every member. Someone who muted the Grammar
    // feed still needs to hear that school is closed.
    const recipients =
      priority === 'emergency'
        ? await emergencyRecipients(channelId, user.id)
        : await recipientsForChannel(channelId, user.id);

    pushResult = await sendToUsers(recipients, {
      title:
        priority === 'emergency'
          ? `Urgent: ${title}`
          : `${channel?.name ?? 'Providence'}: ${title}`,
      body: body.slice(0, 160) || 'Open the app to read it.',
      url: `/feed/${channel?.slug ?? ''}`,
      tag: `post-${post.id}`,
      priority,
      renotify: priority === 'emergency',
    });
  }

  return NextResponse.json({ id: post.id, push: pushResult });
}
