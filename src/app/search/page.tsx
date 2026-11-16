import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { AppShell } from '@/components/AppShell';
import { search, KIND_LABELS, type SearchKind } from '@/lib/search';
import { DIVISION_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ORDER: SearchKind[] = ['event', 'post', 'resource', 'person', 'channel'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = '' } = await searchParams;
  const hits = await search(q);

  const grouped = ORDER.map((kind) => ({
    kind,
    hits: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.hits.length > 0);

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">Search</h1>

      <form action="/search" className="mt-4">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="Christmas program, early dismissal, lunch menu…"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base"
        />
      </form>

      {q.trim().length > 0 && q.trim().length < 2 && (
        <p className="mt-5 text-sm text-gray-500">
          Type at least two characters.
        </p>
      )}

      {grouped.map(({ kind, hits: group }) => (
        <section key={kind} className="mt-7">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {KIND_LABELS[kind]}
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {group.map((hit) => {
              const external = hit.href.startsWith('http');
              const inner = (
                <>
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: DIVISION_COLORS[hit.division] }}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-navy">
                      {hit.title}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {hit.subtitle}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={`${hit.kind}-${hit.id}`}>
                  {external ? (
                    <a
                      href={hit.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      href={hit.href}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {q.trim().length >= 2 && hits.length === 0 && (
        <p className="mt-5 rounded-lg bg-white p-5 text-sm text-gray-500 ring-1 ring-gray-200">
          Nothing matches &ldquo;{q}&rdquo;. Search covers news, resources,
          staff and channels you have access to.
        </p>
      )}
    </AppShell>
  );
}
