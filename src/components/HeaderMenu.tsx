'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// The header used to carry Search, Channels, Admin and Settings as four text
// links. On a phone that wrapped into the wordmark. Channels moved to the tab
// bar, Search became an icon, and the two account links live here.

export function HeaderMenu({
  name,
  isAdmin,
}: {
  name: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        // The 44px tap-target rule in globals.css stretched a 32px circle
        // into a tall pill. The button is now the full 44px target and the
        // visible circle sits inside it.
        className="group flex h-11 w-11 items-center justify-center rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white ring-1 ring-white/25 group-hover:bg-white/25">
          {initials}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/10"
        >
          <p className="truncate px-3 py-2 text-xs text-gray-500">{name}</p>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-navy hover:bg-gray-50"
          >
            Settings
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-navy hover:bg-gray-50"
            >
              Admin
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
