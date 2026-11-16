import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';
import { InvitationPanel } from '@/components/InvitationPanel';
import { ROLE_LABELS, type AppUser } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  not_sent: 'Not invited',
  sent: 'Invited',
  accepted: 'Signed in',
  bounced: 'Failed',
};

export default async function InvitationsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const [pending, unaccepted, { data: recent }] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('invite_status', 'not_sent'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('invite_status', ['not_sent', 'sent', 'bounced']),
    supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <AppShell user={user}>
      <Link href="/admin" className="text-sm text-gray-500">
        ← Administration
      </Link>
      <h1 className="mt-2 font-serif text-2xl text-navy">Invitations</h1>
      <p className="mt-1 text-sm text-gray-600">
        Each invitation carries a one-time sign-in link and the instructions for
        adding the app to a home screen.
      </p>

      <div className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <InvitationPanel
          pendingCount={pending.count ?? 0}
          unacceptedCount={unaccepted.count ?? 0}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Accounts
        </h2>
        <div className="mt-2 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recent as AppUser[] | null)?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium text-navy">
                    {`${u.first_name} ${u.last_name}`.trim() || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{u.email}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {ROLE_LABELS[u.role]}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        u.invite_status === 'accepted'
                          ? 'text-green-700'
                          : u.invite_status === 'bounced'
                            ? 'text-red'
                            : 'text-gray-500'
                      }
                    >
                      {STATUS_LABELS[u.invite_status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
