import { Anton, Archivo, Inter } from 'next/font/google';

/**
 * Three families, self-hosted at build time by next/font — zero runtime
 * requests to fonts.googleapis.com, no third-party font origin in the CSP.
 *
 *   Anton    display: hero headlines, colour-block cards, section headers
 *            (>=28px), the wordmark. Single weight — Anton only ships 400.
 *   Archivo  headlines: card headlines, article H1/H2, nav.
 *   Inter    body and UI copy, kickers, meta.
 *
 * `display: 'swap'` on all three is the DESIGN.md contract. Watch-point for
 * the verify pass: on bwave, `swap` on the headline face caused a measurable
 * late-rewrap CLS (see bwave app/layout.tsx). Anton is condensed and the
 * Impact fallback is too, which limits reflow, but if Lighthouse flags CLS
 * here the fix is `display: 'optional'` on the DISPLAY face only — raise it
 * against DESIGN.md rather than changing it silently.
 *
 * The `variable` names are the public API of the design system: globals.css
 * composes `--family-display/--family-headline/--family-body` stacks from
 * them. Attach `fontVariables` to <html> in app/layout.tsx.
 */

export const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  fallback: ['Impact', 'Arial Narrow'],
});

export const archivo = Archivo({
  // 500–800 only: nothing on this site sets a light or regular headline.
  weight: ['500', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-headline',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial'],
});

export const inter = Inter({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
  fallback: ['system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial'],
});

/** Ready-made className string for the <html> element. */
export const fontVariables = `${anton.variable} ${archivo.variable} ${inter.variable}`;
