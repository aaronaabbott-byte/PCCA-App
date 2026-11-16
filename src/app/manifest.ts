import type { MetadataRoute } from 'next';

/**
 * Web app manifest. Next generates this at /manifest.webmanifest, and the
 * typed form means a bad icon path or display mode fails the build rather
 * than failing silently on someone's phone.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Providence Academy',
    short_name: 'Providence',
    description:
      'News, calendars and resources for Providence Academy families.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#032341',
    theme_color: '#032341',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
