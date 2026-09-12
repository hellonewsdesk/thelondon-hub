import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE } from '../config/sites';
import type { WPPost } from '../types/wp';

vi.mock('./cached.ts', () => ({ cachedJson: vi.fn((fn) => fn) }));
// vi.mock replaces the WHOLE module, so the factory has to cover every export
// anything in getHomepage's import graph reaches for — not just what
// homepage.ts itself calls. It pulls getCategories from wp-cache.ts, which
// imports getCategoriesUncached and hydratePostImages from here; omitting them
// made vitest throw "No export is defined on the mock" instead of running the
// availability assertions.
vi.mock('./wp.ts', () => ({
  getPosts: vi.fn(),
  getCategoryBySlug: vi.fn(),
  getCategoriesUncached: vi.fn(async () => []),
  hydratePostImages: vi.fn(async (_site: unknown, posts: unknown) => posts),
  LIST_FIELDS: 'id',
}));

import { getPosts } from './wp';
import { cachedJson } from './cached';
import { getHomepage } from './homepage';

const site = { ...DEFAULT_SITE, homepageSections: [] };
const story = {
  id: 1, slug: 'latest', title: { rendered: 'Latest story' },
  date: '2026-09-12T10:00:00', modified: '2026-09-12T10:00:00',
} as WPPost;

afterEach(() => vi.clearAllMocks());

describe('homepage availability', () => {
  it('rejects a failed newest page rather than caching a false empty state', async () => {
    vi.mocked(getPosts).mockRejectedValue(new Error('WordPress unavailable'));
    await expect(getHomepage(site)).rejects.toThrow('WordPress unavailable');
  });

  it('renders recent stories when an older page fails', async () => {
    vi.mocked(getPosts).mockImplementation(async (_site, options) => {
      if (options?.page !== 1) throw new Error('Older page timed out');
      return { posts: [story], total: 1, totalPages: 1 };
    });
    const result = await getHomepage(site);
    expect(result.lead?.id).toBe(1);
    expect(result.ordered.map((post) => post.id)).toEqual([1]);
  });

  it('uses a stable cache key across refresh windows', async () => {
    vi.mocked(getPosts).mockResolvedValue({ posts: [], total: 0, totalPages: 0 });
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(0);
    await getHomepage(site);
    clock.mockReturnValue(1_800_000);
    await getHomepage(site);
    // Filter to the homepage's own cache entry. wp-cache.ts also goes through
    // cachedJson (key 'wp-categories'), so the raw call list interleaves two
    // call sites and comparing calls[0] to calls[1] compared different entries
    // from the SAME invocation rather than one entry across two windows.
    const keys = vi
      .mocked(cachedJson)
      .mock.calls.map((call) => call[1])
      .filter((keyParts) => String(keyParts?.[0]).startsWith('homepage-'));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toEqual(keys[1]);
    clock.mockRestore();
  });
});
