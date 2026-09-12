import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentSite } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';
import { StaticPage } from '@/components/StaticPage';

export const revalidate = 86400;

/**
 * This page exists on the live WordPress install at /disclaimer/
 * (recon-verified 2026-09-10) and is therefore already indexed. Dropping it
 * in the rebuild would 404 a live URL, so it is carried across at the same
 * path.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: 'Disclaimer',
    description: `The basis on which ${site.name} publishes information, and the limits of what you should rely on it for.`,
    path: '/disclaimer/',
  });
}

export default async function DisclaimerPage() {
  const site = await getCurrentSite();

  return (
    <StaticPage
      title="Disclaimer"
      standfirst={`The basis on which ${site.name} publishes, and the limits of what you should rely on it for.`}
      updated="September 2026"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Disclaimer', path: '/disclaimer/' },
      ]}
    >
      <h2>General information only</h2>
      <p>
        Everything published on {site.name} is provided for general information.
        It is not professional advice, and it should not be treated as a
        substitute for advice from a qualified solicitor, accountant, financial
        adviser, doctor or other professional. Do not act, or refrain from
        acting, solely on the basis of something you read here.
      </p>

      <h2>Accuracy</h2>
      <p>
        We take reasonable care to report accurately and to correct errors
        promptly. If you believe something we have published is inaccurate,
        please tell us through our{' '}
        <Link href="/contact-us/">contact page</Link> — reports of factual
        error are treated as a priority.
      </p>
      <p>
        We do not warrant that every article is complete or free from error, and
        information can go out of date. Sports fixtures and results, match
        officials, transfer news, prices, opening times, travel and transport
        information, and health guidance all change — sometimes within minutes
        of publication. Check the primary source before relying on any of it.
      </p>

      <h2>Reporting drawn from other outlets</h2>
      <p>
        Where an article builds on reporting first published by another
        organisation, we attribute it and link to the original. The accuracy of
        that underlying reporting is the responsibility of the outlet that
        produced it. Where we quote, we reproduce the quotation as it appeared
        in the source named.
      </p>

      <h2>External links</h2>
      <p>
        Links to other websites are provided for convenience. We do not control
        those sites, do not endorse them, and are not responsible for their
        content, accuracy, availability or privacy practices.
      </p>

      <h2>Legal proceedings</h2>
      <p>
        Reports of criminal proceedings are published subject to reporting
        restrictions and to the principle that a defendant is presumed innocent
        until proven guilty. Nothing on this site should be read as a finding of
        guilt where a case has not been concluded.
      </p>

      <h2>Liability</h2>
      <p>
        Nothing here excludes or limits our liability for death or personal
        injury caused by negligence, for fraud, or for any other liability that
        cannot be excluded under the law of England and Wales. Subject to that,
        our liability is limited as set out in our{' '}
        <Link href="/terms-conditions/">terms of use</Link>. Your statutory
        rights as a consumer are unaffected.
      </p>

      <h2>Contact</h2>
      <p>
        If you believe something we have published is wrong, please tell us at{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a> —
        we would rather hear it from you than leave it uncorrected.
      </p>
    </StaticPage>
  );
}
