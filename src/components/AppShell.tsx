import Link from 'next/link';
import { Shield } from '@/components/Shield';
import { HeaderMenu } from '@/components/HeaderMenu';
import { displayName } from '@/lib/auth';
import type { AppUser } from '@/lib/types';

// The tab bar is the app's navigation. "Home" was a label that said nothing,
// and having both Home and News invited the question of which one had the
// news. The root route is now the feed itself, so the first tab says what it
// is, and Channels moved down here from the header.
//
// The tab label is "News" rather than "News Feed": at five tabs on a narrow
// phone each one gets about 70px, and two words wrap. The page heading says
// News Feed.
const NAV = [
  { href: '/', label: 'News' },
  { href: '/channels', label: 'Channels' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/resources', label: 'Resources' },
  { href: '/directory', label: 'Directory' },
];

export function AppShell({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return (
    <div data-app-shell className="flex min-h-dvh flex-col bg-gray-50">
      <header className="pad-safe-top sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <Shield className="h-8 w-auto" />
            <span className="truncate font-serif text-lg tracking-wide">
              Providence Academy
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link
              href="/search"
              aria-label="Search"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-[18px] w-[18px]"
                aria-hidden
              >
                <circle cx="8.75" cy="8.75" r="5.25" />
                <path d="M12.6 12.6 17 17" />
              </svg>
            </Link>

            <HeaderMenu
              name={displayName(user)}
              isAdmin={user.role === 'admin'}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>

      <nav className="pad-safe-bottom sticky bottom-0 border-t border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 py-3 text-center text-xs font-medium text-navy sm:text-sm"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
