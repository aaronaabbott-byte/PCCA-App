import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/** Issues a new calendar token, invalidating the old subscription URL. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .update({ calendar_token: crypto.randomUUID() })
    .eq('id', user.id)
    .select('calendar_token')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token: data.calendar_token });
}
