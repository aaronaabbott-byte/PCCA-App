import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { AthleticsLink } from '@/components/AthleticsLink';
import { DIVISION_COLORS, DIVISION_LABELS, type Division } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  file_path: string | null;
  category: string;
  division: Division;
  sort_order: number;
}

export default async function ResourcesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('resources')
    .select('*')
    .order('sort_order');

  const resources = (data ?? []) as Resource[];

  // Only show resources with somewhere to go. A seeded row whose URL nobody
  // filled in is a dead end, and a hub full of dead ends teaches families to
  // stop opening it.
  const usable = resources.filter(
    (r) => (r.url && r.url.length > 0) || r.file_path,
  );
  const unfilled = resources.length - usable.length;

  const categories = [...new Set(usable.map((r) => r.category))];

  return (
    <AppShell user={user}>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-navy">Resources</h1>
        {user.role === 'admin' && (
          <Link
            href="/admin/resources"
            className="text-sm text-red underline underline-offset-2"
          >
            Manage
          </Link>
        )}
      </div>

      <AthleticsLink className="mt-5 flex items-center gap-3 rounded-lg bg-navy px-4 py-3.5 text-white shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red text-sm font-bold">
          PA
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">PA Athletics</span>
          <span className="block text-xs text-white/70">
            Scores, schedules and rosters in the Ballfrog app
          </span>
        </span>
        <span className="text-white/60" aria-hidden>
          ↗
        </span>
      </AthleticsLink>

      {categories.map((category) => (
        <section key={category} className="mt-7">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {category}
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {usable
              .filter((r) => r.category === category)
              .map((r) => (
                <li key={r.id}>
                  <a
                    href={resourceHref(r)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: DIVISION_COLORS[r.division] }}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-navy">
                        {r.title}
                      </span>
                      {r.description && (
                        <span className="block text-xs text-gray-500">
                          {r.description}
                        </span>
                      )}
                    </span>
                    {r.division !== 'all_campus' && (
                      <span className="ml-auto shrink-0 text-xs text-gray-400">
                        {DIVISION_LABELS[r.division]}
                      </span>
                    )}
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {usable.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          Nothing here yet.
          {user.role === 'admin' && (
            <>
              {' '}
              <Link href="/admin/resources" className="text-red underline">
                Add the handbooks, schedules and menus
              </Link>{' '}
              to fill this in.
            </>
          )}
        </p>
      )}

      {user.role === 'admin' && unfilled > 0 && (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {unfilled} seeded {unfilled === 1 ? 'resource has' : 'resources have'}{' '}
          no link yet and {unfilled === 1 ? 'is' : 'are'} hidden from families.{' '}
          <Link href="/admin/resources" className="underline">
            Fill them in
          </Link>
          .
        </p>
      )}
    </AppShell>
  );
}

function resourceHref(r: Resource): string {
  if (r.url && r.url.length > 0) return r.url;
  if (r.file_path) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return `${base}/storage/v1/object/public/resources/${r.file_path}`;
  }
  return '#';
}
