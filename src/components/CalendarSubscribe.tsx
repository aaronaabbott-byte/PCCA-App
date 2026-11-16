'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CalendarSubscribe({ url }: { url: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // webcal:// makes the phone open its calendar app and offer to subscribe,
  // rather than downloading a file that never updates again.
  const webcal = url.replace(/^https?:/, 'webcal:');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard is blocked in some in-app browsers; the input below is
      // selectable as a fallback.
    }
  }

  async function reset() {
    setBusy(true);
    await fetch('/api/calendar/reset', { method: 'POST' });
    setBusy(false);
    setConfirmReset(false);
    router.refresh();
  }

  return (
    <section id="calendar" className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h2 className="font-serif text-lg text-navy">Your calendar link</h2>
      <p className="mt-1 text-sm text-gray-600">
        Subscribe once and your children&apos;s events appear in the calendar
        app on your phone, updating on their own when the school adds or
        changes something.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={webcal}
          className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white"
        >
          Add to my calendar
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-navy"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-3 w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
        aria-label="Calendar subscription link"
      />

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-navy">
          How to add it
        </summary>
        <div className="mt-2 space-y-2 text-sm text-gray-600">
          <p>
            <strong>iPhone:</strong> tap &ldquo;Add to my calendar&rdquo; above
            and confirm. Or Settings → Apps → Calendar → Accounts → Add Account
            → Other → Add Subscribed Calendar, then paste the link.
          </p>
          <p>
            <strong>Google Calendar:</strong> on a computer, click the + beside
            &ldquo;Other calendars&rdquo; → From URL, then paste the link.
            Google refreshes subscribed calendars slowly, sometimes up to a
            day.
          </p>
        </div>
      </details>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {confirmReset ? (
          <div>
            <p className="text-sm text-gray-700">
              A new link will be issued and this one stops working. Anyone you
              shared it with will need the new one, and you will need to
              re-subscribe on each device.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="rounded bg-red px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? 'Working…' : 'Issue a new link'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-sm text-navy underline underline-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Anyone with this link can see your family&apos;s events without
            signing in.{' '}
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-red underline underline-offset-2"
            >
              Issue a new link
            </button>{' '}
            if you shared it by mistake.
          </p>
        )}
      </div>
    </section>
  );
}
