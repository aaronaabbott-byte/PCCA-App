'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DIVISION_LABELS, type Division } from '@/lib/types';

export interface EditableResource {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string;
  division: Division;
  sort_order: number;
}

const DIVISIONS: Division[] = [
  'all_campus',
  'grammar',
  'logic',
  'rhetoric',
  'fine_arts',
  'staff',
];

export function ResourceManager({ rows }: { rows: EditableResource[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableResource | null>(null);
  const [creating, setCreating] = useState(false);

  const blank: EditableResource = {
    id: '',
    title: '',
    description: '',
    url: '',
    category: 'General',
    division: 'all_campus',
    sort_order: 0,
  };

  const missingLink = rows.filter((r) => !r.url || r.url.length === 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} {rows.length === 1 ? 'resource' : 'resources'}
          {missingLink.length > 0 && (
            <span className="text-amber-700">
              {' '}
              · {missingLink.length} missing a link
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setEditing(blank);
            setCreating(true);
          }}
          className="rounded bg-navy px-3 py-2 text-sm font-semibold text-white"
        >
          Add resource
        </button>
      </div>

      {editing && (
        <ResourceForm
          resource={editing}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-lg ring-1 ring-gray-200">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 bg-white px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate font-medium text-navy">
                {r.title}
              </span>
              <span className="block truncate text-xs text-gray-500">
                {r.category}
                {r.division !== 'all_campus' &&
                  ` · ${DIVISION_LABELS[r.division]}`}
                {!r.url || r.url.length === 0 ? (
                  <span className="text-amber-700"> · no link yet</span>
                ) : (
                  ` · ${r.url.replace(/^https?:\/\//, '').slice(0, 40)}`
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setEditing(r);
                setCreating(false);
              }}
              className="ml-auto shrink-0 text-sm text-navy underline underline-offset-2"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResourceForm({
  resource,
  isNew,
  onClose,
  onSaved,
}: {
  resource: EditableResource;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(resource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/resources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: isNew ? undefined : form.id,
          title: form.title.trim(),
          description: form.description?.trim() || null,
          url: form.url?.trim() || '',
          category: form.category.trim(),
          division: form.division,
          sort_order: form.sort_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    await fetch('/api/admin/resources', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: form.id }),
    });
    onSaved();
  }

  return (
    <div className="mt-4 rounded-lg border border-navy/20 bg-navy/[0.02] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-navy">Title</span>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-navy">Link</span>
          <input
            value={form.url ?? ''}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://providenceacademy.org/handbook.pdf"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Resources without a link are hidden from families.
          </span>
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-semibold text-navy">Description</span>
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-navy">Category</span>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-navy">Division</span>
          <select
            value={form.division}
            onChange={(e) =>
              setForm({ ...form, division: e.target.value as Division })
            }
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {DIVISION_LABELS[d]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || form.title.trim().length === 0}
          className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-gray-300 px-4 py-2 text-sm font-semibold text-navy"
        >
          Cancel
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto text-sm text-red underline underline-offset-2"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
