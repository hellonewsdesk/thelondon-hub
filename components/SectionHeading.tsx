import Link from 'next/link';

/**
 * The section motif — docs/DESIGN.md § Section header: colour swatch square
 * (CSS ::before) + Anton label + 2px colour rule + optional more-link. The
 * device that colour-codes every listing block; swatch and rule are drawn in
 * `.section-head` CSS, so this component stays markup-only.
 *
 * Colour: the component consumes `var(--section)` via its classes, so the
 * PARENT block sets the section pair (see components/section-style.ts) — or
 * doesn't, and the heading falls back to the brand green (the "Latest" case).
 *
 * When `href` is set the label class appears on both the h2 and the inner
 * Link — intentional: typography stays identical whether or not it links.
 */
export function SectionHeading({
  title,
  href,
  id,
  moreLabel = 'More',
  moreVariant = 'link',
}: {
  title: string;
  href?: string;
  /** Pair with the parent section's aria-labelledby. */
  id?: string;
  moreLabel?: string;
  /**
   * 'link' — the quiet coloured more-link of the section blocks.
   * 'button' — the bordered `View more` button of the Latest header.
   */
  moreVariant?: 'link' | 'button';
}) {
  return (
    <div className="section-head">
      <h2 id={id} className="section-head__label">
        {href ? (
          <Link href={href} className="section-head__label">
            {title}
          </Link>
        ) : (
          title
        )}
      </h2>

      <span className="section-head__rule" aria-hidden="true" />

      {href ? (
        <Link
          href={href}
          className={moreVariant === 'button' ? 'btn' : 'section-head__more'}
          // Never announce a bare "More".
          aria-label={`${moreLabel} ${title.toLowerCase()}`}
        >
          {moreLabel}
          <span aria-hidden="true"> →</span>
        </Link>
      ) : null}
    </div>
  );
}
