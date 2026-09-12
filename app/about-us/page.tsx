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
 * Lives at /about-us/ because that is the live WordPress URL
 * (recon-verified 2026-09-10) — never /about/, which exists only as a
 * redirect in next.config.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: `About ${site.name}`,
    description: `Who we are, what we cover and how to reach us. ${site.name} — ${site.tagline.toLowerCase()} — covering the UK, the world and ${site.city}.`,
    path: '/about-us/',
  });
}

export default async function AboutPage() {
  const site = await getCurrentSite();

  return (
    <StaticPage
      title={`About ${site.name}`}
      standfirst={`${site.tagline}. News from the UK and the world, with ${site.city} at the centre of it.`}
      updated="September 2026"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'About us', path: '/about-us/' },
      ]}
      publisher={site}
    >
      <h2>What we do</h2>
      <p>
        {site.name} is an independent digital news publication based around{' '}
        {site.city}. We cover UK and world news, football and the wider
        sporting week, technology, entertainment, lifestyle, business and
        politics — the stories that matter nationally, read from the capital.
      </p>
      <p>
        Our aim is straightforward: to tell readers what has happened, why it
        matters, and where the information came from. Where a story builds on
        reporting by another organisation, we say so and link to the original.
      </p>

      <h2>Who publishes this site</h2>
      <p>
        {site.name} is published by {publisherName(site)}
        {hasLegalName(site) ? `, registered in the ${site.publisher.country}` : ''}
        {hasCompanyNumber(site)
          ? ` under company number ${site.publisher.companyNumber}`
          : ''}
        {hasPostalAddress(site) ? `. Our registered office is ${postalAddress(site)}` : ''}
        .
      </p>
      {hasIcoRegistration(site) ? (
        <p>
          We are registered with the Information Commissioner&rsquo;s Office
          under registration {site.publisher.icoRegistration}.
        </p>
      ) : null}
      <p>
        You can reach the newsroom at{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>.
      </p>

      <h2>Corrections</h2>
      <p>
        We correct errors promptly and openly. If you believe we have published
        something inaccurate, email{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>{' '}
        with a link to the article, the part you believe is wrong, and the
        correct position. Anything raising a factual error is treated as a
        priority.
      </p>

      <h2>How we are funded</h2>
      <p>This site carries no advertising and no sponsored content.</p>
      {/* TODO(publisher): state how the site is actually funded — reader
          support, a parent company, grant funding. Google News reviewers look
          for this and readers are entitled to know who pays for what they
          read. Replace the paragraph above once the model is settled. */}
      <p>We do not take payment to publish, amend or remove a story.</p>
      <p>
        Whatever the funding source, editorial decisions are made independently
        of it. If we ever publish sponsored or commercial content, it will be
        labelled as such.
      </p>
      {/* TODO(publisher): if an editorial-policy page (how stories are
          produced, sourcing standards, any AI-assisted production) is ever
          approved and published in WordPress, add the route AND an entry in
          config/route-allowlist.ts, then link it from here. Do not invent
          the page before the publisher signs it off. */}

      <h2>Contact us</h2>
      <p>
        For story tips, corrections, or any other enquiry, see our{' '}
        <Link href="/contact-us/">contact page</Link>.
      </p>
    </StaticPage>
  );
}
