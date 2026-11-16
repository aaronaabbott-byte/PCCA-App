import Link from 'next/link';
import { Shield } from '@/components/Shield';

export default function NoAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy px-6 py-12 text-center">
      <Shield className="h-16 w-auto" />
      <h1 className="mt-6 font-serif text-2xl text-white">
        This account is not on the roster
      </h1>
      <p className="mt-3 max-w-sm text-sm text-white/70">
        The Providence Academy app is available to enrolled families and staff.
        Accounts are created by the school, not by signing up.
      </p>
      <p className="mt-3 max-w-sm text-sm text-white/70">
        If you believe you should have access, contact the front office and ask
        them to check the email address on file for your family.
      </p>
      <Link
        href="/sign-in"
        className="mt-8 rounded bg-white px-5 py-2.5 font-semibold text-navy"
      >
        Try a different address
      </Link>
    </main>
  );
}
