/**
 * Font loading for `next/og`.
 *
 * Satori (which powers ImageResponse) needs raw TTF/OTF bytes and cannot read
 * WOFF2, so the self-hosted next/font assets are unusable here. Google's CSS
 * endpoint serves TTF when the User-Agent does not advertise WOFF2 support,
 * which is the trick below.
 *
 * The result is cached for a year. If anything fails the caller renders with
 * satori's built-in font instead — a plain OG image beats a 500.
 */

/** UA old enough that Google Fonts serves TTF rather than WOFF2. */
const TTF_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30';

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

async function loadOne(
  family: string,
  weight: 400 | 600 | 700,
): Promise<OgFont | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}:wght@${weight}`;

    const cssRes = await fetch(cssUrl, {
      headers: { 'User-Agent': TTF_UA },
      next: { revalidate: 31536000 },
    });
    if (!cssRes.ok) return null;

    const css = await cssRes.text();

    // Satori reads ttf / otf / woff but NOT woff2. Google's response for the
    // legacy UA above is woff today and was ttf historically, so accept any
    // supported format in preference order rather than pinning to one.
    const sources = [...css.matchAll(/url\(([^)]+)\)\s*format\(['"]?([a-z0-9-]+)['"]?\)/g)].map(
      (m) => ({ url: m[1], format: m[2] }),
    );

    const supported = ['truetype', 'opentype', 'woff'];
    const chosen = supported
      .map((fmt) => sources.find((s) => s.format === fmt))
      .find((s) => s !== undefined);

    const fontUrl = chosen?.url;
    if (!fontUrl) return null;

    const fontRes = await fetch(fontUrl, { next: { revalidate: 31536000 } });
    if (!fontRes.ok) return null;

    return {
      name: family,
      data: await fontRes.arrayBuffer(),
      weight,
      style: 'normal',
    };
  } catch {
    return null;
  }
}

/**
 * The brand faces for the OG card, per docs/DESIGN.md: Anton for the display
 * headline (it ships in weight 400 only), Archivo 700 for secondary headings
 * and Inter 600 for kickers and meta. Returns whatever loaded; an empty
 * array is a valid result and makes ImageResponse fall back gracefully.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  const results = await Promise.all([
    loadOne('Anton', 400),
    loadOne('Archivo', 700),
    loadOne('Inter', 600),
  ]);
  return results.filter((f): f is OgFont => f !== null);
}
