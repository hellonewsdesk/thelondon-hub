# The London Hub

Headless-WordPress front end for [thelondonhub.co.uk](https://thelondonhub.co.uk),
built on Next.js 15 App Router. WordPress stays the CMS and database; this app is a
**read-only consumer** of its REST API. Nothing here ever writes to WordPress.

Site 2 of the network. Multi-tenant from day one: `config/sites.ts` is keyed by hostname
and is **the only file allowed to name a specific site**. Adding site 3 is one entry.

- Design contract: [`docs/DESIGN.md`](docs/DESIGN.md)
- Live recon report: [`data/recon-report.txt`](data/recon-report.txt)

## Setup

```bash
npm install --legacy-peer-deps    # vitest 5 / puppeteer-core peer conflict
cp .env.example .env.local        # then fill in the two secrets
npm run dev
```

Three env vars, and **no page or route may require any other**
(`npm run test:nokeys` enforces this):

| var | purpose |
|---|---|
| `REVALIDATE_SECRET` | guards `/api/revalidate/`, called by a WP `publish_post` hook |
| `INDEXNOW_KEY` | 32 hex chars; served at `/<key>.txt` |
| `NEXT_PUBLIC_DEFAULT_HOST` | site to use when there is no Host header (dev, CLI, build) |

WP API bases are **not** env vars — they live in `config/sites.ts`, resolved per-request
from the incoming Host header.

## Verified state

Production build, 27 routes, `NEXT_DIST_DIR=.next-verify`:

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean |
| `npm run test` | 17 passed |
| `npm run seo:check` | 5 URLs, no errors |
| `npm run seo:schema` | 0 errors (5 warnings — see below) |
| `npm run perf:check` | 22 / 34 / 25 ms median, budget 200 ms |
| `npm run test:nokeys` | passed |

Lighthouse, desktop preset, warm:

| page | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Home | 99 | 100 | 100 | 100 | 0.9 s | 0.002 | 0 ms |
| Category | 100 | 100 | 100 | 100 | 0.6 s | 0.002 | 0 ms |
| Article | 100 | 100 | 100 | 100 | 0.7 s | 0.002 | 0 ms |

## Regression guards

Every one of these exists because it caught a real bug in the Birmingham sibling.
Do not delete one without reading why it is there.

| command | what it protects |
|---|---|
| `npm run smoke` | full live recon report — run before relaxing any fetch cap |
| `npm run perf:check` | 200 ms warm budget on home, article, category |
| `npm run seo:check` | on-page SEO incl. the doubled-site-name title bug |
| `npm run seo:schema` | JSON-LD `@graph` completeness |
| `npm run urls:fetch` | rebuilds `data/wp-url-inventory.json` from live WP |
| `npm run cat:audit` | proposes long-tail category merges (drives redirects only) |
| `npm run test:nokeys` | no page needs a key, a call or an extra env var |
| `npm run indexnow:keys` | runs in `prebuild` |

Plus two build-time asserts: the 1.5 MB `unstable_cache` ceiling in `lib/cached.ts`
(Next silently refuses to cache over 2 MB — this cost Birmingham 8.5 s of TTFB with no
error) and `distDir` separation, so a dev server can never overwrite a production build.

## Deploying to Vercel

Set the three env vars from `.env.example` in **Project Settings → Environment Variables**
(all three environments). `NEXT_PUBLIC_DEFAULT_HOST` must stay `thelondonhub.co.uk` so a
preview URL with no matching Host header still resolves a site from `config/sites.ts`.

Two settings exist specifically for this deployment:

- **`vercel.json` sets `maxDuration: 60`.** The WordPress origin answers a cold
  `12 posts + _embed` in ~11.8 s, which is over Vercel's 10 s default. Every route that
  regenerates through ISR would otherwise be one slow origin response away from a 504.
- **`serverExternalPackages: ['isomorphic-dompurify']`** in `next.config.ts` keeps jsdom
  out of the webpack bundle and requires it at runtime instead, which is how the package
  expects to be loaded.

After the first deploy, check an **article** URL, not just the homepage — the article
route is the only one that touches the sanitiser, and it is the route that broke on the
Birmingham sibling. Also check a deliberately nonexistent slug: it must return **404**,
not 500. A 500 there means the route module failed to load, and the real error will be in
**Vercel → Deployment → Runtime Logs** (filter to `/[slug]`).

## Known issues

**Image optimizer can 500 on a cold origin.** The WordPress origin (LiteSpeed) is slow
on first byte — 11.8 s for 12 posts with `_embed`, and image requests behave the same.
Under parallel load against a cold cache, `/_next/image` occasionally exceeds its
upstream fetch timeout and returns 500, which shows as a broken image for that one
visitor. It self-heals: `minimumCacheTTL` is 7 days, and a retry served the same image
in 4.5 s. Behind a CDN this should not surface. If it does, the fix is at the origin
(page cache / image CDN), not here — Next exposes no config for the optimizer's
upstream timeout.

**Five `NewsMediaOrganization` warnings are expected.** `publishingPrinciples`,
`correctionsPolicy`, `ethicsPolicy`, `diversityPolicy` and `actionableFeedbackPolicy`
are omitted because London's WordPress has no editorial-policy or corrections page. A
policy URL that 404s is worse than an absent property. They resolve when those pages
exist.

## Publisher-blocked

Nothing here is invented, so these stay empty or `[TODO]` until the publisher supplies
them: `legalName`, `addressLine`, `postalCode`, `companyNumber`, `icoRegistration`
(`config/sites.ts`), the AI-production disclosure, and sign-off on the curated taxonomy
descriptions. Filling any field in `config/sites.ts` makes it appear on About, Contact,
Privacy, Terms and in the footer at once.

`data/category-merge-plan.json` proposes 61 merges of the 104 live categories (70 hold
one post) with `google-news` quarantined. **Merges are executed in WordPress after
publisher review** — this repo only ever generates the redirects.

## Not ported from Birmingham

The `/tools/` system, and the `/corrections/` and `/editorial-policy/` routes — London's
WordPress has no such pages, and inventing a URL is not an option. Live static pages are
exactly: `/about-us/`, `/contact-us/`, `/privacy-policy/`, `/terms-conditions/`,
`/disclaimer/`, `/all-post/`.
