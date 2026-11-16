import Image from 'next/image';

// The official graphic shield, extracted from the vector artwork in the 2024
// brand guide. This replaces the hand-drawn placeholder.
//
// The shield is taller than it is wide (2466 x 2809, so 1.1391). Callers give
// a width and the height follows, which keeps the proportions right wherever
// it appears.

const ASPECT = 1.1391;

type ShieldProps = {
  /** Rendered width in pixels. Height is derived from the artwork. */
  size?: number;
  className?: string;
  /** Set on the one above the fold so it is not lazy-loaded. */
  priority?: boolean;
  /**
   * Empty by default: the shield almost always sits beside the school name,
   * so announcing it again is noise for a screen reader. Pass a label only
   * where the shield stands alone as the link or heading.
   */
  alt?: string;
};

export default function Shield({
  size = 32,
  className,
  priority = false,
  alt = '',
}: ShieldProps) {
  return (
    <Image
      src="/brand/providence-shield.png"
      alt={alt}
      width={size}
      height={Math.round(size * ASPECT)}
      className={className}
      priority={priority}
      aria-hidden={alt === '' ? true : undefined}
    />
  );
}
