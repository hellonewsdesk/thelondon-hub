import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getCurrentSite } from '@/lib/site';
import { getCategoryBySlug, getPosts, REVALIDATE_SECONDS } from '@/lib/wp';
import { buildMetadata, paginationRobots } from '@/lib/seo';
import { categoryPagePath, categoryPath } from '@/lib/urls';
import { CategoryView, categoryDescription, categoryDisplayName, categoryTitleLabel } from '../../category-view';

// Same 3h window as the category index; passed down to getPosts below.
export const revalidate = 10800;
export const dynamicParams = true;

const PER_PAGE = 12;

function parsePage(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);
  const site = await getCurrentSite();
  const category = await getCategoryBySlug(site, slug);

  if (!category) {
    return { title: 'Section not found', robots: { index: false, follow: true } };
  }

  const name = categoryDisplayName(category);

  return buildMetadata({
    site,
    title: `${categoryTitleLabel(category)} — page ${page}`,
    description: `Page ${page} of ${name.toLowerCase()} coverage from ${site.name}. ${categoryDescription(site, category)}`,
    // Self-canonical, NOT canonical-to-page-1: pages 2+ are distinct
    // resources, and collapsing them hides deep archive posts from discovery.
    path: categoryPagePath(category.slug, page),
    robots: paginationRobots(page),
  });
}

export default async function CategoryPaginatedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, page: rawPage } = await params;
  const page = parsePage(rawPage);

  // /page/1/ is a duplicate of the bare category URL.
  if (page === 1) redirect(categoryPath(slug));

  const site = await getCurrentSite();
  const category = await getCategoryBySlug(site, slug);
  if (!category) notFound();

  const query = await searchParams;
  const forceNoImage = query['no-images'] === '1';

  const { posts, totalPages, total } = await getPosts(site, {
    perPage: PER_PAGE,
    page,
    categoryId: category.id,
    // Fetch-window passthrough — same value this route exports as revalidate.
    revalidate: REVALIDATE_SECONDS,
  });

  // Paging past the end is a 404, not an empty page — it stops crawlers
  // wandering into infinite pagination.
  if (posts.length === 0) notFound();

  return (
    <CategoryView
      site={site}
      category={category}
      posts={posts}
      page={page}
      totalPages={totalPages}
      total={total}
      forceNoImage={forceNoImage}
    />
  );
}
