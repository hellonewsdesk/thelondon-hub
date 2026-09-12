import 'server-only';

/**
 * SVG to PNG, for the raster icon routes.
 *
 * Uses sharp, which Next already depends on for image optimisation, so this
 * adds nothing to the dependency tree. `next/og` was the other candidate and
 * was not used: satori is built for laying out JSX with webfonts, needs those
 * fonts fetched over the network, and renders SVG paths only partially. The
 * mark here is pure geometry, so a straight rasteriser is both simpler and
 * exact.
 *
 * The import is dynamic so a missing or broken sharp binary degrades to "no
 * PNG favicon" rather than taking down every route that imports this module
 * at build time.
 */

let warned = false;

export async function svgToPng(svg: string, size: number): Promise<Uint8Array | null> {
  try {
    const { default: sharp } = await import('sharp');

    const png = await sharp(Buffer.from(svg), { density: 384 })
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    return new Uint8Array(png);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.warn(
        '[icon] sharp could not rasterise the site mark, so PNG and ICO ' +
          'favicons are unavailable. The SVG favicon is unaffected. ' +
          `Reason: ${(error as Error).message}`,
      );
    }
    return null;
  }
}
