import Link from 'next/link';
import type { Crumb } from '../lib/schema';
import { sectionStyleVars } from './section-style';

/**
 * Visible breadcrumb trail — docs/DESIGN.md § Article: Home / {Section} /
 * title in `--ink-3`, with the section crumb wearing its section colour
 * (`.breadcrumbs__section` + the inline colour pair, derived from the
 * `/category/{slug}/` path shape — recon-verified as the only category URL
 * form on this install). The matching BreadcrumbList JSON-LD is emitted
 * separately by the page, so this stays purely presentational.
 *
 * The last crumb is a truncating span with aria-current — CSS caps it at
 * 32ch so a full headline cannot wrap the trail.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs__list">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          const sectionSlug = isLast ? null : categorySlugFrom(crumb.path);
          return (
            <li key={crumb.path}>
              {isLast ? (
                <span aria-current="page">{crumb.name}</span>
              ) : (
                <>
                  {sectionSlug ? (
                    <Link
                      href={crumb.path}
                      className="breadcrumbs__section"
                      style={sectionStyleVars(sectionSlug)}
                    >
                      {crumb.name}
                    </Link>
                  ) : (
                    <Link href={crumb.path}>{crumb.name}</Link>
                  )}
                  <span className="breadcrumbs__sep" aria-hidden="true">
                    ›
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** `/category/uk-news/` → `uk-news`; anything else → null. */
function categorySlugFrom(path: string): string | null {
  const match = /^\/category\/([^/]+)\/?$/.exec(path);
  return match ? match[1] : null;
}
