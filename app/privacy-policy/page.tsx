import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentSite } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';
import { StaticPage } from '@/components/StaticPage';
import {
  hasCompanyNumber,
  hasIcoRegistration,
  hasPostalAddress,
  postalAddress,
  publisherName,
} from '@/lib/publisher';

export const revalidate = 86400;

/**
 * Lives at /privacy-policy/ — the live WordPress URL (recon-verified
 * 2026-09-10), already indexed, carried across at the same path.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: 'Privacy policy',
    description: `How ${site.name} collects, uses and protects personal data, your rights under UK GDPR, and how we use cookies.`,
    path: '/privacy-policy/',
  });
}

export default async function PrivacyPolicyPage() {
  const site = await getCurrentSite();

  return (
    <StaticPage
      title="Privacy policy"
      standfirst="How we collect, use and protect personal data, and the rights you have under UK data protection law."
      updated="September 2026"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Privacy policy', path: '/privacy-policy/' },
      ]}
    >
      <h2>Who we are</h2>
      <p>
        {site.name} is published by {publisherName(site)}
        {hasPostalAddress(site) ? `, registered office ${postalAddress(site)}` : ''},{' '}
        {site.publisher.country}
        {hasCompanyNumber(site) ? `. Company number ${site.publisher.companyNumber}` : ''}.
      </p>
      <p>
        For the purposes of the UK General Data Protection Regulation (UK GDPR)
        and the Data Protection Act 2018, we are the data controller for
        personal data collected through this website.
        {hasIcoRegistration(site)
          ? ` We are registered with the Information Commissioner’s Office under registration ${site.publisher.icoRegistration}.`
          : ''}
      </p>
      <p>
        Data protection enquiries:{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>.
      </p>
      {/* TODO(publisher): if a Data Protection Officer is ever appointed, name
          them and give their contact details here — UK GDPR Art. 13(1)(b). */}

      <h2>What data we collect</h2>
      <ul>
        <li>
          <strong>Information you give us.</strong> If you contact us, we
          receive the contents of your message and any contact details you
          include.
        </li>
        <li>
          <strong>Technical data.</strong> When you visit the site, our servers
          and our hosting provider record standard request data including IP
          address, browser type, referring page and the pages you view. This is
          used to deliver the site securely and to diagnose faults.
        </li>
        <li>
          <strong>Analytics data.</strong> If you consent, we set cookies and
          similar technologies to measure readership. See the cookies section
          below. We do not run advertising on this site, so no advertising or
          ad-measurement cookies are set.
        </li>
      </ul>
      <p>
        We do not ask for or knowingly collect special category data, and we do
        not knowingly collect personal data from children under 13.
      </p>

      <h2>Legal bases</h2>
      <ul>
        <li>
          <strong>Consent</strong> — for non-essential cookies and similar
          technologies — analytics only on this site. You can withdraw consent
          at any time.
        </li>
        <li>
          <strong>Legitimate interests</strong> — for operating and securing the
          site, preventing abuse, and responding to correspondence you initiate.
        </li>
        <li>
          <strong>Legal obligation</strong> — where we must retain or disclose
          data to comply with the law.
        </li>
      </ul>

      <h2>Cookies and similar technologies</h2>
      <p>
        Under the Privacy and Electronic Communications Regulations (PECR),
        non-essential cookies require your consent before they are set. We ask
        for that consent through the banner shown on your first visit, and we do
        not load analytics scripts until you accept.
      </p>
      <ul>
        <li>
          <strong>Strictly necessary cookies.</strong> We store your cookie
          choice in a first-party cookie so we do not ask again on every page.
          This does not require consent.
        </li>
        <li>
          <strong>Analytics cookies.</strong> Used to understand which stories
          are read and how the site performs. Set only with your consent.
        </li>
      </ul>
      <p>
        You can change your mind at any time by clearing this site&rsquo;s
        cookies in your browser, which will cause the consent banner to appear
        again. You can also control cookies through your browser settings.
      </p>
      <p>
        <strong>We do not carry advertising on this site.</strong> No ad
        network, ad exchange or ad-measurement provider receives your data, and
        no advertising cookies are set — with or without consent.
      </p>
      {/* TODO(publisher): list every analytics and consent vendor actually
          deployed. Naming one while running others is a transparency failure
          under UK GDPR Art. 13. If advertising is ever introduced, this
          section and the cookie banner must be rewritten before the first ad
          is served. */}

      <h2>Who we share data with</h2>
      <p>
        We share data with service providers who help us run the site — hosting,
        content delivery and, if you consent, analytics. These providers process
        data on our instructions. We do not share data with advertising networks
        or data brokers, and we do not sell personal data.
      </p>
      <p>
        Some providers process data outside the UK. Where they do, transfers are
        made under UK adequacy regulations or the International Data Transfer
        Agreement / Addendum.
      </p>
      {/* TODO(publisher): confirm the specific transfer mechanism your hosting
          and analytics providers rely on, and name it here. */}

      <h2>How long we keep data</h2>
      <p>
        Server and security logs are retained for a limited operational period.
        Correspondence is retained for as long as needed to deal with the matter
        raised and any follow-up. Analytics data is retained according to the
        settings of the analytics provider.
      </p>
      {/* TODO(publisher): state actual retention periods once the hosting and
          analytics configuration is fixed. */}

      <h2>Your rights</h2>
      <p>Under UK GDPR you have the right to:</p>
      <ul>
        <li>access the personal data we hold about you;</li>
        <li>have inaccurate data corrected;</li>
        <li>have data erased in certain circumstances;</li>
        <li>restrict or object to processing;</li>
        <li>data portability, where processing is by consent or contract;</li>
        <li>withdraw consent at any time, without affecting prior processing.</li>
      </ul>
      <p>
        To exercise any of these rights, contact {site.publisher.email}. We will
        respond within one month.
      </p>
      <p>
        If you are unhappy with how we have handled your data, you can complain
        to the Information Commissioner&rsquo;s Office at{' '}
        <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">
          ico.org.uk
        </a>{' '}
        or on 0303 123 1113.
      </p>

      <h2>Journalism exemption</h2>
      <p>
        Where we process personal data for journalism, the Data Protection Act
        2018 provides exemptions from certain provisions of the UK GDPR where
        compliance would be incompatible with journalistic purposes and
        publication is in the public interest. We rely on this exemption only
        where it genuinely applies.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy. Material changes will be reflected in the
        review date at the top of this page. See also our{' '}
        <Link href="/terms-conditions/">terms of use</Link>.
      </p>
    </StaticPage>
  );
}
