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
 * components) and must never be pulled into a client bundle: DOMPurify's
 * jsdom backend is ~2MB.
 */

import DOMPurify from 'isomorphic-dompurify';

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

/**
 * The subset of the DOM element API the hook touches. Declared structurally
 * so nothing here depends on a DOM lib global existing at runtime.
 */
interface ElementLike {
  tagName: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
}

/**
 * Hook registration is global to the DOMPurify instance, so it must happen
 * exactly once. Module scope gives us that for free.
 */
let hooksInstalled = false;

function installHooks(internalHost: string): void {
  if (hooksInstalled) return;
  hooksInstalled = true;

  DOMPurify.addHook('afterSanitizeAttributes', (rawNode) => {
    // NOT `instanceof Element`: on the server DOMPurify runs against jsdom,
    // whose Element constructor lives on the jsdom window rather than
    // globalThis. Referencing the bare global throws ReferenceError at
    // render time. Duck-typing is the portable check.
    const node = rawNode as unknown as ElementLike;
    if (typeof node?.tagName !== 'string') return;

    const tag = node.tagName.toLowerCase();

    if (tag === 'a') {
      const href = node.getAttribute('href') ?? '';

      // Drop anything that is not http(s), a fragment, or a root-relative path.
      if (href && !/^(https?:|\/|#|mailto:|tel:)/i.test(href)) {
        node.removeAttribute('href');
        return;
      }

      let external = false;
      if (/^https?:/i.test(href)) {
        try {
          external = new URL(href).hostname.replace(/^www\./, '') !== internalHost;
        } catch {
          external = true;
        }
      }

      if (external) {
        // Outbound links from syndicated copy are untrusted and unendorsed.
        node.setAttribute('rel', 'noopener noreferrer nofollow ugc');
        node.setAttribute('target', '_blank');
      } else {
        // Internal links stay bare and same-tab.
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
    }

    if (tag === 'img') {
      // Recon found 0 inline <img> in bodies today — this is the safety net
      // for the day the pipeline starts embedding them.
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
      // An unsized inline image is a guaranteed layout shift.
      if (!node.getAttribute('width')) node.setAttribute('width', '1200');
      if (!node.getAttribute('height')) node.setAttribute('height', '800');
    }

    if (tag === 'iframe') {
      const src = node.getAttribute('src') ?? '';
      if (!isAllowedIframe(src)) {
        node.remove();
        return;
      }
      node.setAttribute('loading', 'lazy');
      node.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      node.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-presentation allow-popups',
      );
      node.setAttribute('allowfullscreen', 'true');
    }
  });
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

  installHooks(internalHost.replace(/^www\./, ''));

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Belt and braces: these are already excluded by the allowlist, but being
    // explicit means a future edit to ALLOWED_TAGS cannot reintroduce them.
    FORBID_TAGS: ['script', 'style', 'noscript', 'form', 'input', 'button', 'object', 'embed', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: true,
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false,
  });
}
