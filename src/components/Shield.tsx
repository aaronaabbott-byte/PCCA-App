import Image from 'next/image';
import type { ComponentPropsWithoutRef } from 'react';

// The official graphic shield, extracted from the vector artwork in the 2024
// brand guide. This replaces the hand-drawn placeholder.
//
// Exported as both a named and a default export. The four call sites
// (AppShell, sign-in, welcome, no-access) use `import { Shield }`, and the
// default export keeps any later `import Shield from` working too.
//
// Sizing is deliberately forgiving, because the placeholder this replaces may
// have taken `size`, `width`, or neither:
//   <Shield />              32px wide, height from the artwork
//   <Shield size={48} />    48px wide, height from the artwork
//   <Shield width={48} />   same thing
//   <Shield width={48} height={60} />  both honored as given
//
// The artwork is 2466 x 2809, so height is width x 1.1391 unless overridden.

const ASPECT = 1.1391;

type ImageProps = ComponentPropsWithoutRef<typeof Image>;

export type ShieldProps = Omit<ImageProps, 'src' | 'alt' | 'width' | 'height'> & {
  /** Rendered width in pixels. Height follows the artwork unless given. */
  size?: number;
  width?: number | `${number}`;
  height?: number | `${number}`;
  /**
   * Empty by default: the shield almost always sits beside the school name,
   * so announcing it again is noise for a screen reader. Pass a label only
   * where the shield stands alone as the link or heading.
   */
  alt?: string;
};

export function Shield({
  size,
  width,
  height,
  alt = '',
  ...rest
}: ShieldProps) {
  const w = Number(width ?? size ?? 32);
  const h = height !== undefined ? Number(height) : Math.round(w * ASPECT);

  return (
    <Image
      src="/brand/providence-shield.png"
      alt={alt}
      width={w}
      height={h}
      aria-hidden={alt === '' ? true : undefined}
      {...rest}
    />
  );
}

export default Shield;
