import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { RosterImport } from '@/components/RosterImport';

export default async function RosterPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data: runs } = await supabase
    .from('import_runs')
    .select('id, filename, rows_total, users_created, students_created, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <AppShell user={user}>
      <Link href="/admin" className="text-sm text-gray-500">
        ← Administration
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">Roster import</h1>
      <p className="mt-1 text-sm text-gray-600">
        Creates parent accounts and links students to families. Accounts are
        created here and nowhere else, which is what keeps the app invite-only.
      </p>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <RosterImport />
      </div>

      {runs && runs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Recent imports
          </h2>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
            {runs.map((r) => (
              <li key={r.id} className="flex items-baseline gap-3 px-4 py-3">
                <span className="text-sm font-medium text-navy">
                  {r.filename ?? 'Untitled file'}
                </span>
                <span className="text-xs text-gray-500">
                  {r.users_created} accounts, {r.students_created} students
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
