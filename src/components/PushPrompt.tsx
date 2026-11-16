'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getExistingSubscription,
  pushEnvironment,
  registerServiceWorker,
  subscribeToPush,
  type PushEnvironment,
} from '@/lib/push-client';

type State = 'checking' | 'subscribed' | PushEnvironment | 'error';

/**
 * Shown on the home screen until this device is registered for
 * notifications. Deliberately does not prompt on iOS in a browser tab,
 * because that permission request is denied permanently and cannot be
 * undone from inside the app.
 */
export function PushPrompt() {
  const [state, setState] = useState<State>('checking');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const env = pushEnvironment();
      if (env !== 'ready') {
        if (!cancelled) setState(env);
        return;
      }

      await registerServiceWorker();
      const existing = await getExistingSubscription();
      if (cancelled) return;

      setState(existing && Notification.permission === 'granted' ? 'subscribed' : 'ready');
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === 'checking' || state === 'subscribed' || state === 'unsupported') {
    return null;
  }

  async function enable() {
    setWorking(true);
    const result = await subscribeToPush();
    setWorking(false);
    setState(result.ok ? 'subscribed' : result.reason === 'error' ? 'error' : result.reason);
  }

  return (
    <section className="rounded-lg border border-quil bg-white p-4">
      {state === 'needs-install' && (
        <>
          <h2 className="font-serif text-lg text-navy">
            Add Providence to your home screen
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            On iPhone, notifications only work from the installed app. Until you
            add it, the school cannot reach you about closings or early
            dismissals.
          </p>
          <Link
            href="/welcome"
            className="mt-3 inline-block rounded bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Show me how
          </Link>
        </>
      )}

      {state === 'ready' && (
        <>
          <h2 className="font-serif text-lg text-navy">Turn on notifications</h2>
          <p className="mt-1 text-sm text-gray-600">
            Get closings, early dismissals and announcements for your children&apos;s
            grades. You choose which feeds notify you in Settings.
          </p>
          <button
            type="button"
            onClick={enable}
            disabled={working}
            className="mt-3 rounded bg-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {working ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      )}

      {state === 'denied' && (
        <>
          <h2 className="font-serif text-lg text-navy">Notifications are off</h2>
          <p className="mt-1 text-sm text-gray-600">
            This device previously blocked notifications from Providence. Turn
            them back on in your phone&apos;s Settings under Notifications, find
            Providence, then reopen the app.
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <h2 className="font-serif text-lg text-navy">
            Something went wrong
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            We could not register this device. Try again, or contact the office
            if it keeps failing.
          </p>
          <button
            type="button"
            onClick={enable}
            className="mt-3 rounded bg-navy px-4 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
        </>
      )}
    </section>
  );
}
