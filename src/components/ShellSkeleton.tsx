import { Shield } from '@/components/Shield';

// What shows while a page waits on the server.
//
// The pages are force-dynamic and each does several Supabase round trips
// before it can render, so without a Suspense fallback the browser has
// nothing to paint and the app looks dead on open. Next uses a route's
// loading.tsx as that fallback automatically.
//
// This deliberately repeats the header and tab bar rather than reusing
// AppShell: AppShell needs a user, fetching one is the very wait we are
// covering. Everything here is static and paints immediately.

function Line({ w }: { w: string }) {
  return <div className="h-3 rounded bg-gray-200" style={{ width: w }} />;
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <header className="pad-safe-top sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Shield className="h-8 w-auto" />
            <span className="truncate font-serif text-lg tracking-wide">
              Providence
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/10" />
            <div className="h-8 w-8 rounded-full bg-white/15 ring-1 ring-white/25" />
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-6"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading</span>

        <div className="animate-pulse">
          <div className="h-7 w-44 rounded bg-gray-200" />

          {/* the channel chips */}
          <div className="mt-4 flex gap-2 overflow-hidden">
            {['3.5rem', '6rem', '5rem', '7rem', '4.5rem'].map((w, i) => (
              <div
                key={i}
                className="h-8 shrink-0 rounded-full bg-gray-200"
                style={{ width: w }}
              />
            ))}
          </div>

          {/* post cards */}
          <div className="mt-5 space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-200" />
                  <Line w="5rem" />
                </div>
                <div className="mt-3 h-5 w-3/4 rounded bg-gray-200" />
                <div className="mt-3 space-y-2">
                  <Line w="100%" />
                  <Line w="92%" />
                  <Line w="60%" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <nav className="pad-safe-bottom sticky bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl">
          {['News', 'Channels', 'Calendar', 'Resources', 'Directory'].map(
            (label) => (
              <span
                key={label}
                className="flex-1 py-3 text-center text-xs font-medium text-navy/40 sm:text-sm"
              >
                {label}
              </span>
            ),
          )}
        </div>
      </nav>
    </div>
  );
}
