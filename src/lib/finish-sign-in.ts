import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Shared last step of every sign-in, whether it came from the emailed link
 * or the emailed code. Confirms the person is on the roster, records the
 * visit, and sends first-timers to the install walkthrough.
 */
export async function finishSignIn(origin: string, next: string) {
  const supabase = await createClient();

  const appUser = await getCurrentUser();
  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/no-access`);
  }

  const destination = appUser.last_seen_at ? safeNext(next) : '/welcome';

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', appUser.id);

  return NextResponse.redirect(`${origin}${destination}`);
}

// Only ever redirect within the app.
function safeNext(next: string) {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
