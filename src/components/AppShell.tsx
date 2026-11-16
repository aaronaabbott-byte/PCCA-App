import Link from 'next/link';
import { Shield } from '@/components/Shield';
import type { AppUser } from '@/lib/types';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/feed', label: 'News' },
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
    <div className="flex min-h-dvh flex-col bg-gray-50">
      <header className="pad-safe-top sticky top-0 z-20 bg-navy text-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Shield className="h-8 w-auto" />
            <span className="font-serif text-lg tracking-wide">Providence</span>
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/search"
              className="text-sm text-white/80 hover:text-white"
              aria-label="Search"
            >
              Search
            </Link>
            <Link
              href="/channels"
              className="text-sm text-white/80 hover:text-white"
            >
              Channels
            </Link>
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="text-sm text-white/80 hover:text-white"
              >
                Admin
              </Link>
            )}
            <Link
              href="/settings"
              className="text-sm text-white/80 hover:text-white"
            >
              Settings
            </Link>
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
