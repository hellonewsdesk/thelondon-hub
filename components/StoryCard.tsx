import Image from 'next/image';
import Link from 'next/link';
import type { SiteConfig } from '../config/sites';
import type { WPPost } from '../types/wp';
import { QUARANTINED_SLUGS } from '../config/category-overrides';
import {
  excerptText,
  getAuthor,
  getCategoriesFromPost,
  getFeaturedImage,
  getPrimaryCategory,
  postTitle,
  readingTime,
  type TermRef,
} from '../lib/wp-helpers';
import { postPath } from '../lib/urls';
import { formatRelative, isoDateTime } from '../lib/format';
import { sectionStyleVars } from './section-style';

export type StoryVariant = 'hero' | 'feature' | 'standard' | 'compact' | 'text';

interface StoryCardProps {
  post: WPPost;
  site: SiteConfig;
  variant?: StoryVariant;
  /**
   * Only the homepage hero lead and the article hero may set this. On the
   * `hero` variant it also marks the card as the BAND LEAD: the headline
   * steps up to the Anton display size (`card--hero-lead`) and becomes an
   * h2 — the two stacked secondaries stay Archivo h3s.
   */
  priority?: boolean;
  /** Feature is the only variant that carries a standfirst; false suppresses it. */
  showExcerpt?: boolean;
  /** Fixed "now" from the server render, so relative times cannot drift per card. */
  now: Date;
}

/**
 * The single story unit — docs/DESIGN.md § Cards.
 *
 * Contract points, all regression-guarded by StoryCard.test.ts:
 *
 *   1. ONE link per card. The stretched-link pattern: the headline anchor
 *      (`.card__link`) is the only `<a>`, and its ::after covers the card.
 *      The kicker is therefore a plain span and the image is NOT wrapped in
 *      a link — bwave's aria-hidden image-link is unnecessary here because
 *      there is no second link to hide. Card images stay `alt=""`: the real
 *      headline sits directly below on the same URL, so alt text would be
 *      announced twice AND paint over the layout when an image fails to load.
 *   2. The headline renders EXACTLY once — no aria-label/title duplication.
 *   3. No image → the colour-block card (`card--text`: section-colour plane,
 *      white Anton headline), never an `<img>`, never an empty grey frame.
 *      The one exception is `compact`, whose 96px thumb slot simply
 *      collapses — a full colour block at compact scale would fight the
 *      compact type ramp in CSS (rare path anyway: 99/100 recon posts carry
 *      an image).
 *   4. `priority` images also get fetchPriority='high': Next emits a
 *      <link rel=preload> for a priority image but does not mark it
 *      high-priority, so the browser still fetches it at default priority
 *      behind the preloaded scripts — Lighthouse's LCP-discovery audit
 *      fails on exactly this.
 *
 * Section colour rides in as the `--section-light`/`--section-dark` pair on
 * the card root (see components/section-style.ts); globals.css resolves
 * `var(--section)` from it per theme, and the chrome planes (hero band)
 * force the bright variant.
 */
