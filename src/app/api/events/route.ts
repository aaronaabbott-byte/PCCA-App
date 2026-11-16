import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const CATEGORIES = [
  'academic',
  'arts',
  'community',
  'schedule',
  'spiritual',
  'other',
] as const;

const BodySchema = z
  .object({
    id: z.string().uuid().optional(),
    channelId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).default(''),
    location: z.string().max(200).nullable().optional(),
    category: z.enum(CATEGORIES).default('other'),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullable().optional(),
    allDay: z.boolean().default(false),
    timeTbd: z.boolean().default(false),
    cancelled: z.boolean().default(false),
  })
  .refine(
    (v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt),
    { message: 'The end time cannot be before the start time.', path: ['endsAt'] },
  );

export async function PUT(request: NextRequest) {
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

  const v = parsed.data;
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('memberships')
    .select('can_post')
    .eq('channel_id', v.channelId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership?.can_post && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'You cannot add events to that channel.' },
      { status: 403 },
    );
  }

  const row = {
    channel_id: v.channelId,
    created_by: user.id,
    title: v.title,
    description: v.description,
    location: v.location?.trim() || null,
    category: v.category,
    starts_at: v.startsAt,
    ends_at: v.allDay || v.timeTbd ? null : (v.endsAt ?? null),
    all_day: v.allDay,
    time_tbd: v.timeTbd,
    cancelled: v.cancelled,
  };

  const query = v.id
    ? supabase.from('events').update(row).eq('id', v.id).select('id').single()
    : supabase.from('events').insert(row).select('id').single();

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { id } = await request.json().catch(() => ({ id: null }));
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const supabase = await createClient();

  // Row-level security allows the delete only for the author or an admin.
  // Cancelling is usually kinder than deleting, because families who already
  // put it in their own calendar get the update rather than a silent
  // disappearance, so the form nudges toward that.
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
