'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { SiteConfig } from '../config/sites';
import { CONSENT_COOKIE } from './CookieConsent';

/**
 * Loads GA4 ONLY after positive consent.
 *
 * PECR is opt-in: analytics tags must not be requested before the reader
 * accepts. Gating at mount (rather than firing and hoping a CMP suppresses
 * them) is what makes that true in practice. With no GA measurement id in
 * config (the current state for this site) nothing loads at all, consent or
 * not.
 *
 * This site carries no advertising, so there is no ad loader here and no
 * ad-network origin belongs in the CSP. If advertising is ever introduced it
 * has to be added in three places together: a loader here, the CSP
 * allowlist, and the cookie-banner and privacy-policy copy.
 *
 * `lazyOnload` keeps it clear of the LCP.
 */
export function ConsentScripts({ site }: { site: SiteConfig }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
    setAccepted(match?.split('=')[1] === 'accepted');
  }, []);

  const gaId = site.analytics.gaMeasurementId;

  if (!accepted || !gaId) return null;

  return (
    <>
      <Script
        id="ga4-src"
        strategy="lazyOnload"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script id="ga4-init" strategy="lazyOnload">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}
