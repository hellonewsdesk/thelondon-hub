import Link from 'next/link';
import { getCurrentSite } from '../lib/site';
import { getPosts } from '../lib/wp';
import type { WPPost } from '../types/wp';
import { StoryCard } from '../components/StoryCard';
import { SearchForm } from '../components/SearchForm';
import { SectionHeading } from '../components/SectionHeading';

/**
 * An editorial 404, not a dead end.
 *
 * A reader landing here arrived from a stale link or a mistyped URL — the
 * useful response is a route back into the paper, so this page carries a
 * search box, the section list and live stories. It is also the notFound()
 * target for the article, category, author and pagination routes.
 */
export default async function NotFound() {
  const site = await getCurrentSite();
  const now = new Date();

  let posts: WPPost[] = [];
  try {
    const result = await getPosts(site, { perPage: 6 });
    posts = result.posts;
  } catch {
    // The 404 must render even when the origin is down.
  }

  return (
    <div className="container py-12">
      <header style={{ maxWidth: '44rem' }}>
        <p className="kicker">Error 404</p>
        <h1 className="h-lead mt-2">We can&rsquo;t find that page</h1>
        <p className="standfirst mt-4">
          The story may have been moved or removed, or the address may be
          mistyped. Try a search, or pick up today&rsquo;s coverage below.
        </p>

        <div className="mt-6" style={{ maxWidth: '26rem' }}>
          <SearchForm />
        </div>

        <nav aria-label="Sections" className="mt-6">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 list-none m-0 p-0">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="kicker">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {posts.length > 0 ? (
        <section className="home-section" aria-labelledby="notfound-stories">
          <SectionHeading
            title="Today's stories"
            id="notfound-stories"
            href="/"
            moreLabel="All"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <StoryCard key={post.id} site={site} post={post} variant="standard" now={now} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
