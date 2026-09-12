import { ImageResponse } from 'next/og';
import { getSiteByHost } from '@/config/sites';
import { getPostBySlug } from '@/lib/wp';
import { getFeaturedImage, getPrimaryCategory, postTitle } from '@/lib/wp-helpers';
import { loadOgFonts } from '@/lib/og-font';

export const runtime = 'edge';
export const revalidate = 86400;

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Per-article OG card, 1200x630, in the London Hub visual language
 * (docs/DESIGN.md): near-black chrome ground, Anton display headline in
 * white, the bright brand green as the accent block and kicker, everything
 * flat and square — no gradients, no shadows, no rounded corners.
 *
 * This card is a rich-results dependency, not just social garnish: with no
 * featured image, lib/schema.ts declares it as the NewsArticle image.
 * A missing post still renders a branded card (site name as the title) —
 * a plain OG image beats a 500.
 */

// Tokens from docs/DESIGN.md. --chrome / --chrome-2 / --chrome-rule /
// --ink-inverse / --ink-inverse-2 / --accent-bright (10.30:1 on #0A0A0A).
const CHROME = '#0A0A0A';
const CHROME_RULE = '#2A2A2A';
const WHITE = '#FFFFFF';
const MUTED = '#B3B3B3';
const ACCENT_BRIGHT = '#34D399';

/**
 * Headline sizing in three tiers by character count.
 *
 * The string is also hard-truncated at the tier limit, so the layout cannot
 * overflow regardless of what the pipeline publishes — a headline is data we
 * do not control. Anton is condensed, so these sizes run slightly larger
 * than a regular face could.
 */
function headlineStyle(text: string): { fontSize: number; text: string } {
  if (text.length <= 55) return { fontSize: 82, text };
  if (text.length <= 95) return { fontSize: 64, text };
  const clipped = text.length > 130 ? `${text.slice(0, 129).trimEnd()}…` : text;
  return { fontSize: 50, text: clipped };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Route handlers get the host from the request, not next/headers.
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? undefined;
  const site = getSiteByHost(host);

  const [post, fonts] = await Promise.all([
    getPostBySlug(site, slug).catch(() => null),
    loadOgFonts(),
  ]);

  const displayFamily = fonts.some((f) => f.name === 'Anton') ? 'Anton' : 'sans-serif';
  const uiFamily = fonts.some((f) => f.name === 'Inter') ? 'Inter' : 'sans-serif';

  const rawTitle = post ? postTitle(post) : site.name;
  const { fontSize, text } = headlineStyle(rawTitle);
  const category = post ? getPrimaryCategory(post) : null;
  const image = post ? getFeaturedImage(post) : null;

  // With a picture: text column left, image panel right. Without: full-width
  // editorial card. Both are pure flexbox so satori cannot reflow unexpectedly.
  const textColumnWidth = image ? 720 : WIDTH - 160;

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          background: CHROME,
          position: 'relative',
        }}
      >
        {/* Text column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: textColumnWidth,
            padding: '56px 0 52px 72px',
            paddingRight: image ? 48 : 72,
          }}
        >
          {/* Masthead lockup: Anton wordmark + the brand's green square. */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                fontFamily: displayFamily,
                fontSize: 34,
                fontWeight: 400,
                color: WHITE,
                letterSpacing: '0.01em',
                textTransform: 'uppercase',
              }}
            >
              {site.name}
            </div>
            <div
              style={{
                display: 'flex',
                width: 14,
                height: 14,
                background: ACCENT_BRIGHT,
                marginLeft: 12,
              }}
            />
          </div>

          {/* Kicker + headline */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {category ? (
              <div
                style={{
                  display: 'flex',
                  fontFamily: uiFamily,
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: ACCENT_BRIGHT,
                  marginBottom: 20,
                }}
              >
                {category.name}
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                fontFamily: displayFamily,
                fontSize,
                fontWeight: 400,
                color: WHITE,
                lineHeight: 1.06,
                // Anton is already condensed — never negative-track it.
                letterSpacing: '0.01em',
              }}
            >
              {text}
            </div>
          </div>

          {/* Footer line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid ${CHROME_RULE}`,
              paddingTop: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: uiFamily,
                fontSize: 20,
                fontWeight: 600,
                color: MUTED,
                letterSpacing: '0.06em',
              }}
            >
              {site.hostname}
            </div>
            <div
              style={{
                display: 'flex',
                width: 10,
                height: 10,
                background: ACCENT_BRIGHT,
              }}
            />
          </div>
        </div>

        {/* Image panel — flat, square, separated by a 1px chrome rule. */}
        {image ? (
          <div
            style={{
              display: 'flex',
              width: WIDTH - textColumnWidth,
              height: HEIGHT,
              position: 'relative',
              borderLeft: `1px solid ${CHROME_RULE}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt=""
              width={WIDTH - textColumnWidth}
              height={HEIGHT}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        ) : null}
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
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
