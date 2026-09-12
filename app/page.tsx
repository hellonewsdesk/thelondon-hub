import type { Metadata } from 'next';
import { getCurrentSite } from '../lib/site';
import { getHomepage } from '../lib/homepage';
import { getCategories } from '../lib/wp-cache';
import { buildMetadata } from '../lib/seo';
import type { WPCategory } from '../types/wp';
import { HomeView } from './home-view';

// 15 minutes: the front page has to move faster than an article, which sits
// on the 3h pipeline cadence. lib/homepage.ts passes this same window down to
// its getPosts calls — recomposing a 15-minute page over 3h-stale fetches
// silently defeats the promise (a shipped bug on the Birmingham sibling).
export const revalidate = 900;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return buildMetadata({
    site,
    // The site name and tagline, never the word "Home".
    title: `${site.name} — ${site.tagline}`,
    description: `Breaking news, sport, business and culture from ${site.city} and ${site.region}. Updated throughout the day by ${site.name}.`,
    path: '/',
  });
}

export default async function HomePage() {
  const site = await getCurrentSite();

  // The composed page and the category list for the chip rail, in parallel.
  // The chip rail is decoration by comparison — a failed category fetch
  // costs the chips, never the front page.
  const [data, categories] = await Promise.all([
    getHomepage(site),
    getCategories(site).catch(() => [] as WPCategory[]),
  ]);

  return <HomeView site={site} data={data} categories={categories} />;
}
