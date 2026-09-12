/**
 * JSON-LD builders.
 *
 * We are the ONLY source of structured data on this site: the inbound
 * `content.rendered` carries two inline JSON-LD blocks per post (recon-
 * verified) and lib/sanitize.ts strips them, because two competing
 * NewsArticle blocks on one page is a Rich Results conflict.
 *
 * Everything links by `@id` rather than repeating the publisher object on
 * every page, so the graph is connected: an article's `publisher` points at
 * the one NewsMediaOrganization node declared in the root layout.
 *
 * Typed as JsonLdValue throughout — no hand-written JSON strings — and
 * rendered through <JsonLd>, which escapes `<` to defeat script-tag breakout.
 */

import type { SiteConfig } from '../config/sites';
import type { WPCategory, WPPost } from '../types/wp';
import {
  absoluteUrl,
  authorPath,
  categoryPath,
  ogImagePath,
  postPath,
  searchPath,
} from './urls';
import {
  excerptText,
  getAuthor,
  getFeaturedImage,
  getPrimaryCategory,
  getTags,
  postTitle,
  stripHtml,
} from './wp-helpers';
import { isoDateTime, truncateHeadline } from './format';
import { publisherName } from './publisher';

export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | JsonLdValue[]
  | { [key: string]: JsonLdValue | undefined };

export type JsonLdObject = { [key: string]: JsonLdValue | undefined };

/* ==========================================================================
   Stable @id anchors. Every cross-reference uses these, never a re-declared
   object, so the graph stays connected and deduplicated.
   ========================================================================== */

export const ID = {
  organization: (site: SiteConfig) => absoluteUrl(site, '/#organization'),
  website: (site: SiteConfig) => absoluteUrl(site, '/#website'),
  logo: (site: SiteConfig) => absoluteUrl(site, '/#logo'),
  article: (site: SiteConfig, slug: string) =>
    `${absoluteUrl(site, postPath(slug))}#article`,
  person: (site: SiteConfig, slug: string) =>
    `${absoluteUrl(site, authorPath(slug))}#person`,
};

/* ==========================================================================
   Organization
   ========================================================================== */

/**
 * NewsMediaOrganization — more specific than Organization, and the type
 * Google's news systems expect from a publisher.
 *
 * Policy-page properties (publishingPrinciples, correctionsPolicy,
 * ethicsPolicy, …) are deliberately ABSENT: this WordPress install has no
 * editorial-policy or corrections page (recon-verified — the only live pages
 * are About Us, Contact Us, Privacy Policy, Terms & Conditions, Disclaimer
 * and All Post), and a policy URL that 404s or points at boilerplate is
 * worse than omitting the property. If the publisher ships those pages,
 * add the properties here in the same shape bwave uses.
 */
export function organizationSchema(site: SiteConfig): JsonLdObject {
  const sameAs = site.social.map((s) => s.url).filter(Boolean);

  return {
    '@type': 'NewsMediaOrganization',
    '@id': ID.organization(site),
    name: site.name,
    legalName: publisherName(site),
    url: absoluteUrl(site, '/'),
    description: site.tagline,

    // Rendered by app/logo.png/route.tsx, which owns these dimensions: 600x60
    // is Google's recommended publisher-logo shape. The numbers here are the
    // route's WIDTH/HEIGHT constants — they must not be guessed, and if the
    // route changes shape this block changes with it.
    logo: {
      '@type': 'ImageObject',
      '@id': ID.logo(site),
      url: absoluteUrl(site, '/logo.png'),
      contentUrl: absoluteUrl(site, '/logo.png'),
      width: 600,
      height: 60,
      caption: site.name,
    },
    image: { '@id': ID.logo(site) },

    // Trust and accountability. Every URL below is a live page.
    masthead: absoluteUrl(site, '/about-us/'),
    ownershipFundingInfo: absoluteUrl(site, '/about-us/'),

    areaServed: {
      '@type': 'Place',
      name: `${site.city}, ${site.region}`,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'editorial',
      email: site.publisher.email,
      url: absoluteUrl(site, '/contact-us/'),
      availableLanguage: 'English',
    },

    // Omitted deliberately rather than guessed: foundingDate, address,
    // and sameAs stay absent until the publisher supplies real values.
    // [TODO] foundingDate — supply the real date the title launched.
    // [TODO] sameAs — supply the social profile URLs (config.social).
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function webSiteSchema(site: SiteConfig): JsonLdObject {
  return {
    '@type': 'WebSite',
    '@id': ID.website(site),
    url: absoluteUrl(site, '/'),
    name: site.name,
    description: site.tagline,
    inLanguage: site.locale,
    publisher: { '@id': ID.organization(site) },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: absoluteUrl(site, `${searchPath()}?q={search_term_string}`),
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Root graph: the two nodes every other page references by @id. */
export function rootGraph(site: SiteConfig): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema(site), webSiteSchema(site)],
  };
}

/* ==========================================================================
   Article
   ========================================================================== */

/** Rough word count from the rendered body — for NewsArticle.wordCount. */
function wordCount(post: WPPost): number {
  const text = stripHtml(post.content?.rendered);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Image object(s) for an article.
 *
 * With a real featured image (the normal case here — 99 of 100 sampled posts
 * carry one, typically 1200x800), Google prefers multiple aspect ratios —
 * 16:9, 4:3 and 1:1 — so it can pick per surface. WordPress serves the
 * original and we cannot crop server-side here, so the single source URL is
 * declared once with its true dimensions rather than lying about three crops
 * that do not exist.
 *
 * With no featured image (rare, but wp:featuredmedia is still optional) the
 * generated /og/<slug>/ card stands in at 1200x630 — an Article with no
 * image is ineligible for most rich results, so the fallback matters.
 */
function articleImages(site: SiteConfig, post: WPPost): JsonLdValue {
  const featured = getFeaturedImage(post);

  if (featured) {
    return {
      '@type': 'ImageObject',
      url: featured.url,
      ...(featured.width ? { width: featured.width } : {}),
      ...(featured.height ? { height: featured.height } : {}),
      ...(featured.alt ? { caption: featured.alt } : {}),
    };
  }

  return {
    '@type': 'ImageObject',
    url: absoluteUrl(site, ogImagePath(post.slug)),
    width: 1200,
    height: 630,
  };
}

export function newsArticleSchema(site: SiteConfig, post: WPPost): JsonLdObject {
  const url = absoluteUrl(site, postPath(post.slug));
  const author = getAuthor(post);
  const category = getPrimaryCategory(post);
  const tags = getTags(post).map((t) => t.name);
  const words = wordCount(post);

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': ID.article(site, post.slug),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,

    // Google drops the rich result entirely above 110 characters.
    headline: truncateHeadline(postTitle(post), 110),
    description: excerptText(post, 200),

    // ISO 8601 — isoDateTime resolves the naive WP timestamp (Europe/London
    // install) rather than trusting the server's local zone.
    datePublished: isoDateTime(post.date),
    dateModified: isoDateTime(post.modified || post.date),

    inLanguage: site.locale,
    image: articleImages(site, post),

    author: author
      ? {
          '@type': 'Person',
          '@id': ID.person(site, author.slug),
          name: author.name,
          url: absoluteUrl(site, authorPath(author.slug)),
        }
      : { '@id': ID.organization(site) },

    publisher: { '@id': ID.organization(site) },
    isPartOf: { '@id': ID.website(site) },

    ...(category ? { articleSection: category.name } : {}),
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
    ...(words > 0 ? { wordCount: words } : {}),
    isAccessibleForFree: true,
  };
}

/* ==========================================================================
   Navigation and collections
   ========================================================================== */

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbSchema(site: SiteConfig, crumbs: Crumb[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(site, crumb.path),
    })),
  };
}

