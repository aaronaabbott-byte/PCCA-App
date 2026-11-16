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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${openSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
