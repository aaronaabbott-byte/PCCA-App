import type { MetadataRoute } from 'next';

// Icons live in public/icons/ and are generated from the vector artwork in the
// 2024 brand guide, not from a raster logo. The mark is the graphic shield
// alone: the circle logo's curved word mark is illegible below about 256px,
// and page 4 of the guide permits the shield as a standalone logo.
//
// theme_color is Midnight Navy (#032341) and tints the status bar once the app
// is installed to a home screen. background_color is the splash behind the
// icon during launch, and it matches the icons' navy field so the launch
// reads as one surface rather than a navy tile on white.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Providence Academy',
    short_name: 'Providence',
    description:
      'News, calendars and conversation for Providence Academy families.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#032341',
    theme_color: '#032341',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      // Android crops to a circle. This one keeps the shield inside the 80%
      // safe zone so the point of the shield does not get clipped.
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
