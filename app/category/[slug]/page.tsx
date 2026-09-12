import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getCurrentSite } from '@/lib/site';
import { DEFAULT_SITE } from '@/config/sites';
import { getCategoryBySlug, getPosts, REVALIDATE_SECONDS } from '@/lib/wp';
import { getCategories } from '@/lib/wp-cache';
import { buildMetadata, INDEX_FOLLOW, isCategoryIndexable, NOINDEX_FOLLOW } from '@/lib/seo';
import { taxonomySlugs } from '@/config/taxonomy';
import { categoryPath } from '@/lib/urls';
import { CategoryView, categoryDescription, categoryTitleLabel } from './category-view';

// 3h, the pipeline cadence. The getPosts call below passes the SAME window
// down so the data underneath actually refreshes with the page.
export const revalidate = 10800;
export const dynamicParams = true;

const PER_PAGE = 12;

/** Prebuild only the curated set — the only category pages that earn index
 *  slots, so the only ones worth build-time renders. Everything else renders
 *  on first request (dynamicParams) and caches for 3h. */
export async function generateStaticParams() {
  try {
    // No request context at build time, so getCurrentSite() is unusable
    // here — prebuilt params come from the default tenant only.
    const categories = await getCategories(DEFAULT_SITE);
    const kept = taxonomySlugs(DEFAULT_SITE);
    return categories
      .filter((c) => kept.has(c.slug))
      .map((c) => ({ slug: c.slug }));
  } catch {
    // A slow or unreachable origin must never fail the build.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCurrentSite();
  const category = await getCategoryBySlug(site, slug);

  if (!category) {
    return { title: 'Section not found', robots: NOINDEX_FOLLOW };
  }


  return buildMetadata({
    site,
    title: categoryTitleLabel(category),
    description: categoryDescription(site, category),
    path: categoryPath(category.slug),
    // Indexable only when the category is in the curated taxonomy AND has
    // real depth — depth alone is not an editorial decision (google-news
    // holds 32 posts and stays out), and thin categories are a liability.
    robots: isCategoryIndexable(site, category) ? INDEX_FOLLOW : NOINDEX_FOLLOW,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const site = await getCurrentSite();
  const category = await getCategoryBySlug(site, slug);

  if (!category) notFound();

  const query = await searchParams;
  const forceNoImage = query['no-images'] === '1';

  const { posts, totalPages, total } = await getPosts(site, {
    perPage: PER_PAGE,
    categoryId: category.id,
    // Fetch-window passthrough: the same 3h window this route exports. The
    // default happens to match, but stating it keeps the invariant loud —
    // recomposing a page over a mismatched fetch window silently serves
    // stale data (a shipped bug on the sibling build).
    revalidate: REVALIDATE_SECONDS,
  });

  return (
    <CategoryView
      site={site}
      category={category}
      posts={posts}
      page={1}
      totalPages={totalPages}
      total={total}
      forceNoImage={forceNoImage}
    />
  );
}
