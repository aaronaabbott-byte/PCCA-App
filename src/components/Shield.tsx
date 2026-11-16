/**
 * Placeholder shield.
 *
 * This is a stand-in built from the brand palette so the app looks right
 * while we wait on files. Replace it with the official artwork: drop
 * `shield.svg` into /public/brand/ and swap this component for an <img>
 * pointing at it. Do the same for the app icons in /public/icons/.
 *
 * The real mark is the quartered shield with the cross; do not redraw it by
 * hand, use the file the school's brand package provides.
 */
export function Shield({ className = 'h-10 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 76"
      className={className}
      role="img"
      aria-label="Providence Academy"
    >
      <defs>
        <clipPath id="shield-clip">
          <path d="M2 2h60v38c0 18-13 29-30 34C15 69 2 58 2 40V2Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#shield-clip)">
        <rect x="0" y="0" width="32" height="38" fill="#CB122D" />
        <rect x="32" y="0" width="32" height="38" fill="#032341" />
        <rect x="0" y="38" width="32" height="38" fill="#032341" />
        <rect x="32" y="38" width="32" height="38" fill="#CB122D" />
        <path d="M28 0h8v76h-8z" fill="#fff" />
        <path d="M0 34h64v8H0z" fill="#fff" />
      </g>

      <path
        d="M2 2h60v38c0 18-13 29-30 34C15 69 2 58 2 40V2Z"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}
