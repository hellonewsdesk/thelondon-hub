import Link from 'next/link';
import type { SiteConfig } from '../config/sites';
import { registrationLine } from '../lib/publisher';

/**
 * The Company column: the five REAL WordPress pages on this install
 * (recon-verified 2026-09-10) and nothing else. London's WP has NO
 * /corrections/ and NO /editorial-policy/ — do not add routes bwave has
 * that this install lacks; see config/route-allowlist.ts.
 */
const COMPANY_LINKS = [
  { label: 'About Us', href: '/about-us/' },
  { label: 'Contact Us', href: '/contact-us/' },
  { label: 'Privacy Policy', href: '/privacy-policy/' },
  { label: 'Terms & Conditions', href: '/terms-conditions/' },
  { label: 'Disclaimer', href: '/disclaimer/' },
] as const;

/**
 * Four-column footer on the chrome, separated from the well by the 3px
 * green top border (docs/DESIGN.md): brand + tagline; Sections (site.nav);
 * Company (the five real WP pages); Network (home, RSS, sitemap). Bottom
 * bar: © year + site name, publisher email, and the registration line once
 * real details exist in config.
 *
 * Server component. `now` is the request-time clock threaded from the
 * layout — never `new Date()` here — so every component that formats time
 * agrees, and the year is computed in the paper's own timezone: on 31
 * December a server in Washington is an hour behind London's new year.
 */
export function Footer({ site, now }: { site: SiteConfig; now: Date }) {
  const year = new Intl.DateTimeFormat(site.locale, {
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(now);

  // Empty until real registration details exist in config/sites.ts — a
  // footer reading "Company no. [TODO]" is worse than no line.
  const registration = registrationLine(site);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href="/" className="footer__wordmark">
              {site.name}
            </Link>
            <p className="footer__tagline">{site.tagline}</p>
          </div>

          <nav aria-label="Sections">
            <h2 className="footer__heading">Sections</h2>
            <ul className="footer__links">
              {site.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="footer__link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h2 className="footer__heading">Company</h2>
            <ul className="footer__links">
              {COMPANY_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="footer__link">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Network">
            <h2 className="footer__heading">Network</h2>
            <ul className="footer__links">
              <li>
                <Link href="/" className="footer__link">
                  {site.name}
                </Link>
              </li>
              {/* Plain anchors: these are XML documents served by route
                  handlers, not app pages for the client router to soft-
                  navigate into. */}
              <li>
                <a href="/feed.xml" className="footer__link">
                  RSS feed
                </a>
              </li>
              <li>
                <a href="/sitemap.xml" className="footer__link">
                  Sitemap
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="footer__bottom">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>
            <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>
          </p>
          {registration ? <p>{registration}</p> : null}
        </div>
      </div>
    </footer>
  );
}
