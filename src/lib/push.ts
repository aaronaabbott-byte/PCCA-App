import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';
import type { PostPriority } from '@/lib/types';

let configured = false;

function configure() {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:office@example.org';

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys are not set. Run: npx tsx scripts/generate-vapid-keys.ts',
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  priority?: PostPriority;
  renotify?: boolean;
}

export interface PushOutcome {
  sent: number;
  failed: number;
  pruned: number;
}

/**
 * Sends a notification to every registered device for the given users.
 *
 * A subscription that comes back 404 or 410 is dead: the person deleted the
 * app or the browser expired it. Those rows are removed, which is what keeps
 * the subscription table from filling with addresses that will never
 * receive anything again.
 */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushOutcome> {
  if (userIds.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  configure();
  const admin = createAdminClient();

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        {
          TTL: payload.priority === 'emergency' ? 3600 : 86400,
          urgency: payload.priority === 'emergency' ? 'high' : 'normal',
        },
      ),
    ),
  );

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent += 1;
      return;
    }

    failed += 1;
    const status = (result.reason as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      dead.push(subscriptions[i].id);
    }
  });

  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', dead);
  }

  return { sent, failed, pruned: dead.length };
}

/**
 * The users who should hear about a post in this channel: members with
 * notifications on for it, not currently muted, and not the author.
 */
export async function recipientsForChannel(
  channelId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data } = await admin
    .from('memberships')
    .select('user_id, notify, muted_until')
    .eq('channel_id', channelId)
    .eq('notify', true);

  return (data ?? [])
    .filter((m) => !m.muted_until || m.muted_until < now)
    .map((m) => m.user_id)
    .filter((id) => id !== excludeUserId);
}

/**
 * Emergency notices ignore per-channel preferences. Someone who muted the
 * Grammar feed still needs to hear that school is closed.
 */
export async function emergencyRecipients(
  channelId: string,
  excludeUserId?: string,
): Promise<string[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('memberships')
    .select('user_id')
    .eq('channel_id', channelId);

  return (data ?? [])
    .map((m) => m.user_id)
    .filter((id) => id !== excludeUserId);
}
