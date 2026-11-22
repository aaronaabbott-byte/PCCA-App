'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/feed') || pathname.startsWith('/post');
  return pathname.startsWith(href);
}

/*
 * Navy, to match the header. Since iOS 26.1 an installed iPhone app no
 * longer draws under the home indicator either, and iOS fills that strip
 * with the page background, which is navy. A white bar sat on a navy strip;
 * a navy bar runs straight into it.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="pad-safe-bottom sticky bottom-0 z-20 bg-navy">
      <div className="mx-auto flex w-full max-w-3xl">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex-1 py-3 text-center text-xs font-semibold sm:text-sm ${
                active ? 'text-white' : 'text-white/60 hover:text-white/90'
              }`}
            >
              {active && (
                <span
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-red"
                  aria-hidden
                />
              )}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
