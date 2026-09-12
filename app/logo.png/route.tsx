import { ImageResponse } from 'next/og';
import { getSiteByHost } from '@/config/sites';
import { loadOgFonts } from '@/lib/og-font';

export const runtime = 'edge';
export const revalidate = 86400;

/**
 * The publisher logo, as a real raster asset.
 *
 * Google requires `logo` on a NewsMediaOrganization (an ImageObject with
 * numeric width/height), and `npm run seo:schema` fails the build without it.
 * The masthead wordmark is pure CSS, so there was no file to point at — and
 * pointing schema at a URL that 404s is worse than omitting the property.
 * This route renders the same lockup as the OG cards so the asset is a real
 * brand artefact rather than a placeholder.
 *
 * 600×60 is Google's recommended shape for a publisher logo (max 60px tall,
 * 600px wide). lib/schema.ts declares EXACTLY these dimensions — if either
 * number changes here, change it there.
 *
 * Light ground on purpose: publisher logos are composited onto white surfaces
 * in Google News and Discover, where a near-black tile would read as a hole.
 */

const WIDTH = 600;
const HEIGHT = 60;
const INK = '#111111';
const ACCENT = '#047857';
const PAPER = '#FFFFFF';

export async function GET(request: Request) {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);
  const fonts = await loadOgFonts();
  const displayFamily = fonts.some((f) => f.name === 'Anton') ? 'Anton' : 'sans-serif';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: PAPER,
          padding: '0 8px',
        }}
      >
        {/* The brand mark: a solid square, the same device the masthead uses. */}
        <div style={{ width: 38, height: 38, background: ACCENT, display: 'flex' }} />
        <div
          style={{
            display: 'flex',
            fontFamily: displayFamily,
            fontSize: 40,
            lineHeight: 1,
            letterSpacing: '0.01em',
            color: INK,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {site.name}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable' },
    },
  );
}
