import type { CSSProperties } from 'react';

/**
 * Skeleton for the search route ONLY.
 *
 * There is deliberately NO root app/loading.tsx. A root loading boundary
 * makes Next flush the shell — with a 200 status — before the page component
 * runs, so a later notFound() can only swap in the 404 markup and every
 * missing story answers 200. Soft 404s waste crawl budget and Google reports
 * them as a quality problem, which is unacceptable on a site whose whole
 * point is SEO.
 *
 * Search is safe: it always returns 200, and it is the one genuinely slow
 * route (force-dynamic against an uncached upstream query), so it is where a
 * skeleton earns its place. Every block reserves the space the real content
 * occupies (same container, same header border, same grid), so the swap
 * costs no layout shift.
 *
 * Styling is inline on purpose: globals.css carries no skeleton classes, and
 * these grey blocks (static planes of --rule, square, unanimated) exist only
 * in this file.
 */

const WELL_GRID: CSSProperties = {
  display: 'grid',
  gap: 'var(--gutter)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
};

function bar(height: number, width: number | string): CSSProperties {
  return { height, width, maxWidth: '100%', background: 'var(--rule)' };
}

export default function Loading() {
  return (
    <div
      className="container"
      style={{ paddingBlock: '2rem 0' }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading results…</span>

      {/* Header: kicker line, headline line, search form slot. */}
      <div style={{ paddingBottom: '1.5rem', borderBottom: '2px solid var(--rule)' }}>
        <div style={bar(12, 64)} />
        <div style={{ ...bar(38, '60%'), marginTop: '0.75rem' }} />
        <div style={{ ...bar(44, '28rem'), marginTop: '1.25rem' }} />
      </div>

      {/* Result grid: six standard-card ghosts (image, kicker, two headline
          lines) matching the real card's border + 16:9 media box. */}
      <div style={{ ...WELL_GRID, marginTop: '2rem' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ border: '1px solid var(--rule)' }}>
            <div style={{ aspectRatio: '16 / 9', background: 'var(--rule)' }} />
            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div style={bar(12, 80)} />
              <div style={bar(18, '100%')} />
              <div style={bar(18, '75%')} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
