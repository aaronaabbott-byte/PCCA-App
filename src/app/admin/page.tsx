import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/AppShell';

export default async function AdminPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const [total, accepted, sent, pending] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('invite_status', 'accepted'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('invite_status', 'sent'),
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('invite_status', 'not_sent'),
  ]);

  const totalCount = total.count ?? 0;
  const acceptedCount = accepted.count ?? 0;
  const adoption =
    totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 0;

  return (
    <AppShell user={user}>
      <h1 className="font-serif text-2xl text-navy">Administration</h1>

      <section className="mt-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Adoption
        </h2>
        <p className="mt-2 font-serif text-4xl text-navy">{adoption}%</p>
        <p className="mt-1 text-sm text-gray-600">
          {acceptedCount} of {totalCount} accounts have signed in at least once.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-red transition-all"
            style={{ width: `${Math.min(adoption, 100)}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Phase 1 is not finished until this passes 60 percent. An app a third
          of families installed is one more channel, not one fewer.
        </p>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Invites not sent" value={pending.count ?? 0} />
        <Stat label="Invites sent" value={sent.count ?? 0} />
        <Stat label="Signed in" value={acceptedCount} />
      </div>

      <nav className="mt-8 space-y-2">
        <AdminLink
          href="/admin/roster"
          title="Roster import"
          description="Upload a FACTS export to create family and staff accounts."
        />
        <AdminLink
          href="/admin/invitations"
          title="Invitations"
          description="Send or resend sign-in invitations by email."
        />
      </nav>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-serif text-2xl text-navy">{value}</p>
    </div>
  );
}

function AdminLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
    >
      <p className="font-serif text-lg text-navy">{title}</p>
      <p className="mt-0.5 text-sm text-gray-600">{description}</p>
    </Link>
  );
}
