import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import {
  ResourceManager,
  type EditableResource,
} from '@/components/ResourceManager';

export const dynamic = 'force-dynamic';

export default async function AdminResourcesPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from('resources')
    .select('id, title, description, url, category, division, sort_order')
    .order('category')
    .order('sort_order');

  return (
    <AppShell user={user}>
      <Link href="/admin" className="text-sm text-gray-500">
        ← Administration
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">Resources</h1>
      <p className="mt-1 text-sm text-gray-600">
        Handbooks, schedules, menus, maps and quick links. The athletics app
        link lives here too.
      </p>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <ResourceManager rows={(data ?? []) as EditableResource[]} />
      </div>
    </AppShell>
  );
}
