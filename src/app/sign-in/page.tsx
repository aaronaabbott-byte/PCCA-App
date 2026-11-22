'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Shield } from '@/components/Shield';

/*
 * Two ways in, from one email:
 *
 *   The code. Works everywhere, and is the only thing that works in the
 *   home-screen app on an iPhone. iOS opens email links in Safari, and
 *   Safari and a home-screen app keep separate sign-ins, so a tapped link
 *   signs in Safari and leaves the app at this screen.
 *
 *   The link. Still fine on a computer or in a browser tab.
 *
 * Once in, the session refreshes itself on every visit and the cookie lasts
 * 400 days from the last one, so nobody is signed out unless they choose
 * Sign out.
 */

type Step = 'email' | 'code';

const ERRORS: Record<string, string> = {
  expired: 'That link has expired or was already used. Request a new code below.',
  missing_code: 'That link was incomplete. Request a new code below.',
};

export default function SignInPage() {
  // useSearchParams needs a Suspense boundary on a statically rendered page.
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const codeInput = useRef<HTMLInputElement>(null);

  // An error carried in from a failed link shows until the person acts.
  const [linkError, setLinkError] = useState(ERRORS[params.get('error') ?? ''] ?? '');
  const shown = message || linkError;

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setMessage('');
    setLinkError('');

    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Invite-only: never create an auth user for an address the school
        // has not rostered.
        shouldCreateUser: false,
      },
    });

    setBusy(false);

    if (error) {
      // Same message whether the address is unknown or something else
      // failed, so the form never confirms who is on the roster.
      setMessage(
        error.status === 429
          ? 'Too many requests. Wait a minute, then try again.'
          : 'We could not send a code to that address. Check the spelling, or contact the school office if you believe you should have access.',
      );
      return;
    }

    setCode('');
    setStep('code');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    const { error } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });

    if (error) {
      setBusy(false);
      setMessage(
        'That code did not work. Codes expire after an hour and work once. Check the newest email, or send a new code.',
      );
      return;
    }

    const next = params.get('next') ?? '/';
    window.location.href = `/auth/complete?next=${encodeURIComponent(next)}`;
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

        {step === 'email' ? (
          <form onSubmit={sendCode} className="rounded-lg bg-white p-6">
            <label htmlFor="email" className="block text-sm font-semibold text-navy">
              Email address
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Use the address the school has on file. We will email you a
              sign-in code. No password needed.
            </p>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-3 w-full rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              placeholder="you@example.com"
            />

            {shown && (
              <p className="mt-3 rounded bg-red/5 p-3 text-sm text-red">{shown}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-4 w-full rounded bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="rounded-lg bg-white p-6">
            <h2 className="font-serif text-xl text-navy">Check your email</h2>
            <p className="mt-1 text-sm text-gray-600">
              We sent a code to <strong className="break-all">{email}</strong>.
              Enter it here.
            </p>

            <label htmlFor="code" className="sr-only">
              Sign-in code
            </label>
            <input
              id="code"
              ref={codeInput}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="mt-4 w-full rounded border border-gray-300 bg-white px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] text-gray-900 outline-none focus:border-navy focus:ring-2 focus:ring-navy/20"
              placeholder="••••••"
            />

            {shown && (
              <p className="mt-3 rounded bg-red/5 p-3 text-sm text-red">{shown}</p>
            )}

            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="mt-4 w-full rounded bg-navy px-4 py-2.5 font-semibold text-white transition hover:bg-navy/90 disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="mt-4 flex justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setMessage('');
                }}
                className="text-gray-500 underline underline-offset-2"
              >
                Different email
              </button>
              <button
                type="button"
                onClick={() => sendCode()}
                disabled={busy}
                className="text-red underline underline-offset-2"
              >
                Send a new code
              </button>
            </div>
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
