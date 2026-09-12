import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { getCurrentSite } from '../lib/site';
import { rootGraph } from '../lib/schema';
import { fontVariables } from '../lib/fonts';
import { JsonLd } from '../components/JsonLd';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { ThemeScript } from '../components/ThemeScript';
import { NavProgress } from '../components/NavProgress';
import { CookieConsent } from '../components/CookieConsent';
import { ConsentScripts } from '../components/ConsentScripts';

import './globals.css';

/**
 * Root layout — the chrome every page shares.
 *
 * Composition mirrors the bwave sibling, adapted to London's design system:
 * near-black chrome in both themes, three font families (Anton / Archivo /
 * Inter, composed in lib/fonts.ts), no dropdown nav panels, and the topbar
 * breaking ticker lives INSIDE the Masthead (it fetches its own latest
 * headline on the homepage's 15-minute cache window), so this layout never
 * touches the WP API directly — an API failure can cost the ticker, never
 * the page.
 *
 * DELIBERATE ABSENCE: there is NO root app/loading.tsx in this project. A
 * root loading boundary makes Next flush a 200 shell before a page can call
 * notFound(), which turns every unknown article slug into a soft 404. See
 * components/NavProgress.tsx — the progress bar is the sanctioned feedback.
 */

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();

  return {
    metadataBase: new URL(site.siteUrl),
    title: {
      default: `${site.name} — ${site.tagline}`,
      template: `%s | ${site.name}`,
    },
    description: `Breaking news, sport, business and culture from ${site.city} and ${site.region}. Updated throughout the day by ${site.name}.`,
    applicationName: site.name,
    referrer: 'strict-origin-when-cross-origin',
    alternates: {
      canonical: `${site.siteUrl}/`,
      types: { 'application/rss+xml': `${site.siteUrl}/feed.xml` },
    },
    openGraph: {
      type: 'website',
      siteName: site.name,
      locale: site.ogLocale,
      url: `${site.siteUrl}/`,
    },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
  };
}

export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    // Matches --paper in each scheme so the browser chrome does not flash.
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
      { media: '(prefers-color-scheme: dark)', color: '#121212' },
    ],
    colorScheme: 'light dark',
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const site = await getCurrentSite();
  // One clock for the whole render — relative timestamps and the topbar
  // dateline must agree across components, and output stays deterministic.
  const now = new Date();

  return (
    // suppressHydrationWarning: ThemeScript sets data-theme on <html> before
    // hydration, so the server- and client-rendered attributes legitimately
    // differ. Scoped to this element only — it does not cascade.
    <html lang={site.locale} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Blocking inline script, FIRST in head: sets data-theme before
            first paint so dark mode never flashes light. */}
        <ThemeScript />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <NavProgress />

        <JsonLd data={rootGraph(site)} id="ld-root" />

        {/* Topbar (breaking ticker + dateline + theme toggle), masthead
            wordmark and the sticky section nav — one dark plane. */}
        <Masthead site={site} now={now} />

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        <Footer site={site} now={now} />

        <CookieConsent />
        <ConsentScripts site={site} />
      </body>
    </html>
  );
}
