import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getResend, inviteEmail } from '@/lib/email';

export const maxDuration = 300;

const BodySchema = z.object({
  // 'pending' sends to anyone not yet invited; 'all' re-sends to everyone
  // who has not accepted; an array targets specific users.
  target: z.union([
    z.literal('pending'),
    z.literal('unaccepted'),
    z.array(z.string().uuid()).max(2000),
  ]),
});

/** Resend's free tier allows 2 requests/second. Stay under it. */
const RATE_DELAY_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const actor = await getCurrentUser();
  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const admin = createAdminClient();

  let query = admin.from('users').select('id, email, first_name, invite_status');
  if (parsed.data.target === 'pending') {
    query = query.eq('invite_status', 'not_sent');
  } else if (parsed.data.target === 'unaccepted') {
    query = query.in('invite_status', ['not_sent', 'sent', 'bounced']);
  } else {
    query = query.in('id', parsed.data.target);
  }

  const { data: recipients, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, failures: [] });
  }

  const resend = getResend();
  let sent = 0;
  const failures: { email: string; reason: string }[] = [];

  for (const recipient of recipients) {
    try {
      // A magic link generated server-side, so the first tap from the email
      // signs them straight in. No password, no code to type.
      const { data: link, error: linkError } =
        await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: recipient.email,
          options: { redirectTo: `${appUrl}/auth/callback` },
        });

      // A user row exists but no auth identity yet: create one, then retry.
      let signInUrl = link?.properties?.action_link;
      if (linkError || !signInUrl) {
        await admin.auth.admin.createUser({
          email: recipient.email,
          email_confirm: true,
        });
        const { data: retry } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email: recipient.email,
          options: { redirectTo: `${appUrl}/auth/callback` },
        });
        signInUrl = retry?.properties?.action_link;
      }

      if (!signInUrl) throw new Error('Could not generate a sign-in link');

      await resend.emails.send(
        inviteEmail({
          to: recipient.email,
          firstName: recipient.first_name,
          signInUrl,
          appUrl,
        }) as Parameters<typeof resend.emails.send>[0],
      );

      await admin
        .from('users')
        .update({ invite_status: 'sent', invited_at: new Date().toISOString() })
        .eq('id', recipient.id);

      sent += 1;
    } catch (e) {
      failures.push({
        email: recipient.email,
        reason: e instanceof Error ? e.message : 'unknown error',
      });
      await admin
        .from('users')
        .update({ invite_status: 'bounced' })
        .eq('id', recipient.id);
    }

    await sleep(RATE_DELAY_MS);
  }

  return NextResponse.json({
    sent,
    failed: failures.length,
    failures: failures.slice(0, 50),
  });
}
