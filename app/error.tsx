'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Route-level error boundary. Must be a client component (React requirement).
 *
 * Deliberately shows no stack trace or upstream message: WPError carries the
 * origin hostname and API path, which is not reader-facing information. The
 * digest is the only reference surfaced.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error:', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="container py-16">
      <div style={{ maxWidth: '44rem' }}>
        <p className="kicker">Something went wrong</p>
        <h1 className="h-lead mt-2">This page didn&rsquo;t load</h1>
        <p className="standfirst mt-4">
          We hit a problem fetching this story. It is usually temporary —
          please try again.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn btn--primary">
            Try again
          </button>
          <Link href="/" className="btn">
            Go to the front page
          </Link>
        </div>

        {error.digest ? <p className="meta mt-6">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
