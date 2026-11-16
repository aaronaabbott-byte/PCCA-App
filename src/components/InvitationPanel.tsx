'use client';

import { useState } from 'react';

interface SendResult {
  sent: number;
  failed: number;
  failures: { email: string; reason: string }[];
}

export function InvitationPanel({
  pendingCount,
  unacceptedCount,
}: {
  pendingCount: number;
  unacceptedCount: number;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<'pending' | 'unaccepted' | null>(
    null,
  );

  async function send(target: 'pending' | 'unaccepted') {
    setBusy(true);
    setError('');
    setConfirming(null);

    try {
      const res = await fetch('/api/admin/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Send failed');
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  const count = confirming === 'pending' ? pendingCount : unacceptedCount;

  return (
    <div>
      {confirming ? (
        <div className="rounded border border-red/30 bg-red/5 p-4">
          <p className="font-semibold text-navy">
            Send {count} email{count === 1 ? '' : 's'}?
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {confirming === 'pending'
              ? 'Everyone who has not been invited yet will get a sign-in link.'
              : 'Everyone who has not signed in yet will get a fresh sign-in link, including people already invited once.'}{' '}
            This cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => send(confirming)}
              className="rounded bg-red px-4 py-2 text-sm font-semibold text-white"
            >
              Yes, send now
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || pendingCount === 0}
            onClick={() => setConfirming('pending')}
            className="rounded bg-navy px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : `Invite ${pendingCount} new`}
          </button>
          <button
            type="button"
            disabled={busy || unacceptedCount === 0}
            onClick={() => setConfirming('unaccepted')}
            className="rounded border border-navy px-4 py-2.5 font-semibold text-navy disabled:opacity-50"
          >
            Resend to {unacceptedCount} who have not signed in
          </button>
        </div>
      )}

      {busy && (
        <p className="mt-4 text-sm text-gray-500">
          Sending at about two per second to stay within the email provider&apos;s
          rate limit. A full school takes a few minutes. Leave this tab open.
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red">{error}</p>}

      {result && (
        <div className="mt-5 rounded border border-gray-200 p-4">
          <p className="font-semibold text-navy">
            Sent {result.sent}
            {result.failed > 0 && `, ${result.failed} failed`}
          </p>
          {result.failures.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {result.failures.map((f) => (
                <li key={f.email}>
                  {f.email}: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
