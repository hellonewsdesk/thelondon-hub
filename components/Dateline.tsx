'use client';

import { useEffect, useState } from 'react';

/**
 * The topbar dateline, kept honest against page caching.
 *
 * The date is rendered on the server so crawlers and no-JS readers get one,
 * but pages are cached — a legal page can revalidate on a 24-hour window, so
 * a server-rendered date can be a full day stale by the time someone reads
 * it. This re-computes from the reader's own clock on mount and corrects the
 * text if it has drifted.
 *
 * ALWAYS formatted in Europe/London regardless of where the reader is. This
 * is a London newspaper: at 01:00 in Karachi it is still the previous evening
 * in London, and the masthead must say what day it is in the city the paper
 * covers, not the city the reader happens to be in.
 *
 * `suppressHydrationWarning` because a legitimate server/client difference is
 * the entire point here — React would otherwise flag the correction as a
 * mismatch.
 */
export function Dateline({
  initial,
  locale,
  className,
}: {
  /** Server-rendered value — the initial HTML and the no-JS fallback. */
  initial: string;
  locale: string;
  className?: string;
}) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/London',
      })
        .formatToParts(new Date())
        // en-GB puts a comma after the weekday; a masthead dateline has none.
        .map((part) =>
          part.type === 'literal' ? part.value.replace(/,/g, '') : part.value,
        )
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

    setText(format());

    // Correct again on the hour, so a tab left open overnight does not sit on
    // yesterday's date.
    const timer = window.setInterval(() => setText(format()), 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [locale]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
