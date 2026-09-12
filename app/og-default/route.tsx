import { ImageResponse } from 'next/og';
import { getSiteByHost } from '@/config/sites';
import { loadOgFonts } from '@/lib/og-font';

export const runtime = 'edge';
export const revalidate = 86400;

/**
 * Site-level OG card, used by every non-article route (buildMetadata in
 * lib/seo.ts hard-codes '/og-default/' as its image fallback — if this route
 * moves, lib/seo.ts must move with it).
 *
 * Same lockup and palette as the per-article version so social previews stay
 * consistent: near-black chrome, Anton wordmark in white, the bright brand
 * green as a solid square block — flat and square per docs/DESIGN.md.
 */

const CHROME = '#0A0A0A';
const WHITE = '#FFFFFF';
const MUTED = '#B3B3B3';
const ACCENT_BRIGHT = '#34D399';

export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);
  const fonts = await loadOgFonts();

  const displayFamily = fonts.some((f) => f.name === 'Anton') ? 'Anton' : 'sans-serif';
  const uiFamily = fonts.some((f) => f.name === 'Inter') ? 'Inter' : 'sans-serif';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: CHROME,
          padding: 80,
        }}
      >
        {/* The brand mark: a solid green square. No gradients, no radius. */}
        <div
          style={{
            display: 'flex',
            width: 40,
            height: 40,
            background: ACCENT_BRIGHT,
            marginBottom: 40,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontFamily: displayFamily,
            fontSize: 112,
            fontWeight: 400,
            color: WHITE,
            // Anton is already condensed — never negative-track it.
            letterSpacing: '0.01em',
            lineHeight: 1.02,
            textTransform: 'uppercase',
          }}
        >
          {site.name}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: uiFamily,
            fontSize: 30,
            fontWeight: 600,
            color: MUTED,
            marginTop: 28,
            letterSpacing: '0.02em',
          }}
        >
          {site.tagline}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: uiFamily,
            fontSize: 22,
            fontWeight: 600,
            color: MUTED,
            marginTop: 'auto',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {site.hostname}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length
        ? fonts.map((f) => ({
            name: f.name,
            data: f.data,
            weight: f.weight,
            style: f.style,
          }))
        : undefined,
      headers: {
        'Cache-Control':
          'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
