import type { Metadata, Viewport } from 'next';
import { EB_Garamond, Open_Sans } from 'next/font/google';
import './globals.css';

/*
 * The brand guide names Garamond and Open Sans. Garamond itself is not a web
 * font; EB Garamond is the standard open metric-compatible substitute and is
 * what the school's own site can use without licensing.
 */
const garamond = EB_Garamond({
  variable: '--font-garamond',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const openSans = Open_Sans({
  variable: '--font-open-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Providence Academy',
  description: 'News, calendars and resources for Providence Academy families.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Providence',
    statusBarStyle: 'black-translucent',
  },
  // This app is invite-only. Keep it out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#032341',
  width: 'device-width',
  initialScale: 1,
  // Lets an installed app fill the screen under the notch.
  viewportFit: 'cover',
};

/*
 * Since iOS 26.1 an installed iPhone app stops short of the home indicator:
 * iOS paints that strip itself, from the page background. The app still
 * reports a bottom safe-area inset, so padding for it put a second band of
 * navy under the tab bar. When the page visibly stops short of the bottom of
 * the screen, the tab bar drops that padding. On a phone where the page does
 * reach the bottom, nothing changes and the padding keeps the tabs clear of
 * the home indicator.
 *
 * Runs before first paint so the tab bar never jumps.
 */
const INSET_SCRIPT = `(function(){function c(){try{var s=window.navigator.standalone||window.matchMedia('(display-mode: standalone)').matches;var short=screen.height-window.innerHeight>=20;document.documentElement.classList.toggle('ios-system-bottom',!!(s&&short));}catch(e){}}c();window.addEventListener('resize',c);})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // INSET_SCRIPT adds a class before React hydrates.
      suppressHydrationWarning
      className={`${garamond.variable} ${openSans.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INSET_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
