import type { ReactNode } from 'react';
import type { Crumb } from '../lib/schema';
import type { SiteConfig } from '../config/sites';
import { Breadcrumbs } from './Breadcrumbs';
import {
  hasPostalAddress,
  postalAddress,
  publisherName,
  registrationLine,
} from '../lib/publisher';

/**
 * Shared shell for the standing pages (About, Contact, policies — the five
 * live WordPress pages plus the archive).
 *
 * H1 band in the brand accent (the .cat-band device with no section pair
 * set falls back to --accent), then the page copy inside .prose-article at
 * the 66ch measure — editorial and article copy share one typographic
 * system, because these pages are read, not skimmed.
 *
 * The optional publisher block renders ONLY the identity fields that exist
 * in config: legal name, address, company/ICO registration are all unset
 * until the publisher supplies real values, and a page reading
 * "Company no. [TODO]" is worse than one that omits the line. Nothing here
 * invents a fact.
 */
export function StaticPage({
  title,
  standfirst,
  updated,
  crumbs,
  publisher,
  children,
}: {
  title: string;
  standfirst?: string;
  /** Human-readable review date, e.g. "September 2026". */
  updated?: string;
  crumbs: Crumb[];
  /** Pass the site to append its publisher-identity block (Contact/About). */
  publisher?: SiteConfig;
  children: ReactNode;
}) {
  return (
    <>
      <div className="container">
        <Breadcrumbs crumbs={crumbs} />
      </div>

      <div className="container pb-16">
        <header className="cat-band">
          <h1 className="cat-band__title">{title}</h1>
          {standfirst ? <p className="cat-band__desc">{standfirst}</p> : null}
          {updated ? (
            <p className="cat-band__count">Last reviewed: {updated}</p>
          ) : null}
        </header>

        <div className="prose-article">{children}</div>

        {publisher ? (
          <aside
            aria-label="Publisher details"
            className="mt-12 border border-[color:var(--border)] p-5"
            style={{ maxWidth: 'var(--measure)' }}
          >
            <h2 className="kicker">Publisher</h2>
            <p className="mt-2">{publisherName(publisher)}</p>
            {hasPostalAddress(publisher) ? <p>{postalAddress(publisher)}</p> : null}
            <p>
              <a
                href={`mailto:${publisher.publisher.email}`}
                className="underline decoration-[color:var(--accent)] underline-offset-2"
              >
                {publisher.publisher.email}
              </a>
            </p>
            <p>{publisher.publisher.country}</p>
            {registrationLine(publisher) ? (
              <p className="meta mt-2">{registrationLine(publisher)}</p>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  );
}