export function StoryCard({
  post,
  site,
  variant = 'standard',
  priority = false,
  showExcerpt = true,
  now,
}: StoryCardProps) {
  // The explicit `text` variant is the colour block regardless of artwork.
  const image = variant === 'text' ? null : getFeaturedImage(post);
  const textLook = variant === 'text' || (image === null && variant !== 'compact');

  const category = kickerCategory(post);
  const title = postTitle(post);
  const href = postPath(post.slug);
  const author = getAuthor(post);
  const stamp = formatRelative(post.date, site.locale, now);
  // Listing queries never fetch `content` (slim-post empties it), so a
  // computed reading time would be a fabricated "1 min read" on every card.
  // Render it only when the body is actually present.
  const minutes = post.content?.rendered ? readingTime(post) : null;
  const excerpt =
    showExcerpt && (variant === 'feature' || (variant === 'hero' && priority))
      ? excerptText(post, 150) : '';

  const isHeroLead = variant === 'hero' && priority;

  const cardClass = [
    'card',
    variant === 'hero' ? 'card--hero' : '',
    isHeroLead ? 'card--hero-lead' : '',
    variant === 'feature' ? 'card--feature' : '',
    variant === 'compact' ? 'card--compact' : '',
    // Last so its rules (declared last in globals.css) own the imageless state.
    textLook ? 'card--text' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Display-scale headlines (Anton block, hero lead) are never clamped —
  // everything else clamps to 2 lines so a long headline cannot unbalance
  // a grid row.
  const headlineClass = isHeroLead ? 'card__headline' : 'card__headline clamp-3';

  // The band lead is the page's dominant headline; every other card headline
  // sits under a SectionHeading h2.
  const HeadlineTag = isHeroLead ? 'h2' : 'h3';

  const kicker = category ? (
    <span className="card__kicker">{category.name}</span>
  ) : null;

  const headline = (
    <HeadlineTag className={headlineClass}>
      <Link href={href} className="card__link">
        {title}
      </Link>
    </HeadlineTag>
  );

  const meta = (
    <p className="card__meta">
      {author ? (
        <>
          {author.name}
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      <time dateTime={isoDateTime(post.date)}>{stamp}</time>
      {minutes !== null ? (
        <>
          <span aria-hidden="true"> · </span>
          {minutes} min read
        </>
      ) : null}
    </p>
  );

  // ---- COMPACT: horizontal, 96px square thumb left, text right -----------
  if (variant === 'compact') {
    return (
      <article className={cardClass} style={sectionStyleVars(category?.slug)}>
        {image ? (
          <div className="card__media">
            <Image src={image.url} alt="" fill sizes="96px" />
          </div>
        ) : null}
        <div className="card__body">
          {kicker}
          {headline}
          {/* Time only: the compact slot has no room for the full meta row. */}
          <p className="card__meta">
            <time dateTime={isoDateTime(post.date)}>{stamp}</time>
          </p>
        </div>
      </article>
    );
  }

  // ---- HERO / FEATURE / STANDARD / TEXT -----------------------------------
  return (
    <article className={cardClass} style={sectionStyleVars(category?.slug)}>
      {image && !textLook ? (
        <div className="card__media">
          <Image
            src={image.url}
            alt=""
            fill
            priority={priority}
            fetchPriority={priority ? 'high' : undefined}
            sizes={mediaSizes(variant, isHeroLead)}
          />
        </div>
      ) : null}

      <div className="card__body">
        {kicker}
        {headline}
        {excerpt ? <p className="card__standfirst clamp-2">{excerpt}</p> : null}
        {meta}
      </div>
    </article>
  );
}

/**
 * Measured, not guessed (container 1200px − 48px gutters = 1152px well):
 *   hero lead      2fr of 3fr  ≈ 760px → DESIGN.md prescribes 66vw
 *   hero secondary 1fr of 3fr  ≈ 380px
 *   feature        7 of 12 cols in grid-latest ≈ 660px (its widest slot)
 *   standard       widest slot ≈ 380px; 2-up between 640–900
 * Rounded UP: over-requesting costs a few lazy KB, under-requesting is
 * permanently blurry.
 */
function mediaSizes(variant: StoryVariant, isHeroLead: boolean): string {
  if (variant === 'hero') {
    return isHeroLead
      ? '(max-width: 900px) 100vw, 66vw'
      : '(max-width: 899px) 100vw, 380px';
  }
  if (variant === 'feature') return '(max-width: 899px) 100vw, 660px';
  return '(max-width: 639px) 100vw, (max-width: 899px) 50vw, 380px';
}

/**
 * First category on the post, skipping quarantined meta-categories: a story
 * syndicated into `google-news` must wear its real section on the kicker,
 * never the syndication bucket. If the post carries ONLY a quarantined
 * category we still show it — a truthful kicker beats a missing one.
 */
function kickerCategory(post: WPPost): TermRef | null {
  const primary = getPrimaryCategory(post);
  if (!primary || !QUARANTINED_SLUGS.has(primary.slug)) return primary;
  const alternative = getCategoriesFromPost(post).find(
    (term) => !QUARANTINED_SLUGS.has(term.slug),
  );
  return alternative ?? primary;
}
