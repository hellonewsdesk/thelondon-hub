import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE } from '../config/sites';
import { getPosts, WPError } from './wp';

afterEach(() => vi.restoreAllMocks());

describe('WordPress listing recovery', () => {
  it('retries a timed-out embed request without losing filters or pagination', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 42 }]), {
        headers: { 'X-WP-Total': '24', 'X-WP-TotalPages': '2' },
      }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await getPosts(DEFAULT_SITE, {
      page: 2, perPage: 12, categoryId: 7, search: 'London', revalidate: 900,
    });
    expect(result).toEqual({ posts: [{ id: 42 }], total: 24, totalPages: 2 });
    const first = new URL(String(fetcher.mock.calls[0][0]));
    const retry = new URL(String(fetcher.mock.calls[1][0]));
    expect(first.searchParams.get('_embed')).toBe('author,wp:featuredmedia,wp:term');
    expect(first.searchParams.get('_fields')).toContain('_embedded');
    expect(retry.searchParams.has('_embed')).toBe(false);
    first.searchParams.delete('_embed');
    expect(retry.href).toBe(first.href);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ next: { revalidate: 900 } });
  });

  it('does not turn invalid parameters into an empty publication', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ code: 'rest_invalid_param' }), { status: 400 },
    ));
    await expect(getPosts(DEFAULT_SITE)).rejects.toBeInstanceOf(WPError);
  });

  it('still accepts an out-of-range page as empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ code: 'rest_post_invalid_page_number' }), { status: 400 },
    ));
    await expect(getPosts(DEFAULT_SITE, { page: 99 })).resolves.toEqual({
      posts: [], total: 0, totalPages: 0,
    });
  });

  it('propagates an outage when the plain request also fails', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(getPosts(DEFAULT_SITE)).rejects.toThrow('fetch failed');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
