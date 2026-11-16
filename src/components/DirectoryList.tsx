'use client';

import { useMemo, useState } from 'react';
import {
  DIVISION_COLORS,
  DIVISION_LABELS,
  ROLE_LABELS,
  type AppRole,
  type Division,
} from '@/lib/types';

export interface DirectoryEntry {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  title: string | null;
  department: string | null;
  staff_division: Division | null;
  role: AppRole;
}

export function DirectoryList({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;

    return entries.filter((e) =>
      [
        e.first_name,
        e.last_name,
        e.title ?? '',
        e.department ?? '',
        e.email,
        e.staff_division ? DIVISION_LABELS[e.staff_division] : '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  // Group by department so a parent looking for "who teaches 4th grade" can
  // scan rather than read an alphabetical wall.
  const grouped = useMemo(() => {
    const map = new Map<string, DirectoryEntry[]>();
    for (const entry of filtered) {
      const key = entry.department?.trim() || 'Faculty and Staff';
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div>
      <label htmlFor="dir-search" className="sr-only">
        Search the directory
      </label>
      <input
        id="dir-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, role or department"
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-base"
      />

      {grouped.map(([department, people]) => (
        <section key={department} className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {department}
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                {p.staff_division && (
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: DIVISION_COLORS[p.staff_division] }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-navy">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {p.title || ROLE_LABELS[p.role]}
                  </span>
                </span>
                <a
                  href={`mailto:${p.email}`}
                  className="ml-auto shrink-0 text-sm text-red underline underline-offset-2"
                >
                  Email
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {filtered.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          {entries.length === 0
            ? 'No staff have been added yet.'
            : `Nobody matches "${query}".`}
        </p>
      )}
    </div>
  );
}
