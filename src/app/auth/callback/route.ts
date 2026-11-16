import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

/**
 * Magic-link landing. Exchanges the code for a session, then confirms the
 * person is actually on the roster before letting them in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  }

  // Links the auth identity to the rostered user row on first sign-in.
  const appUser = await getCurrentUser();
  if (!appUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/no-access`);
  }

  // First time in: show the home-screen install walkthrough, which is the
  // step the whole notification story depends on.
  const destination = appUser.last_seen_at ? next : '/welcome';

  await supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', appUser.id);

  return NextResponse.redirect(`${origin}${destination}`);
}
