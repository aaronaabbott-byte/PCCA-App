import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { DirectoryList, type DirectoryEntry } from '@/components/DirectoryList';

export const dynamic = 'force-dynamic';

export default async function DirectoryPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Staff only. Parents are never listed: the family directory is a Phase 4
  // feature with opt-in consent, and students are never listed at all.
  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, title, department, staff_division, role')
    .in('role', ['teacher', 'division_lead', 'admin'])
    .order('last_name');

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">Directory</h1>
      <p className="mt-1 text-sm text-gray-600">
        Faculty and staff. Family contact information is not published here.
      </p>

      <div className="mt-5">
        <DirectoryList entries={(data ?? []) as DirectoryEntry[]} />
      </div>
    </AppShell>
  );
}
