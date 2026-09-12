/**
 * XML escaping for feeds and sitemaps.
 *
 * Headlines are syndicated content and routinely contain `&`, quotes and
 * smart punctuation. An unescaped ampersand makes the whole document
 * ill-formed, which silently kills the feed for every subscriber.
 */

const XML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ENTITIES[ch] ?? ch);
}

/**
 * Drop characters XML 1.0 forbids outright. WordPress occasionally emits
 * control bytes from pasted copy, and they cannot be escaped — only removed.
 *
 * Done by code point rather than a regex literal so the source file stays
 * free of raw control characters.
 */
export function stripInvalidXmlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    const legal =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      (code >= 0x10000 && code <= 0x10ffff);
    if (legal) out += ch;
  }
  return out;
}

export function xmlText(value: string): string {
  return escapeXml(stripInvalidXmlChars(value));
}

/** CDATA is still not a licence to include `]]>`. */
export function cdata(value: string): string {
  return `<![CDATA[${stripInvalidXmlChars(value).replace(/]]>/g, ']]&gt;')}]]>`;
}

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400',
} as const;
