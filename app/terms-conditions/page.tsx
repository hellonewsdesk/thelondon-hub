import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentSite } from '@/lib/site';
import { buildMetadata } from '@/lib/seo';
import { StaticPage } from '@/components/StaticPage';
import {
  hasCompanyNumber,
  hasPostalAddress,
  postalAddress,
  publisherName,
} from '@/lib/publisher';

export const revalidate = 86400;

/**
 * Lives at /terms-conditions/ — the live WordPress slug (recon-verified
 * 2026-09-10). Never /terms/: that shorter form exists only as a redirect
 * in next.config.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    title: 'Terms of use',
    description: `The terms on which you may use ${site.name}, including copyright, liability and governing law.`,
    path: '/terms-conditions/',
  });
}

export default async function TermsPage() {
  const site = await getCurrentSite();

  return (
    <StaticPage
      title="Terms of use"
      standfirst={`The terms on which ${site.name} is made available to you.`}
      updated="September 2026"
      crumbs={[
        { name: 'Home', path: '/' },
        { name: 'Terms of use', path: '/terms-conditions/' },
      ]}
    >
      <h2>1. About these terms</h2>
      <p>
        {site.siteUrl.replace(/^https?:\/\//, '')} is operated by{' '}
        {publisherName(site)} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
        {hasPostalAddress(site) ? `, registered office ${postalAddress(site)}` : ''}
        {hasCompanyNumber(site) ? `, company number ${site.publisher.companyNumber}` : ''}.
        By using this site you agree to these terms. If you do not agree to
        them, please do not use the site.
      </p>

      <h2>2. Changes</h2>
      <p>
        We may amend these terms from time to time. The version published on
        this page applies to your use of the site. We may also change, suspend
        or withdraw all or part of the site without notice.
      </p>

      <h2>3. Using the site</h2>
      <p>You may use this site for personal, non-commercial purposes. You must not:</p>
      <ul>
        <li>use it in any unlawful or fraudulent way;</li>
        <li>attempt to gain unauthorised access to it or any connected system;</li>
        <li>
          introduce malicious code, or attack it by denial-of-service or
          otherwise;
        </li>
        <li>
          systematically scrape, mine or reproduce content for republication or
          for training machine-learning models, without our written permission;
        </li>
        <li>remove or obscure any copyright or attribution notice.</li>
      </ul>

      <h2>4. Intellectual property</h2>
      <p>
        Content on this site is owned by us or our licensors and is protected by
        copyright and related rights. You may link to our pages, and quote
        limited extracts with clear attribution and a link, as permitted by fair
        dealing for reporting current events or criticism and review. Any wider
        reproduction requires our permission.
      </p>
      <p>
        Third-party material, including photographs and quoted reporting,
        remains the property of its owner and is used under licence, with
        permission, or as permitted by law.
      </p>

      <h2>5. Accuracy and reliance</h2>
      <p>
        We take care to report accurately, and correct errors when they are
        identified. If you believe something we have published is wrong, please
        tell us via our <Link href="/contact-us/">contact page</Link> — reports
        of factual error are treated as a priority.
      </p>
      <p>
        Content is provided for general information. It is not professional,
        legal, financial or medical advice, and you should not rely on it as
        such. Sports fixtures, results, prices and travel information may change
        after publication. See also our{' '}
        <Link href="/disclaimer/">disclaimer</Link>.
      </p>

      <h2>6. Links to other sites</h2>
      <p>
        Where we link to third-party sites, we do so for information. We do not
        control them and are not responsible for their content, availability or
        privacy practices.
      </p>

      <h2>7. Advertising</h2>
      <p>
        This site does not carry third-party advertising. If that changes, this
        clause and our{' '}
        <Link href="/privacy-policy/">privacy policy</Link> will be updated
        before any advertisement is served, and advertisements will be clearly
        distinguishable from editorial content.
      </p>

      <h2>8. Liability</h2>
      <p>
        Nothing in these terms excludes or limits our liability for death or
        personal injury caused by negligence, for fraud or fraudulent
        misrepresentation, or for any other liability that cannot be excluded
        under English law.
      </p>
      <p>
        Subject to that, we exclude all implied conditions and warranties to the
        fullest extent permitted by law, and we are not liable for loss of
        profit, business, goodwill, or any indirect or consequential loss
        arising from your use of the site.
      </p>
      <p>Nothing in these terms affects your statutory rights as a consumer.</p>

      <h2>9. Privacy</h2>
      <p>
        Our handling of personal data is set out in our{' '}
        <Link href="/privacy-policy/">privacy policy</Link>.
      </p>

      <h2>10. Governing law</h2>
      <p>
        These terms are governed by the law of England and Wales, and the courts
        of England and Wales have exclusive jurisdiction. If you live in
        Scotland or Northern Ireland, you may also bring proceedings in your
        home jurisdiction.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms:{' '}
        <a href={`mailto:${site.publisher.email}`}>{site.publisher.email}</a>.
      </p>

      {/* TODO(publisher): have these terms reviewed by a solicitor before
          launch. They are a reasonable starting structure, not legal advice,
          and clause 8 in particular should be checked against your actual
          insurance position. */}
    </StaticPage>
  );
}
