'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shield } from '@/components/Shield';

type Platform = 'ios' | 'android' | 'desktop';

/**
 * The install walkthrough.
 *
 * On iOS, web notifications only reach an app that has been added to the
 * home screen, and permission can only be granted from inside the installed
 * app. That makes this page the highest-stakes screen in Phase 1: a family
 * that stops at "bookmarked" is a family that never hears about a closing.
 */
export default function WelcomePage() {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform('ios');
    else if (/Android/.test(ua)) setPlatform('android');

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS reports installed apps through a non-standard property.
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    setInstalled(standalone);
  }, []);

  return (
    <main className="min-h-dvh bg-navy px-6 py-12">
      <div className="mx-auto max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Shield className="h-14 w-auto" />
          <h1 className="mt-5 font-serif text-2xl text-white">
            Welcome to the Providence app
          </h1>
        </div>

        {installed ? (
          <div className="mt-8 rounded-lg bg-white p-6">
            <h2 className="font-serif text-xl text-navy">You are all set</h2>
            <p className="mt-2 text-sm text-gray-600">
              The app is on your home screen. One last step: allow
              notifications so the school can reach you about closings and
              early dismissals.
            </p>
            <NotificationButton />
          </div>
        ) : (
          <div className="mt-8 rounded-lg bg-white p-6">
            <h2 className="font-serif text-xl text-navy">
              Add it to your home screen
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Notifications only work once the app is on your home screen.
              Without this step you will not hear about weather closings.
            </p>

            <div className="mt-4 flex gap-2 text-sm">
              {(['ios', 'android', 'desktop'] as Platform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`rounded px-3 py-1.5 ${
                    platform === p
                      ? 'bg-navy text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p === 'ios' ? 'iPhone' : p === 'android' ? 'Android' : 'Computer'}
                </button>
              ))}
            </div>

            <ol className="mt-4 space-y-3 text-sm text-gray-700">
              {platform === 'ios' && (
                <>
                  <Step n={1}>Make sure you are in Safari, not another browser.</Step>
                  <Step n={2}>
                    Tap the Share button at the bottom of the screen, the square
                    with an arrow pointing up.
                  </Step>
                  <Step n={3}>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </Step>
                  <Step n={4}>
                    Tap <strong>Add</strong>. Open Providence from your home
                    screen from now on.
                  </Step>
                </>
              )}
              {platform === 'android' && (
                <>
                  <Step n={1}>Make sure you are in Chrome.</Step>
                  <Step n={2}>Tap the three-dot menu in the top right.</Step>
                  <Step n={3}>
                    Tap <strong>Install app</strong> or{' '}
                    <strong>Add to Home screen</strong>.
                  </Step>
                  <Step n={4}>Confirm, then open it from your home screen.</Step>
                </>
              )}
              {platform === 'desktop' && (
                <>
                  <Step n={1}>
                    Look for an install icon at the right end of the address
                    bar.
                  </Step>
                  <Step n={2}>
                    Click it, then <strong>Install</strong>.
                  </Step>
                  <Step n={3}>
                    You can also just bookmark this page, though notifications
                    work best in the installed app.
                  </Step>
                </>
              )}
            </ol>
          </div>
        )}

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-white/70 underline underline-offset-2"
        >
          Skip for now
        </Link>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red text-xs font-semibold text-white">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function NotificationButton() {
  const [state, setState] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );

  useEffect(() => {
    if (typeof Notification === 'undefined') setState('unsupported');
    else setState(Notification.permission);
  }, []);

  if (state === 'unsupported') {
    return (
      <p className="mt-4 text-sm text-gray-500">
        This device does not support notifications.
      </p>
    );
  }

  if (state === 'granted') {
    return (
      <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-800">
        Notifications are on. You are done.
      </p>
    );
  }

  if (state === 'denied') {
    return (
      <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
        Notifications are blocked for this app. Turn them back on in your
        phone&apos;s Settings under Notifications, then reopen Providence.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => setState(await Notification.requestPermission())}
      className="mt-4 w-full rounded bg-red px-4 py-2.5 font-semibold text-white"
    >
      Allow notifications
    </button>
  );
}
