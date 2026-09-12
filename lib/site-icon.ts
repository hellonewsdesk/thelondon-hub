import type { SiteConfig } from '../config/sites';

/**
 * The site mark, as SVG.
 *
 * A condensed "H." — the Hub initial with the brand's green full stop —
 * on the near-black chrome that IS this brand (docs/DESIGN.md: the chrome
 * is `#0A0A0A` in both themes). The wordmark in the masthead is pure CSS,
 * so this is the only drawn brand asset, and it is generated: there is no
 * image file to export or forget to update.
 *
 * DRAWN AS PURE RECTANGLES, DELIBERATELY. The obvious alternative was the
 * masthead's Anton wordmark initial, and it was rejected the same way
 * bwave's was: an SVG favicon cannot rely on a webfont being present, and
 * the raster paths would then need the font fetched over the network — for
 * an asset the browser requests on literally every page view. Geometry
 * needs neither, and four axis-aligned rects rasterise pixel-clean.
 *
 * Full-bleed square with no corner radius, matching the site's global
 * zero-radius reset. Browsers and iOS round it themselves where their
 * platform calls for it. Opaque ground by default: a transparent favicon
 * disappears into a dark tab strip.
 *
 * Sized in a 32-unit box because 32×32 is the working size for a favicon;
 * everything scales from there.
 *
 * GEOMETRY IS LOAD-BEARING AT 16PX. The mark was verified by rendering at
 * 16px — the size that actually decides a favicon — not by how it looks
 * large (sharp render, 2026-09-10: stems 2.25px, counter 2px, full stop
 * 3px; all distinct). Re-render at 16px before touching any coordinate:
 * narrower stems or a smaller stop collapse into texture.
 */

/** Colour tokens from docs/DESIGN.md. `--chrome` and `--accent-bright` —
 *  the on-chrome green (10.30:1 on #0A0A0A), identical in both themes. */
const CHROME = '#0A0A0A';
const ACCENT_BRIGHT = '#34D399';

/**
 * The "H." as axis-aligned rectangles in the 32-unit box:
 * two 4.5-unit stems, a 4.5-unit crossbar spanning the 4-unit counter,
 * and a 6-unit accent square sharing the stems' baseline (y = 25).
 */
const MARK_RECTS = [
  { x: 5.5, y: 7, width: 4.5, height: 18, fill: '#ffffff' }, // left stem
  { x: 14, y: 7, width: 4.5, height: 18, fill: '#ffffff' }, // right stem
  { x: 10, y: 13.75, width: 4, height: 4.5, fill: '#ffffff' }, // crossbar
  { x: 22.5, y: 19, width: 6, height: 6, fill: ACCENT_BRIGHT }, // full stop
] as const;

export interface IconOptions {
  /** Rendered box in pixels. The artwork is a 32-unit viewBox scaled to it. */
  size?: number;
  /**
   * Paint the background, or leave it transparent.
   *
   * Transparent is for contexts that composite the mark onto their own
   * surface. Everything shipped here is opaque: a favicon with a transparent
   * ground disappears into a dark tab strip.
   */
  background?: boolean;
}

/**
 * The mark as an SVG document string.
 *
 * No external references, no fonts, no embedded raster — so it is safe to
 * inline, to serve under a strict CSP, and to hand to a rasteriser.
 */
export function siteIconSvg(site: SiteConfig, options: IconOptions = {}): string {
  const { size, background = true } = options;

  // A favicon is decorative and always accompanied by the site name in the
  // tab, so it takes role="img" with a label rather than being announced as
  // a graphic with no meaning.
  const dimensions = size === undefined ? '' : ` width="${size}" height="${size}"`;
  const ground = background ? `<rect width="32" height="32" fill="${CHROME}"/>` : '';

  const rects = MARK_RECTS.map(
    (r) =>
      `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}"/>`,
  ).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"${dimensions}`,
    ` role="img" aria-label="${escapeXml(site.name)}">`,
    ground,
    rects,
    '</svg>',
  ].join('');
}

/**
 * A byte array as a standalone ArrayBuffer.
 *
 * `Response` accepts a typed array at runtime, but its `BodyInit` type rejects
 * a `Uint8Array<ArrayBufferLike>` — a view that may sit at an offset inside a
 * larger (possibly shared) buffer. Copying out the exact bytes satisfies both
 * the type and the intent.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

/** XML-escape an attribute value. Site names are ours, but this is free. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wrap a PNG in an ICO container.
 *
 * `/favicon.ico` is still fetched blind by crawlers and older clients even
 * when the document declares better formats, and Google shows a favicon
 * beside mobile search results — so this path has to answer with something
 * correct rather than a 404.
 *
 * ICO has allowed an embedded PNG since Windows Vista and every browser in
 * service reads it, so there is no need to encode BMP: a 6-byte header, one
 * 16-byte directory entry, then the PNG verbatim.
 *
 * Little-endian throughout, per the format.
 */
export function pngToIco(png: Uint8Array, size: number): Uint8Array {
  if (size < 1 || size > 256) {
    throw new Error(`pngToIco: size ${size} is outside the 1-256 the format allows`);
  }

  const HEADER = 6;
  const ENTRY = 16;
  const offset = HEADER + ENTRY;

  const out = new Uint8Array(offset + png.length);
  const view = new DataView(out.buffer);

  // ICONDIR: reserved, type 1 (icon), one image.
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);

  // ICONDIRENTRY. 256 is stored as 0 — the field is a single byte.
  out[6] = size === 256 ? 0 : size;
  out[7] = size === 256 ? 0 : size;
  out[8] = 0; // palette size: 0 for truecolour
  out[9] = 0; // reserved
  view.setUint16(10, 1, true); // colour planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, png.length, true);
  view.setUint32(18, offset, true);

  out.set(png, offset);
  return out;
}
