'use client';

import { ATHLETICS_IOS, athleticsUrl } from '@/lib/athletics';

/**
 * A link to the PA Athletics app. Renders the App Store link, and swaps in
 * the Play Store link at tap time on Android.
 */
export function AthleticsLink({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={ATHLETICS_IOS}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(e) => {
        e.currentTarget.href = athleticsUrl(navigator.userAgent);
        onClick?.();
      }}
    >
      {children}
    </a>
  );
}
