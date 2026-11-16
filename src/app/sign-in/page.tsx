'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield } from '@/components/Shield';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Invite-only: never create an auth user for an address the school
        // has not rostered.
        shouldCreateUser: false,
      },
    });

    if (error) {
      // Supabase returns the same error whether the address is unknown or
      // something else failed. Say the useful thing without confirming
      // whether an address is on the roster.
      setState('error');
      setMessage(
        'We could not send a link to that address. Check the spelling, or contact the school office if you believe you should have access.',
      );
      return;
    }

    setState('sent');
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-navy px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Shield className="h-16 w-auto" />
          <h1 className="mt-5 font-serif text-2xl text-white">
            Providence Academy
          </h1>
          <p className="mt-1 text-sm text-white/70">Community App</p>
        </div>

        {state === 'sent' ? (
          <div className="rounded-lg bg-white p-6 text-center">
            <h2 className="font-serif text-xl text-navy">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We sent a sign-in link to <strong>{email}</strong>. It is good for
              one hour.
            </p>
            <button
              type="button"
              onClick={() => setState('idle')}
              className="mt-4 text-sm text-red underline underline-offset-2"
            >
              Use a different address
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6">
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-navy"
            >
              Email address
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Use the address the school has on file. No password needed.
            </p>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              placeholder="you@example.com"
            />

            {state === 'error' && (
              <p className="mt-3 rounded bg-red/5 p-3 text-sm text-red">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="mt-4 w-full rounded bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
            >
              {state === 'sending' ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-white/60">
          Accounts are created by the school. If you do not have access, contact
          the front office.
        </p>
      </div>
    </main>
  );
}
