import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

const BodySchema = z.object({
  channelId: z.string().uuid(),
  notify: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const supabase = await createClient();

  // Row-level security limits this to the caller's own membership rows.
  const { error } = await supabase
    .from('memberships')
    .update({ notify: parsed.data.notify })
    .eq('channel_id', parsed.data.channelId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