/**
 * CollectionPage for a category, carrying an ItemList of the posts actually
 * visible on that page — so the list matches what a crawler sees, in order.
 */
export function collectionPageSchema(
  site: SiteConfig,
  category: WPCategory,
  path: string,
  description: string,
  posts: WPPost[] = [],
): JsonLdObject {
  const url = absoluteUrl(site, path);
  const name = stripHtml(category.name) || category.slug;

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    url,
    name: `${name} news`,
    description,
    isPartOf: { '@id': ID.website(site) },
    inLanguage: site.locale,
    ...(posts.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: posts.length,
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
            itemListElement: posts.map((post, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: postTitle(post),
              url: absoluteUrl(site, postPath(post.slug)),
            })),
          },
        }
      : {}),
  };
}

/**
 * ItemList for the homepage headlines — tells Google the front page is a
 * ranked list of stories rather than an undifferentiated blob of links.
 * Positions are 1-based and match the visual order.
 */
export function itemListSchema(
  site: SiteConfig,
  posts: { slug: string; title: string }[],
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absoluteUrl(site, '/')}#headlines`,
    name: `Top stories — ${site.name}`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: post.title,
      url: absoluteUrl(site, postPath(post.slug)),
    })),
  };
}

/* ==========================================================================
   People
   ========================================================================== */

/**
 * Person + ProfilePage for an author page. Google News weighs a resolvable
 * author entity as a direct E-E-A-T signal, and every NewsArticle's `author`
 * points at this node by @id.
 */
export function personSchema(
  site: SiteConfig,
  author: { name: string; slug: string; description?: string },
): JsonLdObject {
  const url = absoluteUrl(site, authorPath(author.slug));

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${url}#profile`,
    url,
    isPartOf: { '@id': ID.website(site) },
    mainEntity: {
      '@type': 'Person',
      '@id': ID.person(site, author.slug),
      name: author.name,
      url,
      ...(author.description ? { description: author.description } : {}),
      worksFor: { '@id': ID.organization(site) },
    },
  };
}

/* ==========================================================================
   FAQ — extracted, never fabricated
   ========================================================================== */

export interface FaqEntry {
  question: string;
  answer: string;
}

/**
 * FAQPage, emitted ONLY when an article body genuinely contains a
 * question-and-answer structure.
 *
 * Never invent FAQ content to win a rich result: it is a manual-action risk
 * and it lies to the reader. This returns null unless real Q/A pairs were
 * extracted from the rendered HTML, and the caller emits nothing when it does.
 */
export function faqSchema(site: SiteConfig, post: WPPost, entries: FaqEntry[]): JsonLdObject | null {
  if (entries.length < 2) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(site, postPath(post.slug))}#faq`,
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

/**
 * Pull genuine Q/A pairs out of sanitised article HTML.
 *
 * A heading only counts as a question when it actually ends in a question
 * mark, and it only counts as an entry when real prose follows it. Anything
 * looser would manufacture FAQs out of ordinary subheadings.
 */
export function extractFaqEntries(html: string | undefined | null): FaqEntry[] {
  if (!html) return [];

  const entries: FaqEntry[] = [];
  const pattern = /<h([23])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[23][^>]*>|$)/gi;

  for (const match of html.matchAll(pattern)) {
    const question = stripHtml(match[2]).trim();
    if (!question.endsWith('?')) continue;

    const answer = stripHtml(match[3]).trim();
    // A one-line answer is a subheading, not an FAQ.
    if (answer.length < 40) continue;

    entries.push({ question, answer: answer.slice(0, 500) });
  }

  return entries;
}

export { categoryPath };
