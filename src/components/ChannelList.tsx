import Link from 'next/link';
import { DIVISION_COLORS, DIVISION_LABELS } from '@/lib/types';
import type { MyChannel } from '@/lib/channels';

export function ChannelList({
  channels,
  className = '',
}: {
  channels: MyChannel[];
  className?: string;
}) {
  if (channels.length === 0) return null;

  return (
    <ul className={`space-y-2 ${className}`}>
      {channels.map((c) => (
        <li key={c.id}>
          <Link
            href={`/feed/${c.slug}`}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200"
          >
            <span
              className="h-8 w-1 shrink-0 rounded-full"
              style={{ background: DIVISION_COLORS[c.division] }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block truncate font-medium text-navy">
                {c.name}
              </span>
              {c.description && (
                <span className="block truncate text-xs text-gray-500">
                  {c.description}
                </span>
              )}
            </span>
            <span className="ml-auto shrink-0 text-xs text-gray-400">
              {c.grade
                ? c.grade === 'K'
                  ? 'Kindergarten'
                  : `Grade ${c.grade}`
                : DIVISION_LABELS[c.division]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
