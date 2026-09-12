/**
 * Date and text formatting.
 *
 * All dates are formatted with an explicit locale (passed in) and a
 * Europe/London timezone rather than the server default — a Vercel box in
 * Washington would otherwise date a British newspaper a day early.
 */

const TIMEZONE = 'Europe/London';

/**
 * WP returns naive local datetimes ("2026-09-08T22:44:31") with no offset.
 * `date_gmt` carries the UTC value. Treat the bare form as UTC so ordering
 * and the 48h news window stay correct.
 */
export function parseWpDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * "Wednesday 9 September 2026" — the topbar dateline.
 *
 * Built from parts rather than `.format()`: en-GB inserts a comma after the
 * weekday ("Wednesday, 9 September"), and a newspaper dateline does not carry
 * one. Dropping literal separators that are only a comma keeps the spacing
 * correct without a locale-specific string hack.
 */
export function formatMastheadDate(date: Date, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).formatToParts(date);

  return parts
    .map((part) =>
      part.type === 'literal' && part.value.includes(',')
        ? part.value.replace(/,/g, '')
        : part.value,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "9 September 2026" */
export function formatDate(value: string | Date | null | undefined, locale: string): string {
  const date = value instanceof Date ? value : parseWpDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(date);
}

/** "9 Sep 2026, 22:44" — compact byline form. */
export function formatDateTime(
  value: string | Date | null | undefined,
  locale: string,
): string {
  const date = value instanceof Date ? value : parseWpDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  }).format(date);
}

/**
 * "3 hours ago" for anything under a week, an absolute date beyond that.
 * News readers care about recency; a two-month-old story does not benefit
 * from "62 days ago".
 *
 * `now` is a parameter, not read inside: callers inside cached compositions
 * must pass a bucketed/stable clock or freeze it at render.
 */
export function formatRelative(
  value: string | Date | null | undefined,
  locale: string,
  now: Date,
): string {
  const date = value instanceof Date ? value : parseWpDate(value);
  if (!date) return '';

  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) return 'Just now';

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absMinutes < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day');

  return formatDate(date, locale);
}

/** Machine-readable value for `<time dateTime>`. */
export function isoDateTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseWpDate(value);
  return date ? date.toISOString() : '';
}

/**
 * Google caps `headline` in NewsArticle at 110 characters and will drop the
 * whole rich result if it is exceeded. Truncate on a word boundary.
 */
export function truncateHeadline(text: string, maxLen = 110): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLen * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}
