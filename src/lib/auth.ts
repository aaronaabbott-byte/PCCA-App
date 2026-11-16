import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppUser } from '@/lib/types';

/**
 * The app user row for the current session, or null when signed out.
 *
 * Invite-only enforcement lives here: a person can hold a valid Supabase
 * auth session and still have no `users` row, which means an admin never
 * added them. They get no access.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (data) return data as AppUser;

  // First sign-in: the roster import created a row by email but has not yet
  // seen this auth identity. Link them.
  if (user.email) {
    const { data: linked } = await supabase
      .from('users')
      .update({
        auth_user_id: user.id,
        accepted_at: new Date().toISOString(),
        invite_status: 'accepted',
      })
      .eq('email', user.email.toLowerCase())
      .is('auth_user_id', null)
      .select()
      .maybeSingle();

    if (linked) return linked as AppUser;
  }

  return null;
}

/** Use in any page that requires a signed-in, rostered user. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}

/** Use in admin pages and admin route handlers. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

export function displayName(user: {
  first_name: string;
  last_name: string;
  email: string;
}): string {
  const name = `${user.first_name} ${user.last_name}`.trim();
  return name.length > 0 ? name : user.email;
}
