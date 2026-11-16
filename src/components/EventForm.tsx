'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CATEGORY_LABELS, type EventCategory } from '@/lib/event-types';
import { DIVISION_COLORS, type Division } from '@/lib/types';

export interface EventFormChannel {
  id: string;
  name: string;
  division: Division;
  memberCount: number;
}

export interface EventDraft {
  id?: string;
  channelId: string;
  title: string;
  description: string;
  location: string;
  category: EventCategory;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string;
  allDay: boolean;
  timeTbd: boolean;
  cancelled: boolean;
}

const CATEGORIES: EventCategory[] = [
  'academic',
  'arts',
  'community',
  'schedule',
  'spiritual',
  'other',
];

/**
 * Builds an ISO timestamp from the date and time fields, in the browser's
 * own timezone. A school calendar is always local: "3:30 PM" means 3:30 in
 * Springdale, whoever is reading it.
 */
function toIso(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export function EventForm({
  channels,
  initial,
}: {
  channels: EventFormChannel[];
  initial: EventDraft;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = Boolean(form.id);
  const channel = channels.find((c) => c.id === form.channelId);

  function set<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const startsAt = toIso(form.date, form.allDay || form.timeTbd ? '00:00' : form.startTime);
    if (!startsAt) {
      setError('Pick a date.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          channelId: form.channelId,
          title: form.title.trim(),
          description: form.description.trim(),
          location: form.location.trim() || null,
          category: form.category,
          startsAt,
          endsAt:
            form.allDay || form.timeTbd || !form.endTime
              ? null
              : toIso(form.date, form.endTime),
          allDay: form.allDay,
          timeTbd: form.timeTbd,
          cancelled: form.cancelled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save');

      router.push(`/calendar/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: form.id }),
    });
    router.push('/calendar');
    router.refresh();
  }

  if (channels.length === 0) {
    return (
      <p className="rounded-lg bg-white p-5 text-sm text-gray-600 ring-1 ring-gray-200">
        You do not have permission to add events to any channel.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="channel" className="block text-sm font-semibold text-navy">
          Calendar
        </label>
        <select
          id="channel"
          value={form.channelId}
          onChange={(e) => set('channelId', e.target.value)}
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
            Visible to {channel.memberCount}{' '}
            {channel.memberCount === 1 ? 'person' : 'people'}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-semibold text-navy">
          Event
        </label>
        <input
          id="title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={200}
          placeholder="Grammar Christmas Program"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-semibold text-navy">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-semibold text-navy">
            Location
          </label>
          <input
            id="location"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Providence Activities Center"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy">Time</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => {
                set('allDay', e.target.checked);
                if (e.target.checked) set('timeTbd', false);
              }}
              className="h-4 w-4"
            />
            All day
          </label>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={form.timeTbd}
              onChange={(e) => {
                set('timeTbd', e.target.checked);
                if (e.target.checked) set('allDay', false);
              }}
              className="h-4 w-4"
            />
            Time to be announced
          </label>
        </div>

        {!form.allDay && !form.timeTbd && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-gray-600">Starts</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set('startTime', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-600">Ends (optional)</span>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
              />
            </label>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="category" className="block text-sm font-semibold text-navy">
          Type
        </label>
        <select
          id="category"
          value={form.category}
          onChange={(e) => set('category', e.target.value as EventCategory)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-semibold text-navy"
        >
          Details (optional)
        </label>
        <textarea
          id="description"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={5}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-base"
        />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 rounded border border-gray-200 p-3 text-sm text-navy">
          <input
            type="checkbox"
            checked={form.cancelled}
            onChange={(e) => set('cancelled', e.target.checked)}
            className="h-4 w-4"
          />
          <span>
            <span className="block font-semibold">Mark as cancelled</span>
            <span className="block text-xs text-gray-500">
              Better than deleting. Families who subscribed see the event turn
              to cancelled instead of vanishing from their phone.
            </span>
          </span>
        </label>
      )}

      {error && <p className="rounded bg-red/5 p-3 text-sm text-red">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || form.title.trim().length === 0 || !form.date}
          className="rounded bg-navy px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add to calendar'}
        </button>

        {isEdit &&
          (confirmDelete ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Delete permanently?</span>
              <button
                type="button"
                onClick={remove}
                className="rounded bg-red px-3 py-1.5 font-semibold text-white"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-navy underline underline-offset-2"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto text-sm text-red underline underline-offset-2"
            >
              Delete
            </button>
          ))}
      </div>
    </div>
  );
}
