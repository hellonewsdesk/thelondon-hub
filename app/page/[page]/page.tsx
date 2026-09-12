import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getCurrentSite } from '../../../lib/site';
import { getPosts } from '../../../lib/wp';
import { buildMetadata, paginationRobots } from '../../../lib/seo';
import { homePagePath } from '../../../lib/urls';
import { ArchiveView } from '../../home-view';

// Same window as the front page: /page/N/ is its river.
export const revalidate = 900;
export const dynamicParams = true;

const PER_PAGE = 12;

function parsePage(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page: rawPage } = await params;
  const page = parsePage(rawPage);
  const site = await getCurrentSite();

  return buildMetadata({
    site,
    title: `All stories — page ${page}`,
    description: `Page ${page} of news, sport and culture from ${site.name}.`,
    // Self-canonical, NOT canonical-to-page-1: pages 2+ are distinct
    // resources, and collapsing them hides deep archive posts from discovery.
    path: homePagePath(page),
    robots: paginationRobots(page),
  });
}

export default async function HomePaginated({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: rawPage } = await params;
  const page = parsePage(rawPage);

  // /page/1/ is a duplicate of the front page.
  if (page === 1) redirect('/');

  const site = await getCurrentSite();
  const { posts, totalPages } = await getPosts(site, { perPage: PER_PAGE, page });

  // Paging past the end is a real 404, not an empty page — it stops crawlers
  // wandering into infinite pagination.
  if (posts.length === 0) notFound();

  return <ArchiveView site={site} posts={posts} page={page} totalPages={totalPages} />;
}
