import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { finishSignIn } from '@/lib/finish-sign-in';

/**
 * Landing after the six-digit code is accepted. The browser already holds
 * the session by the time it gets here, so this only runs the roster check.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get('next') ?? '/';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  }

  return finishSignIn(origin, next);
}
