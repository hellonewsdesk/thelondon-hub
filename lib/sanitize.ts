/**
 * Server-side sanitisation of `content.rendered`.
 *
 * Recon fact (verified 2026-09-10): every article body on this install
 * carries 2 inline `<script type="application/ld+json">` blocks injected
 * upstream. We emit our own NewsArticle schema, and two competing schema
 * blocks is a Rich Results conflict — so scripts are stripped wholesale,
 * not merely escaped.
 *
 * This module is server-only by construction (it is imported from server
 * components) and must never be pulled into a client bundle: sanitize-html is pure JS
 * (htmlparser2) — no jsdom, so it loads in any serverless runtime.
 */

import sanitizeHtml from 'sanitize-html';

/** Hosts allowed to appear in an <iframe>. Everything else is dropped. */
const IFRAME_ALLOWLIST = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
];

function isAllowedIframe(src: string): boolean {
  try {
    const url = new URL(src, 'https://example.invalid');
    return url.protocol === 'https:' && IFRAME_ALLOWLIST.includes(url.hostname);
  } catch {
    return false;
  }
}

/** Tags we allow through. Recon says bodies only use a small prose subset. */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
  'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'cite', 'q',
  'a', 'img', 'figure', 'figcaption', 'picture', 'source',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'hr', 'pre', 'code', 'span', 'div', 'time', 'abbr', 'small',
  'iframe',
];

const ALLOWED_ATTR = [
  'href', 'title', 'alt', 'src', 'srcset', 'sizes', 'width', 'height',
  'target', 'rel', 'loading', 'decoding', 'referrerpolicy', 'sandbox',
  'allowfullscreen', 'datetime', 'colspan', 'rowspan', 'scope', 'cite',
  'lang', 'dir',
  // `class` is allowed so WP alignment classes survive; globals.css styles them.
  'class',
];

export interface SanitizeOptions {
  /** Bare hostname of the site being rendered — decides internal vs external links. */
  internalHost: string;
}

/**
 * Returns HTML safe to pass to `dangerouslySetInnerHTML`.
 *
 * Guarantees: no `<script>`, no `<style>`, no `on*` handlers, no `javascript:`
 * URLs, no `<form>`, and no iframe outside the video allowlist.
 */
export function sanitizeArticleHtml(
  html: string | undefined | null,
  { internalHost }: SanitizeOptions,
): string {
  if (!html) return '';

  const host = internalHost.replace(/^www\./, '');

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { '*': ALLOWED_ATTR },
    // `script`/`style` content is dropped, not kept as text.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
    // http(s), mailto and tel only; root-relative and fragment links carry no scheme.
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
    allowProtocolRelative: false,
    // Iframes survive only for the video allowlist.
    exclusiveFilter: (frame) =>
      frame.tag === 'iframe' && !isAllowedIframe(frame.attribs.src ?? ''),
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';
        let external = false;
        if (/^https?:/i.test(href)) {
          try {
            external = new URL(href).hostname.replace(/^www\./, '') !== host;
          } catch {
            external = true;
          }
        }
        const rest = { ...attribs };
        delete rest.target;
        delete rest.rel;
        return {
          tagName,
          attribs: external
            ? { ...rest, rel: 'noopener noreferrer nofollow ugc', target: '_blank' }
            : rest,
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: 'lazy',
          decoding: 'async',
          // An unsized inline image is a guaranteed layout shift.
          width: attribs.width || '1200',
          height: attribs.height || '800',
        },
      }),
      iframe: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          loading: 'lazy',
          referrerpolicy: 'strict-origin-when-cross-origin',
          sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
          allowfullscreen: 'true',
        },
      }),
    },
  });
}
