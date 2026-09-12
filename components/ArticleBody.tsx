import type { CSSProperties } from 'react';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { getSection } from '../config/sections';
import { sanitizeArticleHtml } from '../lib/sanitize';
import { getPrimaryCategory, getTags } from '../lib/wp-helpers';

/**
 * Renders the WordPress body, followed by the tags row (bordered chips).
 *
 * The HTML passes through lib/sanitize.ts first, which strips the two inline
 * `<script type="application/ld+json">` blocks every article on this install
 * carries (recon-verified) — we emit our own NewsArticle schema and two
 * competing blocks is a Rich Results conflict.
 *
 * This is the ONLY place in the app that calls dangerouslySetInnerHTML on
 * remote content, and it never receives raw `content.rendered`.
 *
 * The section-colour pair is re-declared here (ArticleHeader is a sibling,
 * not an ancestor) so the prose h2 rules and blockquote border pick up the
 * article's section colour. Tags have no route on this install (recon found
 * no /tag/ archive and lib/urls has no tagPath) so the chips are labels, not
 * links — never invent a URL.
 */
export function ArticleBody({ site, post }: { site: SiteConfig; post: WPPost }) {
  const html = sanitizeArticleHtml(post.content?.rendered, {
    internalHost: site.hostname,
  });
  const tags = getTags(post);

  if (!html && tags.length === 0) return null;

  const category = getPrimaryCategory(post);
  const section = category ? getSection(category.slug) : null;
  const sectionVars = section
    ? ({ '--section-light': section.light, '--section-dark': section.dark } as CSSProperties)
    : undefined;

  return (
    <>
      {html ? (
        <div
          className="prose-article mt-8"
          style={sectionVars}
          // Sanitised above: no script, no style, no on* handlers, no
          // unlisted iframe.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}

      {tags.length > 0 ? (
        <ul className="tag-row list-none m-0 p-0" aria-label="Topics" style={sectionVars}>
          {tags.map((tag) => (
            <li key={tag.slug} className="chip chip--tag">
              {tag.name}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
