'use client';

import { useEffect, useState } from 'react';
import {
  getExistingSubscription,
  pushEnvironment,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client';
import { DIVISION_COLORS, type Division } from '@/lib/types';

export interface PreferenceRow {
  channelId: string;
  name: string;
  division: Division;
  notify: boolean;
}

export function NotificationSettings({ rows }: { rows: PreferenceRow[] }) {
  const [prefs, setPrefs] = useState(rows);
  const [device, setDevice] = useState<
    'checking' | 'on' | 'off' | 'needs-install' | 'denied' | 'unsupported'
  >('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const env = pushEnvironment();
      if (env === 'needs-install' || env === 'denied' || env === 'unsupported') {
        setDevice(env);
        return;
      }
      const sub = await getExistingSubscription();
      setDevice(sub && Notification.permission === 'granted' ? 'on' : 'off');
    })();
  }, []);

  async function toggleDevice() {
    setBusy(true);
    if (device === 'on') {
      await unsubscribeFromPush();
      setDevice('off');
    } else {
      const result = await subscribeToPush();
      setDevice(result.ok ? 'on' : result.ok === false && result.reason === 'denied' ? 'denied' : 'off');
    }
    setBusy(false);
  }

  async function toggleChannel(channelId: string, notify: boolean) {
    // Optimistic: the switch should move under the thumb immediately.
    setPrefs((p) =>
      p.map((row) => (row.channelId === channelId ? { ...row, notify } : row)),
    );

    const res = await fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, notify }),
    });

    if (!res.ok) {
      setPrefs((p) =>
        p.map((row) =>
          row.channelId === channelId ? { ...row, notify: !notify } : row,
        ),
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="font-serif text-lg text-navy">This device</h2>

        {device === 'needs-install' && (
          <p className="mt-2 text-sm text-gray-600">
            On iPhone, notifications work only from the app on your home screen.
            Add it first, then come back here.
          </p>
        )}

        {device === 'denied' && (
          <p className="mt-2 text-sm text-gray-600">
            Notifications are blocked for Providence on this device. Turn them
            back on in your phone&apos;s Settings under Notifications, then reopen
            the app.
          </p>
        )}

        {device === 'unsupported' && (
          <p className="mt-2 text-sm text-gray-600">
            This browser cannot receive notifications.
          </p>
        )}

        {(device === 'on' || device === 'off') && (
          <>
            <p className="mt-2 text-sm text-gray-600">
              {device === 'on'
                ? 'This device is registered and will receive notifications.'
                : 'This device is not registered. You will not receive notifications here.'}
            </p>
            <button
              type="button"
              onClick={toggleDevice}
              disabled={busy}
              className={`mt-3 rounded px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                device === 'on'
                  ? 'border border-gray-300 text-navy'
                  : 'bg-red text-white'
              }`}
            >
              {busy
                ? 'Working…'
                : device === 'on'
                  ? 'Turn off on this device'
                  : 'Turn on notifications'}
            </button>
          </>
        )}
      </section>

      <section className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="font-serif text-lg text-navy">Which feeds notify you</h2>
        <p className="mt-1 text-sm text-gray-600">
          Turn off anything you would rather read in the app. Urgent notices
          such as closings always come through.
        </p>

        <ul className="mt-4 divide-y divide-gray-100">
          {prefs.map((row) => (
            <li
              key={row.channelId}
              className="flex items-center gap-3 py-3"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: DIVISION_COLORS[row.division] }}
                aria-hidden
              />
              <span className="text-sm font-medium text-navy">{row.name}</span>
              <label className="ml-auto inline-flex cursor-pointer items-center">
                <span className="sr-only">Notify me about {row.name}</span>
                <input
                  type="checkbox"
                  checked={row.notify}
                  onChange={(e) => toggleChannel(row.channelId, e.target.checked)}
                  className="peer sr-only"
                />
                <span className="relative h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-navy after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
              </label>
            </li>
          ))}
        </ul>

        {prefs.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">
            You are not in any channels yet.
          </p>
        )}
      </section>
    </div>
  );
}
