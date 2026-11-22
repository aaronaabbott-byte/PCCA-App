import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { finishSignIn } from '@/lib/finish-sign-in';

/**
 * Magic-link landing. Exchanges the code for a session, then hands off to
 * the shared roster check.
 *
 * The link works on a computer and in Safari. It cannot sign in the
 * home-screen app on an iPhone: iOS opens email links in Safari, and Safari
 * and a home-screen app keep separate sign-ins. That is what the six-digit
 * code on the sign-in page is for.
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

  return finishSignIn(origin, next);
}
