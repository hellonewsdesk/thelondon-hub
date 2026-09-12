import Link from 'next/link';

/**
 * Archive pagination — docs/DESIGN.md § Pagination: bordered square buttons,
 * the current page a filled section-colour square (`.pagination__current`
 * consumes `var(--section)`, so a category page's wrapper sets the pair and
 * the homepage archive falls back to the brand green).
 *
 * Real <a> elements so crawlers can walk the archive — the pages themselves
 * are noindex,follow, keeping thin pages out of the index while leaving the
 * links traversable. `buildHref` is injected (homePagePath /
 * categoryPagePath from lib/urls) so this component can never invent a URL
 * shape.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  label = 'Pagination',
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 2;
  const start = Math.max(1, page - windowSize);
  const end = Math.min(totalPages, page + windowSize);
  const numbers: number[] = [];
  for (let i = start; i <= end; i += 1) numbers.push(i);

  return (
    <nav aria-label={label} className="pagination">
      <ul className="pagination__list">
        {page > 1 ? (
          <li>
            <Link href={buildHref(page - 1)} rel="prev" className="pagination__link">
              ← Previous
            </Link>
          </li>
        ) : null}

        {start > 1 ? (
          <>
            <li>
              <Link href={buildHref(1)} className="pagination__link">
                1
              </Link>
            </li>
            {start > 2 ? (
              <li className="pagination__ellipsis" aria-hidden="true">
                …
              </li>
            ) : null}
          </>
        ) : null}

        {numbers.map((n) => (
          <li key={n}>
            {n === page ? (
              <span aria-current="page" className="pagination__current">
                {n}
              </span>
            ) : (
              <Link href={buildHref(n)} className="pagination__link">
                {n}
              </Link>
            )}
          </li>
        ))}

        {end < totalPages ? (
          <>
            {end < totalPages - 1 ? (
              <li className="pagination__ellipsis" aria-hidden="true">
                …
              </li>
            ) : null}
            <li>
              <Link href={buildHref(totalPages)} className="pagination__link">
                {totalPages}
              </Link>
            </li>
          </>
        ) : null}

        {page < totalPages ? (
          <li>
            <Link href={buildHref(page + 1)} rel="next" className="pagination__link">
              Next →
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
