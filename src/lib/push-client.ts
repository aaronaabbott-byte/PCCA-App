/**
 * Browser-side push registration.
 *
 * The iOS rules this has to respect:
 *  - Web Push works only in an app added to the home screen (iOS 16.4+).
 *  - Requesting permission from a Safari tab returns "denied" immediately
 *    and permanently, so asking outside the installed app actively harms
 *    the family's chance of ever getting notifications.
 *
 * So `pushEnvironment()` is checked before anything prompts.
 */

export type PushEnvironment =
  | 'ready' // can subscribe now
  | 'needs-install' // iOS in a browser tab; must install first
  | 'unsupported' // no service worker or push API
  | 'denied'; // permission previously refused

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports as Mac; the touch point count gives it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function pushEnvironment(): PushEnvironment {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (isIOS() && !isStandalone()) return 'needs-install';
  return 'ready';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Asks for permission and registers this device. Returns the outcome so the
 * caller can tell the person what happened rather than failing silently.
 */
export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; reason: PushEnvironment | 'error' }
> {
  const env = pushEnvironment();
  if (env !== 'ready') return { ok: false, reason: env };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerServiceWorker());
  if (!registration) return { ok: false, reason: 'error' };

  await navigator.serviceWorker.ready;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, reason: 'error' };

  try {
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        // iOS revokes subscriptions that send silent pushes, so every
        // notification from this app is visible. Required to be true.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });

    return res.ok ? { ok: true } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getExistingSubscription();
  if (!subscription) return true;

  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  return subscription.unsubscribe();
}
