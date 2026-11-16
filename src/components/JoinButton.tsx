'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function JoinButton({
  channelId,
  joined,
}: {
  channelId: string;
  joined: boolean;
}) {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(joined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    setBusy(true);
    setError('');
    const next = !isJoined;

    try {
      const res = await fetch('/api/channels/membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId, join: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not update');

      setIsJoined(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="shrink-0 text-right">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
          isJoined
            ? 'border border-gray-300 text-navy'
            : 'bg-navy text-white'
        }`}
      >
        {busy ? '…' : isJoined ? 'Leave' : 'Join'}
      </button>
      {error && <span className="mt-1 block text-xs text-red">{error}</span>}
    </span>
  );
}
