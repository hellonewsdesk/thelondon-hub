'use client';

import { useState, type CSSProperties } from 'react';

/**
 * Share controls. Client component because it uses the Web Share API and the
 * clipboard; both degrade to plain links when unavailable.
 *
 * No third-party share widgets — they are tracking scripts with a button
 * attached, and would each need a CSP exemption.
 *
 * Designed to sit inside the article's bordered meta strip (.article-meta),
 * right-aligned by the strip's own justify-between — so the buttons are the
 * compact form of .btn--quiet. The inline size override exists because the
 * design-system .btn is unlayered CSS and always beats layered Tailwind
 * utilities; a padding utility here would silently lose.
 */

const COMPACT: CSSProperties = { padding: '0.375rem 0.625rem', fontSize: '0.75rem' };

export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const linkClass = 'btn btn--quiet';

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function onNativeShare() {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User dismissed the sheet — not an error worth surfacing.
      }
    }
    await onCopy();
  }

  return (
    <div
      role="group"
      aria-label="Share this story"
      className="flex flex-wrap items-center gap-1.5"
    >
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        style={COMPACT}
      >
        Facebook
      </a>
      <a
        href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        style={COMPACT}
      >
        X
      </a>
      <a
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        style={COMPACT}
      >
        WhatsApp
      </a>
      <a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} className={linkClass} style={COMPACT}>
        Email
      </a>
      <button type="button" onClick={onNativeShare} className={linkClass} style={COMPACT}>
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}
