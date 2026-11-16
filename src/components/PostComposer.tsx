'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { DIVISION_COLORS, type Division } from '@/lib/types';

export interface ComposerChannel {
  id: string;
  name: string;
  slug: string;
  division: Division;
  kind: string;
  memberCount: number;
}

type Priority = 'normal' | 'announcement' | 'emergency';

export function PostComposer({
  channels,
  isAdmin,
}: {
  channels: ComposerChannel[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [channelId, setChannelId] = useState(channels[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [notify, setNotify] = useState(true);
  const [pinDays, setPinDays] = useState(0);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmUrgent, setConfirmUrgent] = useState(false);

  const channel = useMemo(
    () => channels.find((c) => c.id === channelId),
    [channels, channelId],
  );

  async function uploadImage(file: File) {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads/hero', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setHeroUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (priority === 'emergency' && !confirmUrgent) {
      setConfirmUrgent(true);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          title: title.trim(),
          body: body.trim(),
          heroImageUrl: heroUrl,
          priority,
          notify,
          pinDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not post');

      router.push(`/feed/${channel?.slug ?? ''}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post');
      setSaving(false);
      setConfirmUrgent(false);
    }
  }

  const canSubmit = channelId !== '' && title.trim().length > 0 && !saving;

  if (channels.length === 0) {
    return (
      <p className="rounded-lg bg-white p-5 text-sm text-gray-600 ring-1 ring-gray-200">
        You do not have posting rights on any channel. An administrator can
        grant them.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="channel" className="block text-sm font-semibold text-navy">
          Post to
        </label>
        <select
          id="channel"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        >
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {channel && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: DIVISION_COLORS[channel.division] }}
              aria-hidden
            />
            Reaches {channel.memberCount} {channel.memberCount === 1 ? 'person' : 'people'}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-navy">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
          placeholder="Early dismissal Friday"
        />
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-semibold text-navy">
          Message
        </label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
          placeholder="Write the announcement here."
        />
        <p className="mt-1 text-xs text-gray-500">
          The first 160 characters appear in the notification.
        </p>
      </div>

      <div>
        <span className="block text-sm font-semibold text-navy">Photo</span>
        {heroUrl ? (
          <div className="mt-1">
            <div className="relative aspect-[16/9] overflow-hidden rounded bg-gray-100">
              <Image src={heroUrl} alt="" fill className="object-cover" sizes="600px" />
            </div>
            <button
              type="button"
              onClick={() => setHeroUrl(null)}
              className="mt-2 text-sm text-red underline underline-offset-2"
            >
              Remove photo
            </button>
          </div>
        ) : (
          <label
            htmlFor="hero"
            className="mt-1 flex cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-navy"
          >
            {uploading ? 'Uploading…' : 'Add a photo (optional)'}
            <input
              id="hero"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
              }}
            />
          </label>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy">Kind of post</legend>
        <div className="mt-2 space-y-2">
          <Radio
            name="priority"
            value="normal"
            checked={priority === 'normal'}
            onChange={() => setPriority('normal')}
            label="Regular news"
            hint="Appears in the feed. Notifies people who have this channel on."
          />
          <Radio
            name="priority"
            value="announcement"
            checked={priority === 'announcement'}
            onChange={() => setPriority('announcement')}
            label="Announcement"
            hint="Marked in the feed so it stands out."
          />
          {isAdmin && (
            <Radio
              name="priority"
              value="emergency"
              checked={priority === 'emergency'}
              onChange={() => setPriority('emergency')}
              label="Urgent notice"
              hint="Closings and emergencies. Reaches everyone in the channel, including people who muted it."
            />
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-navy">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="h-4 w-4"
          />
          Send a notification
        </label>

        <label className="flex items-center gap-2 text-sm text-navy">
          Pin for
          <select
            value={pinDays}
            onChange={(e) => setPinDays(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value={0}>Not pinned</option>
            <option value={1}>1 day</option>
            <option value={3}>3 days</option>
            <option value={7}>1 week</option>
          </select>
        </label>
      </div>

      {error && <p className="rounded bg-red/5 p-3 text-sm text-red">{error}</p>}

      {confirmUrgent ? (
        <div className="rounded border border-red/40 bg-red/5 p-4">
          <p className="font-semibold text-navy">Send an urgent notice?</p>
          <p className="mt-1 text-sm text-gray-700">
            Every member of {channel?.name} gets this on their phone, including
            people who turned this channel&apos;s notifications off. Use it for
            closings and emergencies only.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded bg-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Sending…' : 'Yes, send it'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmUrgent(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-navy"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded bg-navy px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
        >
          {saving ? 'Posting…' : notify ? 'Post and notify' : 'Post'}
        </button>
      )}
    </div>
  );
}

function Radio({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex gap-3 rounded border border-gray-200 p-3 has-checked:border-navy has-checked:bg-navy/[0.03]">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0"
      />
      <span>
        <span className="block text-sm font-semibold text-navy">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </label>
  );
}
