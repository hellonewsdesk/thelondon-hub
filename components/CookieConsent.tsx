'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * UK PECR / GDPR consent gate.
 *
 * PECR requires opt-IN for non-essential storage: analytics scripts must not
 * run before a positive choice. This component therefore gates loading rather
 * than merely announcing it — the GA loader in ConsentScripts reads the same
 * cookie and stays inert until it says "accepted".
 *
 * The site runs no advertising (adsense is disabled across config), so
 * analytics is the only non-essential category and the banner says so
 * plainly. The copy below asserts "no advertising, no data sale" — if either
 * ever changes, this copy, the privacy policy and the CSP must change in the
 * same commit.
 *
 * Choice is stored in a first-party cookie (not localStorage) so the server
 * can read it on the next request. No third-party CMP, no vendor list.
 */

export const CONSENT_COOKIE = 'lh_consent';
export type ConsentValue = 'accepted' | 'rejected';

function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  const value = match?.split('=')[1];
  return value === 'accepted' || value === 'rejected' ? value : null;
}

function writeConsent(value: ConsentValue): void {
  // 6 months, matching ICO guidance on re-asking.
  const maxAge = 60 * 60 * 24 * 182;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  // Starts "decided" and flips in the effect: the banner renders NOTHING
  // until the cookie has actually been read, which avoids a flash of the
  // banner for readers who already chose.
  const [decided, setDecided] = useState<boolean>(true);

  useEffect(() => {
    setDecided(readConsent() !== null);
  }, []);

  function choose(value: ConsentValue) {
    writeConsent(value);
    setDecided(true);
    // Loaders are gated at script-eval time, so a reload is the simplest
    // correct way to apply an acceptance. Rejection needs no reload.
    if (value === 'accepted') window.location.reload();
  }

  if (decided) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-heading"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[color:var(--border)] bg-[color:var(--paper)]"
    >
      <div className="container py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-[50rem]">
            <h2 id="consent-heading" className="kicker">
              Your privacy
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--ink-2)]">
              We use essential cookies to make this site work. With your consent
              we would also like to set analytics cookies so we can see which
              stories are read. We do not run advertising and we do not sell
              your data. You can change your mind at any time — see our{' '}
              <Link
                href="/privacy-policy/"
                className="underline decoration-[color:var(--accent)] underline-offset-2"
              >
                privacy policy
              </Link>
              .
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="btn btn--quiet"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="btn btn--primary"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
