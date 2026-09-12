import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentSite } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';
import { StaticPage } from '@/components/StaticPage';
import {
  hasCompanyNumber,
  hasIcoRegistration,
  hasLegalName,
  hasPostalAddress,
  postalAddress,
  publisherName,
} from '@/lib/publisher';

export const revalidate = 86400;

/**
 * Lives at /contact-us/ — the live WordPress URL (recon-verified 2026-09-10;
 * the newsroom address below was verified on that live contact page).
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: 'Contact us',
    description: `How to reach the ${site.name} newsroom — story tips, corrections, complaints and press enquiries.`,
    path: '/contact-us/',
  });
}

export default async function ContactPage() {
  const site = await getCurrentSite();

  return (
    <StaticPage
      title="Contact us"
      standfirst={`Tips, corrections, complaints and other enquiries for ${site.name}.`}
      updated="September 2026"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Contact', path: '/contact-us/' },
      ]}
      publisher={site}
    >
      <h2>Newsroom</h2>
      <p>
        Story tips and general editorial enquiries:{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>
      </p>
      <p>
        We read everything sent to us. We cannot always reply individually, but
        anything raising a factual error is treated as a priority.
      </p>

      <h2>Corrections and complaints</h2>
      <p>
        If you believe we have published something inaccurate, please tell us
        which article, which part of it is wrong, and what the correct position
        is. Include a link to the article where you can. Send it to{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>{' '}
        and we will look into it.
      </p>

      <h2>Data protection</h2>
      <p>
        Requests relating to your personal data should be sent to{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>.
        See our <Link href="/privacy-policy/">privacy policy</Link> for your
        rights and our response times.
      </p>

      {hasPostalAddress(site) || hasLegalName(site) ? (
        <>
          <h2>Postal address</h2>
          <p>
            {publisherName(site)}
            {hasPostalAddress(site) ? (
              <>
                <br />
                {postalAddress(site)}
              </>
            ) : null}
            <br />
            {site.publisher.country}
          </p>
          {hasCompanyNumber(site) || hasIcoRegistration(site) ? (
            <p>
              {hasCompanyNumber(site)
                ? `Company number ${site.publisher.companyNumber}. `
                : ''}
              {hasIcoRegistration(site)
                ? `ICO registration ${site.publisher.icoRegistration}.`
                : ''}
            </p>
          ) : null}
        </>
      ) : null}
    </StaticPage>
  );
}
