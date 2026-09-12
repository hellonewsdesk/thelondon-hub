import { unstable_cache } from 'next/cache';

/**
 * The ONLY sanctioned way to use unstable_cache in this codebase.
 *
 * Exists because Next's data cache refuses entries over 2MB and does it
 * SILENTLY — the write fails, the log line is easy to miss, and the cached
 * function simply re-runs on every request. On the Birmingham sibling of
 * this network that failure mode put 6.9MB of homepage composition past the
 * limit and produced an 8.5-second TTFB with no error anywhere. This wrapper
 * measures every payload and fails loudly instead.
 *
 * Thresholds:
 *   - WARN_BYTES  (1MB):   console.warn naming the key — headroom is shrinking.
 *   - LIMIT_BYTES (1.5MB): throw, naming the key and the size. Deliberately
 *     under Next's 2MB so the failure is ours, explicit and attributable,
 *     never Next's silent one. The throw fires wherever the cache fills —
 *     during `next build` prerendering, or at runtime on first request, where
 *     the route's error boundary catches it. A crashed page is the requested
 *     behaviour: "I want it loud."
 */

const WARN_BYTES = 1_000_000;
const LIMIT_BYTES = 1_500_000;

export function cachedJson<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] },
): (...args: TArgs) => Promise<TResult> {
  const measured = async (...args: TArgs): Promise<TResult> => {
    const result = await fn(...args);

    const bytes = Buffer.byteLength(JSON.stringify(result) ?? '', 'utf8');
    const key = keyParts.join('/');

    if (bytes > LIMIT_BYTES) {
      throw new Error(
        `cachedJson: payload for cache key "${key}" is ${(bytes / 1_000_000).toFixed(2)}MB, ` +
          `over the ${(LIMIT_BYTES / 1_000_000).toFixed(1)}MB ceiling. Next would refuse to ` +
          `cache this silently at 2MB and the function would re-run on every request ` +
          `(the 8.5s-TTFB homepage bug). Slim the payload — see lib/slim-post.ts for the pattern.`,
      );
    }

    if (bytes > WARN_BYTES) {
      console.warn(
        `cachedJson: payload for cache key "${key}" is ${(bytes / 1_000_000).toFixed(2)}MB — ` +
          `approaching the ${(LIMIT_BYTES / 1_000_000).toFixed(1)}MB ceiling. Slim it before it fails the build.`,
      );
    }

    return result;
  };

  return unstable_cache(measured, keyParts, options);
}
